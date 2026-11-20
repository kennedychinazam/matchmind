/* STAGING-capacity2-up.sql (capacity Option A) AND ITS ROLLBACK, AGAINST AN ISOLATED POSTGRES.
 * Synthetic rows only: a disposable PostgreSQL 16.6 container with no network, no hosted database,
 * no credential. The container is brought to the installed staging state (INSTALL, analysis,
 * issued-tips, capacity, tips-continuity) before the change under test is applied.
 * Must hold: 1000 -> 1500 cards and 1 MiB -> 2 MiB in payload_valid and the publisher wire bound;
 * 1501 cards and > 2 MiB still refused; the board's 1000-row bound unchanged; owner, grants,
 * volatility and every other function unchanged; reinstall refused; rollback restores exact text;
 * no published edition changes. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {requestFor,windowFor} from '../staging/mirror/refresh.mjs';
import {buildPresentationPayload,validatePresentationPayload} from '../backend/fixture-delivery/contract.mjs';
const root=new URL('../',import.meta.url),read=f=>readFileSync(new URL(f,root),'utf8');
const db='mm-capacity2-sql-'+process.pid;
const docker=(args,input)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{input,encoding:'utf8',timeout:60000,maxBuffer:64<<20,stdio:['pipe','pipe','pipe']}).trim();
const sql=(s,role)=>docker(['exec','-i',db,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],(role?'set role '+role+';':'')+s);
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const TOKEN='local-test-only-'.repeat(3);
const now=new Date(),day=now.toISOString().slice(0,10),stamp=new Date(+now-60000).toISOString();
const fixture=fxid=>({fxid,lid:1,lname:'Example League',lcountry:'Test',date:day,time:'12:00',status:'NS',elapsed:null,home:'Example Home '+fxid,away:'Example Away '+fxid,gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:stamp,provider:'af'});
// Built at 1 card then widened, so a deliberately oversized inventory can be constructed.
const cards=n=>{const p=buildPresentationPayload({fixtures:[fixture(10000)]});p.cards=Array.from({length:n},(_,i)=>({...p.cards[0],fxid:10000+i,home:'Example Home '+(10000+i),away:'Example Away '+(10000+i)}));return p;};
// n cards each carrying a 30,000-byte approved writeup: n=50 is ~1.5 MB, n=75 is ~2.3 MB.
const heavy=n=>{const p=cards(n);for(const c of p.cards)c.analysis={source:'approved-private-source',source_at:stamp,writeup:{text:'A'.repeat(30000),source:'approved-private-source',source_at:stamp}};return p;};
const valid=p=>sql('select mm_fixture_delivery.payload_valid('+literal(p)+');');
const publish=p=>{const w=windowFor(now),request=requestFor({payload:p,from:w.from,to:w.to,captured_at:new Date().toISOString(),window_cards:p.cards.length,cards:p.cards.length,predictions:0,latest_source_update:stamp});
 return JSON.parse(sql("set request.headers='"+JSON.stringify({'x-mm-preview-token':TOKEN})+"';select public.mm_preview_publish_v1("+literal(request)+");",'anon'));};
const DEFS="select string_agg(p.oid::regprocedure::text||':'||md5(pg_get_functiondef(p.oid)),',' order by p.oid::regprocedure::text) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('mm_preview_mirror','mm_fixture_delivery','public') and p.prokind='f' and p.proname like 'mm_%' or p.proname in('payload_valid','publish','display','status','schema_valid','prediction_count');";
const META="select string_agg(p.oid::regprocedure::text||pg_get_userbyid(p.proowner)||coalesce(p.proacl::text,'')||p.provolatile::text||p.prosecdef::text||coalesce(p.proconfig::text,''),',' order by p.oid::regprocedure::text) from pg_proc p where p.oid in('mm_fixture_delivery.payload_valid(jsonb)'::regprocedure,'mm_preview_mirror.publish(jsonb)'::regprocedure);";
const EDITIONS="select coalesce(string_agg(edition_id::text||md5(payload::text),',' order by as_of),'') from mm_preview_mirror.editions;";
test('capacity Option A raises exactly the card and byte bounds and rolls back exactly',async()=>{
 try{
 docker(['run','-d','--name',db,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16.6@sha256:557fea37a744d5f4c8faab304b0a90858b53ab119735a88c131fd19dab802f36']);
 let ready=false;for(let i=0;i<80;i++){try{if(docker(['logs',db]).includes('init process complete')){docker(['exec',db,'pg_isready','-U','postgres']);ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert.ok(ready,'postgres ready');
 sql(read('backend/fixture-delivery/synthetic-bootstrap.sql'));
 sql('create schema mm_fixture_delivery;create table mm_fixture_delivery.editions(edition_id uuid primary key,edition_day date,as_of timestamptz,expires_at timestamptz,source_review text,expected_cards int,expected_predictions int,payload jsonb);');
 const baseline=read('backend/fixture-delivery/PROPOSAL-up.sql');
 sql(baseline.slice(baseline.indexOf('create function mm_fixture_delivery.schema_valid('),baseline.indexOf('alter table mm_fixture_delivery.editions add constraint closed_payload')));
 sql(baseline.match(/create function mm_fixture_delivery.prediction_count\([\s\S]*?\$\$;/)[0]);
 assert.throws(()=>sql(read('staging/mirror/STAGING-capacity2-up.sql')),/Isolated real-data preview required/);
 sql("set mm.preview_token_sha256='"+'a'.repeat(64)+"';"+read('staging/mirror/INSTALL-staging-only.sql'));
 for(const f of['STAGING-analysis-up.sql','STAGING-issued-tips-up.sql','STAGING-capacity-up.sql','STAGING-tips-continuity-up.sql'])sql(read('staging/mirror/'+f));
 sql("set role mm_preview_mirror_owner;update mm_preview_mirror.configuration set token_sha256=sha256(convert_to('"+TOKEN+"','UTF8'));reset role;");
 const c1000=cards(1000),c1200=cards(1200),c1500=cards(1500),c1501=cards(1501),mid=heavy(50),over=heavy(75);
 const bytes=p=>Buffer.byteLength(JSON.stringify(p));
 assert.ok(bytes(mid)>1048576&&bytes(mid)<2097152&&bytes(over)>2097152,'synthetic sizes straddle the bounds');
 assert.doesNotThrow(()=>validatePresentationPayload(c1500));assert.doesNotThrow(()=>validatePresentationPayload(mid));
 assert.throws(()=>validatePresentationPayload(c1501));assert.throws(()=>validatePresentationPayload(over));
 // Before: the installed bounds.
 assert.equal(valid(c1000),'t');assert.equal(valid(c1200),'f','1200 cards refused before');assert.equal(valid(mid),'f','1.5 MB refused before');
 publish(c1000);
 assert.throws(()=>publish(mid),/Refresh payload exceeds bound/,'publisher wire bound 1 MiB before');
 const defs=sql(DEFS),meta=sql(META),editions=sql(EDITIONS);
 sql(read('staging/mirror/STAGING-capacity2-up.sql'));
 assert.equal(sql(EDITIONS),editions,'no edition changed on install');
 assert.equal(sql(META),meta,'owner, grants, volatility, security definer and config unchanged');
 const changed=sql(DEFS).split(',').filter(x=>!defs.split(',').includes(x)).map(x=>x.split(':')[0]).sort();
 assert.deepEqual(changed,['mm_fixture_delivery.payload_valid(jsonb)','mm_preview_mirror.publish(jsonb)'],'only the two functions changed');
 assert.equal(valid(c1200),'t');assert.equal(valid(c1500),'t');assert.equal(valid(mid),'t');
 assert.equal(valid(c1501),'f','1501 cards still refused');assert.equal(valid(over),'f','over 2 MiB still refused');
 const board=cards(1001);board.board={v:1,ahead:7,builtAt:stamp,n:1001,notPassed:0,noBars:0,rows:board.cards.map(c=>({f:c.fxid,l:c.lid,n:c.lname,d:c.date,t:c.time,h:c.home,a:c.away,p:null,q:null,m:null,g:null,z:false,pw:.5,pd:.3,pq:.2,xh:null,xa:null}))};
 assert.equal(valid(board),'f','board keeps its 1000-row bound');
 assert.equal(publish(c1500).cards,1500,'publisher accepts 1500 cards');
 assert.equal(publish(mid).cards,50,'publisher accepts a 1.5 MB wire');
 assert.throws(()=>publish(over),/Refresh payload exceeds bound/,'publisher refuses over 2 MiB');
 assert.equal(JSON.parse(sql("select public.mm_preview_display_v2('scores');",'anon')).cards.length,50,'latest edition readable');
 assert.throws(()=>sql('select * from mm_preview_mirror.editions;','anon'),/permission denied/);
 assert.throws(()=>sql(read('staging/mirror/STAGING-capacity2-up.sql')),/Expected exactly one/,'reinstall refused');
 const after=sql(EDITIONS);
 sql(read('staging/mirror/STAGING-capacity2-down.sql'));
 assert.equal(sql(DEFS),defs,'rollback restores exact text of every function');
 assert.equal(sql(META),meta);assert.equal(sql(EDITIONS),after,'rollback changes no edition');
 assert.equal(valid(c1200),'f');assert.equal(valid(mid),'f');
 assert.throws(()=>sql(read('staging/mirror/STAGING-capacity2-down.sql')),/nothing to roll back/);
 }finally{docker(['rm','-fv',db]);}
});
