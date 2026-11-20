// Immutable engine regions from accepted public7420905. Display/credential integration must not tune models.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const regions=[
  {
    "name": "football engine",
    "start": "const footballEngine = {",
    "end": "const basketballEngine = {",
    "sha256": "994b4145c3c619568e46e36277d9ac4947a976476e8ba5f9744a78ee2906739e"
  },
  {
    "name": "basketball engine and existing payload scaffolding",
    "start": "const basketballEngine = {",
    "end": "const AI_PROMPT = `",
    "sha256": "7a68c808e0fb84d461610c2aa8ab66185748108af9c691dffd3e0666fdc146c3"
  }
];
for(const r of regions)test('WO62B preserves '+r.name,()=>{
 const a=source.indexOf(r.start),b=source.indexOf(r.end);assert.ok(a>=0&&b>a,'unique original region bounds');
 assert.equal(createHash('sha256').update(source.slice(a,b)).digest('hex'),r.sha256);
});
