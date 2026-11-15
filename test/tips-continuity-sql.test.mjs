/* STAGING-tips-continuity-up.sql AND ITS ROLLBACK, EXECUTED AGAINST AN ISOLATED POSTGRES.
 *
 * Synthetic rows only. A disposable PostgreSQL 16.6 container with no network. No hosted database,
 * no credential. The container is brought to the state the staging project is in (INSTALL, then
 * STAGING-analysis-up, then STAGING-issued-tips-up) before the change under test is applied.
 *
 * What must hold:
 *   - the replacement edits exactly one statement of mm_preview_mirror.publish and nothing else;
 *   - owner, SECURITY DEFINER, search_path and every grant are byte-identical before and after;
 *   - the writer is still token-gated and anonymous readers still cannot read private tables;
 *   - slips for the current and the previous UTC day are admitted, an older day is refused;
 *   - two slips sharing a day and tier are refused;
 *   - a complete 90-leg issued bundle goes in and comes back unchanged, for both days;
 *   - no already-published edition changes, on install or on rollback;
 *   - the rollback restores the original function text exactly. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {requestFor,windowFor} from '../staging/mirror/refresh.mjs';
import {buildPresentationPayload} from '../backend/fixture-delivery/contract.mjs';
const root=new URL('../',import.meta.url),read=f=>readFileSync(new URL(f,root),'utf8');
const db='mm-tips-continuity-'+process.pid;
const docker=(args,input)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{input,encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe']}).trim();
const sql=(s,role)=>docker(['exec','-i',db,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],(role?'set role '+role+';':'')+s);
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const TOKEN='local-test-only-'.repeat(3);
const dayOf=n=>new Date(Date.parse(new Date().toISOString().slice(0,10))+n*86400000).toISOString().slice(0,10);
const today=dayOf(0),yesterday=dayOf(-1),older=dayOf(-2),stamp=new Date(Date.now()-60000).toISOString();
const fixture=(fxid,date)=>({fxid,lid:1,lname:'Example League',lcountry:'Test',date,time:'12:00',status:'NS',elapsed:null,home:'Example Home '+fxid,away:'Example Away '+fxid,gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:stamp,provider:'af'});
const FIXTURES=[...Array.from({length:30},(_,i)=>fixture(1000+i,today)),...Array.from({length:30},(_,i)=>fixture(2000+i,yesterday)),...Array.from({length:30},(_,i)=>fixture(3000+i,older))];
/* A complete issued bundle: 30 Winner, 30 O/U 2.5 and 30 BTTS rows, each on its own fixture. */
const bundle=(day,base)=>({day,tier:'tips',odds:0,build:355,step:'tips',legs:[['winner','1X'],['ou','U25'],['btts','NBT']].flatMap(([tab,code],t)=>Array.from({length:30},(_,rank)=>({fxid:base+rank,d:day,t:'12:00',h:'Example Home '+(base+rank),a:'Example Away '+(base+rank),code,sel:'Selection '+tab+' '+rank,market:'',p:+(.8-rank*.005-t*.05).toFixed(4),tab,rank})))});
const payloadWith=slips=>{const p=buildPresentationPayload({fixtures:FIXTURES});p.slips=slips;return p;};
const publish=(slips,{token=TOKEN}={})=>{const p=payloadWith(slips),w=windowFor(new Date());
 const request=requestFor({payload:p,from:w.from,to:w.to,captured_at:new Date().toISOString(),window_cards:p.cards.length,cards:p.cards.length,predictions:0,latest_source_update:stamp});
 return JSON.parse(sql((token?"set request.headers='"+JSON.stringify({'x-mm-preview-token':token})+"';":'')+'select public.mm_preview_publish_v1('+literal(request)+');','anon'));};
