#!/usr/bin/env python3
"""Catalog all upstream editions with per-edition license declarations; no text import."""
import concurrent.futures,hashlib,json,pathlib,re,urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE='https://raw.githubusercontent.com/scrollmapper/bible_databases/e1b254cef86d0e65b1a5d1a94b8b112d0f296a2c/'
def main():
 readme=urllib.request.urlopen(BASE+'README.md',timeout=30).read().decode()
 entries=re.findall(r'^- \*\*([^ ]+) \(([^)]+)\)\*\*: (.+)$',readme,re.M)
 def load(entry):
  code,language,name=entry;url=BASE+f'sources/{language}/{code}/README.md'
  try:
   metadata=urllib.request.urlopen(url,timeout=15).read().decode();license=re.split(r'\*\*License\*?\*?:?',metadata,flags=re.I)[-1].strip('*: \n')
  except Exception as error:license='Unverified';metadata=''
  safe=bool(re.search(r'Public Domain|CC0|Creative Commons: BY 4.0',license,re.I))
  return {'sourceId':code,'id':'KJV' if code=='KJVPCE' else code.upper(),'name':name,'language':language,'license':license,'licenseSourceUrl':url,'sourceUrl':BASE+f'formats/json/{code}.json','automaticImportAllowed':safe,'status':'available' if safe else 'license-review-required','licenseMetadataSha256':hashlib.sha256(metadata.encode()).hexdigest()}
 rows=list(concurrent.futures.ThreadPoolExecutor(max_workers=10).map(load,entries))
 (ROOT/'data/translation-catalog.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
 print(f'Cataloged {len(rows)} editions; {sum(r["automaticImportAllowed"] for r in rows)} with public-domain, CC0, or CC-BY declarations.')
if __name__=='__main__':main()
