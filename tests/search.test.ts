import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { searchPassages, parseReference, searchLiteral, passages } from '../shared/search';
import { evaluationCases, evaluationMetadata } from '../shared/evaluation';

test('normalizes human and canonical references, including numbered books and ranges',()=>{
  assert.deepEqual(parseReference('Luke 23:39–43'),{book:'LUK',chapter:23,verseStart:39,verseEnd:43,reference:'LUK.23.39-43'});
  assert.equal(parseReference('LUK.23.39-43')?.reference,'LUK.23.39-43');
  assert.equal(parseReference('1 John 3:16')?.book,'1JN');
  assert.equal(parseReference('Song of Songs 2:1')?.book,'SNG');
  assert.equal(parseReference('Psalm 23')?.reference,'PSA.23');
  assert.equal(parseReference('John 3:20-16'),null);
  assert.equal(parseReference('nonsense 3:16'),null);
});
test('canonical verse references find containing passages without unrelated chapter results',()=>{
  assert.equal(searchPassages('Luke 23:42',3)[0].reference,'LUK.23.39-43');
  assert.equal(searchPassages('John 3:16',3)[0].reference,'JHN.3.1-21');
  assert.deepEqual(searchPassages('',3),[]);
  assert.deepEqual(searchPassages('   ',3),[]);
  assert.deepEqual(searchPassages('zqxwvvv',3),[]);
});
const essential=[
  ['thief who got saved on the cross at the last minute','LUK.23.39-43'],
  ['dude fell asleep during a long sermon and out the window','ACT.20.7-12'],
  ['woman turned to salt when she looked back','GEN.19.15-26'],
  ['I feel invisible nobody sees me','GEN.16.7-13'],
  ['why do innocent people suffer like Job','JOB.1.1-22'],
];
for(const [query,expected]of essential)test(`finds colloquial scene: ${query}`,()=>assert.ok(searchPassages(query,3).some(p=>p.reference===expected),JSON.stringify(searchPassages(query,3).map(p=>p.reference))));
test('Job accusation identifies Eliphaz and does not silently endorse his speech',()=>{
  const p=searchPassages('Eliphaz innocent perish',3).find(p=>p.reference==='JOB.4.7-9');
  assert.ok(p);assert.equal(p.speaker,'Eliphaz');assert.ok(p.cautions?.some(c=>c.includes('Do not present')));assert.equal(p.provenance.reviewed,false);
});
test('50 regression queries have explicit canonical keys and measured Hit@3',()=>{
  assert.equal(evaluationCases.length,50);assert.equal(evaluationMetadata.heldOut,false);
  const missing=evaluationCases.filter(c=>!passages.some(p=>p.reference===c.expected));assert.deepEqual(missing,[]);
  const hits=evaluationCases.filter(c=>searchPassages(c.query,3).some(p=>p.reference===c.expected));
  console.log(`Curated regression Hit@3: ${hits.length}/${evaluationCases.length} (in-sample fixture set)`);
  for(const c of evaluationCases.filter(c=>!hits.includes(c)))console.log('Regression miss:',c.query,c.expected);
  assert.ok(hits.length>=40,'At least 80% on the explicit regression fixture');
});
test('literal comparison uses genuine KJV source on same candidate set',{skip:!existsSync('.data/layer-source-text.json')},()=>{
  const source=JSON.parse(readFileSync('.data/layer-source-text.json','utf8'));
  assert.equal(Object.keys(source).length,passages.length);
  assert.ok(source['LUK.23.39-43'].includes('paradise'));
  const layerHits=evaluationCases.filter(c=>searchPassages(c.query,3).some(p=>p.reference===c.expected)).length;
  const literalHits=evaluationCases.filter(c=>searchLiteral(c.query,source,3).some(p=>p.reference===c.expected)).length;
  console.log(`Paired regression: layer ${layerHits}/50; literal KJV ${literalHits}/50; same ${passages.length} passage candidates.`);
  assert.ok(layerHits>literalHits,'Discovery layer should improve this curated colloquial regression fixture');
});
