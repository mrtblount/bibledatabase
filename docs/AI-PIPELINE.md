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

Import appends records. Old versions remain auditable. Admin approval supersedes previous approved entries for that passage/pass without deleting historical content. Approving a historical entry restores it. Whole-run promotion remains a manual review operation. The generated layer must be evaluated against independent held-out questions before promoting a broad run. Pilot questions used to create a layer are not unbiased evaluation evidence.

## Quote checking and typed decisions

`scripts/providers.mjs` exports `verifyQuote(quote, sourceRows)`. It checks an exact, case-sensitive substring in a real source translation; paraphrases fail. Matches return the translation and reference. This utility is available to any future prose-answer generator. The current search UI displays source text directly.

The same adapter exports `typedDecision(question, options)`, accepting 2–255 distinct options and rejecting any response outside that set or confidence outside 0–1. This is a generic constrained classification adapter. `jevProvider(state, questions)` separately uses the verified native Convex Decisions API. Current application search uses the local deterministic retrieval engine, so AI keys are optional for normal use.

## Native Convex Gateway and Jev

Official documentation was successfully checked after network access was restored:

- [Getting started](https://docs.convex.dev/ai-gateway/setup): actions use `getServiceToken("ai-gateway")` with Convex 1.45 or newer; installed dependencies meet this requirement.
- [HTTP API](https://docs.convex.dev/ai-gateway/api): chat uses `https://ai-gateway.convex.dev/v1/chat/completions`; Jev uses `https://ai-gateway.convex.dev/alpha/decisions` and model `typesafe/jev-1.13`.
- [Availability](https://docs.convex.dev/ai-gateway/overview): the gateway needs a paid Convex team. Anonymous local and self-hosted deployments cannot use it. Embeddings are now documented as supported, correcting the uncertainty in the original conversation.

`convex/ai.ts` implements protected native actions. Service tokens stay inside the action; they are never returned, stored or copied into environment variables. `ai:checkAccess` only verifies a deployment can mint a token; it does not initiate paid inference. `ai:availability` describes configured requirements without claiming live access was verified.

Configure `CONVEX_ADMIN_KEY` on the deployment and in your private operator shell. Then:

```sh
# .env.local supplies VITE_CONVEX_URL; admin key is injected securely.
BIBLE_AI_PROVIDER=convex node --env-file=.env.local scripts/generate-layer.mjs --limit 1 --max-requests 10
BIBLE_AI_PROVIDER=convex node --env-file=.env.local scripts/search-ai.mjs "the dude who barely made it to heaven"
```

The generation CLI makes a native chat call for each pass and, by default, a separate batched Jev yes/no probability request for independent source-grounding checks. Set `BIBLE_AI_FAITHFULNESS=chat` to use the separately requested chat checker instead. Jev does not generate prose rationales; the stored metadata says so explicitly. The search runner makes one Jev choice request to route the question, retrieves at most ten source-grounded candidates from Convex, then makes one batched Jev request for independent relevance probabilities. Jev returns typed decisions and does not write a freeform answer. The web search remains the deterministic path; this operator CLI enables the optional paid route.

Every native operation requires the admin key. Chat calls limit source input, restrict models to the deployment's `BIBLE_AI_ALLOWED_MODELS` (defaulting to `openai/gpt-4o-mini`), and cap output at 4,096 tokens. Set `BIBLE_AI_MODEL` and `BIBLE_AI_CHECK_MODEL` for the CLI; authorize both provider/model IDs on the deployment when using different models. Configure Convex spending limits before broad generation. Jev batches are bounded to 20 questions; choice maps are validated against 2–255 options. Decisions is an alpha API and can change.

If gateway access fails with `AiGatewayDisabled`, the linked team's plan or gateway availability needs attention. `AiGatewayUnavailable` indicates an unsupported or unlinked deployment. The configurable external provider remains usable with its own credentials.

Native integration is typechecked against the installed Convex SDK. The seven provider/pipeline tests exercise source provenance, independent checking, review status, output history preservation, quote exactness and constrained response validation using mocks. No paid real-model generation or evaluation is represented as completed without its resulting output manifest.
