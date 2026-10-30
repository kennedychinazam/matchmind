import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,writeFileSync,readdirSync,rmSync,statSync,symlinkSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const api=existsSync(new URL('../source-provenance/attempt-latch.mjs',import.meta.url))?await import('../source-provenance/attempt-latch.mjs'):{};
const adapter=await import('../source-provenance/provider-adapter.mjs');
const PLAN=adapter.pilotPlan().plan_hash;
const WINDOW={authorized_from_utc:'2026-10-29T00:00:00Z',authorized_until_utc:'2026-10-30T00:00:00Z'};
const NOW='2026-10-29T12:00:00Z';
const posix=process.platform!=='win32';
const root=()=>mkdtempSync(join(tmpdir(),'mm-attempt-latch-'));
const open=dir=>api.createLatch(dir,{plan_hash:PLAN,...WINDOW});

test('durable latch exposes its API, grants no authority and refuses real transport',()=>{
 for(const name of ['createLatch','readLatch','reserveAttempt','recordOutcome','dispatchSimulated','grantsExecutionAuthority','executeRealTransportUnderLatch'])assert.equal(typeof api[name],'function');
 assert.equal(api.grantsExecutionAuthority(),false);
 assert.throws(()=>api.executeRealTransportUnderLatch({director_approved:true,fetch:()=>assert.fail('no call')}),/disabled/);
});

test('one fixture and one separately capped metadata attempt, then fail closed',t=>{
 if(!posix){assert.throws(()=>open(join(root(),'latch')),/posix_private_persistence_required/);return t.skip('POSIX only');}
 const dir=join(root(),'latch');open(dir);
 assert.deepEqual(api.readLatch(dir).remaining,{fixture:1,metadata:1});
 const f=api.reserveAttempt(dir,'fixture',NOW);
 assert.deepEqual(api.readLatch(dir).remaining,{fixture:0,metadata:1});
 assert.throws(()=>api.reserveAttempt(dir,'fixture',NOW),/fixture_attempt_exhausted/);
 const m=api.reserveAttempt(dir,'metadata',NOW);
 assert.deepEqual(api.readLatch(dir).remaining,{fixture:0,metadata:0});
 assert.throws(()=>api.reserveAttempt(dir,'metadata',NOW),/metadata_attempt_exhausted/);
 assert.notEqual(f,m);
 assert.throws(()=>api.reserveAttempt(dir,'odds',NOW),/unknown_attempt_kind/);
});

test('reservations survive a real process restart and are never refunded',t=>{
 if(!posix)return t.skip('POSIX only');
 const dir=join(root(),'latch');open(dir);
 api.reserveAttempt(dir,'fixture',NOW);
 // A genuinely separate process reads the same directory: the ceiling holds
 // across restarts because it lives on disk, not in a session variable.
 const script=`import {readLatch,reserveAttempt} from ${JSON.stringify(new URL('../source-provenance/attempt-latch.mjs',import.meta.url).href)};
const s=readLatch(${JSON.stringify(dir)});
if(s.remaining.fixture!==0)process.exit(3);
try{reserveAttempt(${JSON.stringify(dir)},'fixture',${JSON.stringify(NOW)});process.exit(4);}catch{process.exit(0);}`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{timeout:10000});
 assert.equal(child.status,0,'a fresh process must see the consumed attempt and refuse another');
 // An ambiguous or failed outcome consumes the attempt all the same.
 const id=api.readLatch(dir).reservations[0].reservation_id;
 api.recordOutcome(dir,id,{status:'failed',reason:'simulated_timeout'});
 assert.equal(api.readLatch(dir).remaining.fixture,0);
 api.recordOutcome(dir,api.reserveAttempt(dir,'metadata',NOW),{status:'ambiguous',reason:'no_response_observed'});
 assert.deepEqual(api.readLatch(dir).remaining,{fixture:0,metadata:0});
});

test('duplicate outcomes, unknown reservations and stale authorization are refused',t=>{
 if(!posix)return t.skip('POSIX only');
 const dir=join(root(),'latch');open(dir);
 const id=api.reserveAttempt(dir,'fixture',NOW);
 api.recordOutcome(dir,id,{status:'response',reason:'simulated'});
 assert.throws(()=>api.recordOutcome(dir,id,{status:'response',reason:'again'}),/duplicate_outcome/);
 assert.throws(()=>api.recordOutcome(dir,'not-a-reservation',{status:'response',reason:'x'}),/unknown_reservation/);
 assert.throws(()=>api.reserveAttempt(dir,'metadata','2026-10-31T00:00:00Z'),/authorization_expired/);
 assert.throws(()=>api.reserveAttempt(dir,'metadata','2026-10-28T00:00:00Z'),/authorization_not_yet_valid/);
 assert.throws(()=>api.reserveAttempt(dir,'metadata','not-a-time'),/invalid_clock/);
});

