import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,writeFileSync,rmSync}from 'node:fs';import {join}from 'node:path';import {tmpdir}from 'node:os';import {createHash}from 'node:crypto';
const api=await import('../phase8/archive.mjs').catch(()=>({}));
test('each outcome poll explicitly restores its selected verified predecessor instead of forking the first ledger',()=>{
 assert.equal(typeof api.loadBackup,'function');const dir=mkdtempSync(join(tmpdir(),'mm-weekend-chain-'));
 try{for(const[name,body]of [['private-weekend-backup.sql','first'],['next.sql','first plus corrections']]){writeFileSync(join(dir,name),body);writeFileSync(join(dir,name+'.sha256'),createHash('sha256').update(body).digest('hex'));}
  assert.equal(api.loadBackup(dir,'next.sql','next.sql.sha256'),'first plus corrections');
  assert.throws(()=>api.loadBackup(dir,'next.sql','private-weekend-backup.sql.sha256'),/hash/);
  assert.throws(()=>api.loadBackup(dir,'../outside.sql','next.sql.sha256'),/name/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
