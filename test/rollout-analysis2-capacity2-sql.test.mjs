/* ONE ORDERED ROLLOUT: STAGING-analysis2-up.sql THEN STAGING-capacity2-up.sql, AND ROLLBACK IN REVERSE.
 * Isolated synthetic PostgreSQL only (pinned image, --network none). No hosted database, no credential.
 * The container is brought to the installed staging state in its real order (INSTALL-staging-only,
 * analysis, issued-tips, tips-continuity, capacity) through the same files, and the reproduced
 * payload_valid/publish text is checked against the md5s recorded on staging before anything is applied.
 * Prints the function md5s after every step so the lead can verify each step on staging. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {requestFor,windowFor} from '../staging/mirror/refresh.mjs';
import {buildPresentationPayload,validatePresentationPayload} from '../backend/fixture-delivery/contract.mjs';
const root=new URL('../',import.meta.url),read=f=>readFileSync(new URL(f,root),'utf8');
const db='mm-rollout-sql-'+process.pid;
const docker=(args,input)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{input,encoding:'utf8',timeout:90000,maxBuffer:64<<20,stdio:['pipe','pipe','pipe']}).trim();
const sql=(s,role)=>docker(['exec','-i',db,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],(role?'set role '+role+';':'')+s);
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const TOKEN='local-test-only-'.repeat(3);
const STAGING_MD5={'mm_fixture_delivery.payload_valid(jsonb)':'f7349733071963fe030871f10d8eb141','mm_preview_mirror.publish(jsonb)':'c4cce72434de52045fb17ffbb0ac2735'};
const now=new Date(),day=now.toISOString().slice(0,10),stamp=new Date(+now-60000).toISOString();
const fixture=(fxid,lid=1)=>({fxid,lid,lname:'Example League '+lid,lcountry:'Test',date:day,time:'12:00',status:'NS',elapsed:null,home:'Example Home '+fxid,away:'Example Away '+fxid,gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:stamp,provider:'af'});
const cards=(n,leagues=1)=>{const p=buildPresentationPayload({fixtures:[fixture(10000)]});p.cards=Array.from({length:n},(_,i)=>({...p.cards[0],fxid:10000+i,lid:i%leagues+1,lname:'Example League '+(i%leagues+1),home:'Example Home '+(10000+i),away:'Example Away '+(10000+i)}));return p;};
const row=(rank,team)=>({rank,team,played:2,won:1,drawn:0,lost:1,gf:3,ga:3,points:3});
const competition=lid=>({lid,source:'api-football/competition-60m',source_at:stamp,from:'2021-11-20',to:day,rates:{n:40,btts:20,o15:30,o25:20,o35:9},standings:{season:2026,rows:[row(1,'Example Home 10000'),row(2,'Example Away 10000')]}});
const withWriteups=(p,k)=>{for(const c of p.cards.slice(0,k))c.analysis={source:'approved-private-source',source_at:stamp,writeup:{text:'A'.repeat(30000),source:'approved-private-source',source_at:stamp}};return p;};
const bytes=p=>Buffer.byteLength(JSON.stringify(p));
const FUNCS=['mm_fixture_delivery.payload_valid(jsonb)','mm_preview_mirror.publish(jsonb)','mm_preview_mirror.display(text)','public.mm_preview_display_v1(text)','public.mm_preview_display_v2(text)','public.mm_preview_display_v3(text)'];
const md5s=()=>Object.fromEntries(FUNCS.map(f=>[f,sql(`select coalesce(md5(pg_get_functiondef(to_regprocedure('${f}'))),'absent');`)]));
const DEFS="select string_agg(p.oid::regprocedure::text||':'||md5(pg_get_functiondef(p.oid)),',' order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('mm_preview_mirror','mm_fixture_delivery','public') and p.prokind='f';";
const META="select string_agg(p.oid::regprocedure::text||pg_get_userbyid(p.proowner)||coalesce(p.proacl::text,'')||p.provolatile::text||p.prosecdef::text||coalesce(p.proconfig::text,''),';' order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('mm_preview_mirror','mm_fixture_delivery') or p.proname like 'mm_preview_display_v_';";
const META_V2V3="select string_agg(pg_get_userbyid(proowner)||coalesce(proacl::text,'')||provolatile::text||prosecdef::text||coalesce(proconfig::text,''),'|' order by proname) from pg_proc where oid in('public.mm_preview_display_v2(text)'::regprocedure,'public.mm_preview_display_v3(text)'::regprocedure);";
const EDITIONS="select coalesce(string_agg(edition_id::text||md5(payload::text),',' order by as_of),'') from mm_preview_mirror.editions;";
const valid=p=>sql('select mm_fixture_delivery.payload_valid('+literal(p)+');');
const publish=p=>{const w=windowFor(now),request=requestFor({payload:p,from:w.from,to:w.to,captured_at:new Date().toISOString(),window_cards:p.cards.length,cards:p.cards.length,predictions:0,latest_source_update:stamp});
 return JSON.parse(sql("set request.headers='"+JSON.stringify({'x-mm-preview-token':TOKEN})+"';select public.mm_preview_publish_v1("+literal(request)+");",'anon'));};
const view=(v,screen='scores')=>JSON.parse(sql(`select public.mm_preview_display_${v}('${screen}');`,'anon'));
const apply=f=>sql(read('staging/mirror/'+f));
test('analysis2 then capacity2 install in order on the reproduced staging state and roll back exactly',async()=>{
 const report={};
 try{
 docker(['run','-d','--name',db,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16.6@sha256:557fea37a744d5f4c8faab304b0a90858b53ab119735a88c131fd19dab802f36']);
 let ready=false;for(let i=0;i<80;i++){try{if(docker(['logs',db]).includes('init process complete')){docker(['exec',db,'pg_isready','-U','postgres']);ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'postgres ready');
 sql(read('backend/fixture-delivery/synthetic-bootstrap.sql'));
 sql('create schema mm_fixture_delivery;create table mm_fixture_delivery.editions(edition_id uuid primary key,edition_day date,as_of timestamptz,expires_at timestamptz,source_review text,expected_cards int,expected_predictions int,payload jsonb);');
 const baseline=read('backend/fixture-delivery/PROPOSAL-up.sql');
 sql(baseline.slice(baseline.indexOf('create function mm_fixture_delivery.schema_valid('),baseline.indexOf('alter table mm_fixture_delivery.editions add constraint closed_payload')));
 sql(baseline.match(/create function mm_fixture_delivery.prediction_count\([\s\S]*?\$\$;/)[0]);
 sql("set mm.preview_token_sha256='"+'a'.repeat(64)+"';"+read('staging/mirror/INSTALL-staging-only.sql'));
 // Installed staging state today, in its real order.
 for(const f of['STAGING-analysis-up.sql','STAGING-issued-tips-up.sql','STAGING-tips-continuity-up.sql','STAGING-capacity-up.sql'])apply(f);
 sql("set role mm_preview_mirror_owner;update mm_preview_mirror.configuration set token_sha256=sha256(convert_to('"+TOKEN+"','UTF8'));reset role;");
 const installed=md5s();report.installed=installed;
 for(const[f,m]of Object.entries(STAGING_MD5))assert.equal(installed[f],m,f+' reproduces the staging md5');
 assert.equal(installed['public.mm_preview_display_v3(text)'],'absent');
 const defs0=sql(DEFS),meta0=sql(META);
 publish(cards(3));const editions0=sql(EDITIONS);
 // Order is enforced: capacity2 cannot go first.
 assert.throws(()=>apply('STAGING-capacity2-up.sql'),/STAGING-analysis2-up.sql must be installed first/);
 assert.equal(sql(DEFS),defs0,'refused capacity2 changed nothing');
 // Step 1: analysis2.
 apply('STAGING-analysis2-up.sql');report.after_analysis2=md5s();
 assert.equal(sql(EDITIONS),editions0,'analysis2 changes no edition');
 assert.equal(sql(META).split(';').filter(x=>!x.startsWith('mm_preview_display_v3')).join(';'),meta0,'analysis2 keeps owner, grants, volatility, config');
 assert.equal(report.after_analysis2['mm_preview_mirror.publish(jsonb)'],installed['mm_preview_mirror.publish(jsonb)'],'analysis2 does not touch publish');
 assert.throws(()=>apply('STAGING-analysis2-up.sql'),/Expected exactly one|already installed/,'analysis2 reinstall refused');
 // Step 2: capacity2.
 const meta1=sql(META);
 apply('STAGING-capacity2-up.sql');report.after_capacity2=md5s();
 assert.equal(sql(EDITIONS),editions0,'capacity2 changes no edition');
 assert.equal(sql(META),meta1,'capacity2 keeps owner, grants, volatility, security definer, config');
 assert.deepEqual(FUNCS.filter(f=>report.after_capacity2[f]!==report.after_analysis2[f]),['mm_fixture_delivery.payload_valid(jsonb)','mm_preview_mirror.publish(jsonb)'],'capacity2 changes exactly payload_valid and publish');
 assert.throws(()=>apply('STAGING-capacity2-up.sql'),/Expected exactly one/,'capacity2 reinstall refused');
 assert.throws(()=>apply('STAGING-analysis2-down.sql'),/run STAGING-capacity2-down.sql first/,'analysis2 cannot be rolled back under capacity2');
 assert.equal(sql(DEFS).split(',').length,defs0.split(',').length+1,'only v3 added');
 // Combined behaviour: 1500 cards + about 1.5 MB + competitions admitted.
 const big=withWriteups(cards(1500,100),32);big.competitions=Array.from({length:100},(_,i)=>competition(i+1));
 big.competitions[0].standings.rows=Array.from({length:64},(_,i)=>row(i+1,'Example Team '+i));
 assert.ok(bytes(big)>1400000&&bytes(big)<2097152,'about 1.5 MB: '+bytes(big));
 assert.doesNotThrow(()=>validatePresentationPayload(big));
 assert.equal(valid(big),'t','1500 cards, 1.5 MB, 100 competitions, 64-row table admitted');
 const c1501=cards(1501);assert.throws(()=>validatePresentationPayload(c1501));assert.equal(valid(c1501),'f','1501 cards refused');
 const over=withWriteups(cards(80),80);over.competitions=[competition(1)];assert.ok(bytes(over)>2097152);assert.throws(()=>validatePresentationPayload(over));assert.equal(valid(over),'f','over 2 MiB refused');
 const c101=structuredClone(big);c101.cards.push({...c101.cards[0],fxid:99999,lid:101});c101.cards.splice(0,1);c101.competitions.push(competition(101));assert.equal(valid(c101),'f','101 competitions refused');
 const t65=structuredClone(big);t65.competitions[0].standings.rows.push(row(65,'Example Team 65'));assert.equal(valid(t65),'f','65-row table refused');
 assert.equal(publish(big).cards,1500,'publisher accepts the combined edition');
 assert.throws(()=>publish(over),/Refresh payload exceeds bound|payload/i,'publisher refuses over 2 MiB');
 const v3=view('v3'),v2=view('v2'),v1=view('v1');
 assert.deepEqual(v3.competitions,big.competitions,'v3 returns competitions');assert.equal(v3.cards.length,1500);
 const{competitions,...rest}=v3;assert.deepEqual(v2,rest,'v2 is v3 without competitions');
 assert.ok(!Object.hasOwn(v1,'competitions')&&v1.edition_id===v3.edition_id,'v1 strips competitions');
 assert.equal(sql(META_V2V3).split('|')[0],sql(META_V2V3).split('|')[1],'v3 has exactly v2 owner and grants');
 assert.throws(()=>sql('select * from mm_preview_mirror.editions;','anon'),/permission denied/);
 const editions2=sql(EDITIONS);
 // Rollback: capacity2, then analysis2.
 apply('STAGING-capacity2-down.sql');
 assert.deepEqual(md5s(),report.after_analysis2,'capacity2 rollback restores the analysis2 text exactly');
 assert.equal(valid(cards(1200)),'f','1000-card bound back');
 apply('STAGING-analysis2-down.sql');
 assert.deepEqual(md5s(),installed,'analysis2 rollback restores the installed text exactly');
 for(const[f,m]of Object.entries(STAGING_MD5))assert.equal(sql(`select md5(pg_get_functiondef('${f}'::regprocedure));`),m,f+' back to the staging md5');
 assert.equal(sql(DEFS),defs0,'every function back to its exact text');
 assert.equal(sql(META),meta0,'owner and grants back');
 assert.equal(sql(EDITIONS),editions2,'rollback changes no edition');
 assert.throws(()=>apply('STAGING-capacity2-down.sql'),/nothing to roll back/);
 assert.throws(()=>apply('STAGING-analysis2-down.sql'),/nothing to roll back/);
 console.log('ROLLOUT_MD5 '+JSON.stringify(report));
 }finally{try{docker(['rm','-fv',db]);}catch{}}
});
