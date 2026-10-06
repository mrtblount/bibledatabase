#!/usr/bin/env node
import { existsSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

// The Convex CLI authenticates with the user's configured cloud deployment.
// Never replace user notes, evaluations, reviews, or previous generation runs.
const args = process.argv.slice(2);
const dir = resolve(args.find(a => !a.startsWith('--')) || '.data');
const replace = args.includes('--replace-source-data');
const prod = args.includes('--prod');
const tables = ['translations', 'books', 'verses', 'crossReferences', 'entities', 'passages', 'expansions', 'evaluationCases'];
if (!existsSync(dir)) throw new Error(`No seed data in ${dir}. Run the download and layer-seed scripts first.`);
let imported = 0;
for (const table of tables) {
  const path = resolve(dir, `${table}.jsonl`);
  if (!existsSync(path)) continue;
  const replaceable = ['translations', 'books', 'verses', 'crossReferences', 'entities'].includes(table);
  const command = ['convex', 'import', '--table', table, path];
  if (replace && replaceable) command.push('--replace', '--yes');
  if (prod) command.push('--prod');
  console.log(`Importing ${table} from ${path}`);
  const result = spawnSync('npx', command, {stdio:'inherit'});
  if (result.status !== 0) process.exit(result.status || 1);
  imported++;
}
if (!imported) throw new Error(`No recognized JSONL tables in ${dir}. Found: ${readdirSync(dir).join(', ')}`);
console.log(`Imported ${imported} tables. Source imports are independent of user workspace data.`);
