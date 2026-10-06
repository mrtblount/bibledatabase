#!/usr/bin/env python3
"""Download and normalize licensed scripture. Standard library only; see SOURCES.md."""
import argparse, concurrent.futures, csv, hashlib, json, pathlib, re, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
OUT=ROOT/'.data'; RAW=OUT/'raw'; PUBLIC=ROOT/'data'; BASE='https://raw.githubusercontent.com/scrollmapper/bible_databases/e1b254cef86d0e65b1a5d1a94b8b112d0f296a2c/'
CODES='GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split()
NAMES='Genesis|Exodus|Leviticus|Numbers|Deuteronomy|Joshua|Judges|Ruth|1 Samuel|2 Samuel|1 Kings|2 Kings|1 Chronicles|2 Chronicles|Ezra|Nehemiah|Esther|Job|Psalms|Proverbs|Ecclesiastes|Song of Solomon|Isaiah|Jeremiah|Lamentations|Ezekiel|Daniel|Hosea|Joel|Amos|Obadiah|Jonah|Micah|Nahum|Habakkuk|Zephaniah|Haggai|Zechariah|Malachi|Matthew|Mark|Luke|John|Acts|Romans|1 Corinthians|2 Corinthians|Galatians|Ephesians|Philippians|Colossians|1 Thessalonians|2 Thessalonians|1 Timothy|2 Timothy|Titus|Philemon|Hebrews|James|1 Peter|2 Peter|1 John|2 John|3 John|Jude|Revelation'.split('|')
OSIS='Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split()
EXTRA={'Tobit':'TOB','Judith':'JDT','Wisdom':'WIS','Wisdom of Solomon':'WIS','Sirach':'SIR','Ecclesiasticus':'SIR','Baruch':'BAR','1 Maccabees':'1MA','2 Maccabees':'2MA','3 Maccabees':'3MA','4 Maccabees':'4MA','1 Esdras':'1ES','2 Esdras':'2ES','Prayer of Manasseh':'MAN','Psalm 151':'PS2','Susanna':'SUS','Bel and the Dragon':'BEL','Letter of Jeremiah':'LJE','Additions to Esther':'ESG','Prayer of Azariah':'S3Y','Prayer of Manasses':'MAN','Additional Psalm':'PS2','Laodiceans':'LAO','Psalms of Solomon':'PSS','Epistle of Jeremiah':'LJE','1 Enoch':'ENO','Odes':'ODA'}
def norm(s):
 s=re.sub(r'^IV ', '4 ', s);s=re.sub(r'^III ', '3 ', s);s=re.sub(r'^II ', '2 ', s);s=re.sub(r'^I ', '1 ', s)
 return re.sub('[^a-z0-9]','',s.lower())
BOOKMAP={norm(n):c for n,c in zip(NAMES,CODES)}|{norm(n):c for n,c in zip(OSIS,CODES)}|{norm(c):c for c in CODES}|{norm(k):v for k,v in EXTRA.items()}|{'songofsongs':'SNG','canticles':'SNG','psalm':'PSA','apocalypse':'REV','revelationofjohn':'REV'}
DEFAULT=['KJVPCE','BSB','ASV','BBE','Darby','DRC','Geneva1599','JPS','NHEB','Webster','YLT','WLC','StatResGNT']
ADDITIONAL=['NHEBJE','NHEBME','OEB','OEBcth','CPDV','ACV','Anderson','Haweis','Noyes','Rotherham','Tyndale','Twenty','UKJV']
LANG={'WLC':'hbo','StatResGNT':'grc'}
MANIFEST=[]
LOCKS={}
for manifest_path in [PUBLIC/'source-manifest.json',PUBLIC/'knowledge-manifest.json']:
 if manifest_path.exists():
  LOCKS.update({r['file']:r['sha256'] for r in json.loads(manifest_path.read_text()).get('files',[])})
def fetch(url,path):
 if path.exists():b=path.read_bytes()
 else:b=urllib.request.urlopen(url,timeout=60).read()
 digest=hashlib.sha256(b).hexdigest();expected=LOCKS.get(str(path.relative_to(ROOT)))
 if expected and expected!=digest:raise ValueError(f'Checksum mismatch: {path}; review upstream changes before updating the manifest')
 if not path.exists():path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(b)
 MANIFEST.append({'url':url,'file':str(path.relative_to(ROOT)),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()});return b

def download(source):
 catalog_path=PUBLIC/'translation-catalog.json'
 catalog=json.loads(catalog_path.read_text()) if catalog_path.exists() else []
 lang=next((r['language'] for r in catalog if r['sourceId']==source),LANG.get(source,'en')); url=BASE+f'formats/json/{source}.json'
 license_url=BASE+f'sources/{lang}/{source}/README.md'
 license_text=fetch(license_url,PUBLIC/'licenses'/f'{source}.md').decode()
 if not re.search('Public Domain|CC0|Creative Commons: BY 4.0',license_text,re.I):raise ValueError(f'Unapproved license for {source}: {license_text}')
 data=json.loads(fetch(url,RAW/f'{source}.json'));print(f'Downloaded {source}: {len(data["books"])} books',flush=True)
 return source,lang,license_text,url,data

def write_row(f,row):f.write(json.dumps(row,ensure_ascii=False,separators=(',',':'))+'\n')
def canonical_ref(ref):
 pieces=[]
 for part in ref.split('-'):
  b,c,v=part.split('.');pieces.append(f'{BOOKMAP[norm(b)]}.{int(c)}.{int(v)}')
 if len(pieces)==2 and pieces[0].rsplit('.',1)[0]==pieces[1].rsplit('.',1)[0]:return pieces[0]+'-'+pieces[1].rsplit('.',1)[1]
 return '-'.join(pieces)

