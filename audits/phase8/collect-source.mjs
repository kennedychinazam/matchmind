import {writeFileSync}from 'node:fs';import {resolve}from 'node:path';
import {privateDirectory}from './files.mjs';import {collectReadonly}from './source.mjs';
if(process.argv.length!==4||process.argv[3]!=='--read-only')throw Error('usage: node audits/phase8/collect-source.mjs /private/new-directory --read-only');
const directory=privateDirectory(process.argv[2]),source=await collectReadonly();
writeFileSync(resolve(directory,'raw-source.json'),JSON.stringify(source),{mode:0o600,flag:'wx'});
process.stdout.write(JSON.stringify({rows:source.rows.length,targets:source.targets.length,read_at_utc:source.source_read_at_utc})+'\n');
