// Explicit opt-in full-stack characterization; no hosted URLs or credentials accepted.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
import {localRequest} from './local-transport.mjs';
const runtime=resolve(process.argv[2]||'/workspace/matchmind-tools/phase4/runtime');
const cli='/workspace/matchmind-tools/phase4/node_modules/.bin/supabase';
assert.ok(runtime.startsWith('/workspace/matchmind-tools/phase4/'),'private scratch runtime required');
assert.ok(!existsSync(runtime+'/supabase/.temp/project-ref'),'linked project forbidden');
const config=readFileSync(runtime+'/supabase/config.toml','utf8');
assert.match(config,/project_id = "runtime"/);
const env={PATH:process.env.PATH,HOME:runtime,DOCKER_HOST:'unix:///var/run/docker.sock',SUPABASE_INTERNAL_IMAGE_REGISTRY:'ghcr.io'};
function docker(args,input){return execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{env,input,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']});}
const network=JSON.parse(docker(['network','inspect','mm-phase4-local']))[0];
assert.equal(network.Internal,true);
const containers=Object.keys(network.Containers||{});
assert.ok(containers.length>=4,'full stack must be running');
for(const id of containers){
 const c=JSON.parse(docker(['inspect',id]))[0];
 assert.deepEqual(Object.keys(c.NetworkSettings.Networks),['mm-phase4-local']);
 for(const bindings of Object.values(c.NetworkSettings.Ports||{}))for(const binding of bindings||[])assert.equal(binding.HostIp,'127.0.0.1','non-loopback port');
}
const keys=JSON.parse(execFileSync(cli,['status','--workdir',runtime,'-o','json'],{env,encoding:'utf8',stdio:['pipe','pipe','pipe']}));
assert.equal(keys.API_URL,'http://127.0.0.1:54321');
const apikey=keys.ANON_KEY;
assert.ok(apikey,'local anon key required');
async function request(path,{token,body,method='GET'}={}) {
 const r=await localRequest(keys.API_URL,path,{method,headers:{apikey,...token?{Authorization:`Bearer ${token}`}:{},'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const text=await r.text();let data;try{data=JSON.parse(text);}catch{data=text;}
 return {status:r.status,data};
}
const email=`phase4-${randomUUID()}@example.test`,password=randomBytes(24).toString('base64url');
const signup=await request('/auth/v1/signup',{method:'POST',body:{email,password,data:{publisher:true}}});
assert.equal(signup.status,200,'synthetic signup failed');
assert.ok(signup.data.access_token,'local email confirmation must be disabled');
const token=signup.data.access_token;
const user=await request('/auth/v1/user',{token});assert.equal(user.status,200);assert.equal(user.data.email,email);
assert.equal((await request('/auth/v1/user',{token:'invalid'})).status,401);
assert.equal((await request('/rest/v1/')).status,200);
// Probe a test-only RLS/RPC boundary on the local stack, never application or production tables.
const db='supabase_db_runtime';
function sql(input){return docker(['exec','-i',db,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At'],input).trim();}
const uid=signup.data.user.id;assert.match(uid,/^[a-f0-9-]{36}$/);
try {
 sql(`create table public.phase4_probe(owner uuid primary key,value text);alter table public.phase4_probe enable row level security;grant select on public.phase4_probe to anon,authenticated;create policy own on public.phase4_probe to authenticated using(owner=(select auth.uid()));insert into public.phase4_probe values('${uid}','owned'),(gen_random_uuid(),'hidden');create function public.phase4_probe_rpc()returns bigint language sql security invoker set search_path='' as 'select count(*)from public.phase4_probe';revoke all on function public.phase4_probe_rpc()from public;grant execute on function public.phase4_probe_rpc()to authenticated;notify pgrst,'reload schema';`);
 // PostgREST refresh is asynchronous; retry only this local schema-cache readiness probe.
 let result;for(let i=0;i<30;i++){result=await request('/rest/v1/phase4_probe',{token});if(result.status===200)break;await new Promise(r=>setTimeout(r,100));}
 assert.equal(result.status,200);assert.deepEqual(result.data,[{owner:uid,value:'owned'}]);
 assert.deepEqual((await request('/rest/v1/phase4_probe')).data,[]);
 assert.equal((await request('/rest/v1/rpc/phase4_probe_rpc',{token,method:'POST',body:{}})).data,1);
 assert.ok([401,403].includes((await request('/rest/v1/rpc/phase4_probe_rpc',{method:'POST',body:{}})).status));
 console.log(JSON.stringify({local_stack:'passed',checks:['internal network','loopback bindings','Auth signup/user','invalid JWT rejected','PostgREST','owner RLS','RPC permission'],external_calls:0}));
}finally{sql('drop function if exists public.phase4_probe_rpc();drop table if exists public.phase4_probe;');sql(`delete from auth.users where id='${uid}';`);}
