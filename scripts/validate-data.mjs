#!/usr/bin/env node
import {createReadStream, existsSync, readFileSync} from 'node:fs';
import {createInterface} from 'node:readline';
const counts = new Map();
const keys = new Set();
let total=0;
const path = process.argv[2] || '.data/verses.jsonl';
if (!existsSync(path)) throw new Error(`Missing ${path}. Download source data first.`);
for await (const line of createInterface({input:createReadStream(path), crlfDelay:Infinity})) {
 if (!line.trim()) continue;
 const v=JSON.parse(line);
 if (!v.translation || !v.book || !Number.isInteger(v.chapter) || !Number.isInteger(v.verse) || typeof v.text !== 'string' || !v.text.trim() || !v.ref) throw new Error(`Invalid verse at row ${total+1}`);
 const key=`${v.translation}:${v.ref}`;
 if (keys.has(key)) throw new Error(`Duplicate verse ${key}`);
 keys.add(key); counts.set(v.translation,(counts.get(v.translation)||0)+1); total++;
}
if (!total) throw new Error('No verses downloaded');
console.log(JSON.stringify({total,translations:Object.fromEntries(counts)},null,2));
for (const ref of ['KJV:GEN.1.1','KJV:JHN.3.16','KJV:LUK.23.43','BSB:GEN.1.1','BSB:LUK.23.43']) {
 if (!keys.has(ref)) throw new Error(`Missing canonical validation verse ${ref}`);
}
console.log('Verse uniqueness, required fields, and canonical reference checks passed.');
