import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {createHash} from 'node:crypto';
const api=await import('../phase8-continuation/checkpoint.mjs').catch(()=>({}));
test('private checkpoint chain writes full exclusive backups, carries liability and rejects broken parent continuity',()=>{
 assert.equal(typeof api.checkpointWriter,'function');const dir=mkdtempSync(join(tmpdir(),'mm-or-checkpoint-'));
 try{
  let dump='first complete SQL',liability=306000;const write=api.checkpointWriter({dump:()=>dump}, {reservedMicros:()=>liability,events:()=>[{event_id:'one',event_body_hash:'immutable',received_at:'original'}]},dir,'a'.repeat(64));
  const one=write();dump+=' plus response';liability=612000;const two=write();assert.equal(two.parent_sha256,one.backup_sha256);assert.equal(two.reserved_micros,612000);
  assert.equal(readFileSync(join(dir,two.backup),'utf8'),dump);assert.equal(createHash('sha256').update(dump).digest('hex'),two.backup_sha256);
  assert.throws(()=>api.checkpointWriter({dump:()=>dump},{},dir,'a'.repeat(64)),/empty|existing/);
  assert.throws(()=>api.verifyCheckpointFiles(dir,'b'.repeat(64)),/parent/);
  assert.equal(api.verifyCheckpointFiles(dir,'a'.repeat(64)).at(-1).reserved_micros,612000);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
