import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,writeFileSync,unlinkSync,rmSync,statSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const url=new URL('../source-provenance/retention.mjs',import.meta.url);
const api=existsSync(url)?await import('../source-provenance/retention.mjs'):{};
const adapter=await import('../source-provenance/provider-adapter.mjs');
const {canonicalHash}=await import('../lib/snapshot-contract.mjs');

const ids=[788036,788048,788038];
const meta=()=>({request_id:'synthetic-retention-001',request_started_at_utc:'2026-10-29T01:00:00Z',response_received_at_utc:'2026-10-29T01:00:01Z',collector_sha256:'a'.repeat(64)});
const fixture=(id,i)=>({fixture:{id,date:'2021-10-26T18:45:00Z',status:{short:['FT','AET','PEN'][i],long:'Synthetic finished status',elapsed:120,extra:null}},league:{id:81,name:'Synthetic Cup',country:'Synthetic Country',season:2021},teams:{home:{id:10+i*2,name:'Home '+i},away:{id:11+i*2,name:'Away '+i}},goals:{home:i+1,away:i},score:{halftime:{home:0,away:0},fulltime:{home:i+1,away:i},extratime:{home:null,away:null},penalty:{home:null,away:null}}});
const body=()=>Buffer.from(JSON.stringify({get:'fixtures',parameters:{ids:'788036-788048-788038'},errors:[],results:3,paging:{current:1,total:1},response:ids.map(fixture)}));
const response=()=>({status:200,headers:{'content-type':'application/json; charset=utf-8'},body:body(),body_complete:true,content_decoding:{mode:'none',encoding:'identity'}});
const capture=()=>adapter.createSyntheticSession().captureFixture(response(),meta());

const posix=process.platform!=='win32';
const root=()=>mkdtempSync(join(tmpdir(),'mm-retention-'));
const NOW='2026-11-01T00:00:00Z';
const REG=()=>({storage_id:'synthetic-private-volume',reviewers:['owner','independent-reviewer'],backups:[],nowUtc:NOW});
// A registered store: the adapter writes the capture, retention registers over it.
function store(extra={}){
 const dir=join(root(),'capture');
 adapter.writeAdapterCapture(dir,capture());
 api.registerRetention(dir,{...REG(),...extra});
 return dir;
}

test('retention API exists, grants no authority and refuses real transport',()=>{
 for(const name of ['retentionPolicy','registerRetention','readRetention','assertRetainable','planDeletion','recordSubscriptionEnd','beginDeletion','executeDeletion','verifyDeletion','grantsExecutionAuthority','executeRealTransportUnderRetention'])assert.equal(typeof api[name],'function');
 assert.equal(api.grantsExecutionAuthority(),false);
 assert.throws(()=>api.executeRealTransportUnderRetention({director_approved:true,fetch:()=>assert.fail('no call')}),/disabled/);
});

test('the policy deletes before the subscription expires, and says so in data',()=>{
 const p=api.retentionPolicy();
 assert.equal(p.subscription_expires_utc,'2026-11-11T13:47:51Z');
 assert.equal(p.deletion_deadline_utc,'2026-11-10T12:00:00Z');
 assert.equal(Date.parse(p.deletion_deadline_utc)<Date.parse(p.subscription_expires_utc),true);
 assert.equal(p.condition,'subscription_active');
 assert.equal(p.grants_execution_authority,false);
 assert.throws(()=>{p.deletion_deadline_utc='2099-01-01T00:00:00Z';});
});

test('a registered capture is retainable inside the window and the record chains',t=>{
 if(!posix){assert.throws(()=>api.registerRetention(join(root(),'x'),REG()),/posix_private_persistence_required/);return t.skip('POSIX only');}
 const dir=store();
 const state=api.readRetention(dir);
 assert.equal(state.registration.type,'registration');
 assert.equal(state.registration.parent_sha256,null);
 assert.equal(state.registration.storage_id,'synthetic-private-volume');
 assert.equal(state.deleted,false);
 const view=api.assertRetainable(dir,NOW);
 assert.equal(view.retainable,true);
 assert.equal(view.raw_present,true);
 assert.equal(statSync(join(dir,'retention-000001.json')).mode&0o777,0o600);
 assert.throws(()=>api.registerRetention(dir,REG()),/retention_already_registered/);
});

test('an expired subscription or a passed deadline refuses retention, fail closed',t=>{
 if(!posix)return t.skip('POSIX only');
 const dir=store();
 assert.throws(()=>api.assertRetainable(dir,'2026-11-10T12:00:00Z'),/retention_deadline_passed/);
 assert.throws(()=>api.assertRetainable(dir,'2026-11-12T00:00:00Z'),/retention_deadline_passed/);
 assert.throws(()=>api.assertRetainable(dir,'not-a-clock'),/invalid_clock/);
 // Simulated expiry at registration time: nothing may be newly retained past the boundary.
 const late=join(root(),'late');
 adapter.writeAdapterCapture(late,capture());
 assert.throws(()=>api.registerRetention(late,{...REG(),nowUtc:'2026-11-10T12:00:01Z'}),/retention_deadline_passed/);
 assert.equal(existsSync(join(late,'retention-000001.json')),false);
});

