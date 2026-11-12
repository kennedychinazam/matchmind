// Real isolated PostgreSQL. Docker has no network/ports; all source facts and credentials are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const IMAGE='postgres:16.6@sha256:557fea37a744d5f4c8faab304b0a90858b53ab119735a88c131fd19dab802f36';
const name='mm-prospective-'+process.pid;
let now='2027-01-01T12:00:00Z',id=920000,baseline;
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const proposal=readFileSync(new URL('../backend/settlement-cohort/PROPOSAL-up.sql',import.meta.url),'utf8');
function sql(s,role){
 const prefix=`set mm_test.now='${now}';`+(role?`set role ${role};`:'');
 return execFileSync('docker',['--host=unix:///var/run/docker.sock','exec','-i',name,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],{input:prefix+s,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']}).trim();
}
const json=s=>JSON.parse(sql(s));
const ledger=fx=>json(`select row_to_json(s) from mm_settlement.selections s where fxid=${fx} order by id limit 1;`);
function issue(code='1',kind='prediction'){
 now='2027-01-01T12:00:00Z';const fx=++id;
 sql(`insert into fixtures values(${fx},'af','2027-01-02','12:00','NS',null,null,null,null,null,null,'${now}');`,'service_role');
 if(kind==='prediction')sql(`insert into predictions values(${fx},'2027-01-02','12:00','${code}',0.64,'synthetic market','original immutable payload');`,'service_role');
 else sql(`insert into daily_slips values('2027-01-01','tier-${fx}','[{"fxid":${fx},"d":"2027-01-02","code":"${code}","market":"synthetic market","p":0.64}]');`,'service_role');
 return fx;
}
function observe(fx,status='NS',date='2027-01-02',time='12:00',h=null,a=null,ftH=null,ftA=null){
 return sql(`update fixtures set status='${status}',date='${date}',time='${time}',gh=${h},ga=${a},ft_h=${ftH},ft_a=${ftA},updated_at='${now}' where fxid=${fx};`,'service_role');
}
test.before(async()=>{
 execFileSync('docker',['--host=unix:///var/run/docker.sock','run','-d','--name',name,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE],{stdio:'pipe'});
 let ready=false;
 for(let i=0;i<80;i++){
  try{
   const logs=execFileSync('docker',['--host=unix:///var/run/docker.sock','logs',name],{encoding:'utf8',stdio:'pipe'});
   if(logs.includes('init process complete')){
    execFileSync('docker',['--host=unix:///var/run/docker.sock','exec',name,'pg_isready','-U','postgres'],{stdio:'pipe'});ready=true;break;
   }
  }catch{}
  await new Promise(r=>setTimeout(r,250));
 }
 assert.equal(ready,true,'isolated PostgreSQL must complete initialization and final startup');
 sql(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
 create schema mm_fixture_delivery;
 create function mm_fixture_delivery.publisher_allowed() returns boolean language sql as $$select current_setting('role')='service_role'$$;
 create table mm_fixture_delivery.editions(id int);
 create table fixtures(fxid bigint primary key,provider text,date text,time text,status text,gh int,ga int,ft_h int,ft_a int,ht_h int,ht_a int,updated_at text);
 alter table fixtures enable row level security;
 create table predictions(fxid bigint primary key,kickoff text,ktime text,pick text,pick_prob numeric,market text,archive text);
 create table daily_slips(day text,tier text,legs jsonb,unique(day,tier));
 create table shared_records(key text primary key,payload jsonb,computed_at text);
 grant usage on schema public to anon,authenticated,service_role;
 grant select,insert,update on fixtures,predictions,daily_slips,shared_records to service_role;
 grant insert on predictions to authenticated;
 insert into predictions values(1,'2020-01-01','12:00','1',0.7,'Winner','legacy immutable');
 insert into shared_records values('engine','{"voidLate":7,"days":{"2020-01-01":{"Winner":[4,3,2]}}}','legacy'),('clv','{"n":89,"mean":0.1}','legacy');`);
 baseline=sql(`select md5((select jsonb_agg(to_jsonb(p))::text from predictions p)|| (select jsonb_agg(to_jsonb(r) order by key)::text from shared_records r));`);
 sql(proposal);
 // Only the local clock seam is substituted. Production reads statement_timestamp, never a caller GUC or parameter.
 sql(`create or replace function mm_settlement.clock() returns timestamptz language sql stable set search_path=pg_catalog as $$select current_setting('mm_test.now')::timestamptz$$;`);
});
test.after(()=>{execFileSync('docker',['--host=unix:///var/run/docker.sock','rm','-fv',name],{stdio:'pipe'});});

test('migration preserves history; explicit activation rejects an older repeatable-read issuance snapshot',async()=>{
 assert.equal(sql('select count(*) from mm_settlement.selections;'),'0');
 assert.equal(sql(`select md5((select jsonb_agg(to_jsonb(p))::text from predictions p)|| (select jsonb_agg(to_jsonb(r) order by key)::text from shared_records r));`),baseline);
 sql("insert into predictions values(2,'2020-01-01','12:00','X',0.3,'Winner','legacy without inferred membership');");
 assert.equal(sql('select count(*) from mm_settlement.selections;'),'0');
 sql(readFileSync(new URL('../backend/settlement-cohort/PROPOSAL-down.sql',import.meta.url),'utf8'));
 sql(proposal);
 sql(`create or replace function mm_settlement.clock() returns timestamptz language sql stable set search_path=pg_catalog as $$select current_setting('mm_test.now')::timestamptz$$;`);
 sql(`insert into fixtures values(3,'af','2027-01-02','12:00','NS',null,null,null,null,null,null,'${now}');`,'service_role');
 // The publisher snapshot predates activation. It must fail rather than silently insert an unenrolled prediction afterward.
 await new Promise((resolve,reject)=>{
  const child=spawn('docker',['--host=unix:///var/run/docker.sock','exec','-i',name,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1']);
  let output='',err='',activated=false;
  const timer=setTimeout(()=>{child.kill();reject(Error('cutover transaction timed out'));},10000);
  child.stdout.on('data',d=>{
   output+=d;
   if(!activated&&output.includes('snapshot_ready')){
    activated=true;
    try{
     sql(readFileSync(new URL('../backend/settlement-cohort/ACTIVATE-review.sql',import.meta.url),'utf8'));
     child.stdin.end("insert into predictions values(3,'2027-01-02','12:00','1',.6,'Winner','old transaction');commit;");
    }catch(e){child.kill();reject(e);}
   }
  });
  child.stderr.on('data',d=>err+=d);child.on('error',reject);
  child.on('close',code=>{clearTimeout(timer);try{assert.equal(activated,true);assert.notEqual(code,0);assert.match(err,/could not serialize/);resolve();}catch(e){reject(e);}});
  child.stdin.write(`set mm_test.now='${now}';begin isolation level repeatable read;set role service_role;select count(*) from predictions;select 'snapshot_ready';\n`);
 });
 assert.equal(sql('select count(*) from predictions where fxid=3'),'0');
 assert.throws(()=>sql('update mm_settlement.policy set active=false;'));
});
test('only authoritative pre-match issuance enrolls; replays and legacy updates never backfill',()=>{
 const fx=issue();const r=ledger(fx);
 assert.equal(r.policy_version,'matchmind-settlement/2');assert.equal(r.original_kickoff,'2027-01-02T12:00:00+00:00');
 assert.equal(r.original.archive,'original immutable payload');assert.equal(r.probability,.64);
 sql(`insert into predictions select * from predictions where fxid=${fx} on conflict do nothing;`,'service_role');
 assert.equal(sql(`select count(*) from mm_settlement.selections where fxid=${fx}`),'1');
 sql("update predictions set archive=archive where fxid=1;",'service_role');
 assert.equal(sql('select count(*) from mm_settlement.selections where fxid=1'),'0');
 assert.throws(()=>sql("insert into predictions values(99,'2027-01-02','12:00','1',.5,'Winner','unauthorized');",'authenticated'));
});
test('delayed NS remains unresolved at 47:59, 48h and well beyond; issuance bytes stay unchanged',()=>{
 const fx=issue(),original=ledger(fx).original;
 for(const clock of ['2027-01-04T11:59:59Z','2027-01-04T12:00:00Z','2027-02-04T12:00:00Z']){
  now=clock;observe(fx);assert.equal(ledger(fx).status,'unresolved');
 }
 assert.deepEqual(ledger(fx).original,original);
});
for(const status of ['PST','CANC'])test(status+' requires original 48h boundary and persists the evidence/reason',()=>{
 const fx=issue();now='2027-01-04T11:59:59Z';observe(fx,status);assert.equal(ledger(fx).status,'unresolved');
 now='2027-01-04T12:00:00Z';sql('insert into mm_fixture_delivery.editions values(1);');
 const r=ledger(fx);assert.equal(r.status,'void');assert.equal(r.reason,'accepted_postponement_or_cancellation_48h');assert.equal(r.evidence.fixture.status,status);assert.ok(r.decided_at);
});
test('accepted rescheduling needs both original 48h elapsed and a >=48h schedule movement',()=>{
 const fx=issue();now='2027-01-04T11:59:59Z';observe(fx,'NS','2027-01-04');assert.equal(ledger(fx).status,'unresolved');
 now='2027-01-04T12:00:00Z';sql('select public.matchmind_settle_prospective_v2();','service_role');assert.equal(ledger(fx).reason,'accepted_reschedule_at_least_48h');
 const g=issue();now='2027-01-05T12:00:00Z';observe(g,'NS','2027-01-04','11:59');assert.equal(ledger(g).status,'unresolved');
});
for(const status of ['ABD','SUSP','INT'])test(status+' alone never voids, even after 48h and a changed schedule',()=>{
 const fx=issue();now='2027-01-05T12:00:00Z';observe(fx,status,'2027-01-04');assert.equal(ledger(fx).status,'unresolved');
});
test('late-arriving authoritative score settles an on-time fixture normally; unknown result period stays unresolved',()=>{
 const fx=issue();now='2027-01-08T12:00:00Z';observe(fx,'NS');assert.equal(ledger(fx).status,'unresolved');
 now='2027-01-08T12:00:01Z';observe(fx,'AET','2027-01-02','12:00',2,1);assert.equal(ledger(fx).status,'unresolved');
 now='2027-01-08T12:00:02Z';observe(fx,'AET','2027-01-02','12:00',2,1,1,0);assert.equal(ledger(fx).status,'hit');
});
test('stale, missing, future and equal-time conflicting observations cannot authorize settlement',()=>{
 const fx=issue();now='2027-01-05T12:00:00Z';observe(fx,'NS');
 now='2027-01-04T12:00:00Z';observe(fx,'PST');assert.equal(ledger(fx).status,'unresolved','older replay must not displace NS');
 now='2027-01-05T12:00:00Z';observe(fx,'PST');assert.equal(ledger(fx).status,'unresolved','equal-time contradiction fails closed');
 assert.equal(sql(`select conflicted from mm_settlement.observations where fxid=${fx}`),'t');
 sql(`update fixtures set updated_at=null where fxid=${fx};`,'service_role');assert.equal(ledger(fx).status,'unresolved');
 sql(`update fixtures set updated_at='2030-01-01T00:00:00Z' where fxid=${fx};`,'service_role');assert.equal(ledger(fx).status,'unresolved');
 now='2027-01-05T12:00:01Z';observe(fx,'PST');assert.equal(ledger(fx).status,'void','a strictly newer accepted observation recovers');
 const g=issue();now='2027-01-05T12:00:00Z';
 // Administrator writes are not the scheduled collector/publisher observation path.
 sql(`update fixtures set status='PST',updated_at='${now}' where fxid=${g};`);
 sql('select public.matchmind_settle_prospective_v2();','service_role');
 assert.equal(ledger(g).status,'unresolved','a later authorized tick must not launder an untrusted source write');
});
test('issuance rejects incomplete kickoff, unsupported markets, late issuance and partial source identity',()=>{
 now='2027-01-01T12:00:00Z';
 for(const [time,provider,code]of [[null,'af','1'],['12:00',null,'1'],['12:00','af','UNSUPPORTED']]){
  const fx=++id;
  sql(`insert into fixtures values(${fx},${provider===null?'null':"'af'"},'2027-01-02',${time===null?'null':"'12:00'"},'NS',null,null,null,null,null,null,'${now}');`,'service_role');
  assert.throws(()=>sql(`insert into predictions values(${fx},'2027-01-02',${time===null?'null':"'12:00'"},'${code}',.6,'Winner','must fail atomically');`,'service_role'));
  assert.equal(sql(`select count(*) from predictions where fxid=${fx}`),'0');
 }
 const fx=issue();now='2027-01-02T12:00:00Z';
 assert.throws(()=>sql(`insert into daily_slips values('2027-01-02','late','[{"fxid":${fx},"d":"2027-01-02","code":"1","market":"Winner","p":0.64}]');`,'service_role'));
});
test('completed DNB draws void, DNB wins/losses grade normally and late-played guard stays final',()=>{
 for(const [code,h,a,expected]of [['1D',1,1,'void'],['1D',2,0,'hit'],['2D',2,0,'miss']]){
  const fx=issue(code);now='2027-01-03T12:00:00Z';observe(fx,'FT','2027-01-02','12:00',h,a);assert.equal(ledger(fx).status,expected);
 }
 const fx=issue();now='2027-01-05T12:00:00Z';observe(fx,'FT','2027-01-04','12:00',2,0);assert.equal(ledger(fx).reason,'played_at_least_48h_late');
});
test('two selections on one fixture settle independently; existing final decisions cannot change or disappear',()=>{
 const fx=issue();
 sql(`insert into daily_slips values('2027-01-01','two-${fx}','[{"fxid":${fx},"d":"2027-01-02","code":"O25","market":"Goals","p":0.6},{"fxid":${fx},"d":"2027-01-02","code":"2D","market":"DNB","p":0.4}]');`,'service_role');
 now='2027-01-03T12:00:00Z';observe(fx,'FT','2027-01-02','12:00',1,0);
 assert.deepEqual(json(`select json_agg(status order by id) from mm_settlement.selections where fxid=${fx}`),['hit','miss','miss']);
 const frozen=sql(`select jsonb_agg(to_jsonb(s) order by id) from mm_settlement.selections s where fxid=${fx};`);
 observe(fx,'FT','2027-01-02','12:00',0,3);
 assert.equal(sql(`select jsonb_agg(to_jsonb(s) order by id) from mm_settlement.selections s where fxid=${fx};`),frozen);
 assert.equal(sql('select public.matchmind_settle_prospective_v2();','service_role'),'0');
 assert.throws(()=>sql(`update mm_settlement.selections set status='miss' where fxid=${fx};`));
 assert.throws(()=>sql(`delete from mm_settlement.selections where fxid=${fx};`));
});
test('concurrent settlement calls produce exactly one final decision',async()=>{
 const fx=issue();now='2027-01-04T11:59:59Z';observe(fx,'PST');now='2027-01-04T12:00:00Z';
 const call=()=>new Promise((resolve,reject)=>{
  const child=spawn('docker',['--host=unix:///var/run/docker.sock','exec','-i',name,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1']);
  let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);
  child.on('error',reject);child.on('close',code=>code?reject(Error(err)):resolve(Number(out.trim())));
  child.stdin.end(`set mm_test.now='${now}';set role service_role;select public.matchmind_settle_prospective_v2();`);
 });
 const results=await Promise.all([call(),call()]);assert.equal(results[0]+results[1],1);
 assert.equal(ledger(fx).status,'void');
 assert.equal(sql(`select count(*) from mm_settlement.selections where fxid=${fx}`),'1');
});
test('legacy aggregates cannot be overwritten and public reporting is aggregate-only and separate',()=>{
 for(const role of ['service_role',undefined])assert.throws(()=>sql("update shared_records set payload='{}' where key='engine';",role));
 assert.equal(sql("select payload->>'voidLate' from shared_records where key='engine';"),'7');
 for(const role of ['anon','authenticated']){
  const r=JSON.parse(sql('select public.matchmind_prospective_report_v2();',role));assert.equal(r.policy_version,'matchmind-settlement/2');assert.ok(r.populations.prediction.enrolled>0);
  assert.throws(()=>sql('select * from mm_settlement.selections;',role));
  assert.throws(()=>sql('select public.matchmind_settle_prospective_v2();',role));
 }
 assert.throws(()=>sql(readFileSync(new URL('../backend/settlement-cohort/PROPOSAL-down.sql',import.meta.url),'utf8')));
 assert.equal(sql("select archive from predictions where fxid=1"),'legacy immutable');
});
test('all supported SQL grades equal the unchanged application grader across score and half-time combinations',()=>{
 const goal=source.slice(source.indexOf('const GOAL_MARKETS = {'),source.indexOf('const HEADLINE_SOLO_MIN'));
 const grader=source.slice(source.indexOf('const RESULT_MARKETS = {'),source.indexOf('/* build 348 - a leg'));
 const context=vm.createContext({});vm.runInContext(goal+grader+";globalThis.grade=gradePick;function actualCode(h,a){return h>a?'1':h===a?'X':'2';}",context);
 const codes=['1','X','2','1X','X2','12','1D','2D','O15','U15','O25','U25','O35','U35','BTS','NBT','1/1','1/X','1/2','X/1','X/X','X/2','2/1','2/X','2/2'];
 const cases=[];
 for(const code of codes)for(let h=0;h<=3;h++)for(let a=0;a<=3;a++)for(const [hh,ha]of [[null,null],[0,0],[1,0],[0,1],[h,a]])cases.push({code,h,a,hh,ha});
 const values=cases.map((c,i)=>`(${i},'${c.code}',${c.h},${c.a},${c.hh},${c.ha})`).join(',');
 const got=json(`select json_agg(mm_settlement.grade(code,h,a,hh,ha) order by i) from(values ${values})t(i,code,h,a,hh,ha);`);
 assert.equal(got.length,2000);
 cases.forEach((c,i)=>assert.equal(got[i],context.grade(c.code,c.h>c.a?'1':c.h===c.a?'X':'2',c.h,c.a,c.hh,c.ha),JSON.stringify(c)));
});
