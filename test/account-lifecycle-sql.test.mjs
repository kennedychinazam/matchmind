// Current production schema/RLS/grants, invented identities, own network-none PostgreSQL.
import test from 'node:test';
import {deleteAccountRequest} from '../backend/account-deletion/deletion-service.mjs';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync,execFile} from 'node:child_process';
const contract=JSON.parse(readFileSync(new URL('../backend/account-lifecycle/production-contract.synthetic.json',import.meta.url),'utf8'));
const proposal=readFileSync(new URL('../backend/account-lifecycle/PROPOSAL-production-up.sql',import.meta.url),'utf8');
const db='mm-account-lifecycle-'+process.pid,image='postgres:16.6@sha256:557fea37a744d5f4c8faab304b0a90858b53ab119735a88c131fd19dab802f36';
const A='11111111-2222-4333-8444-555555555555',B='21111111-2222-4333-8444-555555555555',Z='31111111-2222-4333-8444-555555555555';
const q=x=>x===null?'null':"'"+String(x).replaceAll("'","''")+"'",ident=x=>'"'+x.replaceAll('"','""')+'"';
const docker=(args,input)=>execFileSync('docker',args,{input,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']}).trim();
function prefix(role='',uid=A){return "set timezone='UTC';"+(role?'set role '+role+';':'')+"set request.jwt.claims="+q(JSON.stringify({sub:uid}))+';';}
const sql=(s,role='',uid=A)=>docker(['exec','-i',db,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],prefix(role,uid)+s);
function asyncSql(s,role='service_role',uid=A){return new Promise((resolve,reject)=>{const p=execFile('docker',['exec','-i',db,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],{encoding:'utf8',timeout:30000},(e,out,stderr)=>e?reject(Object.assign(e,{stderr})):resolve(out.trim()));p.stdin.end(prefix(role,uid)+s);});}
const call=(name,args,role='service_role',uid=A)=>JSON.parse(sql('select to_jsonb(public.mm_deletion_'+name+'_v1('+args.map(q).join(',')+'));',role,uid));
const identity=j=>[j.job_id,j.lease_token];
function bootstrap(){
 let s=`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;create schema auth;grant usage on schema public,auth to public;create table auth.users(id uuid primary key);create function auth.uid()returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;`;
 for(const table of ['profiles','app_state','ai_usage','push_subscriptions','push_sent']){
  const cols=contract.columns.filter(x=>x.table===table).map(x=>ident(x.name)+' '+x.type+(x.not_null?' not null':'')+(x.default?' default '+x.default:''));
  const cs=contract.constraints.filter(x=>x.table===table).map(x=>'constraint '+ident(x.name)+' '+x.definition);
  s+='create table public.'+table+'('+[...cols,...cs].join(',')+');alter table public.'+table+' enable row level security;';
 }
 for(const g of contract.grants)s+='grant '+g.privilege_type+' on public.'+g.table_name+' to '+ident(g.grantee)+';';
 for(const p of contract.policies)s+='create policy '+ident(p.policyname)+' on public.'+p.tablename+' as '+p.permissive+' for '+p.cmd+' to '+p.roles.map(ident).join(',')+(p.qual?' using('+p.qual+')':'')+(p.with_check?' with check('+p.with_check+')':'')+';';
 return s;
}
function seed(){
 sql('insert into auth.users values('+q(A)+'),('+q(B)+');');
 for(const [uid,ep]of [[A,'A'],[B,'B']]){
  sql(`insert into public.profiles(id,display_name)values(${q(uid)},'Synthetic');insert into public.app_state(user_id,prefs)values(${q(uid)},'{"marker":"keep"}');insert into public.ai_usage(user_id,day,count)values(${q(uid)},current_date,7);`);
  sub(uid,ep);sql(`insert into public.push_sent(endpoint,dedupe_key)values('https://synthetic.invalid/${ep}','test');`);
 }
}
function sub(uid=A,ep='A',role=''){return sql(`insert into public.push_subscriptions(endpoint,user_id,p256dh,auth)values('https://synthetic.invalid/${ep}',${q(uid)},'synthetic','synthetic');`,role,uid);}
const version=()=>sql("select updated_at from public.push_subscriptions where endpoint='https://synthetic.invalid/A';");
const snapshot=()=>sql("select jsonb_build_object('profiles',(select jsonb_agg(to_jsonb(x))from public.profiles x),'state',(select jsonb_agg(to_jsonb(x))from public.app_state x),'usage',(select jsonb_agg(to_jsonb(x))from public.ai_usage x),'subs',(select jsonb_agg(to_jsonb(x))from public.push_subscriptions x),'sent',(select jsonb_agg(to_jsonb(x))from public.push_sent x));");
const expires=j=>sql('update mm_account_lifecycle.jobs set lease_until=clock_timestamp()-interval\'1second\' where job_id='+q(j.job_id)+';');
const dispatched=()=>{const j=call('prepare',[A]);assert.equal(call('cleanup',identity(j)).ok,true);assert.equal(call('mark_auth',identity(j)).ok,true);return j;};
test.describe('account lifecycle production protocol',()=>{
 test.before(async()=>{
  docker(['run','-d','--name',db,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust',image]);
  let ready=false;for(let n=0;n<80;n++){try{if(docker(['logs',db]).includes('init process complete')){docker(['exec',db,'pg_isready','-U','postgres']);ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready);
  sql(bootstrap());seed();
  // Old orphans are retained exactly; NOT VALID does not silently clean or validate them.
  sub(Z,'legacy');sql("insert into public.push_sent(endpoint,dedupe_key)values('https://synthetic.invalid/orphan','old');");
  const before=snapshot();sql(proposal);assert.equal(snapshot(),before);
  assert.equal(sql("select count(*)from pg_constraint where conname in('mm_lifecycle_subscription_owner_fk','mm_lifecycle_sent_endpoint_fk') and not convalidated;"),'2');
 });
 test.after(()=>docker(['rm','-f',db]));
 test.beforeEach(()=>{sql('truncate mm_account_lifecycle.resolutions,mm_account_lifecycle.jobs,public.push_sent,public.push_subscriptions,public.app_state,public.profiles,public.ai_usage,auth.users cascade;');seed();});
 test('service-only protocol and private journal deny API roles and client TRUNCATE',()=>{
  for(const role of ['anon','authenticated']){
   assert.throws(()=>call('prepare',[A],role),/permission denied/);
   assert.throws(()=>sql('select *from mm_account_lifecycle.jobs;',role),/permission denied/);
   assert.throws(()=>sql('truncate public.push_sent;',role),/permission denied/);
   assert.throws(()=>call('push_allowed',['https://synthetic.invalid/A',A,version()],role),/permission denied/);
   assert.throws(()=>call('push_record',['https://synthetic.invalid/A',A,version(),'x'],role),/permission denied/);
  }
  assert.throws(()=>sql('select id from auth.users;','service_role'),/permission denied/);
  assert.equal(call('prepare',[A]).status,'reserved');
 });
 test('admission is durable and unique; concurrent callers cannot own the same lease',async()=>{
  const results=await Promise.all([asyncSql('select public.mm_deletion_prepare_v1('+q(A)+');'),asyncSql('select public.mm_deletion_prepare_v1('+q(A)+');')]);
  assert.deepEqual(results.map(x=>JSON.parse(x).status).sort(),['busy','reserved']);assert.equal(sql('select count(*)from mm_account_lifecycle.jobs;'),'1');
 });
 test('atomic cleanup rolls ledger, endpoint and job state back after an injected delete failure',()=>{
  const j=call('prepare',[A]);const before=snapshot();sql("create function public.mm_test_delete_failure()returns trigger language plpgsql as $$begin raise exception 'synthetic cleanup failure';end$$;create trigger mm_test_delete_failure before delete on public.push_subscriptions for each row execute function public.mm_test_delete_failure();");
  assert.throws(()=>call('cleanup',identity(j)),/synthetic cleanup failure/);assert.equal(snapshot(),before);assert.equal(sql('select state from mm_account_lifecycle.jobs;'),'requested');
  sql('drop trigger mm_test_delete_failure on public.push_subscriptions;drop function public.mm_test_delete_failure();');
  const r=call('cleanup',identity(j));assert.deepEqual(r.counts,{push_sent:1,push_subscriptions:1});assert.deepEqual(call('cleanup',identity(j)).counts,r.counts);
  assert.equal(sql('select count(*)from public.app_state where user_id='+q(A)+';'),'1');assert.equal(sql('select count from public.ai_usage where user_id='+q(A)+';'),'7');
  assert.equal(sql('select count(*)from public.push_subscriptions where user_id='+q(B)+';'),'1');
 });
 test('new personal writes are fenced after admission, while other owner and DELETE remain usable',()=>{
  call('prepare',[A]);
  for(const role of ['authenticated','service_role'])for(const statement of ["update public.app_state set prefs='{}'where user_id="+q(A),"update public.profiles set display_name='changed'where id="+q(A),"update public.push_subscriptions set digest=true where user_id="+q(A)])assert.throws(()=>sql(statement+';',role),/deletion is pending/);
  sql("update public.profiles set display_name='B still works'where id="+q(B)+';','authenticated',B);
  sql('delete from public.push_subscriptions where user_id='+q(A)+';','authenticated',A);assert.equal(sql('select count(*)from public.push_sent;'),'1');
 });
 test('stale JWT cannot recreate subscription or personal state after Auth deletion',()=>{
  const j=dispatched();sql('delete from auth.users where id='+q(A)+';');
  assert.throws(()=>sub(A,'late','authenticated'),/unavailable|foreign key/);assert.throws(()=>sql('insert into public.app_state(user_id)values('+q(A)+');','authenticated'),/unavailable|foreign key/);
  assert.equal(call('finish',[...identity(j),'complete']).status,'completed');assert.equal(sql('select count(*)from mm_account_lifecycle.jobs;'),'1');
  assert.equal(call('prepare',[A]).status,'completed');
 });
 test('unsupported snapshot isolation and owner reassignment fail closed',()=>{
  assert.throws(()=>sql("begin isolation level repeatable read;update public.profiles set display_name='no'where id="+q(A)+';commit;','authenticated'),/READ COMMITTED/);
  assert.throws(()=>sql('update public.app_state set user_id='+q(Z)+'where user_id='+q(A)+';','service_role'),/cannot be reassigned/);
  assert.throws(()=>sql('begin isolation level serializable;select public.mm_deletion_prepare_v1('+q(A)+');commit;','service_role'),/READ COMMITTED/);
 });
 test('expired predispatch leases can recover with a new token and stale completion cannot act',()=>{
  const first=call('prepare',[A]);assert.equal(call('prepare',[A]).status,'busy');expires(first);const second=call('prepare',[A]);assert.equal(second.status,'reserved');assert.notEqual(second.lease_token,first.lease_token);
  assert.equal(call('cleanup',identity(first)).reason,'stale_token');assert.equal(call('cleanup',identity(second)).status,'cleaned');expires(second);const third=call('prepare',[A]);assert.equal(third.state,'cleaned');assert.equal(call('mark_auth',identity(second)).reason,'stale_token');assert.equal(call('mark_auth',identity(third)).ok,true);
 });
 test('dispatched and uncertain Auth work never automatically expires into another request',()=>{
  const j=dispatched();expires(j);assert.equal(call('prepare',[A]).status,'auth_unconfirmed');assert.equal(call('mark_auth',identity(j)).ok,false);
  assert.equal(call('finish',[...identity(j),'auth_unconfirmed']).status,'auth_unconfirmed');expires(j);assert.equal(call('prepare',[A]).status,'auth_unconfirmed');
  assert.equal(call('finish',[...identity(j),'complete']).reason,'absence_unverified');
 });
 test('unexpected Auth absence remains recoverable without the original login',()=>{
  const j=call('prepare',[A]);sql('delete from auth.users where id='+q(A)+';');assert.equal(call('prepare',[A]).state,'auth_unconfirmed');
  assert.equal(call('reconcile',[...identity(j),Z,'auth_absent','Operator verified unexpected subject removal']).status,'completed');
 });
 test('service reconciliation requires a unique resolution and preserves token fencing',()=>{
  const j=dispatched();call('finish',[...identity(j),'auth_error']);
  assert.equal(call('reconcile',[...identity(j),Z,'auth_absent','verified absent']).reason,'absence_unverified');
  const retry=call('reconcile',[...identity(j),Z,'auth_present_retry','Operator checked exact live subject and isolated old Auth call']);assert.equal(retry.status,'reserved');assert.notEqual(retry.lease_token,j.lease_token);
  assert.equal(call('finish',[...identity(j),'complete']).reason,'stale_token');call('mark_auth',identity(retry));
  assert.equal(call('reconcile',[...identity(retry),Z,'auth_present_retry','repeat']).reason,'resolution_used');
  sql('delete from auth.users where id='+q(A)+';');const complete=call('reconcile',[...identity(retry),B,'auth_absent','Operator confirmed subject absent']);assert.equal(complete.status,'completed');assert.equal(sql('select count(*)from mm_account_lifecycle.resolutions;'),'2');
 });
 test('completion independently checks all owned rows and never trusts outcome alone',()=>{
  const j=dispatched();assert.equal(call('finish',[...identity(j),'complete']).ok,false);
  sql('delete from auth.users where id='+q(A)+';');
  // Simulate unexpected pre-existing unvalidated personal orphan without weakening production SQL.
  sql('alter table public.app_state disable trigger all;insert into public.app_state(user_id)values('+q(A)+');alter table public.app_state enable trigger all;');
  assert.equal(call('finish',[...identity(j),'complete']).reason,'absence_unverified');sql('delete from public.app_state where user_id='+q(A)+';');assert.equal(call('finish',[...identity(j),'complete']).status,'completed');
 });
 test('new FKs prevent orphan subscriptions and late blind ledgers, legacy rows are not validated',()=>{
  assert.throws(()=>sub(Z,'no-auth'),/unavailable|foreign key/);
  sql("delete from public.push_subscriptions where endpoint='https://synthetic.invalid/A';");
  assert.throws(()=>sql("insert into public.push_sent(endpoint,dedupe_key)values('https://synthetic.invalid/A','late');",'service_role'),/foreign key/);
  assert.equal(sql("select count(*)from pg_constraint where conname like 'mm_lifecycle_%_fk' and not convalidated;"),'2');
 });
 test('push gates require exact live owner/version and atomic record rejects stale identities',()=>{
  const ep='https://synthetic.invalid/A',v=version();assert.equal(call('push_allowed',[ep,A,v]),true);assert.equal(call('push_record',[ep,A,v,'new-key']),true);
  assert.equal(call('push_record',[ep,B,v,'wrong-owner']),false);assert.equal(call('push_record',[ep,A,'1900-01-01Z','old-version']),false);assert.throws(()=>call('push_record',[ep,A,v,' '.repeat(2)]),/Invalid push/);
  call('prepare',[A]);assert.equal(call('push_allowed',[ep,A,v]),false);assert.equal(call('push_record',[ep,A,v,'pending']),false);
 });
 test('atomic push record cannot attach old owner history after endpoint re-registration',()=>{
  const ep='https://synthetic.invalid/A',v=version();sql("delete from public.push_subscriptions where endpoint="+q(ep)+';');sub(B,'A');
  assert.equal(call('push_record',[ep,A,v,'old-owner']),false);assert.equal(sql("select count(*)from public.push_sent where dedupe_key='old-owner';"),'0');
 });
 test('admission waits for prior live writer, then later writer sees the committed fence',async()=>{
  const old=asyncSql("begin;update public.profiles set display_name='prior'where id="+q(A)+";select pg_advisory_lock(778801);select pg_sleep(3);commit;select pg_advisory_unlock(778801);",'authenticated');
  let ready=false;for(let n=0;n<40;n++){if(sql("select count(*)from pg_locks where locktype='advisory'and objid=778801 and granted;")==='1'){ready=true;break;}await new Promise(r=>setTimeout(r,30));}assert.ok(ready);
  const pending=asyncSql('select public.mm_deletion_prepare_v1('+q(A)+');');await old;assert.equal(JSON.parse(await pending).status,'reserved');
  assert.throws(()=>sql("update public.profiles set display_name='late'where id="+q(A)+';','authenticated'),/deletion is pending/);
 });
 test('atomic push record locks non-key generation until ledger completion',async()=>{
  const ep='https://synthetic.invalid/A',v=version();
  const recording=asyncSql('begin;select public.mm_deletion_push_record_v1('+[ep,A,v,'held'].map(q).join(',')+");select pg_advisory_lock(778802);select pg_sleep(6);commit;select pg_advisory_unlock(778802);");
  let ready=false;for(let n=0;n<40;n++){if(sql("select count(*)from pg_locks where locktype='advisory'and objid=778802 and granted;")==='1'){ready=true;break;}await new Promise(r=>setTimeout(r,30));}assert.ok(ready);
  let updated=false;const update=asyncSql("set application_name='mm-lifecycle-generation-wait';update public.push_subscriptions set updated_at=clock_timestamp()+interval'1second'where endpoint="+q(ep)+';').then(r=>{updated=true;return r;});
  let waiting=false;for(let n=0;n<10&&!updated;n++){await new Promise(r=>setTimeout(r,30));if(sql("select count(*)from pg_stat_activity where application_name='mm-lifecycle-generation-wait'and wait_event_type='Lock';")==='1'){waiting=true;break;}}
  assert.ok(waiting,'the real non-key UPDATE must wait on the recorder SHARE lock');
  await recording;await update;assert.equal(call('push_record',[ep,A,v,'late-generation']),false);
 });
 test('future MM05 FK shape preserves shared work and cascades only owned refunds/counters',()=>{
  sql("create schema mm_ai_generation;create table mm_ai_generation.refunds(user_id uuid references auth.users(id)on delete cascade,day date,credits integer);create table mm_ai_generation.work(work_key text primary key,owner_id uuid references auth.users(id)on delete set null,private boolean,output jsonb,state text);create table mm_ai_generation.reconciliations(resolution_id uuid primary key,work_key text,note text);insert into mm_ai_generation.refunds values("+q(A)+",current_date,1);insert into mm_ai_generation.work values('owned',"+q(A)+",true,null,'uncertain'),('shared',null,false,'{\"text\":\"shared facts\"}','complete');insert into mm_ai_generation.reconciliations values("+q(Z)+",'owned','nonsecret operational result');");
  const j=dispatched();assert.equal(sql('select count from public.ai_usage where user_id='+q(A)+';'),'7');sql('delete from auth.users where id='+q(A)+';');assert.equal(call('finish',[...identity(j),'complete']).status,'completed');assert.equal(sql('select count(*)from mm_ai_generation.refunds;'),'0');assert.equal(sql("select owner_id is null from mm_ai_generation.work where work_key='owned';"),'t');assert.equal(sql('select count(*)from mm_ai_generation.work;'),'2');assert.equal(sql('select count(*)from mm_ai_generation.reconciliations;'),'1');
  sql('drop schema mm_ai_generation cascade;');
 });
 test('integrated durable handler completes only after real database cleanup and Auth cascades',async()=>{
  const admin={rpc:async(name,args)=>({error:null,data:JSON.parse(await asyncSql('select to_jsonb(public.'+name+'('+Object.values(args).map(q).join(',')+'));'))}),auth:{getUser:async()=>({error:null,data:{user:{id:A}}}),admin:{deleteUser:async uid=>{await asyncSql('delete from auth.users where id='+q(uid)+';','');return{error:null,data:{user:{id:uid}}};}}}};
  const req=new Request('https://synthetic.invalid/delete-account',{method:'POST',headers:{authorization:'Bearer invented-only'},body:JSON.stringify({confirmation:'DELETE',password:'synthetic-only-password',user_id:B})});
  const r=await deleteAccountRequest({admin,req,verifyPassword:async({userId})=>({verified:true,user_id:userId})});assert.equal(r.status,200);assert.equal(r.body.state,'completed');
  assert.equal(sql('select count(*) from auth.users where id='+q(A)+';'),'0');assert.equal(sql('select count(*) from public.app_state where user_id='+q(A)+';'),'0');assert.equal(sql('select count(*) from public.push_sent where endpoint=\'https://synthetic.invalid/A\';'),'0');
  assert.equal(sql('select count(*) from public.app_state where user_id='+q(B)+';'),'1');
 });
 test('integrated lost Auth response leaves durable operator recovery without the deleted login',async()=>{
  const admin={rpc:async(name,args)=>({error:null,data:JSON.parse(await asyncSql('select to_jsonb(public.'+name+'('+Object.values(args).map(q).join(',')+'));'))}),auth:{getUser:async()=>({error:null,data:{user:{id:A}}}),admin:{deleteUser:async uid=>{await asyncSql('delete from auth.users where id='+q(uid)+';','');throw Error('synthetic lost response');}}}};
  const req=new Request('https://synthetic.invalid/delete-account',{method:'POST',headers:{authorization:'Bearer invented-only'},body:JSON.stringify({confirmation:'DELETE',password:'synthetic-only-password'})});
  const r=await deleteAccountRequest({admin,req,verifyPassword:async({userId})=>({verified:true,user_id:userId})});assert.equal(r.body.state,'auth_unconfirmed');assert.equal(r.body.ok,false);
  const j=JSON.parse(sql('select jsonb_build_object(\'job_id\',job_id,\'token\',token,\'state\',state) from mm_account_lifecycle.jobs where user_id='+q(A)+';'));assert.equal(j.state,'auth_unconfirmed');
  const result=call('reconcile',[j.job_id,j.token,Z,'auth_absent','Synthetic privileged Auth lookup confirmed absence']);assert.equal(result.ok,true);assert.equal(sql('select state from mm_account_lifecycle.jobs where job_id='+q(j.job_id)+';'),'completed');assert.equal(sql('select count(*) from auth.users where id='+q(A)+';'),'0');
 });

 test('actual MM05 allocation and provider-dispatch SQL respect admitted deletion',()=>{
  sql(`create schema mm_fixture_delivery;grant usage on schema mm_fixture_delivery to service_role;create table public.fixtures(fxid bigint primary key,date date);grant select on public.fixtures to service_role;
   create function mm_fixture_delivery.display(text)returns jsonb language sql stable as $f$select null::jsonb$f$;create function mm_fixture_delivery.history(date,bigint)returns jsonb language sql stable as $f$select null::jsonb$f$;
   create function public.matchmind_display_v1(text)returns jsonb language sql stable as $f$select mm_fixture_delivery.display($1)$f$;create function public.matchmind_history_v1(date,bigint)returns jsonb language sql stable as $f$select mm_fixture_delivery.history($1,$2)$f$;`);
  sql(readFileSync(new URL('../backend/ai-generation/PROPOSAL-up.sql',import.meta.url),'utf8'));
  const doc={user_id:A,private:true,fxid:null,mode:'analysis',provider:'gemini',prompt_version:'lifecycle-test',source_hash:'a'.repeat(64),limit:100};
  const alloc=JSON.parse(sql('select public.mm_ai_prepare_v1('+q(JSON.stringify(doc))+'::jsonb);','service_role'));assert.equal(alloc.status,'reserved');
  call('prepare',[A]);const before=sql('select count from public.ai_usage where user_id='+q(A)+';');
  assert.throws(()=>sql('select public.mm_ai_prepare_v1('+q(JSON.stringify({...doc,source_hash:'b'.repeat(64)}))+'::jsonb);','service_role'),/lifecycle recovery/);
  assert.throws(()=>sql('select public.mm_ai_mark_dispatch_v1('+q(alloc.work_key)+','+q(alloc.lease_token)+','+q(A)+');','service_role'),/lifecycle recovery/);
  assert.equal(sql('select count from public.ai_usage where user_id='+q(A)+';'),before);assert.equal(sql('select state from mm_ai_generation.work where work_key='+q(alloc.work_key)+';'),'reserved');
  assert.throws(()=>call('generation_guard',[A],'authenticated'),/permission denied/);
 });

});
