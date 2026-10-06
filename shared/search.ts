import { passages, type Passage } from './passages';
export { passages } from './passages';
export type { Passage } from './passages';
export interface ParsedReference { book:string; chapter:number; verseStart?:number; verseEnd?:number; reference:string }
const bookRows = [
'GEN|Genesis|Ge|Gn','EXO|Exodus|Ex|Exod','LEV|Leviticus|Lev','NUM|Numbers|Num|Nu','DEU|Deuteronomy|Deut|Dt','JOS|Joshua|Josh','JDG|Judges|Judg','RUT|Ruth','1SA|1 Samuel|1 Sam','2SA|2 Samuel|2 Sam','1KI|1 Kings|1 Kgs','2KI|2 Kings|2 Kgs','1CH|1 Chronicles|1 Chron','2CH|2 Chronicles|2 Chron','EZR|Ezra','NEH|Nehemiah|Neh','EST|Esther|Est','JOB|Job','PSA|Psalms|Psalm|Ps','PRO|Proverbs|Prov','ECC|Ecclesiastes|Eccl','SNG|Song of Solomon|Song of Songs|Song|SOS','ISA|Isaiah|Isa','JER|Jeremiah|Jer','LAM|Lamentations|Lam','EZK|Ezekiel|Ezek|Eze','DAN|Daniel|Dan','HOS|Hosea|Hos','JOL|Joel','AMO|Amos','OBA|Obadiah|Obad','JON|Jonah|Jon','MIC|Micah|Mic','NAM|Nahum|Nah','HAB|Habakkuk|Hab','ZEP|Zephaniah|Zeph','HAG|Haggai|Hag','ZEC|Zechariah|Zech','MAL|Malachi|Mal','MAT|Matthew|Matt|Mt','MRK|Mark|Mk','LUK|Luke|Lk','JHN|John|Jn','ACT|Acts','ROM|Romans|Rom','1CO|1 Corinthians|1 Cor','2CO|2 Corinthians|2 Cor','GAL|Galatians|Gal','EPH|Ephesians|Eph','PHP|Philippians|Phil','COL|Colossians|Col','1TH|1 Thessalonians|1 Thess','2TH|2 Thessalonians|2 Thess','1TI|1 Timothy|1 Tim','2TI|2 Timothy|2 Tim','TIT|Titus|Tit','PHM|Philemon|Philem','HEB|Hebrews|Heb','JAS|James|Jm','1PE|1 Peter|1 Pet','2PE|2 Peter|2 Pet','1JN|1 John|1 Jn','2JN|2 John|2 Jn','3JN|3 John|3 Jn','JUD|Jude','REV|Revelation|Revelations|Rev',
];
const aliases = new Map<string,string>();
const normalizeBook = (s:string) => s.toLowerCase().replace(/[^a-z0-9]/g,'');
for (const row of bookRows) { const [id,...names]=row.split('|'); for(const alias of [id,...names]) aliases.set(normalizeBook(alias),id); }
export function parseReference(input:string): ParsedReference|null {
  const match = input.trim().replace(/[–—]/g,'-').match(/^([1-3]?\s*[a-zA-Z][a-zA-Z\s]*?)\s*\.?\s*(\d{1,3})(?:\s*[:.]\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?)?$/);
  if (!match) return null;
  const book = aliases.get(normalizeBook(match[1])); const chapter=Number(match[2]);
  if (!book || chapter<1) return null;
  const verseStart=match[3]?Number(match[3]):undefined; const verseEnd=match[4]?Number(match[4]):verseStart;
  if (verseStart!==undefined && (verseStart<1 || (verseEnd ?? 0)<verseStart)) return null;
  return {book,chapter,verseStart,verseEnd,reference:`${book}.${chapter}${verseStart===undefined?'':`.${verseStart}${verseEnd!==verseStart?`-${verseEnd}`:''}`}`};
}
const stopWords=new Set('a an and are as at be been being bible biblical book but by can could did do does for from get got had has have he her him his how i in is it its me my of on or our passage said says say she should so some that the their them there these they this those to us verse was we were what when where which who why will with would you your about into not'.split(' '));
export function tokenize(text:string): string[] {
  return (text.toLowerCase().normalize('NFKD').replace(/[’']/g,'').match(/[a-z0-9]+/g) ?? [])
    .filter(t=>t.length>1&&!stopWords.has(t)).map(t => t.length>5&&t.endsWith('ing')?t.slice(0,-3):t.length>4&&t.endsWith('es')?t.slice(0,-2):t.length>3&&t.endsWith('s')?t.slice(0,-1):t);
}
const synonymGroups=[
['anxiety','anxious','worry','worried','stress','stressed','panic'],['grief','grieving','mourning','bereavement'],['invisible','unseen','overlooked','ignored'],['exhausted','burnout','weary','tired','burned'],['forgiveness','forgive','forgiven','mercy'],['thief','criminal','robber'],['sermon','preaching','preached'],['asleep','sleepy','sleeping','sleep'],['window','windowsill'],['innocent','undeserved','blameless'],['depressed','downcast','sad'],['poor','poverty','hungry'],['guilty','guilt','condemnation'],['salt','salty'],['kid','child','children'],['skeptical','doubt','doubting'],['abandoned','forsaken','forgotten'],['revenge','vengeance','retaliation'],['rich','wealth','wealthy','money'],['enemy','enemies','bully','bullies'],
];
const synonyms=new Map<string,string[]>();
for(const group of synonymGroups) {const tokens=[...new Set(group.flatMap(tokenize))]; for(const word of tokens) synonyms.set(word,tokens);}
const fieldWeights: [keyof Passage,number][]=[['title',2.8],['plain',1.4],['context',0.65],['everyday',2.5],['questions',2],['nicknames',3.2],['topics',1.3],['entities',2]];
type Indexed={passage:Passage; tf:Map<string,number>; length:number};
const index:Indexed[]=passages.map(passage=>{const tf=new Map<string,number>();let length=0;for(const [field,weight] of fieldWeights){const raw=passage[field];const terms=tokenize(Array.isArray(raw)?raw.join(' '):String(raw??''));length+=terms.length;for(const term of terms)tf.set(term,(tf.get(term)??0)+weight);}return{passage,tf,length};});
const documentFrequency=new Map<string,number>();for(const doc of index)for(const term of doc.tf.keys())documentFrequency.set(term,(documentFrequency.get(term)??0)+1);
const averageLength=index.reduce((sum,d)=>sum+d.length,0)/index.length;
export interface SearchResult extends Passage { score:number; matchedTerms:string[]; matchReason:string }
export function searchPassages(query:string,limit=12):SearchResult[] {
  if(!query.trim() || limit<1)return[];
  const reference=parseReference(query);
  if(reference){return passages.filter(p=>p.book===reference.book&&p.chapter===reference.chapter&&(reference.verseStart===undefined||p.verseStart<=(reference.verseEnd??reference.verseStart)&&p.verseEnd>=reference.verseStart)).slice(0,limit).map(p=>({...p,score:100,matchedTerms:[reference.reference],matchReason:'Canonical reference overlap'}));}
  const terms=[...new Set(tokenize(query))];if(!terms.length)return[];
  const expanded=new Map<string,number>();for(const term of terms){expanded.set(term,1);for(const synonym of synonyms.get(term)??[])if(!expanded.has(synonym))expanded.set(synonym,.4);}
  const normalized=query.toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  return index.map(({passage,tf,length})=>{let score=0;const matchedTerms:string[]=[];
    for(const [term,boost] of expanded){const count=tf.get(term)??0;if(!count)continue;const df=documentFrequency.get(term)??0;const idf=Math.log(1+(index.length-df+.5)/(df+.5));score+=idf*(count*2.2)/(count+1.2*(.25+.75*length/averageLength))*boost;if(terms.includes(term))matchedTerms.push(term);}
    const coverage=matchedTerms.length/terms.length;score*=.55+.45*coverage;
    for(const alias of passage.nicknames){const phrase=alias.toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim();if(phrase.length>4&&normalized.includes(phrase))score+=8;}
    return {...passage,score:Math.round(score*1000)/1000,matchedTerms,matchReason:matchedTerms.length?`Matched ${matchedTerms.slice(0,5).join(', ')} in passage discovery notes`:'Related vocabulary in passage discovery notes'};
  }).filter(p=>p.score>0).sort((a,b)=>b.score-a.score||a.reference.localeCompare(b.reference)).slice(0,Math.min(limit,100));
}
/** Literal baseline on exactly the same passage candidates; no layer text or synonym expansion. */
export function searchLiteral(query:string,sourceText:Record<string,string>,limit=3):{reference:string;score:number}[]{
  const terms=[...new Set(tokenize(query))];
  const docs=passages.map(p=>({reference:p.reference,terms:tokenize(sourceText[p.reference]??'')}));
  const avg=docs.reduce((s,d)=>s+d.terms.length,0)/docs.length||1;
  return docs.map(d=>{let score=0;for(const term of terms){const tf=d.terms.filter(t=>t===term).length;if(!tf)continue;const df=docs.filter(other=>other.terms.includes(term)).length;score+=Math.log(1+(docs.length-df+.5)/(df+.5))*(tf*2.2)/(tf+1.2*(.25+.75*d.terms.length/avg));}return{reference:d.reference,score};}).filter(d=>d.score>0).sort((a,b)=>b.score-a.score||a.reference.localeCompare(b.reference)).slice(0,limit);
}
