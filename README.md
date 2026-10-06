# Lumen — a Bible reference engine

Search scripture using half-remembered stories and everyday language, read available translations, inspect related passages and entities, and compare literal retrieval with a source-anchored understanding layer. Convex stores the scripture, graph, review queue, saved passages and evaluation history. React and Vite provide the interface.

The original product discussion is preserved in [docs/source-conversation.md](docs/source-conversation.md) as design reference. [docs/FEATURES.md](docs/FEATURES.md) records what is implemented and what still needs external access or further work.

## Start with Convex cloud

Requirements: Node.js 22+, npm, Python 3, a Convex account and network access to GitHub and Convex. This repository is already isolated in the cloud workspace; use the existing checkout. Do not create another Git worktree unless explicitly requested.

```sh
npm ci
npx convex dev
```

Complete Convex's device/browser login when prompted, select or create the cloud project, and let the CLI configure `.env.local`. It must contain the cloud deployment's `VITE_CONVEX_URL`; keep deployment keys and `.env.local` out of Git. Leave `convex dev` running while developing. In another terminal:

```sh
python3 scripts/download-data.py --all
node scripts/seed-layer.mjs
python3 scripts/download-knowledge.py
python3 scripts/catalog-translations.py
npm run validate:data
npm run seed
npm run dev
```

The data commands prepare full licensed editions, cross-references, curated passages, expansions, STEPBible lexical resources and the initial graph. Downloads and normalized bulk data go under ignored `.data/`; source manifests, license texts, application code, import scripts and curated data live in Git. The importer checks each translation's source license before importing it. Translation availability and verse numbering follow each source edition.

`npm run seed` appends data. Run it once per fresh deployment to avoid duplicates. After inspecting your deployment, `npm run seed -- --replace-source-data` can refresh only the source tables; it deliberately preserves notes, review records and generated layer history. For production, pass `--prod`. Do not run replacement against a deployment containing source customizations you need to retain.

If this network blocks the login endpoint before Convex issues a device code, account approval alone cannot fix it: allow Convex's authentication/API domains in the environment network settings and rerun `npx convex dev`. GitHub authentication and Convex authentication are separate. Without `VITE_CONVEX_URL`, the UI explains the missing cloud connection; it does not present local sample data as a live cloud deployment.

## Development and checks

```sh
npm run check
npm test
node --test scripts/providers.test.mjs
npm run build
npm run preview
```

Tests cover reference parsing and retrieval behavior; provider tests check literal quote verification and constrained routing. The evaluation screen compares literal versus expanded retrieval on the checked-in benchmark. Those seeded examples demonstrate known cases and must not be treated as independent evidence of general accuracy. See the importer's source manifest for actual edition counts.

## Generate the five-pass AI layer

Normal reading and search require no paid AI key. Offline generation is optional and uses a configurable OpenAI-compatible provider. It generates plain, context, everyday, questions and nicknames passes, independently checks faithfulness, retains exact source text and version history, and queues uncertain rows for review.

```sh
node scripts/generate-layer.mjs --dry-run
# Set BIBLE_AI_API_KEY securely before the next command.
node scripts/generate-layer.mjs --limit 1 --max-requests 10
```

See [docs/AI-PIPELINE.md](docs/AI-PIPELINE.md) for the 50-passage pilot, import procedure, provider settings, cost controls, quote verification, and the unverified Convex Gateway/Jev status. Set `CONVEX_ADMIN_KEY` securely in the deployment to enable privileged review operations; never put it in a `VITE_` environment variable.

## Deploy

Create a Convex production deploy key in the dashboard and provide it as `CONVEX_DEPLOY_KEY` only in your deployment environment:

```sh
npm run deploy
# Import the prepared source data to this production deployment once:
npm run seed -- --prod
```

`npm run deploy` deploys Convex functions and builds the frontend with the resulting `VITE_CONVEX_URL`. Serve the generated `dist/` with an SPA-compatible static host. `vercel.json` supplies the route fallback for Vercel. The manual GitHub Actions workflow **Deploy Convex cloud** uses the `production` environment's `CONVEX_DEPLOY_KEY` secret and uploads the frontend as an artifact. It does not silently seed or replace production data and does not publish that artifact to a web host. Configure the web host's build/deploy integration separately.

CI validates build and tests on pushes and pull requests. Never store API tokens, deploy keys or private environment files in the repository.

## Data and interpretation

The translation selector contains only imported source editions. This project does not claim a license to redistribute every modern commercial Bible. [SOURCES.md](SOURCES.md) and `data/licenses/` record source attribution and terms. Cross-reference votes are relevance weights, not measures of truth; speaker metadata distinguishes a character's claim from the narrator's endorsement. Generated expansions are retrieval aids anchored to source passages and are not a new Bible translation.

Saved passages use a browser-scoped identifier. This is a personal-workspace convenience, not a complete authenticated multi-user account system. See [docs/FEATURES.md](docs/FEATURES.md) for remaining production work.
