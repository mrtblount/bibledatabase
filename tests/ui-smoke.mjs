import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { ({ chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/codex/cua_node/lib/node_modules/playwright')); }
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 1050 } });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const results = [];
async function check(name, fn) { try { await fn(); results.push({ name, passed: true }); console.log(`PASS ${name}`); } catch (error) { results.push({ name, passed: false, error: error.message }); console.error(`FAIL ${name}: ${error.message}`); } }
try {
  await page.goto(process.env.APP_URL || 'http://127.0.0.1:5173');
  await page.getByLabel('Search Scripture').waitFor({ timeout: 20000 });
  await page.getByLabel('Translation').locator('option[value="KJV"]').waitFor({ state: 'attached', timeout: 20000 });
  await mkdir('test-results', { recursive: true });
  await page.screenshot({ path: 'test-results/desktop-discover.png', fullPage: true });
  for (const [query, reference] of [
    ["Who's that dude that just barely made it to heaven? He squeezed himself in at the last minute.", 'Luke 23:39'],
    ['The guy who fell asleep during a sermon and fell out a window.', 'Acts 20:'],
    ['The lady who looked back and turned into salt.', 'Genesis 19:'],
    ['I feel invisible at work.', 'Genesis 16:'],
    ['John 3:16', 'John 3:16'],
  ]) {
    await check(`Search ${reference}`, async () => {
      await page.getByLabel('Search Scripture').fill(query);
      await page.getByRole('button', { name: 'Search', exact: true }).click();
      await page.locator('.result-card').first().waitFor({ timeout: 15000 });
      await page.waitForFunction(ref => Array.from(document.querySelectorAll('.result-card .reference-link')).slice(0,3).some(e=>e.textContent.includes(ref)), reference, { timeout: 15000 });
    });
  }
  await check('Translation switch changes real verse text', async () => {
    const before = await page.locator('.result-card blockquote').first().textContent();
    await page.getByLabel('Translation').selectOption('ASV');
    await page.waitForFunction(text => document.querySelector('.result-card blockquote')?.textContent !== text, before, { timeout: 10000 });
    assert.match(await page.locator('.result-card').first().textContent(), /ASV/);
  });
  await check('Saved passage and note survive reload', async () => {
    await page.getByRole('button', { name: 'Save passage', exact: true }).first().click();
    await page.getByRole('button', { name: /My notebook/ }).click();
    const note = page.getByLabel('YOUR REFLECTION').first();
    await note.waitFor({ timeout: 10000 });
    await note.fill('Browser validation: source text stays anchored.');
    await page.getByRole('button', { name: 'Save note', exact: true }).first().click();
    await page.getByRole('status').filter({ hasText: 'Note saved' }).waitFor();
    await page.reload();
    await page.getByLabel('YOUR REFLECTION').first().waitFor();
    assert.equal(await page.getByLabel('YOUR REFLECTION').first().inputValue(), 'Browser validation: source text stays anchored.');
  });
  await check('Reader navigation renders Genesis 2', async () => {
    await page.getByRole('button', { name: 'Bible reader', exact: true }).click();
    await page.getByLabel('Book', { exact: true }).selectOption('GEN');
    await page.getByLabel('Chapter', { exact: true }).selectOption('2');
    await page.waitForFunction(() => document.querySelector('.scripture-text')?.textContent.includes('heavens'), null, { timeout: 10000 });
  });
  await check('Knowledge graph renders nodes', async () => {
    await page.getByRole('button', { name: 'Knowledge graph', exact: true }).click();
    await page.getByRole('img', { name: /Knowledge graph/ }).waitFor();
    assert.ok(await page.locator('.graph-node').count() > 1);
  });
  await check('Language layer contains imported expressions', async () => {
    await page.getByRole('button', { name: 'Language layer', exact: true }).click();
    await page.locator('.expansion-card').first().waitFor();
    assert.ok(await page.locator('.expansion-card').count() > 5);
  });
  await check('Evaluation action persists results', async () => {
    await page.getByRole('button', { name: 'Evaluation lab', exact: true }).click();
    await page.getByRole('button', { name: 'Run evaluation', exact: true }).click();
    await page.locator('.evaluation-table tbody tr').first().waitFor({ timeout: 15000 });
    assert.ok(await page.locator('.evaluation-table tbody tr').count() >= 5);
  });
  await check('Mobile navigation and overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Open navigation' }).click();
    await page.getByRole('button', { name: 'Discover', exact: true }).click();
    await page.getByLabel('Search Scripture').waitFor();
    await page.screenshot({ path: 'test-results/mobile-discover.png', fullPage: true });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    assert.equal(overflow, false);
  });
  await check('No browser runtime errors', async () => assert.deepEqual(errors, []));
  console.log(JSON.stringify({ results, errors }, null, 2));
  if (results.some(r => !r.passed)) process.exitCode = 1;
} finally { await browser.close(); }