/* Everything about the function except its body. */
const META=`select jsonb_build_object('owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'config',p.proconfig,'acl',p.proacl::text,'volatility',p.provolatile,'lang',p.prolang::regproc::text,'returns',p.prorettype::regtype::text,
 'wrapper_acl',(select w.proacl::text from pg_proc w where w.oid='public.mm_preview_publish_v1(jsonb)'::regprocedure),
 'wrapper_md5',(select md5(pg_get_functiondef(w.oid)) from pg_proc w where w.oid='public.mm_preview_publish_v1(jsonb)'::regprocedure),
 'table_acls',(select jsonb_object_agg(c.relname,c.relacl::text) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='mm_preview_mirror' and c.relkind='r'),
 'functions',(select jsonb_object_agg(f.oid::regprocedure::text,md5(pg_get_functiondef(f.oid))) from pg_proc f join pg_namespace n on n.oid=f.pronamespace where n.nspname in('mm_preview_mirror','mm_fixture_delivery','public') and f.oid<>p.oid and f.prokind='f' and f.proname like any(array['mm_%','display%','status%','payload_valid','schema_valid','prediction_count'])))
 from pg_proc p where p.oid='mm_preview_mirror.publish(jsonb)'::regprocedure;`;
const DEF="select pg_get_functiondef('mm_preview_mirror.publish(jsonb)'::regprocedure);";
const EDITIONS="select coalesce(string_agg(edition_id::text||':'||md5(payload::text)||':'||md5(manifest::text),',' order by as_of),'') from mm_preview_mirror.editions;";
const OLD=" if exists(select 1 from jsonb_array_elements(p->'slips') s where(s->>'day')::date<>d) then raise exception 'Only current issued slips admitted';end if;";

