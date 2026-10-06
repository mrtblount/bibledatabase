# Delivery map

This checklist separates implemented behavior from external service access and planned extensions. The conversation export is a specification reference, not evidence that every service or benchmark claim in it is current.

## Implemented in this repository

- React/Vite interface backed by Convex schema, queries and mutations.
- Canonical scripture references, chapter reading and translation selection.
- Reproducible full-text import with source license checks and SHA-256 manifests. The initial prepared dataset has 13 editions, 369,950 verse rows and 772 translation/book records. `--all` has also been verified for 26 editions totaling 631,885 verses and 1,371 translation/book records. `data/translation-catalog.json` inventories the broader upstream catalog and its source license notices.
- 344,799 OpenBible cross-reference edges retaining source labels and vote weights.
- STEPBible proper-name and lexicon import, and Theographic people/place/event import: 9,049 entities and 21,293 lexical entries in the initial prepared dataset. Greek definitions and allowed Hebrew gloss/morphology fields are retained. Hebrew definition text with a separate Online Bible permission notice is excluded.
- Literal and expanded retrieval, passage grouping, source-reference grounding and curated metadata to help distinguish speakers.
- Search examples including the criminal on the cross, Eutychus, Lot's wife and Hagar; a benchmark comparing literal and expanded retrieval.
- Source-reading, related-passage/graph, review and saved-note workflows. Privileged review requires a server-side admin key.
- A reproducible 50-passage pilot across Mark, Psalms, Romans and Job.
- Optional real-provider generation CLI with plain, context, everyday, questions and nicknames passes; separate faithfulness checks; uncertain drafts; exact source text, model/prompt metadata and append-only output history.
- Native Convex AI Gateway chat and Jev alpha decision actions, plus a configurable OpenAI-compatible fallback, strict typed classification and literal quote verification. The optional `scripts/search-ai.mjs` runner routes with Jev, retrieves from Convex and reranks grounded candidates with Jev probabilities.
- Native frontend hosting through Convex HTTP actions, plus GitHub CI and a manual production deployment workflow with the frontend build attached as an artifact.

## Requires account/network configuration

- Deploying to the user's Convex **cloud** account requires successful Convex authentication and reachable Convex services. A local backend test is not a cloud deployment.
- Paid AI generation requires a valid provider key, an enabled model and provider network access. Offline/mocked validation does not establish real-model quality.
- A public frontend URL is supplied by the Convex `.site` HTTP action after deploying the packaged frontend with the correct cloud `VITE_CONVEX_URL`. No separate frontend hosting account is required.
- Review writes require `CONVEX_ADMIN_KEY` configured on the deployment. Provider and admin credentials must never be committed or put in public frontend build variables.

## Further work and explicit limits

- **Convex AI Gateway/Jev live access:** official setup and HTTP API documentation were verified after network access was restored. Native actions are implemented and typechecked, but paid live inference requires a linked paid Convex team and has not been represented as completed. Jev Decisions is an alpha API.
- **Automatic scholarly tagging:** Jev supports typed decisions and the current curated passages include speaker/genre/topic metadata. A full-corpus automatically generated speaker/genre/audience tagging job is not yet implemented.
- **Full-corpus AI expansion:** the CLI supports arbitrary passage lists, but a paid generation/checking run for the entire Bible has not been performed. The initial useful layer is curated and should not be described as a fully generated corpus.
- **Full original-language word alignment:** original Hebrew/Greek source editions, proper names and lexical resources are imported; the complete TAHOT/TAGNT token-to-verse morphology corpus and cross-tradition versification mapping are not yet implemented.
- **UST comparison:** the licensed UST source is referenced in the original discussion. A UST benchmark/derived-text pipeline is not implemented.
- **Optional passage vectors:** no embeddings provider or vector index is required by the implemented lexical/layer retrieval. Adding vectors for empirically demonstrated misses remains a future extension.
- **AI response prose:** search returns actual source passages. A freeform answer-writing model is not implemented; the quote-verification helper is ready for such an integration.
- **Evaluation generalization:** the seeded questions are known examples. Reported performance on them is not an independent or scholarly validation of retrieval accuracy or interpretation.
- **Accounts/privacy:** saved notes use a browser-scoped identifier. Full sign-in, account recovery, organization permissions and cross-device private note synchronization require a separate authentication layer.
- **History:** generated rows and manifests are retained, and prior generated entry IDs are linked. Admin approval supersedes older approved entries of that passage/pass without deleting them; approving an old entry restores it. Bulk whole-run promotion remains manual.

See [AI-PIPELINE.md](AI-PIPELINE.md) for provider behavior and [../SOURCES.md](../SOURCES.md) for source licensing details.
