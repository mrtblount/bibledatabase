# Scripture and knowledge sources

Application code and imported data have separate licenses. Scripture quotations are always stored separately from editorial descriptions, discovery phrases, annotations, and AI-generated drafts. Translation numbering is preserved; the app does not assume every edition has identical verses or canons.

## Reproduce the database

```sh
python scripts/catalog-translations.py
python scripts/download-data.py
python scripts/download-knowledge.py
npm run data:validate
npm run data:seed
```

The first import contains **13 editions, 369,950 nonempty verses, 772 edition/book records, 344,799 weighted cross-references, 9,049 entities, 85,266 entity-to-verse links, and 21,293 lexical entries**. Generated NDJSON and raw downloads live under `.data/` and are deliberately excluded from Git. Committed manifests contain source URLs, byte sizes, and SHA-256 hashes. The scripts use Python's standard library and verified HTTPS. Convex documents and search indexes require additional storage beyond the approximately 136 MiB of JSONL; choose a deployment with adequate capacity.

`python scripts/download-data.py --all` enables 13 further public-domain/CC0 English editions (26 editions total). `--translations KJVPCE BSB ASV` builds a selected source set. The argument is an upstream identifier; database identifiers are uppercase, except the public-domain KJVPCE edition is intentionally exposed as `KJV`. Rebuilding source files replaces local generated exports, so rerun `download-knowledge.py` afterward to regenerate the combined counts. Import source replacement is explicit in the seeding CLI. Editorial reviews and saved notes must not be replaced with source imports.

`data/translation-catalog.json` catalogs 140 upstream editions, their declared licenses, and whether the importer accepts the declaration. A catalog entry is not a claim that the text is installed. The importer currently accepts public-domain, CC0 and CC-BY 4.0 declarations; noncommercial and restricted editions are listed for review without importing them.

## Scripture

Source: [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases), snapshot `e1b254cef86d0e65b1a5d1a94b8b112d0f296a2c`. The repository's MIT license covers its software, not blanket permission for every translation. Individual declarations are saved under `data/licenses/`.

Default editions: KJV Pure Cambridge Edition, Berean Standard Bible (CC0), American Standard Version, Bible in Basic English, Darby, Douay-Rheims/Challoner, Geneva 1599, JPS, New Heart English Bible, Webster, Young's Literal Translation, Westminster Leningrad Codex (Hebrew), and Statistical Restoration Greek New Testament (CC-BY 4.0).

The annotated upstream `KJV` module declares GPL. This app uses upstream **KJVPCE**, which declares public domain, under the display ID **KJV**. KJV rights can differ by jurisdiction, including Crown rights in the United Kingdom. The edition and source remain identifiable in the translation record. The supplied KJVPCE digital transcription has four empty verses: Joshua 15:1, Job 7:1, Hosea 8:1 and Romans 8:1. These four are supplemented using the separately attributed [Arul John KJV transcription](https://github.com/aruljohn/Bible-kjv), MIT, pinned snapshot `a9aa4e55afbb3e095f57e4b14cd1f22c5ee8d7c9`. Exact per-verse provenance is in `data/verse-provenance.json`, its license is preserved in `data/licenses/ArulJohn-KJV.txt`, and the translation name explicitly states that transcription supplements are present. No verse is invented. KJV now contains 31,102 verses. Other empty source placeholders are omitted and recorded in the manifest. Full upstream source coverage is not a guarantee of editorial or textual completeness.

## Cross-references

[OpenBible.info Bible cross-references](https://www.openbible.info/labs/cross-references/), snapshot header **2024-11-04**, Creative Commons Attribution (CC-BY), accessed through scrollmapper's attributed mirror. Original positive and negative vote counts are preserved as `weight`. These are editorial relationships and votes, not scripture or an infallible interpretation. Normalization maps book abbreviations and compacts same-chapter ranges without changing endpoints.

## Lexicon and proper names

[STEP Bible](https://www.STEPBible.org), [STEPBible Data](https://github.com/STEPBible/STEPBible-Data), originally developed at Tyndale House Cambridge; **CC BY 4.0**. Pinned snapshot `1f3423d42400f59f1f30fe08f74e38fcd3bbf7bc`.

- TIPNR: 4,258 disambiguated people, places and other names with verse references, source descriptions and aliases. The importer uses structured source descriptions and reference lists; it does not import the upstream Claude-generated `@Brief`, `@Short` or `@Article` prose as canonical facts.
- TBESG: Greek Extended Strong's lemmas, transliterations, morphology, glosses and brief definitions.
- TBESH: Hebrew Extended Strong's lemmas, transliterations, morphology and STEP-authored glosses. **The Online Bible/BDB definition column is not imported**, because the source expressly requests separate permission for that column despite the surrounding CC-BY notice.

Changes are format normalization, HTML removal from descriptions, deduplication of verse references, source-prefixed identifiers, and mapping book abbreviations to canonical three-character codes. Subverse suffixes are collapsed to their parent verse for graph linkage. Original files remain available from the pinned links in the manifest. Lexicon morphology here describes the lemma; it is not an interlinear word-alignment dataset.

## Theographic

[Theographic Bible Metadata](https://github.com/robertrouse/theographic-bible-metadata), by Robert Rouse and contributors, **Creative Commons Attribution-ShareAlike 4.0**, snapshot `cfb1c485d4da6fb63a69cb3b7f5b0752792f46bc`. Full license preserved in `data/licenses/Theographic.txt`.

Imported 3,067 people, 1,274 places and 450 events. Verse record IDs are resolved to canonical scripture references. Theographic-derived normalized entity records remain available under CC-BY-SA 4.0; attribution and share-alike requirements accompany exports. Uncertain historical dates, map coordinates and source chronology are not promoted into canonical scripture. Source records are retained in downloaded JSON; current graph entities contain names, aliases, descriptions, types and linked verses.

Entity documents retain up to 100 verse references as a preview; the `entityReferences` relation table preserves all 85,266 links without truncation.

The source-prefixed namespaces `step:` and `theographic:` preserve provenance and avoid claiming that two identically named people are necessarily the same individual.
