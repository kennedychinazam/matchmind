// Offline aggregate-only entrypoint; never connects to a database or provider.
import {readFileSync}from 'node:fs';
import {buildReport}from './report.mjs';
if(process.argv.length!==3)throw Error('usage: node audits/phase6/evaluate.mjs /private/frozen-study.json');
process.stdout.write(JSON.stringify(buildReport(JSON.parse(readFileSync(process.argv[2],'utf8'))),null,2)+'\n');
