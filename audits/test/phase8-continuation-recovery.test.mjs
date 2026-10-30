import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const api=await import('../phase8-continuation/recovery.mjs').catch(()=>({}));
const hash=x=>createHash('sha256').update(x).digest('hex');
function archive(dir,name='../escape',kind='file'){
 const file=join(dir,'recovery.tgz');
 execFileSync('python3',['-c',`import tarfile,io,sys
with tarfile.open(sys.argv[1],'w:gz') as t:
 m=tarfile.TarInfo(sys.argv[2]); m.size=3
 if sys.argv[3]=='link': m.type=tarfile.SYMTYPE; m.linkname='/etc/passwd'; m.size=0
 t.addfile(m,io.BytesIO(b'abc') if m.size else None)`,file,name,kind]);
 writeFileSync(file+'.sha256',hash(readFileSync(file))+'  recovery.tgz\n');return file;
}
test('recovery verifies bytes before extraction and rejects unsafe archive members',()=>{
 assert.equal(typeof api.extractRecovery,'function');const dir=mkdtempSync(join(tmpdir(),'mm-recovery-'));
 try{
  const file=archive(dir);assert.throws(()=>api.extractRecovery(file,file+'.sha256',join(dir,'bad')),/archive|unsafe/);assert.equal(existsSync(join(dir,'escape')),false);
  archive(dir,'saturday-run/link','link');assert.throws(()=>api.extractRecovery(file,file+'.sha256',join(dir,'link')),/archive|unsafe/);
  archive(dir,'raw-source.json');writeFileSync(file+'.sha256','0'.repeat(64));assert.throws(()=>api.extractRecovery(file,file+'.sha256',join(dir,'corrupt')),/checksum/);
  archive(dir,'raw-source.json');api.extractRecovery(file,file+'.sha256',join(dir,'ok'));assert.equal(readFileSync(join(dir,'ok/raw-source.json'),'utf8'),'abc');
  assert.throws(()=>api.extractRecovery(file,file+'.sha256',join(dir,'ok')),/empty|exist/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('ancestry rejects missing, changed, forked or decreasing-liability checkpoints',()=>{
 assert.equal(typeof api.verifyAncestry,'function');
 const a={name:'first',events:[{event_id:'one',hash:'a',received:'old'}],liability_micros:200};
 const b={name:'last',events:[...a.events,{event_id:'two',hash:'b',received:'new'}],liability_micros:300};
 assert.equal(api.verifyAncestry([a,b]).liability_micros,300);
 for(const altered of [{...b,events:[]},{...b,events:[{...a.events[0],hash:'changed'}]},{...b,events:[{...a.events[0],received:'new'}]},{...b,liability_micros:0}])assert.throws(()=>api.verifyAncestry([a,altered]),/ancestry|liability/);
 assert.throws(()=>api.verifyAncestry([]),/checkpoint/);
});
test('frozen engine artifact must match each original stored forecast and exact packet hash',()=>{
 assert.equal(typeof api.verifyFrozenEngine,'function');const body={fixture_id:'1',probabilities:[.4,.3,.3],prediction:{pW:.4,pD:.3,pL:.3}},engine={source_sha256:'source',input_hash:'input',predictions:[body]},stored=[{body:{arm:'E-Refreshed',status:'forecast',input_hash:'input',...body}}];
 assert.equal(api.verifyFrozenEngine(engine,stored,'source','input'),1);
 assert.throws(()=>api.verifyFrozenEngine(engine,[{body:{...stored[0].body,probabilities:[.8,.1,.1]}}],'source','input'),/frozen/);
 assert.throws(()=>api.verifyFrozenEngine(engine,stored,'source','other'),/frozen/);
});
test('auxiliary dumps must be verified logical ancestors; differing dump formatting cannot hide new liability',()=>{
 assert.equal(typeof api.classifyAuxiliary,'function');const base={name:'known.sql',events:[{event_id:'one',hash:'same',received:'original'}],liability_micros:100};
 assert.equal(api.classifyAuxiliary({...base,name:'emergency.sql'},[base]).matches,'known.sql');
 assert.throws(()=>api.classifyAuxiliary({...base,events:[...base.events,{event_id:'hidden',hash:'x'}]},[base]),/ancestry|backup/);
 assert.throws(()=>api.classifyAuxiliary({...base,liability_micros:200},[base]),/ancestry|backup/);
});
