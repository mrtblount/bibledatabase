# Retrieval expansion pipeline

The layer helps match a user's words to source references. It is machine-facing derived data, never a replacement translation. Scripture quotations come from the imported translation text.

`node scripts/generate-layer.mjs --dry-run` validates all source references for the checked-in 50-passage pilot across Mark, Psalms, Romans and Job. It needs `.data/verses.jsonl`, produced by the data importer, but no AI credential. The pilot includes narrative, poetry, argument, and speaker-sensitive passages.

## Run generation

Set `BIBLE_AI_API_KEY` or `OPENAI_API_KEY` securely in the shell environment. Do not commit it. The default uses OpenAI's chat completions endpoint with `gpt-4o-mini`; optionally set `BIBLE_AI_MODEL`, `BIBLE_AI_CHECK_MODEL`, and `BIBLE_AI_BASE_URL` to a provider's documented OpenAI-compatible endpoint and supported models. Each provider must support JSON-object chat responses and the `max_tokens` option. Output is capped at 2,048 tokens per request by default; `BIBLE_AI_MAX_TOKENS` changes that cap. Remote endpoints require HTTPS.

```sh
node scripts/generate-layer.mjs --dry-run --limit 1
node scripts/generate-layer.mjs --limit 1 --max-requests 10
# Full pilot: at most 500 model requests, charged by the chosen provider.
node scripts/generate-layer.mjs --limit 50 --max-requests 500
```

The generator makes five separate passes: plain, context, everyday, questions and nicknames. A separate model request checks every generated entry against the exact sources and context. A faithful verdict with score at least 0.90 is approved; everything else is a draft for review. These are model judgments, not human scholarly validation. Empty nickname outputs are allowed. Unsupported traditional names must never be asserted as names present in scripture.

Every row records the passage, translation, exact source text, available second English and original-language source texts, model, prompt version, generation time, checker model and reasons. Original-language text is present when that edition covers the passage; this does not imply word-level morphology or aligned lexical analysis.

Output is an exclusively created `.data/layers/<run>.jsonl` with a manifest. Successful rows are written as work completes. A failed run retains its completed rows. Re-running creates a new version; previous JSONL files remain unchanged. `provenance.priorEntryIds` links earlier generated rows for that passage and pass. Do not import the same run twice.

```sh
npx convex import --table expansions .data/layers/REPLACE-WITH-RUN.jsonl
# For a production deployment, append --prod to the command.
```

Import appends records. Old versions remain auditable. Review and reject superseded approved rows when switching versions; automatic activation/rollback of an entire version is not currently implemented. The generated layer must be evaluated against independent held-out questions before promoting a broad run. Pilot questions used to create a layer are not unbiased evaluation evidence.

## Quote checking and typed decisions

`scripts/providers.mjs` exports `verifyQuote(quote, sourceRows)`. It checks an exact, case-sensitive substring in a real source translation; paraphrases fail. Matches return the translation and reference. This utility is available to any future prose-answer generator. The current search UI displays source text directly.

The same adapter exports `typedDecision(question, options)`, accepting 2–255 distinct options and rejecting any response outside that set or confidence outside 0–1. This is a generic constrained classification adapter, not a Jev implementation. Current application search uses the local deterministic retrieval engine, so AI keys are optional for normal use.

## Gateway and Jev status

The conversation attachment contains claims about newer Convex AI Gateway and Jev services. Their authoritative documentation could not be reached from this build environment: requests to `docs.convex.dev/ai-gateway/setup`, `www.convex.dev/ai-gateway`, `news.convex.dev/introducing-convex-ai-gateway/`, `typesafe.ai`, and `docs.typesafe.ai` were denied by the network proxy with HTTP 403 before content could be verified.

No gateway base URL, special authentication mechanism, model availability, embeddings API, Jev primitive, performance number or price has been assumed. `jevProvider()` fails explicitly. Once official docs and account access are available, a compatible chat gateway can be configured through `BIBLE_AI_BASE_URL`; Jev needs its documented typed API adapter. Do not point the generic chat adapter at an undocumented endpoint.

The implementation has provider contract tests and offline source-validation checks. No paid generation or independent real-model faithfulness run is represented as completed without the corresponding credentials and output manifest.
