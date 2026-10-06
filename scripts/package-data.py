#!/usr/bin/env python3
"""Create a Convex snapshot from reproducible source tables, excluding private user data."""
import pathlib,zipfile
root=pathlib.Path('.data')
tables=['translations','books','verses','crossReferences','entities','entityReferences','lexicon','datasetStats','passages','expansions']
with zipfile.ZipFile(root/'snapshot.zip','w',zipfile.ZIP_DEFLATED,compresslevel=6) as out:
    for table in tables:
        source=root/f'{table}.jsonl'
        if not source.exists(): raise SystemExit(f'Missing {source}; run npm run download first')
        out.write(source,arcname=f'{table}/documents.jsonl')
print(f"Prepared {root/'snapshot.zip'} ({(root/'snapshot.zip').stat().st_size:,} bytes), {len(tables)} source tables. No user notes, credentials, or evaluation runs included.")
