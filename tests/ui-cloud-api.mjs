import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const origin = process.env.CONVEX_URL || 'https://adamant-yak-708.convex.cloud';
const appUrl = process.env.APP_URL || 'https://adamant-yak-708.convex.site';
const results = [];
async function call(kind, path, args = {}) {
  const response = await fetch(`${origin}/api/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path, args, format: 'json' }), signal: AbortSignal.timeout(90000) });
  assert.equal(response.status, 200, `${path} HTTP status`);
  const result = await response.json();
  if (result.status !== 'success') throw new Error(result.errorMessage || `${path} failed`);
  return result.value;
}
const query = (path, args) => call('query', path, args);
const mutation = (path, args) => call('mutation', path, args);
async function check(name, fn) { try { await fn(); results.push({ name, passed: true }); console.log(`PASS ${name}`); } catch (error) { results.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); } }

await check('Production HTML, JavaScript and CSS load with verified TLS', async () => {
  const htmlResponse = await fetch(appUrl, { signal: AbortSignal.timeout(20000) });
  assert.equal(htmlResponse.status, 200); assert.match(htmlResponse.headers.get('content-type'), /text\/html/);
  const html = await htmlResponse.text(); assert.match(html, /Lumen/);
  const assetUrls = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(m => m[1]);
  assert.ok(assetUrls.some(a => a.endsWith('.js'))); assert.ok(assetUrls.some(a => a.endsWith('.css')));
  for (const asset of assetUrls) { const response = await fetch(new URL(asset, appUrl)); assert.equal(response.status, 200); assert.ok((await response.text()).length > 100); }
});
let translations = [];
await check('Full production corpus reports 26 translations and over 631,000 verses', async () => {
  const stats = await query('bible:stats'); translations = await query('bible:translations');
  assert.equal(translations.length, 26); assert.equal(stats.translations, 26); assert.ok(stats.verses >= 631000);
  assert.ok(stats.crossReferences >= 344000); assert.ok(stats.entities >= 9000); assert.ok(stats.expansions >= 510);
  console.log(`DATA ${JSON.stringify(stats)}`);
});
await check('Every imported translation returns real chapter text', async () => {
  assert.equal(translations.length, 26);
  for (const translation of translations) {
    const books = await query('bible:books', { translation: translation.id }); assert.ok(books.length, `${translation.id} books`);
    const chapter = await query('bible:chapter', { translation: translation.id, book: books[0].id, chapter: 1 });
    assert.ok(chapter.length, `${translation.id} first chapter`); assert.ok(chapter.every(v => v.text.length > 0), `${translation.id} verse text`);
  }
});
for (const [text, reference] of [
  ["Who's that dude that just barely made it to heaven? He squeezed himself in at the last minute.", 'LUK.23.39'],
  ['The guy who fell asleep during a sermon and fell out a window.', 'ACT.20.7'],
  ['The lady who looked back and turned into salt.', 'GEN.19.'],
  ['I feel invisible at work.', 'GEN.16.'],
  ['John 3:16', 'JHN.3.16'],
]) await check(`Cloud search ${reference}`, async () => {
  const data = await query('bible:search', { q: text, translation: 'KJV', mode: 'layer', limit: 3 });
  assert.ok(data.results.some(r => r.ref.startsWith(reference)), JSON.stringify(data.results.map(r => r.ref)));
  assert.ok(data.results.every(r => r.text.length > 0));
});
await check('KJV and ASV source passages differ and remain reference-aligned', async () => {
  const kjv = await query('bible:passage', { ref: 'JHN.3.16', translation: 'KJV' });
  const asv = await query('bible:passage', { ref: 'JHN.3.16', translation: 'ASV' });
  assert.equal(kjv.length, 1); assert.equal(asv.length, 1); assert.notEqual(kjv[0].text, asv[0].text); assert.equal(kjv[0].ref, asv[0].ref);
});
await check('Literal mode returns indexed source text', async () => {
  const data = await query('bible:search', { q: 'begotten', translation: 'KJV', mode: 'literal', limit: 3 });
  assert.equal(data.route, 'literal'); assert.ok(data.results.length); assert.ok(data.results.every(r => /begotten/i.test(r.text)));
});
await check('Cross-references, language expansions, lexical data and people are accessible', async () => {
  const graph = await query('bible:graph', { ref: 'JHN.3.16' }); assert.ok(graph.edges.length > 1);
  assert.ok((await query('bible:listExpansions')).length >= 510);
  assert.ok((await query('bible:lexicon', { q: 'love', limit: 5 })).length > 0);
  assert.ok((await query('bible:entities', { q: 'Moses', limit: 5 })).length > 0);
});
await check('Production notes persist and reject cross-session edits', async () => {
  const sessionId = `qa_${randomUUID().replaceAll('-', '')}`; const otherSession = `qa_${randomUUID().replaceAll('-', '')}`;
  const saved = await mutation('bible:toggleSaved', { sessionId, ref: 'JHN.3.16', translation: 'KJV' });
  try {
    assert.equal(saved.saved, true);
    await mutation('bible:saveNote', { sessionId, id: saved.id, note: 'Automated production validation; removed immediately after test.' });
    const rows = await query('bible:saved', { sessionId }); assert.equal(rows.length, 1); assert.match(rows[0].note, /Automated production validation/);
    await assert.rejects(mutation('bible:saveNote', { sessionId: otherSession, id: saved.id, note: 'This must not be written.' }));
    assert.match((await query('bible:saved', { sessionId }))[0].note, /Automated production validation/);
    assert.equal((await query('bible:saved', { sessionId: otherSession })).length, 0);
  } finally { if (saved.saved) await mutation('bible:toggleSaved', { sessionId, ref: 'JHN.3.16', translation: 'KJV' }); }
  assert.equal((await query('bible:saved', { sessionId })).length, 0);
});
await check('Review mutations require the administrator key', async () => {
  const [expansion] = await query('bible:listExpansions'); assert.ok(expansion);
  await assert.rejects(mutation('bible:reviewExpansion', { id: expansion._id, status: 'approved', adminKey: 'intentionally-invalid-qa-key' }));
  assert.equal((await query('bible:listExpansions')).find(row => row._id === expansion._id)?.status, expansion.status);
});
await check('Native Convex AI integration is configured', async () => {
  const data = await query('ai:availability'); assert.equal(data.native, true); assert.equal(data.adminConfigured, true); assert.equal(data.provider, 'Convex AI Gateway');
});
await check('Cloud evaluation action saves 50 results', async () => {
  const run = await call('action', 'bible:runEvaluation'); assert.equal(run.total, 50); assert.equal(run.results.length, 50);
  assert.ok(run.score >= 0.9, `Top-three retrieval accuracy ${run.score}`);
  const saved = await query('bible:evaluations'); assert.ok(saved.some(r => r._id === run._id));
  console.log(`EVALUATION ${JSON.stringify({ total: run.total, passed: run.passed, score: run.score, baselineScore: run.baselineScore })}`);
});
console.log(JSON.stringify({ origin, appUrl, results }, null, 2));
if (results.some(r => !r.passed)) process.exitCode = 1;
