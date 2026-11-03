/* Explicit LOCAL SYNTHETIC runner. Never a hosted URL, real key, provider call or production database. */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,chmodSync} from 'node:fs';
import {randomBytes,createHmac,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve,dirname} from 'node:path';
const ROOT=dirname(fileURLToPath(import.meta.url));
if(process.argv[2]!=='--run-local-synthetic')throw Error('Explicit --run-local-synthetic required');
const evidenceDir=resolve(process.argv[3]||'/workspace/review-deliverables/public-fixture-remediation-20261102/backend');mkdirSync(evidenceDir,{recursive:true});
const prefix='mm-fixture-delivery-'+Date.now(),db=prefix+'-db',rest=prefix+'-rest',network=prefix,volume=prefix+'-data';
const env={...process.env};for(const k of ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH'])delete env[k];
const password=randomBytes(24).toString('hex'),secret=randomBytes(48).toString('hex');env.POSTGRES_PASSWORD=password;env.PGRST_DB_URI='postgres://authenticator:'+password+'@db:5432/synthetic';env.PGRST_JWT_SECRET=secret;
const docker=(args,input)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{env,input,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']}).trim();
const sql=q=>docker(['exec','-i',db,'psql','-U','postgres','-d','synthetic','-At','-v','ON_ERROR_STOP=1'],q);
const jwt=(role,sub,extra={})=>{const encode=x=>Buffer.from(JSON.stringify(x)).toString('base64url');const data=encode({alg:'HS256',typ:'JWT'})+'.'+encode({role,sub,aud:'authenticated',exp:Math.floor(Date.now()/1000)+10800,...extra});return data+'.'+createHmac('sha256',secret).update(data).digest('base64url');};
const ids={A:'11111111-1111-4111-8111-111111111111',B:'22222222-2222-4222-8222-222222222222',publisher:'33333333-3333-4333-8333-333333333333',research:'44444444-4444-4444-8444-444444444444'};
const tokens={anon:jwt('anon'),A:jwt('authenticated',ids.A),B:jwt('authenticated',ids.B),publisher:jwt('authenticated',ids.publisher),research:jwt('authenticated',ids.research),spoof:jwt('authenticated',ids.A,{user_metadata:{role:'publisher',raw_allowed:true}}),service:jwt('service_role')};
const request=(path,{token=tokens.anon,method='GET',body}={})=>{
 if(!path.startsWith('/')||/[\r\n]/.test(path))throw Error('Only fixed local path permitted');const payload=body===undefined?'':JSON.stringify(body);
 const headers=['Host: rest','Connection: close','Prefer: return=representation','Authorization: Bearer '+token,...(body===undefined?[]:['Content-Type: application/json','Content-Length: '+Buffer.byteLength(payload)])];
 const raw=docker(['exec','-i',db,'perl','-MIO::Socket::INET','-e','my $s=IO::Socket::INET->new(PeerAddr=>"rest",PeerPort=>3000,Proto=>"tcp",Timeout=>5) or die "local socket unavailable"; $s->autoflush(1); local $/; my $r=<STDIN>; print $s $r; print while <$s>;'],method+' '+path+' HTTP/1.0\r\n'+headers.join('\r\n')+'\r\n\r\n'+payload);
 const status=Number(raw.match(/^HTTP\/\d\.\d (\d+)/)?.[1]);let data;try{data=JSON.parse(raw.slice(raw.indexOf('\r\n\r\n')+4));}catch{data=null;}return{status,data};
};
const result={utc:new Date().toISOString(),scope:'NEW isolated synthetic Postgres17/PostgREST14; not deployed schema or provider evidence',checks:[],productionConnections:0};
const check=(name,fn)=>{try{fn();result.checks.push({name,status:'PASS'});}catch(e){result.checks.push({name,status:'FAIL',error:e.message});throw e;}};
const digest=()=>sql("select md5(coalesce(jsonb_agg(to_jsonb(f) order by fxid)::text,'')) from public.fixtures f;")+':'+sql("select md5(coalesce(jsonb_agg(to_jsonb(p) order by fxid)::text,'')) from public.predictions p;");
try{
 docker(['info','--format','{{.ServerVersion}}']);docker(['network','create','--internal',network]);docker(['volume','create',volume]);
 const noProxy=['HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy'].flatMap(k=>['-e',k+'=']);
 docker(['run','-d','--name',db,'--label','matchmind.purpose=offline-fixture-delivery','--network',network,'--network-alias','db','-e','POSTGRES_PASSWORD','-e','POSTGRES_DB=synthetic',...noProxy,'-v',volume+':/var/lib/postgresql/data','postgres@sha256:858bb5e98eed02eb8cafbcdc007f9a65d1b613972028944a8ec2133ccaf80d27']);
 let ready=false;for(let i=0;i<30;i++){try{sql('select 1;');ready=true;break;}catch{await new Promise(r=>setTimeout(r,1000));}}if(!ready)throw Error('Local PostgreSQL startup not ready');
 sql(readFileSync(resolve(ROOT,'synthetic-bootstrap.sql'),'utf8'));
 docker(['run','-d','--name',rest,'--label','matchmind.purpose=offline-fixture-delivery','--network',network,'--network-alias','rest','-e','PGRST_DB_URI','-e','PGRST_JWT_SECRET','-e','PGRST_DB_SCHEMAS=public','-e','PGRST_DB_ANON_ROLE=anon','-e','PGRST_LOG_LEVEL=error',...noProxy,'postgrest/postgrest:v14.18@sha256:c7cd7e265a85b05248abf53f4473fcec7e327c282d0bd0cf60f1551996d09fcf']);
 for(let i=0;i<30;i++){try{if(request('/fixtures?select=fxid').status===200)break;}catch{}await new Promise(r=>setTimeout(r,500));}
 const red=request('/fixtures?select=*&limit=1000');assert.equal(red.status,200);assert.equal(red.data.length,148);writeFileSync(resolve(evidenceDir,'local-failing-first.json'),JSON.stringify({test:'raw fixture rejection',expected:'denied',observedStatus:200,syntheticRows:148,result:'FAIL (confirmed synthetic baseline exposure)'},null,2)+'\n');
 check('synthetic publisher write positive control before proposal',()=>{const r=request('/fixtures?fxid=eq.910999',{method:'PATCH',body:{elapsed:3},token:tokens.publisher});assert.equal(r.status,200);assert.equal(r.data[0].elapsed,3);assert.equal(request('/fixtures?fxid=eq.910999',{method:'PATCH',body:{elapsed:null},token:tokens.publisher}).status,200);});
 const original=digest();
 // An unreviewed inherited ACL must abort installation, not silently leave a raw backdoor.
 sql('create role synthetic_unreviewed_reader nologin;grant select on public.fixtures to synthetic_unreviewed_reader;grant synthetic_unreviewed_reader to anon;');
 check('unknown inherited anonymous SELECT fails installation atomically',()=>{assert.throws(()=>sql(readFileSync(resolve(ROOT,'PROPOSAL-up.sql'),'utf8')),/Unreviewed inherited anonymous SELECT/);assert.equal(sql("select to_regclass('mm_fixture_delivery.editions') is null;"),'t');assert.equal(digest(),original);});
 sql('revoke synthetic_unreviewed_reader from anon;');
 sql(readFileSync(resolve(ROOT,'PROPOSAL-up.sql'),'utf8'));
 check('SQL string validation guards date casts by format',()=>{assert.equal(sql("select mm_fixture_delivery.schema_valid(to_jsonb('Synthetic Upcoming Away'::text),'{\"type\":\"string\",\"max\":160}'::jsonb);"),'t');assert.equal(sql("select mm_fixture_delivery.schema_valid(to_jsonb('2026-99-99'::text),'{\"type\":\"string\",\"max\":10,\"format\":\"date\"}'::jsonb);"),'f');});
 // Empty-by-default registry is a real gate, not a client flag. No actual Director receipt enrolled.
 await new Promise(r=>setTimeout(r,700));
 const rpc=(name,body={},token=tokens.anon)=>request('/rpc/'+name,{method:'POST',body,token});
 check('empty registry denies even proposed publisher',()=>assert.deepEqual(rpc('matchmind_fixture_access_v1',{},tokens.publisher).data,{version:'matchmind-fixture-access/1',raw_allowed:false,expires_at:null}));
 check('public current edition absent fails closed',()=>assert(rpc('matchmind_display_v1',{screen:'scores'}).status>=400));
 sql(`insert into mm_fixture_delivery.principals values('${ids.publisher}','publisher',true,now()+interval '1 hour','synthetic-only'),('${ids.research}','research',true,now()+interval '1 hour','synthetic-only');`);
 check('publisher materializes from unchanged original records',()=>{const r=rpc('matchmind_publish_display_v1',{},tokens.publisher);assert.equal(r.status,200);assert.equal(r.data.cards,148);assert.equal(r.data.predictions,145);assert.equal(digest(),original);});
 for(const [who,token] of [['anon',tokens.anon],['A',tokens.A],['B',tokens.B],['spoof',tokens.spoof]]){
  check('raw capability false '+who,()=>assert.equal(rpc('matchmind_fixture_access_v1',{},token).data.raw_allowed,false));
  for(const table of ['fixtures','fixtures_lean','competitions','provider_alias','predictions','daily_slips','shared_records','odds_snapshots','odds_latest','injuries','match_context','predictions_retired','match_analysis','venues'])check('generic raw access denied '+who+'/'+table,()=>{const r=request('/'+table+'?select=*',{token});if(who==='anon')assert(r.status>=400);else{assert.equal(r.status,200);assert.deepEqual(r.data,[]);}});
  check('publisher RPC denied '+who,()=>assert.equal(rpc('matchmind_publish_display_v1',{},token).status,who==='anon'?401:403));
 }
 for(const [who,token] of [['publisher',tokens.publisher],['research',tokens.research]]){
  check('raw capability true '+who,()=>assert.equal(rpc('matchmind_fixture_access_v1',{},token).data.raw_allowed,true));
  check('complete raw inventory '+who,()=>{const r=request('/fixtures?select=*',{token});assert.equal(r.status,200);assert.equal(r.data.length,148);assert(r.data[0].provider_blob);});
 }
 check('verified service collector refreshes presentation without model changes',()=>{const r=rpc('matchmind_publish_display_v1',{},tokens.service);assert.equal(r.status,200);assert.equal(r.data.predictions,145);assert.equal(digest(),original);});
 check('research cannot publish',()=>assert.equal(rpc('matchmind_publish_display_v1',{},tokens.research).status,403));
 for(const screen of ['scores','predictions','history','records','slips'])check('bounded screen '+screen,()=>{const r=rpc('matchmind_display_v1',{screen});assert.equal(r.status,200);assert.equal(r.data.version,'matchmind-display/1');assert.equal(r.data.screen,screen);assert(!JSON.stringify(r.data).includes('RAW-PRIVATE'));assert(!JSON.stringify(r.data).includes('private_raw_marker'));if(screen==='scores'){assert.equal(r.data.cards.length,2);assert(r.data.cards.every(c=>c.prediction===null));assert(r.data.cards.some(c=>c.fxid===910998&&c.status==='FT'&&c.ft_h===2));}if(screen==='predictions')assert.equal(r.data.cards.length,1);if(screen==='history'){assert.equal(r.data.cards.length,146);assert(r.data.cards.some(c=>c.fxid===910997&&c.ft_h===1&&c.prediction===null));}});
 check('all original synthetic145 forecasts exact in history',()=>{const cards=rpc('matchmind_display_v1',{screen:'history'}).data.cards;const historical=cards.filter(c=>c.prediction);assert.equal(historical.length,145);assert(historical.every(c=>c.prediction.p_home===.6&&c.prediction.p_draw===.2&&c.prediction.p_away===.2&&c.prediction.build===355));});
 for(const bad of [{screen:'other'},{screen:'scores',fxid:910001},{screen:'history',date:'2020-01-01'},{screen:'scores',offset:1000},{screen:'scores',select:'*'}])check('caller selector rejected '+Object.keys(bad).join(','),()=>assert(rpc('matchmind_display_v1',bad).status>=400));
 check('private schema not exposed',()=>assert(request('/editions').status>=400));
 check('dedicated reader cannot read raw source',()=>{assert.equal(sql("select has_table_privilege('mm_display_reader','public.fixtures','select');"),'f');assert.equal(sql("select rolcanlogin or rolbypassrls or rolsuper from pg_roles where rolname='mm_display_reader';"),'f');});
 check('cross account rows remain isolated',()=>{assert.equal(request('/app_state?select=*',{token:tokens.A}).data[0].user_id,ids.A);assert.equal(request('/app_state?select=*&user_id=eq.'+ids.B,{token:tokens.A}).data.length,0);const r=request('/app_state?user_id=eq.'+ids.B,{token:tokens.A,method:'PATCH',body:{fav_matches:['MUST-NOT-WRITE']}});assert.equal(r.status,200);assert.deepEqual(r.data,[]);assert(sql('select fav_matches::text from public.app_state where user_id=\''+ids.B+'\';').includes('B-private'));});
 check('service collector original write grants preserved',()=>{const r=request('/fixtures?fxid=eq.910999',{method:'PATCH',body:{elapsed:1},token:tokens.service});assert.equal(r.status,200);assert.equal(r.data[0].elapsed,1);const r2=request('/fixtures?fxid=eq.910999',{method:'PATCH',body:{elapsed:null},token:tokens.service});assert.equal(r2.status,200);assert.equal(digest(),original);});
 check('scoped publisher original writes preserved',()=>{const r=request('/fixtures?fxid=eq.910999',{method:'PATCH',body:{elapsed:2},token:tokens.publisher});assert.equal(r.status,200);request('/fixtures?fxid=eq.910999',{method:'PATCH',body:{elapsed:null},token:tokens.publisher});assert.equal(digest(),original);});
 check('schema payload check cannot be bypassed by service',()=>assert.throws(()=>sql("insert into mm_fixture_delivery.editions select gen_random_uuid(),edition_day,as_of,expires_at,'synthetic-bad',expected_cards,expected_predictions,payload||'{\"raw\":{\"secret\":1}}'::jsonb from mm_fixture_delivery.editions limit 1;")));
 check('revert restores original ACLs and disables all new entry points transactionally',()=>{
  const body=readFileSync(resolve(ROOT,'PROPOSAL-revert.sql'),'utf8').replace(/^begin;$/m,'').replace(/^commit;$/m,'');
  const raw=sql('begin;'+body+"select jsonb_build_object('anon_raw',has_any_column_privilege('anon','public.fixtures','SELECT'),'anon_facade',has_function_privilege('anon','public.matchmind_display_v1(text)','EXECUTE'),'auth_helper',has_function_privilege('authenticated','mm_fixture_delivery.display(text)','EXECUTE'),'service_publish',has_function_privilege('service_role','public.matchmind_publish_display_v1()','EXECUTE'));rollback;");
  const proof=JSON.parse(raw.split('\n').find(x=>x.startsWith('{')));assert.equal(proof.anon_raw,true);assert.equal(proof.anon_facade,false);assert.equal(proof.auth_helper,false);assert.equal(proof.service_publish,false);
  assert.equal(request('/fixtures?select=*').status,401);assert.equal(digest(),original);
 });
 check('immutable original records unchanged',()=>assert.equal(digest(),original));
 const runtime={db,rest,network,volume,ids,tokens,editionId:rpc('matchmind_display_v1',{screen:'scores'}).data.edition_id,apiAlias:'http://local-fixture.invalid',scope:'LOCAL GENERATED credentials; do not publish',bootstrapSource:'synthetic-bootstrap.sql'};const runtimePath=resolve(evidenceDir,'runtime.json');writeFileSync(runtimePath,JSON.stringify(runtime,null,2)+'\n',{mode:0o600});chmodSync(runtimePath,0o600);
 const isolation=JSON.parse(docker(['network','inspect',network]))[0];assert.equal(isolation.Internal,true);
 result.runtimeFile=runtimePath;result.containerNames={db,rest};result.internalNetwork=true;result.originalDigest=original;result.finalDigest=digest();result.result='PASS';
}catch(e){result.result='FAIL';result.failure=e.message.replaceAll(password,'[local-password-redacted]').replaceAll(secret,'[local-secret-redacted]');process.exitCode=1;}
finally{result.completedUtc=new Date().toISOString();writeFileSync(resolve(evidenceDir,'local-results.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({result:result.result,checks:result.checks.length,pass:result.checks.filter(x=>x.status==='PASS').length,failure:result.failure,containers:result.containerNames}));}
