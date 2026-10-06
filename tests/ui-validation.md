# Browser validation

Validated October 6, 2026 (UTC), using Chromium and the real Convex backend with the current application functions. All 14 checks in `tests/ui-smoke.mjs` passed; no browser runtime errors were recorded.

- Five retrieval examples: thief on the cross, Eutychus, Lot’s wife, Hagar, and John 3:16.
- KJV/ASV switching changes the quoted source text.
- Literal search and the side-by-side comparison render.
- Saved passages and edited notes survive a page reload.
- Bible reader chapter navigation displays Genesis 2.
- Knowledge graph displays connected nodes.
- Imported language expressions display.
- Evaluation runs persist and render their results.
- Mobile navigation works at 390 px without horizontal overflow.
- No uncaught browser errors.

The browser run used a separate local validation deployment with 5,751 actual KJV/ASV verses spanning the curated passage chapters, 102 passages, 510 expansions, and focused graph/lexicon records. This is functional validation, not evidence of a completed cloud deployment or a completed full-corpus import. The full corpus and import scripts are independent of this test fixture.

Run against an already running and populated application:

```sh
CHROMIUM_PATH=/usr/bin/chromium APP_URL=http://127.0.0.1:5173 npm run test:ui
```

Set `CHROMIUM_PATH` to your installed Chromium browser. The runner writes desktop and mobile screenshots under ignored `test-results/`.
