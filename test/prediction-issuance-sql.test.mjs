// Exact production column/RLS/grant shape, invented fixture identities and JWTs.
// Own pinned PostgreSQL container, network none, no host mounts or hosted requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,execFile} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
const contract=JSON.parse(readFileSync(new URL('../backend/prediction-integrity/production-contract.synthetic.json',import.meta.url),'utf8'));
const proposal=readFileSync(new URL('../backend/prediction-integrity/PROPOSAL-production-up.sql',import.meta.url),'utf8');
const db='mm-prediction-issuance-'+process.pid,image='postgres:16.6@sha256:557fea37a744d5f4c8faab304b0a90858b53ab119735a88c131fd19dab802f36';
const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']}).trim();
const q=s=>"'"+String(s).replaceAll("'","''")+"'",ident=s=>'"'+s.replaceAll('"','""')+'"';
const claims=JSON.stringify({email:'publisher@example.invalid',raw:true});
function prefix(role='authenticated',jwt=claims){return `set timezone='UTC';set role ${role};set request.jwt.claims=${q(jwt)};`;}
function sql(s,role='',jwt=claims){return docker(['exec','-i',db,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],(role?prefix(role,jwt):"set timezone='UTC';")+s);}
function asyncSql(s,role='authenticated'){return new Promise((resolve,reject)=>{const p=execFile('docker',['exec','-i',db,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],{encoding:'utf8',timeout:30000},(e,out,stderr)=>e?reject(Object.assign(e,{stderr})):resolve(out.trim()));p.stdin.end(prefix(role)+s);});}
function bootstrap(){
 let s=`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create role mm_display_materializer nologin;create role mm_match_context nologin;create schema auth;grant usage on schema auth,public to public;create function auth.jwt() returns jsonb language sql stable as $f$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$f$;create schema mm_fixture_delivery;grant usage on schema mm_fixture_delivery to public;create function mm_fixture_delivery.raw_allowed() returns boolean language sql stable as $f$select coalesce((auth.jwt()->>'raw')::boolean,false)$f$;`;
 for(const table of ['fixtures','predictions']){
  const cols=contract.columns.filter(c=>c.table===table).map(c=>ident(c.name)+' '+c.type+(c.not_null?' not null':'')+(c.default?' default '+c.default:''));
  s+=`create table public.${table}(${cols.join(',')},primary key(fxid));alter table public.${table} enable row level security;`;
 }
 for(const g of contract.grants)s+=`grant ${g.privilege_type} on public.${g.table_name} to ${ident(g.grantee)};`;
 for(const c of contract.effective_columns.filter(c=>c.role==='authenticated'&&c.update))s+=`grant update(${ident(c.column)}) on public.predictions to authenticated;`;
 for(const p of contract.policies)s+=`create policy ${ident(p.policyname)} on public.${p.tablename} as ${p.permissive} for ${p.cmd} to ${p.roles.map(ident).join(',')}${p.qual?' using('+p.qual+')':''}${p.with_check?' with check('+p.with_check+')':''};`;
 return s;
}
function fixture(id=1,overrides={}){
 const f={fxid:String(id),lid:'39',date:"(clock_timestamp() at time zone 'UTC')::date+1",time:"'12:00'",status:"'NS'",home:"'Harbor'",away:"'Granite'",...overrides};
 sql(`insert into public.fixtures(${Object.keys(f).join(',')}) values(${Object.values(f).join(',')});`);
}
function insertion(id=1,overrides={}){
 const v={fxid:String(id),lid:'39',lname:"'Synthetic league'",kickoff:'f.date',ktime:'f.time',home:'f.home',away:'f.away',p_home:'.6',p_draw:'.2',p_away:'.2',xg_home:'1.7',xg_away:'.8',pick:"'1'",pick_prob:'.73',build:'368',made_at:"'1900-01-01Z'::timestamptz",market:"'Winner'",...overrides};
 return`insert into public.predictions(${Object.keys(v).join(',')}) select ${Object.values(v).join(',')} from public.fixtures f where f.fxid=${id}`;
}
const reject=(s,role='authenticated',pattern=/ERROR/)=>assert.throws(()=>sql(s,role),pattern);
function originals(){return sql("select coalesce(jsonb_agg(to_jsonb(p) order by fxid),'[]') from public.predictions p;");}

