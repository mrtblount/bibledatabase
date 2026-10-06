#!/usr/bin/env python3
"""Derive test fixtures from the checked-in, licensed corpus instead of model-written scripture."""
import json,pathlib,zipfile
root=pathlib.Path('.data');root.mkdir(exist_ok=True)
with zipfile.ZipFile('data/bible-corpus.zip') as source:
    rows=[json.loads(line) for line in source.read('passages/documents.jsonl').decode().splitlines() if line]
texts={row['ref']:row['text'] for row in rows if row['translation']=='KJV'}
if len(texts)!=102:raise SystemExit(f'Expected 102 source passages, received {len(texts)}')
(root/'layer-source-text.json').write_text(json.dumps(texts,ensure_ascii=False))
print(f'Prepared {len(texts)} genuine KJV passage fixtures from the licensed corpus.')