test('a partial capture cannot be registered or asserted as retainable',t=>{
 if(!posix)return t.skip('POSIX only');
 const dir=join(root(),'capture');
 adapter.writeAdapterCapture(dir,capture());
 unlinkSync(join(dir,'response.bin'));
 assert.throws(()=>api.registerRetention(dir,REG()));
 assert.equal(readdirSync(dir).some(f=>f.startsWith('retention-')),false);
 const other=store();
 const bytes=readFileSync(join(other,'response.bin'));
 writeFileSync(join(other,'response.bin'),Buffer.concat([bytes,Buffer.from('x')]));
 assert.throws(()=>api.assertRetainable(other,NOW));
});

test('tampered retention metadata is refused, and so is a missing link',t=>{
 if(!posix)return t.skip('POSIX only');
 const dir=store();
 const file=join(dir,'retention-000001.json');
 const record=JSON.parse(readFileSync(file,'utf8'));
 record.deletion_deadline_utc='2099-01-01T00:00:00Z';
 writeFileSync(file,JSON.stringify(record));
 assert.throws(()=>api.readRetention(dir),/record_hash_mismatch/);
 assert.throws(()=>api.assertRetainable(dir,NOW),/record_hash_mismatch/);
 // Re-hashed consistently but still off-policy: the snapshot must match the policy.
 const second=store();
 const sfile=join(second,'retention-000001.json');
 const s=JSON.parse(readFileSync(sfile,'utf8'));
 delete s.record_sha256;s.deletion_deadline_utc='2099-01-01T00:00:00Z';
 s.record_sha256=canonicalHash(s);
 writeFileSync(sfile,JSON.stringify(s));
 assert.throws(()=>api.assertRetainable(second,NOW),/retention_policy_mismatch/);
 const third=store();
 unlinkSync(join(third,'retention-000001.json'));
 assert.throws(()=>api.readRetention(third),/missing_record/);
});

test('deletion rehearsal clears the raw bytes, keeps non-reconstructive audit metadata',t=>{
 if(!posix)return t.skip('POSIX only');
 const dir=store();
 const plan=api.planDeletion(dir);
 assert.deepEqual(plan.targets.map(x=>x.role),['primary']);
 assert.equal(plan.targets[0].path,join(dir,'response.bin'));
 api.beginDeletion(dir,{nowUtc:NOW,reason:'rehearsal'});
 const receipt=api.executeDeletion(dir,{nowUtc:NOW});
 assert.equal(receipt.type,'deletion-receipt');
 assert.equal(receipt.resumed,false);
 assert.deepEqual(receipt.results.map(r=>r.status),['deleted']);
 assert.equal(existsSync(join(dir,'response.bin')),false);
 assert.equal(existsSync(join(dir,'manifest.json')),true);
 // The receipt proves what was destroyed without being able to rebuild it.
 const text=readFileSync(join(dir,'retention-000003.json'),'utf8');
 assert.equal(text.includes('Synthetic Cup'),false);
 assert.equal(text.includes('788036'),false);
 assert.match(receipt.results[0].sha256,/^[a-f0-9]{64}$/);
 assert.equal(receipt.results[0].length,body().length);
 const v=api.verifyDeletion(dir);
 assert.equal(v.verified,true);
 assert.equal(v.raw_bytes_remaining,0);
 assert.throws(()=>api.assertRetainable(dir,NOW),/raw_data_deleted/);
 assert.throws(()=>api.executeDeletion(dir,{nowUtc:NOW}),/deletion_already_complete/);
});

test('an interrupted deletion is resumable across a real process restart',t=>{
 if(!posix)return t.skip('POSIX only');
 const dir=store();
 // A genuinely separate process records the durable intent and then stops,
 // which is the state a crash mid-deletion leaves behind.
 const script=`const r=await import(${JSON.stringify(url.href)});r.beginDeletion(${JSON.stringify(dir)},{nowUtc:${JSON.stringify(NOW)},reason:'rehearsal'});`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',script],{timeout:10000});
 assert.equal(child.status,0,String(child.stderr));
 assert.equal(existsSync(join(dir,'response.bin')),true);
 assert.throws(()=>api.assertRetainable(dir,NOW),/deletion_in_progress/);
 assert.equal(api.readRetention(dir).deletion_in_progress,true);
 assert.throws(()=>api.verifyDeletion(dir),/deletion_incomplete/);
 // Resumption finishes the job rather than starting a second one.
 const receipt=api.executeDeletion(dir,{nowUtc:NOW});
 assert.equal(receipt.resumed,true);
 assert.equal(existsSync(join(dir,'response.bin')),false);
 assert.equal(api.verifyDeletion(dir).verified,true);
});

