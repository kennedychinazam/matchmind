import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,rmSync,symlinkSync,statSync}from 'node:fs';
import {tmpdir}from 'node:os';
import {resolve,join}from 'node:path';
const api=await import('../phase8/files.mjs').catch(()=>({}));
test('private archive guards reject repository paths including dot-dot-prefixed names and symlinks',()=>{
 assert.equal(typeof api.privateDirectory,'function');
 const root=resolve(new URL('../../',import.meta.url).pathname),inside=join(root,'..private-phase8-test'),outside=mkdtempSync(join(tmpdir(),'mm-phase8-private-'));
 try{
  mkdirSync(inside,{recursive:true});symlinkSync(inside,join(outside,'link'));
  for(const p of [root,inside,join(outside,'link')])assert.throws(()=>api.privateDirectory(p),/outside/);
  assert.equal(api.privateDirectory(outside),outside);assert.equal(statSync(outside).mode&0o777,0o700);
 }finally{rmSync(inside,{recursive:true,force:true});rmSync(outside,{recursive:true,force:true});}
});
