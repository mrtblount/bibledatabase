# Delivery map

This checklist separates implemented behavior from external service access and planned extensions. The conversation export is a specification reference, not evidence that every service or benchmark claim in it is current.

## Implemented in this repository

- React/Vite interface backed by Convex schema, queries and mutations.
- Canonical scripture references, chapter reading and translation selection.
- Reproducible full-text import with source license checks and SHA-256 manifests. The initial prepared dataset has 13 editions, 369,946 verse rows and 772 translation/book records. `--all` requests another 13 eligible editions. `data/translation-catalog.json` inventories the broader upstream catalog and its source license notices.
- 344,799 OpenBible cross-reference edges retaining source labels and vote weights.
- STEPBible proper-name and lexicon import, and Theographic people/place/event import: 9,049 entities and 21,293 lexical entries in the initial prepared dataset. Greek definitions and allowed Hebrew gloss/morphology fields are retained. Hebrew definition text with a separate Online Bible permission notice is excluded.
- Literal and expanded retrieval, passage grouping, source-reference grounding and curated metadata to help distinguish speakers.
- Search examples including the criminal on the cross, Eutychus, Lot's wife and Hagar; a benchmark comparing literal and expanded retrieval.
- Source-reading, related-passage/graph, review and saved-note workflows. Privileged review requires a server-side admin key.
- A reproducible 50-passage pilot across Mark, Psalms, Romans and Job.
- Optional real-provider generation CLI with plain, context, everyday, questions and nicknames passes; separate faithfulness checks; uncertain drafts; exact source text, model/prompt metadata and append-only output history.
- A configurable OpenAI-compatible provider adapter, strict typed classification helper and literal quote-verification utility.
- GitHub CI and a manual Convex production deployment workflow, with the resulting frontend build attached as an artifact.

## Requires account/network configuration

- Deploying to the user's Convex **cloud** account requires successful Convex authentication and reachable Convex services. A local backend test is not a cloud deployment.
- Paid AI generation requires a valid provider key, an enabled model and provider network access. Offline/mocked validation does not establish real-model quality.
- A public frontend URL requires a static web host deployment and the correct cloud `VITE_CONVEX_URL`.
- Review writes require `CONVEX_ADMIN_KEY` configured on the deployment. Provider and admin credentials must never be committed or put in public frontend build variables.

## Further work and explicit limits

- **Convex AI Gateway/Jev:** authoritative setup docs were blocked by the build environment's network proxy. No undocumented API is claimed to work. Jev currently fails explicitly; the generic compatible chat adapter is implemented separately.
- **Full-corpus AI expansion:** the CLI supports arbitrary passage lists, but a paid generation/checking run for the entire Bible has not been performed. The initial useful layer is curated and should not be described as a fully generated corpus.
- **Full original-language word alignment:** original Hebrew/Greek source editions, proper names and lexical resources are imported; the complete TAHOT/TAGNT token-to-verse morphology corpus and cross-tradition versification mapping are not yet implemented.
- **UST comparison:** the licensed UST source is referenced in the original discussion. A UST benchmark/derived-text pipeline is not implemented.
- **Optional passage vectors:** no embeddings provider or vector index is required by the implemented lexical/layer retrieval. Adding vectors for empirically demonstrated misses remains a future extension.
- **AI response prose:** search returns actual source passages. A freeform answer-writing model is not implemented; the quote-verification helper is ready for such an integration.
- **Evaluation generalization:** the seeded questions are known examples. Reported performance on them is not an independent or scholarly validation of retrieval accuracy or interpretation.
- **Accounts/privacy:** saved notes use a browser-scoped identifier. Full sign-in, account recovery, organization permissions and cross-device private note synchronization require a separate authentication layer.
- **History:** generated rows and manifests are retained, and prior generated entry IDs are linked. Bulk promotion and one-click version rollback are not implemented.

See [AI-PIPELINE.md](AI-PIPELINE.md) for provider behavior and [../SOURCES.md](../SOURCES.md) for source licensing details.
