import test from 'node:test';
import assert from 'node:assert/strict';
import {providerConfig, verifyQuote, typedDecision, requestJson, jevProvider} from './providers.mjs';

test('quote validation requires exact source words and reports provenance', () => {
  const sources = [{reference: 'JHN.3.16', translation: 'KJV', text: 'For God so loved the world, that he gave his only begotten Son,'}];
  assert.deepEqual(verifyQuote('God so loved the world', sources), {valid: true, matches: [{reference: 'JHN.3.16', translation: 'KJV'}]});
  assert.equal(verifyQuote('God really loved the world', sources).valid, false);
  assert.equal(verifyQuote('god so loved the world', sources).valid, false);
  assert.equal(verifyQuote('', sources).valid, false);
});

test('provider requires secure remote endpoints and supports local test servers', () => {
  assert.throws(() => providerConfig({BIBLE_AI_BASE_URL: 'http://example.com/v1'}), /HTTPS/);
  assert.equal(providerConfig({BIBLE_AI_BASE_URL: 'http://127.0.0.1:8787/v1/'}).baseUrl, 'http://127.0.0.1:8787/v1');
});

test('missing credentials never initiate a provider request', async () => {
  await assert.rejects(requestJson([], {config: {baseUrl:'https://example.com', apiKey:null}}), /API_KEY/);
});

test('Jev fails explicitly rather than calling an invented endpoint', () => {
  assert.throws(jevProvider, /not configured/);
});

test('typed routing rejects unknown categories and invalid confidence', async () => {
  const originalFetch = globalThis.fetch;
  const config = {baseUrl:'http://localhost/v1', apiKey:'test-only', model:'test-model', timeoutMs:1000};
  try {
    globalThis.fetch = async () => ({ok:true, json:async () => ({choices:[{message:{content:JSON.stringify({choice:'invented',confidence:0.9})}}]})});
    await assert.rejects(typedDecision('who was he?', ['person','topic'], config), /invalid typed decision/);
    globalThis.fetch = async () => ({ok:true, json:async () => ({choices:[{message:{content:JSON.stringify({choice:'person',confidence:0.9})}}]})});
    assert.deepEqual(await typedDecision('who was he?', ['person','topic'], config), {choice:'person',confidence:0.9,model:'test-model',method:'openai-compatible'});
  } finally {globalThis.fetch = originalFetch;}
});

test('pipeline writes source-grounded rows and independently queues uncertain entries', async () => {
  const {mkdtemp, writeFile, readFile, rm} = await import('node:fs/promises');
  const {tmpdir} = await import('node:os');
  const {join} = await import('node:path');
  const {main} = await import('./generate-layer.mjs');
  const dir = await mkdtemp(join(tmpdir(), 'lumen-pipeline-test-'));
  const originalFetch = globalThis.fetch;
  const previous = process.env.BIBLE_AI_API_KEY;
  let calls = 0;
  try {
    const input = join(dir, 'verses.jsonl'), passages = join(dir, 'passages.json'), output = join(dir, 'run.jsonl');
    await writeFile(input, JSON.stringify({translation:'BSB', book:'MRK', chapter:1, verse:1, reference:'MRK.1.1', text:'The beginning of the gospel of Jesus Christ, the Son of God.'})+'\n');
    await writeFile(passages, '["MRK.1.1"]');
    process.env.BIBLE_AI_API_KEY = 'test-only-never-transmitted';
    globalThis.fetch = async (_url, options) => {
      calls++;
      const payload = JSON.parse(options.body);
      const checker = payload.messages[0].content.includes('independent source-grounding checker');
      const value = checker ? {assessments:[{index:0,score:0.98,verdict:'faithful',reason:'Source supported.'},{index:1,score:0.7,verdict:'uncertain',reason:'Review context.'}]} : {entries:[{text:'The beginning of the gospel about Jesus.'},{text:'The start of a remembered story.'}]};
      return {ok:true, json:async () => ({model:checker?'test-checker':'test-generator', choices:[{message:{content:JSON.stringify(value)}}]})};
    };
    await main(['--input',input,'--passages',passages,'--output',output,'--limit','1']);
    const rows = (await readFile(output,'utf8')).trim().split('\n').map(JSON.parse);
    assert.equal(calls, 10);
    assert.equal(rows.length, 10);
    assert.equal(rows.filter(row => row.status==='approved').length, 5);
    assert.equal(rows.filter(row => row.status==='draft').length, 5);
    assert.equal(new Set(rows.map(row => row.type)).size, 5);
    assert.equal(rows[0].faithfulness.checkerModel, 'test-checker');
    assert.equal(rows[0].provenance.sourceWords[0].text, 'The beginning of the gospel of Jesus Christ, the Son of God.');
    assert.equal(rows[0].provenance.sourceRefs[0].reference, 'MRK.1.1');
    assert.equal(rows[0].model, 'test-generator');
    await assert.rejects(main(['--input',input,'--passages',passages,'--output',output,'--limit','1']), /EEXIST/);
  } finally {
    globalThis.fetch = originalFetch;
    if (previous === undefined) delete process.env.BIBLE_AI_API_KEY;
    else process.env.BIBLE_AI_API_KEY = previous;
    await rm(dir, {recursive:true,force:true});
  }
});