test.describe('prediction issuance production protocol',()=>{
 test.before(async()=>{
  docker(['run','-d','--name',db,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust',image]);
  let ready=false;for(let i=0;i<80;i++){try{if(docker(['logs',db]).includes('init process complete')){docker(['exec',db,'pg_isready','-U','postgres']);ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready);
  sql(bootstrap());
  fixture(999,{date:"(clock_timestamp() at time zone 'UTC')::date-1",status:"'FINISHED'"});
  sql(insertion(999),'authenticated');const before=JSON.parse(sql('select to_jsonb(p) from public.predictions p where fxid=999;'));
  assert.equal(before.build,368);assert.match(before.made_at,/1900-01-01/);
  writeFileSync(new URL('../../mm06-evidence/sql-before.json',import.meta.url),JSON.stringify({kind:'actual retained production policy/grant shape; synthetic identity',late_live_insert_admitted:true,caller_made_at_persisted:before.made_at,scope:'network-none local PostgreSQL only'},null,2));
  // Install with one historical row present; it must survive exactly unchanged.
  const saved=originals();sql(proposal);assert.equal(originals(),saved);
 });
 test.after(()=>docker(['rm','-f',db]));
 test.beforeEach(()=>sql('truncate public.predictions,public.fixtures;'));
 test('ordinary publisher inserts future fixture with server time; UTC session setting cannot forge issuance',()=>{
  fixture();sql("set timezone='Pacific/Honolulu';"+insertion(),'authenticated');const r=JSON.parse(sql("select jsonb_build_object('current',abs(extract(epoch from made_at-clock_timestamp()))<10,'build',build) from public.predictions;"));assert.equal(r.current,true);assert.equal(r.build,368);
 });
 test('nonpublisher and anon have no new insert or private-helper privileges',()=>{
  fixture();reject(insertion(),'anon',/permission denied/);assert.throws(()=>sql(insertion(),'authenticated',JSON.stringify({email:'other@example.invalid',raw:true})),/row-level security/);
  for(const role of ['anon','authenticated','service_role'])reject("select mm_prediction_integrity.kickoff(current_date,'12:00');",role,/permission denied/);
  assert.equal(sql("select count(*) from pg_auth_members m join pg_roles r on r.oid=m.roleid where r.rolname='mm_prediction_guard';"),'0');
 });
 test('past or exact current kickoff, live status and beyond horizon cannot become new live issues',()=>{
  for(const [id,v]of [[1,{date:"(clock_timestamp() at time zone 'UTC')::date-1"}],[2,{date:"(clock_timestamp() at time zone 'UTC')::date",time:"to_char(clock_timestamp() at time zone 'UTC','HH24:MI:SS.US')"}],[3,{status:"'LIVE'"}],[4,{date:"(clock_timestamp() at time zone 'UTC')::date+6"}]]){fixture(id,v);reject(insertion(id));}
  assert.equal(sql('select count(*) from public.predictions;'),'0');
 });
 test('unknown fixture, identity mismatch, null/malformed time and invalid builds fail closed',()=>{
  reject("insert into public.predictions(fxid)values(999);",'service_role');
  fixture();for(const patch of [{lid:'40'},{home:"'Other'"},{away:'null'},{kickoff:'f.date+1'},{ktime:"'13:00'"},{build:'null'},{build:'0'},{build:'-2'},{final_pick:"'X'"}])reject(insertion(1,patch));
  for(const [id,t]of [[2,'null'],[3,"'25:00'"],[4,"'12:60'"],[5,"'12:00oops'"]]){fixture(id,{time:t});reject(insertion(id));}
 });
 test('new matching canonical identity still requires positive IDs and nonblank bounded teams',()=>{
  const admitted=[];
  for(const [id,patch]of [[0,{}],[-1,{}],[3,{lid:'null'}],[4,{lid:'0'}],[5,{lid:'-1'}],[6,{home:'null'}],[7,{away:'null'}],[8,{home:"'   '"}],[9,{away:"''"}],[10,{home:"repeat('x',161)"}]]){
   fixture(id,patch);try{sql(insertion(id,{lid:'f.lid'}),'authenticated');admitted.push(id);}catch(e){assert.match(String(e),/ERROR/);}
  }
  assert.deepEqual(admitted,[],'invalid canonical identity was admitted');
 });
 test('private owner has only reviewed fixture locking/read authority and strict UTC parser',()=>{
  fixture();assert.equal(sql('select fxid from public.fixtures where fxid=1 for share;','mm_prediction_guard'),'1');
  reject('update public.fixtures set fxid=2 where fxid=1;','mm_prediction_guard',/row-level security/);
  reject(insertion(),'mm_prediction_guard',/permission denied/);
  assert.equal(sql("select pg_has_role('service_role','mm_prediction_guard','MEMBER');"),'f');
  const valid=["'0:00'","'12:34:56.123456'","'2026-11-27T12:34Z'","'2026-11-27 12:34:56+00:00'"];
  for(const t of valid)assert.ok(sql("select mm_prediction_integrity.kickoff('2026-11-27',"+t+");",'mm_prediction_guard'));
  for(const t of ["'24:00'","'12:34:60'","'2026-11-28T12:34Z'","'2026-11-27T12:34+01:00'","'12:34junk'",'null'])reject("select mm_prediction_integrity.kickoff('2026-11-27',"+t+");",'mm_prediction_guard',/UTC|mismatch/);
 });
 test('all original columns are immutable through service_role, with existing authenticated column restrictions retained',()=>{
  fixture();sql(insertion(),'authenticated');const before=originals();
  const mutations={fxid:'2',lid:'40',lname:"'changed'",kickoff:'kickoff+1',ktime:"'13:00'",home:"'changed'",away:'null',p_home:'.8',p_draw:'.1',p_away:'.1',xg_home:'2.5',xg_away:'1.5',pick:"'2'",pick_prob:'.9',build:'-1',made_at:'clock_timestamp()',market:"'Goals'",odds_at_pick:'2.4',odds_at_pick_at:'clock_timestamp()',odds_snap_id:'999'};
  assert.equal(Object.keys(mutations).length,20);
  for(const [col,value]of Object.entries(mutations)){reject(`update public.predictions set ${col}=${value} where fxid=1;`,'service_role',/immutable/);assert.equal(originals(),before);}
  reject("update public.predictions set pick='2' where fxid=1;",'authenticated',/permission denied/);
 });
 test('metadata remains narrowly permitted, server-stamped and first-withdrawal-only',()=>{
  fixture();sql(insertion(),'authenticated');const before=JSON.parse(originals())[0];
  sql("update public.predictions set final_pick='X',final_prob=.8,final_at='1900-01-01Z' where fxid=1;",'authenticated');
  sql("update public.predictions set withheld_at='1900-01-01Z' where fxid=1;",'authenticated');
  const row=JSON.parse(originals())[0];assert.ok(Date.parse(row.final_at)>Date.parse('2026-01-01'));assert.ok(Date.parse(row.withheld_at)>Date.parse('2026-01-01'));for(const k of Object.keys(before).filter(k=>!['final_pick','final_prob','final_at','withheld_at'].includes(k)))assert.equal(row[k],before[k]);
  reject('update public.predictions set withheld_at=null where fxid=1;');reject("update public.predictions set withheld_at=clock_timestamp() where fxid=1;");reject("update public.predictions set final_pick='X',final_prob='NaN'::real where fxid=1;");
  reject("update public.predictions set final_pick='2',pick='2' where fxid=1;",'service_role',/immutable/);
 });
 test('original/current earliest kickoff prevents rescheduling from reopening metadata',()=>{
  fixture();sql(insertion());sql("update public.fixtures set date=(clock_timestamp() at time zone 'UTC')::date-1 where fxid=1;");reject("update public.predictions set final_pick='X',final_prob=.8 where fxid=1;",'service_role',/closed/);
  // Legacy original date in past, canonical fixture now future: no mutation or repair.
  sql('truncate public.predictions;');sql('alter table public.predictions disable trigger mm_prediction_integrity;');sql(insertion(1,{kickoff:"(clock_timestamp() at time zone 'UTC')::date-2"}));sql('alter table public.predictions enable trigger mm_prediction_integrity;');sql("update public.fixtures set date=(clock_timestamp() at time zone 'UTC')::date+1 where fxid=1;");const before=originals();reject("update public.predictions set withheld_at=clock_timestamp() where fxid=1;",'service_role',/closed/);assert.equal(originals(),before);
 });
 test('reconstructed past finished rows stay -1, cannot promote or replace a live issue',()=>{
  fixture(1,{date:"(clock_timestamp() at time zone 'UTC')::date-1",status:"'FINISHED'"});sql(insertion(1,{build:'-1'}),'authenticated');assert.equal(sql('select build from public.predictions;'),'-1');reject('update public.predictions set build=368 where fxid=1;','service_role',/immutable/);
  fixture(2);reject(insertion(2,{build:'-1'}));sql(insertion(2));const before=originals();sql(insertion(2,{build:'-1',pick:"'2'"})+' on conflict(fxid)do nothing;','authenticated');assert.equal(originals(),before);
 });
 test('duplicate-ignore replay after kickoff preserves canonical original and client DELETE remains denied',()=>{
  fixture();sql(insertion());const before=originals();sql("update public.fixtures set date=(clock_timestamp() at time zone 'UTC')::date-1,status='FINISHED' where fxid=1;");sql(insertion(1,{pick:"'2'"})+' on conflict(fxid)do nothing;','authenticated');assert.equal(originals(),before);reject('delete from public.predictions where fxid=1;','authenticated',/permission denied/);
 });
 test('legacy null time and old values survive installation/no-op; changed metadata fails closed',()=>{
  fixture();sql('alter table public.predictions disable trigger mm_prediction_integrity;');sql(insertion(1,{ktime:'null',pick:"'OLD_CODE'",made_at:'null',build:'-1'}));sql('alter table public.predictions enable trigger mm_prediction_integrity;');const before=originals();sql('update public.predictions set final_pick=final_pick where fxid=1;','authenticated');assert.equal(originals(),before);reject("update public.predictions set withheld_at=clock_timestamp() where fxid=1;",'authenticated',/verified UTC/);assert.equal(originals(),before);
 });
 test('two concurrent publishers retain exactly one canonical immutable row',async()=>{
  fixture();await Promise.all([asyncSql(insertion(1,{pick:"'1'"})+' on conflict(fxid)do nothing;'),asyncSql(insertion(1,{pick:"'2'"})+' on conflict(fxid)do nothing;')]);assert.equal(sql('select count(*) from public.predictions;'),'1');assert.match(sql('select pick from public.predictions;'),/^[12]$/);
 });
 test('real private guard fixture lock waits, then rejects issuance that crossed kickoff',async()=>{
  fixture(1,{date:"(clock_timestamp() at time zone 'UTC')::date",time:"to_char((clock_timestamp()+interval'3seconds') at time zone 'UTC','HH24:MI:SS.US')"});
  // Advisory synchronization is test-only. The real guard must still take its own fixture lock.
  const blocker=asyncSql("begin;select pg_advisory_lock(667788);select fxid from public.fixtures where fxid=1 for update;select pg_sleep(5);commit;select pg_advisory_unlock(667788);",'service_role');
  let locked=false;for(let n=0;n<40;n++){if(sql("select count(*) from pg_locks where locktype='advisory' and objid=667788 and granted;")==='1'){locked=true;break;}await new Promise(r=>setTimeout(r,50));}assert.ok(locked);
  const waiting=asyncSql(insertion(1));await assert.rejects(waiting,e=>/before verified kickoff/.test(e.stderr));await blocker;assert.equal(sql('select count(*) from public.predictions;'),'0');
 });
});
