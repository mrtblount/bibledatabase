# Application validation

Validated October 6, 2026 (UTC).

## Production cloud verification

All **15 checks** in `tests/ui-cloud-api.mjs` passed against the live application at <https://adamant-yak-708.convex.site> and its production Convex deployment. HTTPS certificate verification remained enabled.

- Production HTML, JavaScript and CSS returned HTTP 200. The compiled frontend points to the production Convex URL.
- The database reported **26 translations, 631,885 verses, 344,799 cross-references and 9,049 entities**.
- Every one of the 26 translations returned actual first-chapter text.
- The five required retrieval examples found the expected references in the top three: the criminal on the cross, Eutychus, Lot’s wife, Hagar and John 3:16.
- KJV/ASV passages retain matching canonical references and distinct source wording.
- Literal search, graph connections, lexical search, entity lookup and imported expansions returned real data.
- Notes persisted; another session could neither list nor edit them. The temporary test note was deleted afterward.
- An invalid administrator key could not change an expansion’s review status.
- The native Convex AI integration reported administrator configuration present.
- The evaluation action persisted all 50 cases: **50/50 language-layer hits versus 13/50 literal hits** in the first three results. This is the fixed development suite, not an independent blind benchmark.

The suite checks AI configuration, not paid model inference. The separate AI pilot’s provenance records document those model calls.

```sh
CONVEX_URL=https://adamant-yak-708.convex.cloud \
APP_URL=https://adamant-yak-708.convex.site \
node tests/ui-cloud-api.mjs
```

For environments that require an HTTP proxy, Node 24 can use `NODE_USE_ENV_PROXY=1` with the environment’s existing trusted CA configuration.

## Browser verification

All **14 checks** in `tests/ui-smoke.mjs` passed in Chromium against the actual application and a separate local Convex deployment. No uncaught browser errors were recorded.

- Five retrieval examples match the production cases above.
- KJV/ASV switching changes quoted source text.
- Literal search and side-by-side comparison render.
- Saved passages and edited notes survive a page reload.
- Bible reader chapter navigation displays Genesis 2.
- Knowledge graph nodes and imported language expressions display.
- Evaluation runs persist and render results.
- Mobile navigation works at 390 px without horizontal overflow.

Desktop and mobile screenshots were visually inspected. The browser run used 5,751 actual KJV/ASV verses spanning the curated passage chapters, 102 passages, 510 expansions and focused graph/lexicon records. Production was verified separately through the complete cloud API suite above; production browser rendering was not tested.

Run against an already running and populated application:

```sh
CHROMIUM_PATH=/usr/bin/chromium APP_URL=http://127.0.0.1:5173 npm run test:ui
```

Set `CHROMIUM_PATH` to your installed Chromium browser. The runner writes desktop and mobile screenshots under ignored `test-results/`.
