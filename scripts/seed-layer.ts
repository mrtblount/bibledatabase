import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { passages, layerPasses } from '../shared/passages';
import { searchPassages, searchLiteral } from '../shared/search';
import { evaluationCases, evaluationMetadata } from '../shared/evaluation';

mkdirSync('.data', {recursive:true});
const relevant = new Map<string,string>();
for await (const line of createInterface({input:createReadStream('.data/verses.jsonl'),crlfDelay:Infinity})) {
  if(!line) continue; const verse=JSON.parse(line);
  if(verse.translation==='KJV') relevant.set(verse.reference,verse.text);
}
const sourceText:Record<string,string>={};
const records=passages.map(p=>{
  const parts:string[]=[]; const missingReferences:string[]=[];
  for(let verse=p.verseStart;verse<=p.verseEnd;verse++){
    const ref=`${p.book}.${p.chapter}.${verse}`;const text=relevant.get(ref);
    if(!text) { missingReferences.push(ref); continue; }
    parts.push(text);
  }
  if(!parts.length) throw new Error(`No canonical text available for ${p.reference}`);
  if(missingReferences.length) console.warn(`SOURCE GAP ${p.reference}: unavailable upstream verses ${missingReferences.join(', ')}`);
  const text=parts.join(' ');sourceText[p.reference]=text;
  return {translation:'KJV',ref:p.reference,title:p.title,book:p.book,chapter:p.chapter,verse:p.verseStart,endVerse:p.verseEnd,text,context:p.context,speaker:p.speaker,tags:p.topics,entities:p.entities,cautions:[...(p.cautions??[]),...(missingReferences.length?[`Source edition does not contain ${missingReferences.join(', ')}; the displayed text includes only available source verses.`]:[])],provenance:{...p.provenance,missingSourceVerses:missingReferences},
    searchText:[p.title,p.plain,p.context,...p.everyday,...p.questions,...p.nicknames,...p.topics,...p.entities].join(' ')};
});
const expansions=passages.flatMap(p=>layerPasses.map(type=>({passageRef:p.reference,translation:'KJV',type,text:Array.isArray(p[type])?p[type].join('\n'):p[type],status:'draft',source:'Implementation-authored discovery note; independent editorial review pending',version:'curated-v1',sourceText:sourceText[p.reference],tags:p.topics,faithfulness:{status:'not_independently_reviewed',method:'Manually authored against canonical passage context during implementation; not model verified'},provenance:p.provenance})));
function jsonl(path:string,records:unknown[]){writeFileSync(path,records.map(r=>JSON.stringify(r)).join('\n')+'\n');}
jsonl('.data/passages.jsonl',records);jsonl('.data/expansions.jsonl',expansions);
writeFileSync('.data/layer-source-text.json',JSON.stringify(sourceText));
const start=Date.now();
const results=evaluationCases.map(test=>{const actual=searchPassages(test.query,3).map(p=>p.reference);const baseline=searchLiteral(test.query,sourceText,3).map(p=>p.reference);const position=actual.indexOf(test.expected);return{...test,actual,baseline,passed:position>=0,baselinePassed:baseline.includes(test.expected),rank:position<0?null:position+1};});
const passed=results.filter(r=>r.passed).length,baselinePassed=results.filter(r=>r.baselinePassed).length;
const run={createdAt:Date.now(),status:'complete',total:results.length,passed,score:passed/results.length,baselineScore:baselinePassed/results.length,results,durationMs:Date.now()-start,metadata:{...evaluationMetadata,metric:'Hit@3',candidateSet:`Same ${passages.length} passage ranges for both methods`,baseline:'Literal BM25 over actual KJV passage text; no synonyms or discovery notes'}};
writeFileSync('.data/evaluation.json',JSON.stringify(run,null,2)+'\n');
console.log(JSON.stringify({passages:records.length,expansions:expansions.length,regressionHitAt3:`${passed}/${results.length}`,literalHitAt3:`${baselinePassed}/${results.length}`,metadata:run.metadata},null,2));
for(const result of results.filter(r=>!r.passed))console.log('MISS',result.query,result.expected,result.actual.join(','));
