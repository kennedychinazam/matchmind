// Isolated synthetic PostgreSQL only (pinned image, --network none). No hosted database credentials.
// STAGING-analysis2-up/down.sql: per-competition goal-rate counts and league table ("competitions").
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {buildPresentationPayload,validatePresentationPayload} from '../backend/fixture-delivery/contract.mjs';
const root=new URL('../',import.meta.url),read=f=>readFileSync(new URL(f,root),'utf8');
const db='mm-analysis2-sql-'+process.pid;
const docker=(args,input)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{input,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']}).trim();
const sql=(s,role)=>docker(['exec','-i',db,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],(role?'set role '+role+';':'')+s);
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const now=new Date(),day=now.toISOString().slice(0,10),stamp=new Date(+now-60000).toISOString();
const base=buildPresentationPayload({fixtures:[{fxid:1,lid:1,lname:'Synthetic League',lcountry:'Test',date:day,time:'12:00',status:'NS',elapsed:null,home:'Synthetic Home',away:'Synthetic Away',gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:stamp,provider:'af'}]});
const withComp=validatePresentationPayload({...structuredClone(base),competitions:[{lid:1,source:'api-football/competition-60m',source_at:stamp,from:'2021-11-20',to:day,rates:{n:40,btts:20,o15:30,o25:20,o35:9},
 standings:{season:2026,rows:[{rank:1,team:'Synthetic Home',played:2,won:2,drawn:0,lost:0,gf:4,ga:1,points:6},{rank:2,team:'Synthetic Away',played:2,won:0,drawn:0,lost:2,gf:1,ga:4,points:0}]}}]});
const defs=()=>sql("select string_agg(md5(pg_get_functiondef(p::regprocedure)),',') from unnest(array['mm_fixture_delivery.payload_valid(jsonb)','mm_preview_mirror.display(text)','public.mm_preview_display_v1(text)','public.mm_preview_display_v2(text)']) p;");
const acls=()=>sql("select string_agg(pg_get_userbyid(proowner)||coalesce(proacl::text,'')||provolatile::text||prosecdef::text,',' order by oid) from pg_proc where oid in('mm_fixture_delivery.payload_valid(jsonb)'::regprocedure,'mm_preview_mirror.display(text)'::regprocedure,'public.mm_preview_display_v1(text)'::regprocedure,'public.mm_preview_display_v2(text)'::regprocedure);");
let checks=0;const check=(t,m)=>{assert.ok(t,m);checks++;};
const valid=x=>sql('select mm_fixture_delivery.payload_valid('+literal(x)+');');
test('staging analysis2 SQL adds closed competitions, keeps v1 shape and rolls back exactly',async()=>{
 try{
 docker(['run','-d','--name',db,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16.6@sha256:557fea37a744d5f4c8faab304b0a90858b53ab119735a88c131fd19dab802f36']);
 let ready=false;for(let i=0;i<80;i++){try{if(docker(['logs',db]).includes('init process complete')){docker(['exec',db,'pg_isready','-U','postgres']);ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}check(ready,'postgres ready');
 sql(read('backend/fixture-delivery/synthetic-bootstrap.sql'));
 sql('create schema mm_fixture_delivery;create table mm_fixture_delivery.editions(edition_id uuid primary key,edition_day date,as_of timestamptz,expires_at timestamptz,source_review text,expected_cards int,expected_predictions int,payload jsonb);');
 const baseline=read('backend/fixture-delivery/PROPOSAL-up.sql');
 sql(baseline.slice(baseline.indexOf('create function mm_fixture_delivery.schema_valid('),baseline.indexOf('alter table mm_fixture_delivery.editions add constraint closed_payload')));
 sql(baseline.match(/create function mm_fixture_delivery.prediction_count\([\s\S]*?\$\$;/)[0]);
 assert.throws(()=>sql(read('staging/mirror/STAGING-analysis2-up.sql')),/Isolated real-data preview/);checks++;
 sql("set mm.preview_token_sha256='"+'a'.repeat(64)+"';"+read('staging/mirror/INSTALL-staging-only.sql'));
 for(const f of ['STAGING-analysis-up.sql','STAGING-issued-tips-up.sql','STAGING-tips-continuity-up.sql','STAGING-capacity-up.sql'])sql(read('staging/mirror/'+f));
 check(valid(base)==='t'&&valid(withComp)==='f','before: base accepted, competitions refused');
 const before=defs(),aclBefore=acls();
 sql(read('staging/mirror/STAGING-analysis2-up.sql'));
 check(valid(base)==='t','after: edition without competitions accepted');
 check(valid(withComp)==='t','after: competitions accepted');
 for(const [why,mut] of [['duplicate competition',x=>x.competitions.push(structuredClone(x.competitions[0]))],['competition without fixture',x=>{x.competitions[0].lid=2;}],['btts over n',x=>{x.competitions[0].rates.btts=41;}],
  ['over 3.5 above over 2.5',x=>{x.competitions[0].rates.o35=21;}],['unknown field',x=>{x.competitions[0].raw=[];}],['65 table rows',x=>{x.competitions[0].standings.rows=Array.from({length:65},(_,i)=>({...x.competitions[0].standings.rows[0],rank:i+1}));}],['101 competitions',x=>{x.competitions=Array.from({length:101},(_,i)=>({...x.competitions[0],lid:i+1}));}]]){
  const bad=structuredClone(withComp);mut(bad);check(valid(bad)==='f','refused: '+why);
 }
 check(acls()===aclBefore,'owner, grants, volatility and security mode unchanged');
 assert.throws(()=>sql(read('staging/mirror/STAGING-analysis2-up.sql')),/Expected exactly one|already installed/);checks++;
 sql('insert into mm_preview_mirror.editions(payload,manifest) values('+literal(withComp)+",'{}');");
 const hashes=sql("select string_agg(md5(payload::text),',' order by as_of) from mm_preview_mirror.editions;");
 for(const screen of ['scores','predictions','history']){const v3=JSON.parse(sql(`select public.mm_preview_display_v3('${screen}');`,'anon'));assert.deepEqual(v3.competitions,withComp.competitions,'v3 '+screen);checks++;
  const v2=JSON.parse(sql(`select public.mm_preview_display_v2('${screen}');`,'anon'));const {competitions,...rest}=v3;assert.deepEqual(v2,rest,'v2 '+screen+' is v3 without competitions');checks++;
  const v1=JSON.parse(sql(`select public.mm_preview_display_v1('${screen}');`,'anon'));check(!Object.hasOwn(v1,'competitions')&&v1.edition_id===v3.edition_id,'v1 '+screen+' strips competitions');}
 for(const screen of ['records','slips'])check(!Object.hasOwn(JSON.parse(sql(`select public.mm_preview_display_v3('${screen}');`,'anon')),'competitions'),screen+' screen unchanged');
 check(sql("select coalesce(proacl::text,'') from pg_proc where oid='public.mm_preview_display_v3(text)'::regprocedure;")===sql("select coalesce(proacl::text,'') from pg_proc where oid='public.mm_preview_display_v2(text)'::regprocedure;"),'v3 has exactly v2 grants');
 assert.throws(()=>sql('select * from mm_preview_mirror.editions;','anon'),/permission denied/);checks++;
 sql(read('staging/mirror/STAGING-analysis2-down.sql'));
 check(defs()===before,'rollback restores the exact function text');
 check(acls()===aclBefore,'rollback keeps owner and grants');
 check(valid(withComp)==='f'&&valid(base)==='t','rollback restores the earlier closed schema');
 check(!Object.hasOwn(JSON.parse(sql("select public.mm_preview_display_v2('scores');",'anon')),'competitions'),'rollback v2 returns the earlier shape');
 check(sql("select to_regprocedure('public.mm_preview_display_v3(text)') is null;")==='t','rollback removes v3');
 check(sql("select string_agg(md5(payload::text),',' order by as_of) from mm_preview_mirror.editions;")===hashes,'rollback preserves stored editions');
 assert.throws(()=>sql(read('staging/mirror/STAGING-analysis2-down.sql')),/nothing to roll back/);checks++;
 console.log('SQL analysis2 assertions: '+checks);
 }finally{try{docker(['rm','-fv',db]);}catch{}}
});