test('a subscription that ends early stops retention at once, before the deadline',t=>{
 if(!posix)return t.skip('POSIX only');
 const dir=store();
 assert.equal(api.assertRetainable(dir,NOW).retainable,true);
 api.recordSubscriptionEnd(dir,{ended_at_utc:'2026-11-02T09:00:00Z',source:'provider-cancellation'});
 // Well inside the deadline, and retention is over anyway: the permission was
 // conditional on the subscription, not on the calendar.
 assert.throws(()=>api.assertRetainable(dir,NOW),/subscription_ended/);
 assert.equal(api.readRetention(dir).subscription_ended,true);
 assert.equal(api.planDeletion(dir).subscription_ended,true);
 assert.throws(()=>api.recordSubscriptionEnd(dir,{ended_at_utc:NOW,source:'again'}),/already_recorded/);
 assert.throws(()=>api.recordSubscriptionEnd(store(),{ended_at_utc:NOW,source:''}),/subscription_end_source/);
 assert.throws(()=>api.recordSubscriptionEnd(store(),{ended_at_utc:'nope',source:'provider'}),/invalid_clock/);
 // Deletion is still the way out, and the reason is recorded as what it was.
 api.beginDeletion(dir,{nowUtc:'2026-11-02T09:05:00Z',reason:'subscription_ended'});
 const receipt=api.executeDeletion(dir,{nowUtc:'2026-11-02T09:05:00Z'});
 assert.equal(receipt.reason,'subscription_ended');
 assert.equal(api.verifyDeletion(dir).verified,true);
});

test('deletion without a recorded intent is refused',t=>{
 if(!posix)return t.skip('POSIX only');
 const dir=store();
 assert.throws(()=>api.executeDeletion(dir,{nowUtc:NOW}),/deletion_not_initiated/);
 assert.equal(existsSync(join(dir,'response.bin')),true);
 const bare=join(root(),'bare');
 adapter.writeAdapterCapture(bare,capture());
 assert.throws(()=>api.beginDeletion(bare,{nowUtc:NOW,reason:'rehearsal'}),/missing_record/);
});

test('a registered backup inherits the same boundary and is cleared with the original',t=>{
 if(!posix)return t.skip('POSIX only');
 const c=capture();
 const dir=join(root(),'capture'),backup=join(root(),'backup');
 adapter.writeAdapterCapture(dir,c);
 adapter.writeAdapterCapture(backup,c);
 api.registerRetention(dir,{...REG(),backups:[backup]});
 assert.deepEqual(api.planDeletion(dir).targets.map(x=>x.role),['primary','backup']);
 assert.equal(api.assertRetainable(dir,NOW).backups_verified,1);
 api.beginDeletion(dir,{nowUtc:NOW,reason:'rehearsal'});
 api.executeDeletion(dir,{nowUtc:NOW});
 assert.equal(existsSync(join(backup,'response.bin')),false);
 assert.equal(api.verifyDeletion(dir).verified,true);
 // Verification re-checks the world; it never just replays the receipt.
 writeFileSync(join(backup,'response.bin'),body());
 const v=api.verifyDeletion(dir);
 assert.equal(v.verified,false);
 assert.equal(v.raw_bytes_remaining,1);
 assert.match(v.unverified[0].reason,/raw_data_still_present/);
});

test('a backup that drifts from the original is a tamper signal, not a copy',t=>{
 if(!posix)return t.skip('POSIX only');
 const c=capture();
 const dir=join(root(),'capture'),backup=join(root(),'backup');
 adapter.writeAdapterCapture(dir,c);
 adapter.writeAdapterCapture(backup,c);
 api.registerRetention(dir,{...REG(),backups:[backup]});
 writeFileSync(join(backup,'response.bin'),Buffer.from('{}'));
 assert.throws(()=>api.assertRetainable(dir,NOW),/backup_copy_mismatch/);
 // An absent backup is not a mismatch: it is one fewer place holding raw bytes.
 unlinkSync(join(backup,'response.bin'));
 assert.equal(api.assertRetainable(dir,NOW).backups_verified,0);
});

test('registration refuses an unusable storage, reviewer or backup declaration',t=>{
 if(!posix)return t.skip('POSIX only');
 for(const change of [{storage_id:''},{storage_id:'x'.repeat(200)},{reviewers:[]},{reviewers:['']},{reviewers:'owner'},{backups:['relative/path']},{backups:[123]}]){
  const dir=join(root(),'capture');
  adapter.writeAdapterCapture(dir,capture());
  assert.throws(()=>api.registerRetention(dir,{...REG(),...change}),/retention_registration/);
  assert.equal(readdirSync(dir).some(f=>f.startsWith('retention-')),false);
 }
});