test('the staging Tips continuity change edits one guard, keeps every permission, and rolls back exactly',async()=>{
 try{
 docker(['run','-d','--name',db,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16.6@sha256:557fea37a744d5f4c8faab304b0a90858b53ab119735a88c131fd19dab802f36']);
 let ready=false;for(let i=0;i<80;i++){try{if(docker(['logs',db]).includes('init process complete')){docker(['exec',db,'pg_isready','-U','postgres']);ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'postgres ready');
 // The up file refuses a database that is not the isolated preview.
 assert.throws(()=>sql(read('staging/mirror/STAGING-tips-continuity-up.sql')),/Isolated real-data preview required/);
 sql(read('backend/fixture-delivery/synthetic-bootstrap.sql'));
 sql('create schema mm_fixture_delivery;create table mm_fixture_delivery.editions(edition_id uuid primary key,edition_day date,as_of timestamptz,expires_at timestamptz,source_review text,expected_cards int,expected_predictions int,payload jsonb);');
 const baseline=read('backend/fixture-delivery/PROPOSAL-up.sql');
 sql(baseline.slice(baseline.indexOf('create function mm_fixture_delivery.schema_valid('),baseline.indexOf('alter table mm_fixture_delivery.editions add constraint closed_payload')));
 sql(baseline.match(/create function mm_fixture_delivery.prediction_count\([\s\S]*?\$\$;/)[0]);
 sql("set mm.preview_token_sha256='"+'a'.repeat(64)+"';"+read('staging/mirror/INSTALL-staging-only.sql'));
 sql(read('staging/mirror/STAGING-analysis-up.sql'));sql(read('staging/mirror/STAGING-issued-tips-up.sql'));
 sql("set role mm_preview_mirror_owner;update mm_preview_mirror.configuration set token_sha256=sha256(convert_to('"+TOKEN+"','UTF8'));reset role;");

 // BEFORE. Today's complete issue is admitted, and the previous day's is refused by the one guard.
 const t0=bundle(today,1000),y0=bundle(yesterday,2000);
 assert.equal(publish([t0]).cards,FIXTURES.length);
 assert.throws(()=>publish([y0,t0]),/Only current issued slips admitted/);
 const defBefore=sql(DEF),metaBefore=sql(META),editionsBefore=sql(EDITIONS);
 assert.equal(defBefore.split(OLD).length-1,1,'the statement to replace must occur exactly once');
 assert.equal(JSON.parse(metaBefore).security_definer,true);

 // INSTALL.
 sql(read('staging/mirror/STAGING-tips-continuity-up.sql'));
 const defAfter=sql(DEF);
 assert.notEqual(defAfter,defBefore);
 assert.equal(sql(META),metaBefore,'owner, security settings, grants or another function changed');
 assert.equal(sql(EDITIONS),editionsBefore,'an already-published edition changed on install');
 // The body differs by that one statement and nothing else.
 const [head,tail]=defBefore.split(OLD);
 assert.ok(defAfter.startsWith(head)&&defAfter.endsWith(tail),'text outside the replaced statement changed');
 const inserted=defAfter.slice(head.length,defAfter.length-tail.length);
 assert.match(inserted,/not between d-1 and d\) then raise exception 'Only current and previous-day issued slips admitted'/);
 assert.match(inserted,/raise exception 'Duplicate issued slip day and tier'/);
 assert.equal(inserted.split('raise exception').length-1,2,'exactly two guards replace the one');

 // The writer is still token-gated. Private tables are still closed to anonymous readers.
 assert.throws(()=>publish([y0,t0],{token:null}),/writer required/);
 assert.throws(()=>publish([y0,t0],{token:'wrong-token-'.repeat(4)}),/writer required/);
 for(const table of ['qa_backup','configuration','editions'])assert.throws(()=>sql('select * from mm_preview_mirror.'+table,'anon'),/permission denied/);

 // Both days are admitted as whole 90-leg bundles and come back exactly as issued.
 assert.equal(publish([y0,t0]).cards,FIXTURES.length);
 const back=JSON.parse(sql("select public.mm_preview_display_v2('slips');",'anon')).slips;
 assert.deepEqual(back,[y0,t0],'an issued bundle was altered, reordered or shortened');
 assert.deepEqual(back.map(s=>s.legs.length),[90,90]);
 assert.equal(JSON.parse(sql("select public.mm_preview_display_v1('slips');",'anon')).slips.length,0,'the legacy reader still omits the 90-leg bundle');
 // The previous day alone is admitted too: the hours after 00:00 UTC before the new issue.
 assert.equal(publish([y0]).cards,FIXTURES.length);
 assert.deepEqual(JSON.parse(sql("select public.mm_preview_display_v2('slips');",'anon')).slips,[y0]);

 // The two-day limit, duplicate protection and bundle validation all still refuse.
 assert.throws(()=>publish([bundle(older,3000),t0]),/Only current and previous-day issued slips admitted/);
 assert.throws(()=>publish([bundle(dayOf(1),1000)]),/Only current and previous-day issued slips admitted/);
 assert.throws(()=>publish([t0,structuredClone(t0)]),/Duplicate issued slip day and tier/);
 const twice=structuredClone(t0);twice.legs[1].rank=0;assert.throws(()=>publish([twice]),/Closed public payload validation failed/);
 const over=structuredClone(t0);over.legs.push({...over.legs[0],rank:30});assert.throws(()=>publish([over]),/Closed public payload validation failed/);
 const orphan=structuredClone(y0);orphan.legs[0].fxid=999999;assert.throws(()=>publish([orphan,t0]));
 const editionsInstalled=sql(EDITIONS);
 assert.ok(editionsInstalled.startsWith(editionsBefore+','),'earlier editions must be an unchanged prefix');

 // A second install refuses and changes nothing.
 assert.throws(()=>sql(read('staging/mirror/STAGING-tips-continuity-up.sql')),/Expected exactly one current-day slip guard/);
 assert.equal(sql(DEF),defAfter);

 // ROLLBACK restores the original text exactly, with the same permissions, and keeps every edition.
 sql(read('staging/mirror/STAGING-tips-continuity-down.sql'));
 assert.equal(sql(DEF),defBefore,'the rollback did not restore the original function text');
 assert.equal(sql(META),metaBefore);
 assert.equal(sql(EDITIONS),editionsInstalled,'an edition changed on rollback');
 assert.deepEqual(JSON.parse(sql("select public.mm_preview_display_v2('slips');",'anon')).slips,[y0],'the published previous-day issue must stay readable and intact');
 assert.throws(()=>publish([y0,t0]),/Only current issued slips admitted/);
 assert.equal(publish([t0]).cards,FIXTURES.length);
 assert.throws(()=>sql(read('staging/mirror/STAGING-tips-continuity-down.sql')),/nothing to roll back/);
 }finally{try{docker(['rm','-fv',db]);}catch{}}
});
