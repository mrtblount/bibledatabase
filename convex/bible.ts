import { makeFunctionReference } from "convex/server";
import { action, mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { parseReference, searchPassages } from "../shared/search";
import { evaluationCases } from "../shared/evaluation";

const translationArg = { translation: v.string() };
const limitOf = (n: number | undefined, fallback = 20) => Math.max(1, Math.min(n ?? fallback, 100));
const asVerse = (row: any) => ({ ...row, ref: row.reference });
const normalizeTranslation = (s: string) => s.trim().toUpperCase();
function requireSession(sessionId: string) {
  if (!/^[a-zA-Z0-9_-]{24,128}$/.test(sessionId)) throw new Error("A valid private workspace session is required.");
}
function requireAdmin(key: string) {
  const expected = process.env.CONVEX_ADMIN_KEY;
  if (!expected || key !== expected) throw new Error("An administrator key is required for this operation.");
}
async function readChapter(ctx: any, translation: string, book: string, chapter: number) {
  return await ctx.db.query("verses").withIndex("by_chapter", (q: any) => q.eq("translation", normalizeTranslation(translation)).eq("book", book).eq("chapter", chapter)).take(200);
}
async function readReference(ctx: any, translation: string, ref: string) {
  const parsed = parseReference(ref);
  if (!parsed) return [];
  const rows = await readChapter(ctx, translation, parsed.book, parsed.chapter);
  return rows.filter((r: any) => (!parsed.verseStart || r.verse >= parsed.verseStart) && (!parsed.verseEnd || r.verse <= parsed.verseEnd) && (!parsed.verseStart || parsed.verseEnd || r.verse === parsed.verseStart));
}

export const translations = query({ args: {}, handler: async (ctx) => (await ctx.db.query("translations").collect()).sort((a, b) => a.name.localeCompare(b.name)) });
export const books = query({ args: translationArg, handler: async (ctx, args) => (await ctx.db.query("books").withIndex("by_translation", (q) => q.eq("translation", normalizeTranslation(args.translation))).take(100)).sort((a, b) => a.order - b.order) });
export const chapter = query({ args: { ...translationArg, book: v.string(), chapter: v.number() }, handler: async (ctx, args) => (await readChapter(ctx, args.translation, args.book, args.chapter)).map(asVerse) });
export const passage = query({ args: { ...translationArg, ref: v.string() }, handler: async (ctx, args) => (await readReference(ctx, args.translation, args.ref)).map(asVerse) });
export const stats = query({ args: {}, handler: async (ctx) => {
  const [translations, passages, expansions, entities, counters] = await Promise.all([
    ctx.db.query("translations").collect(), ctx.db.query("passages").take(2000), ctx.db.query("expansions").take(10000), ctx.db.query("entities").take(2000), ctx.db.query("datasetStats").collect(),
  ]);
  const count = { ...Object.assign({}, ...counters), ...Object.fromEntries(counters.filter((row) => row.value !== undefined).map((row) => [row.key, row.value])) };
  return { translations: translations.length, verses: count.verses ?? translations.reduce((n, t) => n + t.verseCount, 0), passages: count.passages ?? passages.length, expansions: count.expansions ?? expansions.length, crossReferences: count.crossReferences ?? 0, entities: count.entities ?? entities.length };
} });

export const search = query({ args: { q: v.string(), translation: v.string(), mode: v.optional(v.union(v.literal("layer"), v.literal("literal"))), limit: v.optional(v.number()) }, handler: async (ctx, args) => {
  const q = args.q.trim().slice(0, 500);
  if (!q) return { results: [], route: "empty" };
  const translation = normalizeTranslation(args.translation);
  const limit = limitOf(args.limit);
  const parsed = parseReference(q);
  if (parsed) {
    const verses = await readReference(ctx, translation, q);
    return { route: "reference", results: verses.slice(0, limit).map((row: any) => ({ ref: row.reference, title: row.reference, text: row.text, book: row.book, chapter: row.chapter, verse: row.verse, endVerse: row.verse, score: 1, reason: "Direct canonical reference", tags: [], translation })) };
  }
  const literalRows = await ctx.db.query("verses").withSearchIndex("search_text", (s) => s.search("text", q).eq("translation", translation)).take(limit);
  const literal = literalRows.map((row, index) => ({ ref: row.reference, title: row.reference, text: row.text, book: row.book, chapter: row.chapter, verse: row.verse, endVerse: row.verse, score: 1 / (index + 1), reason: "Matches the words in the selected translation", tags: [] as string[], translation }));
  if (args.mode === "literal") return { results: literal, route: "literal" };
  const approvedCandidates = await ctx.db.query("expansions").withSearchIndex("search_text", (s) => s.search("text", q).eq("status", "approved")).take(Math.min(limit * 3, 100));
  const supersededEntries = new Set(approvedCandidates.flatMap((entry) => entry.provenance?.priorEntryIds ?? []));
  const versionGroups = await Promise.all([...new Set(approvedCandidates.map((entry) => entry.passageRef))].map(async (ref) => {
    const versions = await ctx.db.query("expansions").withIndex("by_ref", (index) => index.eq("passageRef", ref)).order("desc").take(200);
    const active = new Map<string, typeof versions[number]>();
    for (const version of versions.filter((row) => row.status === "approved" && !row.supersededBy).sort((a, b) => (b.createdAt ?? b._creationTime) - (a.createdAt ?? a._creationTime))) {
      const key = `${version.translation}:${version.type}`;
      if (!active.has(key)) active.set(key, version);
    }
    return [...active.values()].map((row) => String(row._id));
  }));
  const activeIds = new Set(versionGroups.flat());
  const approved = approvedCandidates.filter((entry) => activeIds.has(String(entry._id)) && !entry.supersededBy && !supersededEntries.has(entry.provenance?.entryId)).slice(0, limit);
  const expanded = await Promise.all(approved.map(async (expansion, index) => {
    const verses = await readReference(ctx, translation, expansion.passageRef);
    if (!verses.length) return null;
    const first = verses[0];
    return { ref: expansion.passageRef, title: expansion.passageRef, text: verses.map((r: any) => r.text).join(" "), book: first.book, chapter: first.chapter, verse: first.verse, endVerse: verses[verses.length - 1].verse, score: 2 / (index + 1), reason: `Matched an approved ${expansion.type} expansion`, tags: expansion.tags ?? [], translation, context: expansion.text, provenance: expansion.provenance };
  }));
  const curated = searchPassages(q, limit);
  const grounded = await Promise.all(curated.map(async (p: any) => {
    const verses = await readReference(ctx, translation, p.reference);
    if (!verses.length) return null;
    return { ref: p.reference, title: p.title, text: verses.map((r: any) => r.text).join(" "), book: p.book, chapter: p.chapter, verse: p.verseStart, endVerse: p.verseEnd, score: p.score, reason: p.matchReason, tags: p.topics ?? [], speaker: p.speaker, context: p.context, translation, cautions: p.cautions ?? [], provenance: p.provenance };
  }));
  const seen = new Set<string>();
  const conceptResults = [...expanded, ...grounded].filter((row) => {
    if (!row || seen.has(row.ref)) return false;
    seen.add(row.ref);
    return true;
  }).filter((row): row is NonNullable<typeof row> => row !== null);
  const covered = new Set(conceptResults.flatMap((r) => Array.from({ length: r.endVerse - r.verse + 1 }, (_, i) => `${r.book}.${r.chapter}.${r.verse + i}`)));
  return { results: [...conceptResults, ...literal.filter((r) => !covered.has(r.ref))].slice(0, limit), route: conceptResults.length ? "layer" : "literal" };
} });

export const listPassages = query({ args: {}, handler: async (ctx) => await ctx.db.query("passages").take(500) });
export const listExpansions = query({ args: {}, handler: async (ctx) => await ctx.db.query("expansions").order("desc").take(1000) });
export const reviewExpansion = mutation({ args: { id: v.id("expansions"), status: v.union(v.literal("draft"), v.literal("approved"), v.literal("rejected")), adminKey: v.string() }, handler: async (ctx, args) => {
  requireAdmin(args.adminKey);
  const row = await ctx.db.get(args.id);
  if (!row) throw new Error("Expansion not found.");
  if (args.status === "approved") {
    const versions = await ctx.db.query("expansions").withIndex("by_ref", (q) => q.eq("passageRef", row.passageRef)).take(1000);
    for (const previous of versions.filter((r) => r._id !== row._id && r.translation === row.translation && r.type === row.type && r.status === "approved" && !r.supersededBy)) {
      await ctx.db.patch(previous._id, { supersededBy: String(row._id) });
    }
  }
  await ctx.db.patch(args.id, { status: args.status, ...(args.status === "approved" ? { supersededBy: undefined } : {}) });
  return { ...row, status: args.status };
} });
export const saved = query({ args: { sessionId: v.string() }, handler: async (ctx, { sessionId }) => { requireSession(sessionId); return await ctx.db.query("savedPassages").withIndex("by_session", (q) => q.eq("sessionId", sessionId)).order("desc").take(500); } });
export const toggleSaved = mutation({ args: { sessionId: v.string(), ref: v.string(), translation: v.string(), note: v.optional(v.string()) }, handler: async (ctx, args) => {
  requireSession(args.sessionId);
  if (args.ref.length > 120 || (args.note?.length ?? 0) > 20000) throw new Error("Reference or note is too long.");
  const translation = normalizeTranslation(args.translation);
  const existing = await ctx.db.query("savedPassages").withIndex("by_session_ref", (q) => q.eq("sessionId", args.sessionId).eq("translation", translation).eq("ref", args.ref)).unique();
  if (existing) { await ctx.db.delete(existing._id); return { saved: false }; }
  const existingNotes = await ctx.db.query("savedPassages").withIndex("by_session", (q) => q.eq("sessionId", args.sessionId)).take(500);
  if (existingNotes.length >= 500) throw new Error("This workspace has reached the 500-passage limit. Remove a saved passage to add another.");
  const verses = await readReference(ctx, translation, args.ref);
  if (!verses.length) throw new Error("This passage is unavailable in the selected translation.");
  const id = await ctx.db.insert("savedPassages", { sessionId: args.sessionId, ref: args.ref, translation, note: args.note ?? "", text: verses.map((r: any) => r.text).join(" "), title: args.ref, createdAt: Date.now() });
  return { saved: true, id };
} });
export const saveNote = mutation({ args: { sessionId: v.string(), id: v.id("savedPassages"), note: v.string() }, handler: async (ctx, args) => {
  requireSession(args.sessionId);
  if (args.note.length > 20000) throw new Error("Notes must be under 20,000 characters.");
  const row = await ctx.db.get(args.id);
  if (!row || row.sessionId !== args.sessionId) throw new Error("Saved passage not found in this workspace.");
  await ctx.db.patch(args.id, { note: args.note });
} });

export const graph = query({ args: { ref: v.string() }, handler: async (ctx, args) => {
  const parsed = parseReference(args.ref);
  const ref = parsed ? `${parsed.book}.${parsed.chapter}.${parsed.verseStart ?? 1}` : args.ref;
  const [outgoing, incoming, entityLinks] = await Promise.all([
    ctx.db.query("crossReferences").withIndex("by_from", (q) => q.eq("from", ref)).take(24),
    ctx.db.query("crossReferences").withIndex("by_to", (q) => q.eq("to", ref)).take(12),
    ctx.db.query("entityReferences").withIndex("by_reference", (q) => q.eq("reference", ref)).take(30),
  ]);
  const entities = await Promise.all([...new Set(entityLinks.map((r) => r.entityId))].slice(0, 12).map((id) => ctx.db.query("entities").withIndex("by_identifier", (q) => q.eq("id", id)).unique()));
  const refs = [...outgoing, ...incoming];
  const ids = new Set([ref, ...refs.flatMap((r) => [r.from, r.to])]);
  const nodes: { id: string; label: string; type: string }[] = [...ids].map((id) => ({ id, label: id === ref ? args.ref : id, type: id === ref ? "selected" : "verse" }));
  const edges = refs.map((r) => ({ source: r.from, target: r.to, label: r.label, weight: r.weight }));
  for (const entity of entities.filter((e): e is NonNullable<typeof e> => e !== null).slice(0, 12)) {
    nodes.push({ id: `entity:${entity.id}`, label: entity.name, type: entity.type });
    edges.push({ source: ref, target: `entity:${entity.id}`, label: "mentions", weight: 1 });
  }
  return { nodes, edges, references: refs.map((r) => ({ ...r, ref: r.from === ref ? r.to : r.from })) };
} });

export const evaluations = query({ args: {}, handler: async (ctx) => await ctx.db.query("evaluationRuns").order("desc").take(20) });
function overlapsReference(actual: string, expected: string) {
  const a = parseReference(actual), b = parseReference(expected);
  if (!a || !b) return actual === expected;
  return a.book === b.book && a.chapter === b.chapter && (a.verseStart ?? 1) <= (b.verseEnd ?? b.verseStart ?? 200) && (b.verseStart ?? 1) <= (a.verseEnd ?? a.verseStart ?? 200);
}
export const runEvaluation = action({ args: {}, handler: async (ctx) => {
  const start = Date.now();
  const results: any[] = [];
  const cases = evaluationCases.slice(0, 60);
  for (let index = 0; index < cases.length; index += 5) {
    const batch = await Promise.all(cases.slice(index, index + 5).map(async (test: any) => {
      const expected = test.expected ?? test.expectedReference;
      const expectedRefs = Array.isArray(expected) ? expected : [expected];
      const [layer, literal] = await Promise.all([
        ctx.runQuery(makeFunctionReference<"query">("bible:search"), { q: test.query, translation: "KJV", mode: "layer", limit: 3 }),
        ctx.runQuery(makeFunctionReference<"query">("bible:search"), { q: test.query, translation: "KJV", mode: "literal", limit: 3 }),
      ]);
      const actual = layer.results.map((p: any) => p.ref);
      const baseline = literal.results.map((p: any) => p.ref);
      const position = actual.findIndex((r: string) => expectedRefs.some((ref: string) => overlapsReference(r, ref)));
      return { query: test.query, expected: expectedRefs.join(", "), actual, baseline, passed: position !== -1, baselinePassed: baseline.some((r: string) => expectedRefs.some((ref: string) => overlapsReference(r, ref))), rank: position === -1 ? null : position + 1 };
    }));
    results.push(...batch);
  }
  const passed = results.filter((r) => r.passed).length;
  const run = { createdAt: start, status: "complete", total: results.length, passed, score: results.length ? passed / results.length : 0, baselineScore: results.length ? results.filter((r) => r.baselinePassed).length / results.length : 0, results, durationMs: Date.now() - start, metadata: { metric: "Hit@3", translation: "KJV", corpus: "Imported canonical verses and grounded curated passages", suite: "Fixed colloquial evaluation cases; not an independent blind study" } };
  const id = await ctx.runMutation(makeFunctionReference<"mutation">("bible:recordEvaluation"), { run });
  return { ...run, _id: id, id };
} });
export const jobs = query({ args: {}, handler: async (ctx) => await ctx.db.query("jobs").order("desc").take(50) });
export const adminStatus = query({ args: {}, handler: async () => ({ configured: Boolean(process.env.CONVEX_ADMIN_KEY) }) });
export const recordEvaluation = internalMutation({ args: { run: v.any() }, handler: async (ctx, { run }) => await ctx.db.insert("evaluationRuns", run) });

export const lexicon = query({ args: { q: v.string(), language: v.optional(v.string()), limit: v.optional(v.number()) }, handler: async (ctx, args) => {
  const q = args.q.trim().slice(0, 100);
  if (!q) return [];
  if (/^[HG]\d+$/i.test(q)) return await ctx.db.query("lexicon").withIndex("by_strong", (s) => s.eq("strong", q.toUpperCase())).take(limitOf(args.limit));
  return await ctx.db.query("lexicon").withSearchIndex("search_gloss", (s) => args.language ? s.search("gloss", q).eq("language", args.language) : s.search("gloss", q)).take(limitOf(args.limit));
} });

export const entities = query({ args: { q: v.string(), type: v.optional(v.string()), limit: v.optional(v.number()) }, handler: async (ctx, args) => {
  const q = args.q.trim().slice(0, 100);
  if (!q) return await ctx.db.query("entities").take(limitOf(args.limit));
  return await ctx.db.query("entities").withSearchIndex("search_name", (s) => args.type ? s.search("name", q).eq("type", args.type) : s.search("name", q)).take(limitOf(args.limit));
} });