test('tampering, truncation, extra files and a foreign plan all fail closed',t=>{
 if(!posix)return t.skip('POSIX only');
 const base=root(),dir=join(base,'latch');open(dir);
 api.reserveAttempt(dir,'fixture',NOW);
 const names=readdirSync(dir).sort();
 assert.equal(names.length,2);
 // Edited record body no longer matches its own hash.
 const edited=join(base,'edited');api.createLatch(edited,{plan_hash:PLAN,...WINDOW});
 const first=join(edited,readdirSync(edited)[0]);
 const rec=JSON.parse(readFileSync(first,'utf8'));rec.allowances.fixture=5;
 writeFileSync(first,JSON.stringify(rec));
 assert.throws(()=>api.readLatch(edited),/record_hash_mismatch/);
 // Removing a generation breaks the chain rather than lowering the count.
 const gap=join(base,'gap');api.createLatch(gap,{plan_hash:PLAN,...WINDOW});
 api.reserveAttempt(gap,'fixture',NOW);api.reserveAttempt(gap,'metadata',NOW);
 rmSync(join(gap,readdirSync(gap).sort()[1]));
 assert.throws(()=>api.readLatch(gap),/missing_record/);
 // An unexpected file in the private directory is not ignored.
 const extra=join(base,'extra');api.createLatch(extra,{plan_hash:PLAN,...WINDOW});
 writeFileSync(join(extra,'notes.txt'),'x');
 assert.throws(()=>api.readLatch(extra),/unexpected_latch_file/);
 // A latch is bound to the reviewed plan it was opened for.
 const foreign=join(base,'foreign');
 assert.throws(()=>api.createLatch(foreign,{plan_hash:'f'.repeat(64),...WINDOW}),/plan_hash_mismatch/);
 assert.equal(existsSync(foreign),false);
 // Symlinked directories and files are refused.
 const link=join(base,'link');symlinkSync(dir,link,'dir');
 assert.throws(()=>api.readLatch(link));
});

test('a fresh process or session cannot mint or reset genuine authority',t=>{
 if(!posix)return t.skip('POSIX only');
 const base=root(),dir=join(base,'latch');open(dir);
 api.reserveAttempt(dir,'fixture',NOW);
 // Re-opening an existing latch never resets the ceiling.
 assert.throws(()=>open(dir),/latch_already_exists/);
 assert.equal(api.readLatch(dir).remaining.fixture,0);
 // The stored authorization records in data that it grants nothing.
 const auth=api.readLatch(dir).authorization;
 assert.equal(auth.grants_execution_authority,false);
 assert.equal(auth.classification,'synthetic_only');
 assert.equal(auth.plan_hash,PLAN);
 // A second latch directory is not a second authority: dispatch stays simulated
 // and the real transport is unconditionally disabled.
 const second=join(base,'second');open(second);
 assert.equal(api.grantsExecutionAuthority(),false);
 assert.throws(()=>api.executeRealTransportUnderLatch(),/disabled/);
 assert.equal(api.readLatch(second).authorization.grants_execution_authority,false);
});

test('simulated dispatch consumes before transport and records both outcomes',t=>{
 if(!posix)return t.skip('POSIX only');
 const base=root();
 const ok=join(base,'ok');open(ok);
 const order=[];
 const r=api.dispatchSimulated(ok,{attempt:'fixture',simulated:true,transport:()=>{order.push('transport:remaining='+api.readLatch(ok).remaining.fixture);return{status:200};}},NOW);
 assert.deepEqual(order,['transport:remaining=0'],'the attempt is consumed before the transport runs');
 assert.equal(r.outcome.status,'response');
 assert.equal(api.readLatch(ok).remaining.fixture,0);
 // A throwing transport still consumes the attempt and leaves failure evidence.
 const bad=join(base,'bad');open(bad);
 assert.throws(()=>api.dispatchSimulated(bad,{attempt:'fixture',simulated:true,transport:()=>{throw Error('simulated_network_loss');}},NOW),/simulated_dispatch_failed/);
 const s=api.readLatch(bad);
 assert.equal(s.remaining.fixture,0);
 assert.equal(s.outcomes.length,1);
 assert.equal(s.outcomes[0].outcome.status,'failed');
 // Anything not explicitly simulated is refused before any attempt is consumed.
 const guard=join(base,'guard');open(guard);
 for(const bad2 of [{attempt:'fixture',transport:()=>({})},{attempt:'fixture',simulated:false,transport:()=>({})},{attempt:'fixture',simulated:true},{attempt:'fixture',simulated:true,transport:{fetch(){}}}])
  assert.throws(()=>api.dispatchSimulated(guard,bad2,NOW),/simulated_transport_required/);
 assert.deepEqual(api.readLatch(guard).remaining,{fixture:1,metadata:1},'a refused dispatch consumes nothing');
});

test('latch files are private, exclusive and immutable receipts',t=>{
 if(!posix)return t.skip('POSIX only');
 const dir=join(root(),'latch');open(dir);
 const id=api.reserveAttempt(dir,'fixture',NOW);
 api.recordOutcome(dir,id,{status:'response',reason:'simulated'});
 assert.equal(statSync(dir).mode&0o777,0o700);
 for(const f of readdirSync(dir))assert.equal(statSync(join(dir,f)).mode&0o777,0o600);
 const s=api.readLatch(dir);
 assert.equal(s.directory_mode,0o700,'the mode is reported so a later breach is visible');
 // Independent review finding: a directory created in advance used to be
 // accepted, leaving the receipts in whatever mode it already had. The latch now
 // creates its own directory or refuses.
 const pre=join(root(),'pre-created');mkdirSync(pre,{mode:0o755});
 assert.throws(()=>open(pre),/latch_already_exists/);
 assert.deepEqual(readdirSync(pre),[],'nothing is written into a directory it did not create');
 assert.equal(s.records.length,3);
 assert.deepEqual(s.records.map(r=>r.type),['authorization','reservation','outcome']);
 // Each record chains to the one before it.
 for(let i=1;i<s.records.length;i++)assert.equal(s.records[i].parent_sha256,s.records[i-1].record_sha256);
 assert.equal(s.records[0].parent_sha256,null);
});