def main():
 p=argparse.ArgumentParser();p.add_argument('--all',action='store_true',help='Include additional public-domain English editions');p.add_argument('--translations',nargs='+');p.add_argument('--skip-cross-references',action='store_true');args=p.parse_args()
 RAW.mkdir(parents=True,exist_ok=True);PUBLIC.mkdir(parents=True,exist_ok=True)
 ids=args.translations or DEFAULT+(ADDITIONAL if args.all else [])
 results=list(concurrent.futures.ThreadPoolExecutor(max_workers=6).map(download,ids))
 catalog=[];total=0;book_count=0; omitted=[];supplements={};supplement_rows=[];supplement_provenance=[]
 if 'KJVPCE' in ids:
  supplement_base='https://raw.githubusercontent.com/aruljohn/Bible-kjv/a9aa4e55afbb3e095f57e4b14cd1f22c5ee8d7c9/'
  fetch(supplement_base+'LICENSE',PUBLIC/'licenses'/'ArulJohn-KJV.txt')
  for book_name,code,chapter,verse in [('Joshua','JOS',15,1),('Job','JOB',7,1),('Hosea','HOS',8,1),('Romans','ROM',8,1)]:
   source_url=supplement_base+book_name+'.json'
   doc=json.loads(fetch(source_url,RAW/('aruljohn-'+book_name+'.json')))
   value=next(v['text'] for c in doc['chapters'] if int(c['chapter'])==chapter for v in c['verses'] if int(v['verse'])==verse)
   reference=f'{code}.{chapter}.{verse}';supplements[reference]=value
   supplement_provenance.append({'translation':'KJV','reference':reference,'sourceUrl':source_url,'license':'MIT; public-domain KJV text','reason':'Fills an empty verse in the upstream KJVPCE digital transcription; wording from separately identified KJV source.'})
 with (OUT/'verses.jsonl').open('w') as vf,(OUT/'books.jsonl').open('w') as bf,(OUT/'translations.jsonl').open('w') as tf:
  for source,lang,license_text,url,data in results:
   tid='KJV' if source=='KJVPCE' else source.upper();count=0;edition_books=0;seen=set()
   for i,book in enumerate(data['books']):
    if not any(v['text'].strip() for c in book['chapters'] for v in c['verses']):continue
    code=BOOKMAP.get(norm(book['name']))
    if not code:raise ValueError(f'Unknown book {source}: {book["name"]}')
    order=CODES.index(code)+1 if code in CODES else 67+list(EXTRA.values()).index(code)
    book_count+=1;edition_books+=1
    write_row(bf,{'translation':tid,'id':code,'name':book['name'],'chapters':max(int(c['chapter']) for c in book['chapters']),'order':order})
    for chapter in book['chapters']:
     ch=int(chapter['chapter'])
     for verse in chapter['verses']:
      vn=int(verse['verse']);text=verse['text'].strip();ref=f'{code}.{ch}.{vn}'
      is_supplement=source=='KJVPCE' and not text and ref in supplements
      if is_supplement:text=supplements[ref]
      if not text:omitted.append({'translation':tid,'reference':ref,'reason':'empty source text'});continue
      if ref in seen:raise ValueError(f'Duplicate {tid} {ref}')
      seen.add(ref);row={'translation':tid,'book':code,'chapter':ch,'verse':vn,'reference':ref,'text':text,'sortOrder':order*1000000+ch*1000+vn};write_row(vf,row);count+=1
      if is_supplement:supplement_rows.append(row)
   license_value=license_text.split('License')[-1].strip('*: \n')
   title=data.get('translation',source).split(': ',1)[-1]
   row={'id':tid,'name':title,'language':lang,'license':license_value,'sourceUrl':url,'verseCount':count,'description':f'Complete available source edition; {edition_books} books with text. Verse numbering follows this edition.'}
   if source=='KJVPCE':row['name']='King James Version (PCE with documented transcription supplements)';row['description']+=' Four empty digital transcription verses supplied from Arul John KJV (MIT); see data/verse-provenance.json.'
   write_row(tf,row);catalog.append(row);total+=count;print(f'Normalized {tid}: {count:,} verses',flush=True)
 cross_count=0
 if not args.skip_cross_references:
  b=fetch(BASE+'sources/extras/cross_references.txt',RAW/'cross_references.txt')
  with (OUT/'crossReferences.jsonl').open('w') as f:
   for row in csv.reader(b.decode('utf-8-sig').splitlines()[1:],delimiter='\t'):
    if len(row)<3:continue
    write_row(f,{'from':canonical_ref(row[0]),'to':canonical_ref(row[1]),'label':'OpenBible cross-reference','type':'cross-reference','weight':int(row[2])});cross_count+=1
 with (OUT/'verse-supplements.jsonl').open('w') as sf:
  for row in supplement_rows:write_row(sf,row)
 (PUBLIC/'verse-provenance.json').write_text(json.dumps(supplement_provenance,ensure_ascii=False,indent=2)+'\n')
 (PUBLIC/'translations.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
 report={'translations':len(catalog),'verses':total,'crossReferences':cross_count,'books':book_count,'omittedEmptyVerses':omitted,'files':sorted(MANIFEST,key=lambda x:x['file'])}
 (PUBLIC/'source-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
 with (OUT/'datasetStats.jsonl').open('w') as sf:
  for k in ['translations','verses','books','crossReferences']:write_row(sf,{'key':k,'value':report[k]})
 print(json.dumps({k:v for k,v in report.items() if k not in ['files','omittedEmptyVerses']},indent=2))
if __name__=='__main__':main()
