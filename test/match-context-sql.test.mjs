// Build 360: public.matchmind_match_context_v1(fxid). Isolated synthetic PostgreSQL only (Docker, no network).
// The reference is Build 355's own loader rules and the browser's own table functions, extracted from index.html.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const root=new URL('../',import.meta.url),read=f=>readFileSync(new URL(f,root),'utf8');
const UP=read('release/match-context/MATCH-CONTEXT-up.sql'),DOWN=read('release/match-context/MATCH-CONTEXT-down.sql');
const db='mm-match-context-'+process.pid;
const docker=(args,input)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{input,encoding:'utf8',timeout:60000,stdio:['pipe','pipe','pipe']}).trim();
const psql=(s,user='postgres')=>docker(['exec','-i',db,'psql','-X','-qAt','-U',user,'-d','postgres','-v','ON_ERROR_STOP=1'],s);
const html=read('index.html').replace(/\r\n/g,'\n');
function extract(head){const a=html.indexOf(head);assert.ok(a>=0&&html.indexOf(head,a+1)<0,'unique '+head);let i=html.indexOf('{',a),d=0;for(;i<html.length;i++){if(html[i]==='{')d++;else if(html[i]==='}'&&!--d)break;}return html.slice(a,i+1);}
const ctx=vm.createContext({});
vm.runInContext(`const LEAGUE_PHASE = { 'Regular Season': 1, 'League Stage': 1 };const _seasonSeq = new WeakMap();const _rrOK = new WeakMap();
const MATCH_CONTEXT_VERSION='matchmind-match-context/1';const MATCH_CONTEXT_BOUNDS={matches:6000,teams:1500,upcoming:1000,scorers:40,rounds:400};
${['function roundKind(','function isLeaguePhase(','function seasonSeqFor(','function roundRobinOK(','function tableAt(','function seasonRoster(','function tableAsOf(','function latestSeasonOf(','function matchContextDecode(','function matchContextRates('].map(extract).join('\n')}
var api={tableAsOf,latestSeasonOf,matchContextDecode,matchContextRates};`,ctx);
const B=vm.runInContext('api',ctx),plain=x=>JSON.parse(JSON.stringify(x));
const today=new Date().toISOString().slice(0,10),dayOff=n=>new Date(Date.parse(today)+n*86400000).toISOString().slice(0,10);
const from=(()=>{const d=new Date(today+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()-60);return d.toISOString().slice(0,10);})();
// Invented competition: two prior double round-robin seasons and a current partial one, half-time scores, a play-off,
// status variants, extra-time rows with and without a usable 90-minute pair, rows outside the window and another league.
function synthetic(){
 const T=['Alpha','Bravo','Charlie','Delta','Echo','Foxtrot'],rows=[];let id=1000;
 const add=(o)=>rows.push({fxid:id++,lid:7,season:null,round:'Regular Season - 1',status:'FINISHED',ft_h:null,ft_a:null,ht_h:null,ht_a:null,events:null,lineup_h:null,lineup_a:null,...o});
 let d=-500;
 for(const season of [2024,2025])for(const h of T)for(const a of T)if(h!==a){const gh=(h.length*3+a.length)%4,ga=(a.length*5+h.length)%3;add({season,date:dayOff(d++),home:h,away:a,gh,ga,ht_h:Math.min(gh,1),ht_a:Math.min(ga,Math.abs(d%2))});}
 add({season:2025,date:dayOff(d++),home:T[0],away:T[1],gh:1,ga:1,round:'Relegation Play-off'});
 d=-60;const cur=T.slice(0,5);
 for(const h of cur)for(const a of cur)if(h<a)add({season:2026,date:dayOff(d++),home:h,away:a,gh:(h.length+a.length)%4,ga:(h.length*2)%3,round:'Regular Season - 2',status:d%3?'FINISHED':' ft '});
 add({season:2026,date:dayOff(d++),home:T[1],away:T[2],gh:3,ga:2,status:'AET',ft_h:2,ft_a:2});
 add({season:2026,date:dayOff(d++),home:T[2],away:T[3],gh:2,ga:1,status:'PEN',ft_h:3,ft_a:0});
 add({season:2026,date:dayOff(d++),home:T[0],away:'Qualifier FC',gh:3,ga:0,round:'Qualifying Round'});
 add({season:2026,date:dayOff(d++),home:T[0],away:T[4],gh:null,ga:null});
 add({season:2026,date:dayOff(-1),home:T[1],away:T[3],gh:0,ga:0,status:'NS'});
 add({season:2021,date:dayOff(-1900),home:T[0],away:T[1],gh:9,ga:9});                       // before the 60-month window
 add({season:2026,date:dayOff(-3),home:'Other',away:'League',gh:5,ga:5,lid:8});           // another competition
 // goal events for the scorer list: Alpha v Bravo with line-ups tying team ids to sides
 const ev=[{type:'Goal',detail:'Normal Goal',team:101,pid:1,player:'A. Striker'},{type:'Goal',detail:'Penalty',team:101,pid:1,player:'A. Striker'},
  {type:'Goal',detail:'Own Goal',team:101,pid:9,player:'B. Unlucky'},{type:'Goal',detail:'Missed Penalty',team:102,pid:8,player:'B. Forward'},
  {type:'Goal',detail:'Normal Goal',team:102,pid:8,player:'B. Forward'},{type:'subst',detail:'Substitution 1',team:101,pid:2,aid:3,player:'A. Mid'},
  {type:'Goal',detail:'Normal Goal',team:101,pid:3,player:'A. Sub'}];
 add({season:2026,date:dayOff(-2),home:'Alpha',away:'Bravo',gh:3,ga:1,round:'Regular Season - 3',events:ev,
  lineup_h:{xi:[{id:1,name:'A. Striker'},{id:2,name:'A. Mid'}]},lineup_a:{xi:[{id:8,name:'B. Forward'},{id:9,name:'B. Unlucky'}]}});
 const upcoming=[{fxid:id++,lid:7,season:2026,status:'NS',date:dayOff(1),home:'Foxtrot',away:'Alpha'},{fxid:id++,lid:7,season:2026,status:'NS',date:dayOff(90),home:'Far Future',away:'Bravo'}];
 return {rows,upcoming,target:upcoming[0]};
}
const isFin=s=>{const v=String(s??'').trim().toUpperCase();return ['FT','AET','PEN'].includes(v==='FINISHED'?'FT':v);};
function settled(r){const {gh,ga,ft_h:fh,ft_a:fa}=r;return gh!=null&&ga!=null&&Number.isInteger(fh)&&Number.isInteger(fa)&&fh>=0&&fa>=0&&fh<=gh&&fa<=ga?{gh:fh,ga:fa}:{gh,ga};}
function reference355(rows,lid){
 // 355: read lid with date (the round is sent as 355's roundKind, the only part of it any 355 function reads)
 // 355: read lid with date >= cacheCutoff(), ordered by date then fxid; push every finished row with both goals.
 return rows.filter(r=>r.lid===lid&&r.date>=from&&r.date<=today&&isFin(r.status)&&r.gh!=null&&r.ga!=null).sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:a.fxid-b.fxid)
  .map(r=>{const s=settled(r),x={};if(r.season!=null)x.season=r.season;if(r.round!=null)x.round=r.round.indexOf(' - ')>=0?r.round.slice(0,r.round.indexOf(' - ')):r.round;return {date:r.date,home:r.home,away:r.away,hg:s.gh,ag:s.ga,hth:r.ht_h,hta:r.ht_a,_x:x};});
}
const q=x=>x==null?'null':typeof x==='number'?String(x):typeof x==='object'?"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb":"'"+String(x).replaceAll("'","''")+"'";
const insert=rs=>'insert into public.fixtures(fxid,lid,season,round,date,status,home,away,gh,ga,ft_h,ft_a,ht_h,ht_a,events,lineup_h,lineup_a,odds_open_h) values '+rs.map(r=>'('+[r.fxid,r.lid,r.season,r.round??null,r.date,r.status,r.home,r.away,r.gh??null,r.ga??null,r.ft_h??null,r.ft_a??null,r.ht_h??null,r.ht_a??null,r.events??null,r.lineup_h??null,r.lineup_a??null,1.9].map(q).join(',')+')').join(',')+';';
const callAs=(role,fx)=>psql(`set role ${role};select public.matchmind_match_context_v1(${fx});`);
test('match context SQL: installs as a non-superuser, serves exactly 355\'s inputs to anon, bounded, reversible',{timeout:240000},async(t)=>{
 try{docker(['info','--format','{{.ServerVersion}}']);}catch{t.skip('docker unavailable');return;}
 try{
  docker(['run','-d','--name',db,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16.6@sha256:557fea37a744d5f4c8faab304b0a90858b53ab119735a88c131fd19dab802f36']);
  let ready=false;for(let i=0;i<120;i++){try{if(docker(['logs',db]).includes('init process complete')){docker(['exec',db,'pg_isready','-U','postgres']);ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  assert.ok(ready,'postgres ready');
  // Hosted shape: the installer is a non-superuser CREATEROLE role that owns the database (so is a member of
  // pg_database_owner), the table has RLS with a PUBLIC read policy and anon has no SELECT grant.
  psql(`create role anon nologin;create role authenticated nologin;create role service_role nologin bypassrls;
   create role installer login createrole inherit;alter database postgres owner to installer;
   create table public.fixtures(fxid bigint primary key,lid bigint,season int,round text,date date,status text,home text,away text,gh int,ga int,ft_h int,ft_a int,ht_h int,ht_a int,events jsonb,lineup_h jsonb,lineup_a jsonb,odds_open_h numeric);
   alter table public.fixtures owner to installer;alter table public.fixtures enable row level security;
   create policy "public read fixtures" on public.fixtures for select using(true);
   grant select on public.fixtures to service_role;`);
  const {rows,upcoming,target}=synthetic();psql(insert([...rows,...upcoming]));
  assert.throws(()=>psql(`set role anon;select count(*) from public.fixtures;`),/permission denied/);
  psql(UP,'installer');
  assert.throws(()=>psql(UP,'installer'),/already installed/,'refuses to install twice');
  assert.equal(psql(`select pg_has_role('installer','mm_match_context','SET')::text||pg_has_role('installer','mm_match_context','USAGE')::text`),'falsefalse','installer gives the role back');
  assert.equal(psql(`select string_agg(attname,',' order by attname::text collate "C") from pg_attribute a where attrelid='public.fixtures'::regclass and attnum>0 and has_column_privilege('mm_match_context','public.fixtures',attname,'SELECT')`),
   'away,date,events,ft_a,ft_h,fxid,ga,gh,home,ht_a,ht_h,lid,lineup_a,lineup_h,round,season,status'
  );
  assert.equal(psql(`select has_column_privilege('mm_match_context','public.fixtures','ft_h','SELECT')::text||has_column_privilege('mm_match_context','public.fixtures','odds_open_h','SELECT')::text`),'truefalse','no odds column');
  assert.equal(psql(`select has_schema_privilege('mm_match_context','public','CREATE')::text`),'false','schema CREATE given back');
  assert.throws(()=>psql(`set role anon;select count(*) from public.fixtures;`),/permission denied/,'anon still cannot read the table');
  const raw=JSON.parse(callAs('anon',target.fxid));
  assert.equal(raw.version,'matchmind-match-context/1');assert.deepEqual([raw.from,raw.to],[from,today]);
  assert.ok(!JSON.stringify(raw).includes('1.9'),'no odds value leaves');assert.ok(!('fxid' in (raw.m[0]||{})));
  const C=B.matchContextDecode(raw,target.fxid),ref=reference355(rows,7);
  assert.deepEqual(JSON.parse(JSON.stringify(C.matches)),JSON.parse(JSON.stringify(ref)),'L.matches identical to 355 loader');
  assert.ok(!C.matches.some(m=>m.home==='Other'),'other competition excluded');assert.ok(!C.matches.some(m=>m.hg===9),'row before window excluded');
  assert.deepEqual(plain(C.upcoming),[{home:'Foxtrot',away:'Alpha',season:2026}],'upcoming within 60 days only');
  const L1={matches:C.matches,upcoming:C.upcoming},L2={matches:ref,upcoming:[{home:'Foxtrot',away:'Alpha',season:2026}]};
  const s1=B.latestSeasonOf(L1),t1=B.tableAsOf(L1,null,s1),t2=B.tableAsOf(L2,null,B.latestSeasonOf(L2));
  assert.equal(s1,2026);assert.deepEqual(JSON.parse(JSON.stringify(t1.rows)),JSON.parse(JSON.stringify(t2.rows)),'355 table identical');
  assert.ok(t1.rows.some(r=>r.team==='Foxtrot'&&r.pl===0),'roster seeded from upcoming on a confirmed round-robin');
  assert.ok(!t1.rows.some(r=>r.team==='Qualifier FC'),'qualifying round is not league phase');
  const rc=B.matchContextRates(C.matches);assert.equal(rc.n,ref.length);
  // Scorers: own goals and missed penalties excluded; a substitute's goal counts and his appearance is the sub on.
  assert.deepEqual(plain(C.scorers.filter(s=>s.team==='Alpha').map(s=>[s.name,s.goals,s.apps])),[['A. Striker',2,1],['A. Sub',1,1]]);
  assert.deepEqual(plain(C.scorers.filter(s=>s.team==='Foxtrot')),[],'no events for the other side');
  // Authenticated can call it too; unknown fixture is null; bad input refused.
  assert.equal(JSON.parse(callAs('authenticated',target.fxid)).lid,7);
  assert.equal(callAs('anon',987654321),'');
  assert.throws(()=>callAs('anon',0),/Invalid fixture/);
  // Function shape.
  assert.equal(psql(`select proowner::regrole||' '||prosecdef||' '||array_to_string(proconfig,',')||' '||provolatile::text from pg_proc where oid='public.matchmind_match_context_v1(bigint)'::regprocedure`),'mm_match_context true search_path=pg_catalog s');
  // Bounds: a competition over 6000 results is refused, never truncated.
  psql(`insert into public.fixtures(fxid,lid,season,round,date,status,home,away,gh,ga) select 500000+g,9,2026,'Regular Season - 1',current_date-(g%1500),'FT','H'||(g%40),'A'||(g%41),1,0 from generate_series(1,6001) g;`);
  assert.throws(()=>callAs('anon',500001),/6000-result bound/);
  // Reversible: down removes everything, up installs again.
  psql(DOWN,'installer');
  assert.equal(psql(`select (to_regprocedure('public.matchmind_match_context_v1(bigint)') is null)::text||(select count(*) from pg_roles where rolname='mm_match_context')||(select count(*) from pg_policy where polname='match_context_read')`),'true00');
  psql(UP,'installer');assert.equal(JSON.parse(callAs('anon',target.fxid)).m.length,ref.length);
 }finally{try{docker(['rm','-fv',db]);}catch{}}
});
