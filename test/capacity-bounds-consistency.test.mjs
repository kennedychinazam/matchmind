// Offline: every copy of the edition card and byte bounds agrees (capacity Option A, 1500 cards / 2 MiB).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAX_DOCUMENT_BYTES,PAYLOAD_SCHEMA} from '../backend/fixture-delivery/contract.mjs';
import {MAX_SOURCE_ROWS,readPages} from '../staging/mirror/refresh.mjs';
import {validateLogos} from '../staging/original-logos.mjs';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
test('JS contract, refresh, client and staging SQL carry the same bounds',()=>{
 assert.equal(MAX_DOCUMENT_BYTES,2097152);assert.equal(PAYLOAD_SCHEMA.properties.cards.max,1500);assert.equal(MAX_SOURCE_ROWS,1500);
 assert.equal(PAYLOAD_SCHEMA.properties.board.properties.rows.max,1000,'board bound unchanged');
 const html=read('index.html');
 assert.equal(JSON.parse(html.match(/const FIXTURE_DISPLAY_SCHEMA=(.*);\r?\n/)[1]).properties.cards.max,1500);
 assert.match(html,/value\.cards\.length>1500\|\|/);assert.match(html,/byteLength>2097152\)throw Error\('Display inventory exceeds limit'\)/);
 assert.doesNotMatch(html,/value\.cards\.length>1000/);
 const up=read('staging/mirror/STAGING-capacity2-up.sql');
 for(const s of['"nullable":false},"max":1500}','octet_length(v::text)>2097152','octet_length(wire)>2097152'])assert.ok(up.includes(s),s);
 assert.ok(read('staging/mirror/STAGING-capacity2-down.sql').includes('octet_length(wire)>1048576'));
});
test('refresh pagination reads a complete 1500-row inventory and refuses 1501',async()=>{
 const fake=n=>async u=>{const off=+u.searchParams.get('offset'),rows=Array.from({length:Math.max(0,Math.min(200,n-off))},(_,i)=>({fxid:off+i+1}));return{ok:true,headers:new Map([['content-range','0-0/'+n]]),json:async()=>rows};};
 assert.equal((await readPages('fixtures','fxid',[],'fxid.asc',fake(1500))).length,1500);
 assert.equal((await readPages('fixtures','fxid',[],'fxid.asc',fake(1001))).length,1001);
 await assert.rejects(readPages('fixtures','fxid',[],'fxid.asc',fake(1501)),/exceeds reviewed bound/);
});
test('logo catalog admits the raised membership',()=>{
 const fixtures=Array.from({length:1500},(_,i)=>({fxid:i+1,lid:1,home:'H',away:'A',home_logo:null,away_logo:null,llogo:null}));
 try{validateLogos({version:'matchmind-original-logos/1',fixtures});}catch(e){assert.doesNotMatch(e.message,/Invalid original-logo catalog/);}
 assert.throws(()=>validateLogos({version:'matchmind-original-logos/1',fixtures:[...fixtures,{...fixtures[0],fxid:1501}]}),/Invalid original-logo catalog/);
});
