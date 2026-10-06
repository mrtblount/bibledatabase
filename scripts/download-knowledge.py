#!/usr/bin/env python3
"""Reproducibly import attributed STEPBible and Theographic knowledge data."""
import importlib.util, pathlib, json, re, html, urllib.parse
spec=importlib.util.spec_from_file_location('bible_data',pathlib.Path(__file__).with_name('download-data.py'));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
STEP='https://raw.githubusercontent.com/STEPBible/STEPBible-Data/1f3423d42400f59f1f30fe08f74e38fcd3bbf7bc/'
THEO='https://raw.githubusercontent.com/robertrouse/theographic-bible-metadata/cfb1c485d4da6fb63a69cb3b7f5b0752792f46bc/'
FILES={'TIPNR':'Proper Nouns/TIPNR - Translators Individualised Proper Names with all References - STEPBible.org CC BY.txt','TBESG':'Lexicons/TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt','TBESH':'Lexicons/TBESH - Translators Brief lexicon of Extended Strongs for Hebrew - STEPBible.org CC BY.txt'}
# STEP uses standard 3-character abbreviations; retain canonical book IDs.
STEP_CODES='Gen Exo Lev Num Deu Jos Jdg Rut 1Sa 2Sa 1Ki 2Ki 1Ch 2Ch Ezr Neh Est Job Psa Pro Ecc Sng Isa Jer Lam Ezk Dan Hos Jol Amo Oba Jon Mic Nah Hab Zep Hag Zec Mal Mat Mrk Luk Jhn Act Rom 1Co 2Co Gal Eph Php Col 1Th 2Th 1Ti 2Ti Tit Phm Heb Jas 1Pe 2Pe 1Jn 2Jn 3Jn Jud Rev'.split()
m.BOOKMAP.update({m.norm(k):v for k,v in zip(STEP_CODES,m.CODES)})
def plain(x):return html.unescape(re.sub('<[^>]*>',' ',str(x))).strip()
def refs(text):
 out=[]
 for book,ch,verse in re.findall(r'\b([123]?[A-Z][a-zA-Z]+)\.(\d+)\.(\d+)',text):
  code=m.BOOKMAP.get(m.norm(book))
  if code:out.append(f'{code}.{int(ch)}.{int(verse)}')
 return list(dict.fromkeys(out))
def main():
 texts={k:m.fetch(STEP+urllib.parse.quote(v),m.RAW/(k+'.txt')).decode('utf-8-sig') for k,v in FILES.items()}
 m.fetch(STEP+'README.md',m.PUBLIC/'licenses'/'STEPBible.md')
 m.fetch(THEO+'LICENSE',m.PUBLIC/'licenses'/'Theographic.txt')
 entities=[];current=None;kind='other'
 for line in texts['TIPNR'].splitlines():
  if line.startswith('$'):
   if current:current['refs']=list(dict.fromkeys(current['refs']));entities.append(current);current=None
   kind='person' if 'PERSON' in line else 'place' if 'PLACE' in line else 'other'
  elif re.match(r'^[^\t–@]+@[^\t]+=[HG]',line):
   fields=line.split('\t');identifier=fields[0];name=identifier.split('@')[0];uid=identifier.rsplit('=',1)[-1]
   current={'id':'step:'+uid,'name':name,'type':kind,'description':plain(fields[1]),'aliases':[],'refs':[]}
  elif current and (line.startswith('– ') or line.startswith('- ')) and 'Total' not in line[:10]:
   fields=line.split('\t')
   if len(fields)>4:
    current['refs']+=refs(';'.join(fields[4:]));alias=plain(fields[3]);
    if alias and alias!=current['name'] and alias not in current['aliases']:current['aliases'].append(alias)
 if current:current['refs']=list(dict.fromkeys(current['refs']));entities.append(current)
 # Preserve duplicate-disambiguated original IDs while making database entity IDs unique.
 seen=set()
 for entity in entities:
  key=entity['id'];n=1
  while entity['id'] in seen:n+=1;entity['id']=key+':'+str(n)
  seen.add(entity['id'])
 step_count=len(entities)
 verse_data=json.loads(m.fetch(THEO+'json/verses.json',m.RAW/'theographic-verses.json'))
 verse_ids={row['id']:m.canonical_ref(row['fields']['osisRef']) for row in verse_data}
 verse_links={}
 for row in verse_data:
  for field in ['people','places','event']:
   for eid in row['fields'].get(field,[]):verse_links.setdefault(eid,[]).append(verse_ids[row['id']])
 for category,kind in [('people','person'),('places','place'),('events','event')]:
  records=json.loads(m.fetch(THEO+f'json/{category}.json',m.RAW/f'theographic-{category}.json'))
  for row in records:
   f=row['fields'];name=f.get('name') or f.get('displayTitle') or f.get('title') or f.get('kjvName') or row['id']
   description=f.get('comment') or f.get('description') or f.get('dictionaryText') or f.get('dictText') or ''
   if isinstance(description,list):description=' '.join(description)
   # No speculative chronology is treated as canonical; preserve only descriptive metadata.
   entities.append({'id':'theographic:'+row['id'],'name':name,'type':kind,'description':plain(description),'aliases':list(dict.fromkeys(str(f[x]) for x in ['kjvName','esvName','personLookup','placeLookup'] if f.get(x) and f[x]!=name)),'refs':list(dict.fromkeys([verse_ids[v] for v in f.get('verses',[]) if v in verse_ids]+verse_links.get(row['id'],[])))})
 with (m.OUT/'entities.jsonl').open('w') as f:
  for row in entities:m.write_row(f,row)
 lexical=[];seen=set()
 for source,lang in [('TBESG','grc'),('TBESH','hbo')]:
  for line in texts[source].splitlines():
   if not re.match(r'^[GH]\d{4,5}\t',line):continue
   fields=line.split('\t')
   if len(fields)<7:continue
   strong=fields[0];uid=fields[1].split()[0];key=source+':'+uid
   if key in seen:key+=':'+str(len(lexical))
   seen.add(key)
   row={'id':key,'strong':strong,'lemma':fields[3],'transliteration':fields[4],'language':lang,'morphology':fields[5],'gloss':fields[6],'source':'STEPBible '+source,'license':'CC-BY-4.0'}
   # TBESH expressly reserves its Online Bible definition column. Hebrew glosses are STEP-authored.
   if source=='TBESG' and len(fields)>7:row['definition']=plain(fields[7])
   lexical.append(row)
 with (m.OUT/'lexicon.jsonl').open('w') as f:
  for row in lexical:m.write_row(f,row)
 counts={'entities':len(entities),'lexiconEntries':len(lexical)}
 stats={}
 stats_path=m.OUT/'datasetStats.jsonl'
 if stats_path.exists():stats={r['key']:r['value'] for r in map(json.loads,stats_path.read_text().splitlines())}
 stats.update(counts)
 with stats_path.open('w') as f:
  for key,value in stats.items():m.write_row(f,{'key':key,'value':value})
 report={'stepEntities':step_count,'theographicEntities':len(entities)-step_count,**counts,'files':sorted(m.MANIFEST,key=lambda r:r['file'])}
 (m.PUBLIC/'knowledge-manifest.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='files'},indent=2))
if __name__=='__main__':main()
