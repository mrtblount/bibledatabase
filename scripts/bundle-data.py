#!/usr/bin/env python3
"""Create a public Convex import ZIP, excluding every user workspace table."""
import argparse,collections,hashlib,json,pathlib,re,zipfile
ROOT=pathlib.Path(__file__).resolve().parents[1]
def main():
 p=argparse.ArgumentParser();p.add_argument('--source-dir',default='.data');p.add_argument('--knowledge-dir',default='.data');p.add_argument('--output',default='data/bible-corpus.zip');a=p.parse_args()
 source=ROOT/a.source_dir;knowledge=ROOT/a.knowledge_dir;output=ROOT/a.output;output.parent.mkdir(parents=True,exist_ok=True)
 # Explicit allowlist: never package notes, reviews, savedPassages, jobs, or evaluationRuns.
 files={name:source/(name+'.jsonl') for name in ['translations','books','verses']}
 files.update({name:knowledge/(name+'.jsonl') for name in ['crossReferences','entities','entityReferences','lexicon','passages','expansions']})
 book_counts=collections.Counter(json.loads(line)['translation'] for line in files['books'].open())
 metadata=[json.loads(line) for line in files['translations'].open()]
 for row in metadata:row['description']=re.sub(r'; \d+ books(?: with text)?\.',f'; {book_counts[row["id"]]} books with text.',row.get('description',''))
 tables={}
 with zipfile.ZipFile(output,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6,allowZip64=True) as archive:
  for table,path in files.items():
   if not path.exists():raise FileNotFoundError(path)
   digest=hashlib.sha256();count=0;size=0
   with archive.open(table+'/documents.jsonl','w',force_zip64=True) as target:
    source_lines=(json.dumps(r,ensure_ascii=False,separators=(',',':')).encode()+b'\n' for r in metadata) if table=='translations' else path.open('rb')
    for line in source_lines:
     target.write(line);digest.update(line);count+=1;size+=len(line)
   tables[table]={'rows':count,'uncompressedBytes':size,'sha256':digest.hexdigest()}
  stat_keys={'translations':'translations','books':'books','verses':'verses','crossReferences':'crossReferences','entities':'entities','entityReferences':'entityReferences','lexicon':'lexiconEntries','passages':'passages','expansions':'expansions'}
  stats=b''.join((json.dumps({'key':stat_keys[t],'value':info['rows']},separators=(',',':'))+'\n').encode() for t,info in tables.items())
  archive.writestr('datasetStats/documents.jsonl',stats)
  tables['datasetStats']={'rows':len(stat_keys),'uncompressedBytes':len(stats),'sha256':hashlib.sha256(stats).hexdigest()}
 # Read the completed archive to verify CRCs and its own durable content hash.
 with zipfile.ZipFile(output) as archive:
  failure=archive.testzip()
  if failure:raise ValueError('ZIP CRC failed: '+failure)
 manifest={'file':str(output.relative_to(ROOT)),'format':'Convex ZIP import: <table>/documents.jsonl','bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'tables':tables,'privacy':'Public source and editorial seed tables only; excludes user notes, saved passages, private reviews, jobs and evaluation history.','canonicalSourceManifest':'data/extended-source-manifest.json' if len(metadata)>13 else 'data/source-manifest.json','knowledgeSourceManifest':'data/knowledge-manifest.json','supplementalVerseProvenance':'data/verse-provenance.json','attribution':'SOURCES.md','licenses':['data/licenses/STEPBible.md','data/licenses/Theographic.txt','data/licenses/ArulJohn-KJV.txt'],'translations':[{k:r[k] for k in ['id','name','language','license','sourceUrl','verseCount']} for r in metadata],'derivedContentNotice':'Passage descriptions and expansions are editorial seed data, stored separately from canonical verses. Entity refs are previews; entityReferences preserves all source links.','rebuild':f'python scripts/bundle-data.py --source-dir {a.source_dir} --knowledge-dir {a.knowledge_dir} --output {a.output}'}
 (output.parent/'bundle-manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 print(json.dumps({'bytes':manifest['bytes'],'sha256':manifest['sha256'],'rows':{t:v['rows'] for t,v in tables.items()}},indent=2))
if __name__=='__main__':main()
