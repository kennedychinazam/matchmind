// Isolated synthetic PostgreSQL only. No network or hosted database credentials.
// PROPOSAL-up.sql as a whole: the bounded current-window edition, the paginated history read,
// the neutral league label, the loud size refusal, edition retention, server publisher authority
// and PROPOSAL-revert.sql.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=f=>readFileSync(new URL(f,root),'utf8');
const db='mm-bounded-window-'+process.pid;
const docker=(args,input)=>execFileSync('docker',['--host=unix:///var/run/docker.sock',...args],{input,encoding:'utf8',timeout:60000,stdio:['pipe','pipe','pipe'],maxBuffer:64<<20}).trim();
const sql=s=>docker(['exec','-i',db,'psql','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1'],s);
const PUB='33333333-3333-4333-8333-333333333333',A='11111111-1111-4111-8111-111111111111';
const as=(role,sub,q)=>sql(`begin;set local role ${role};${sub?`select 1 where set_config('request.jwt.claims','{"sub":"${sub}","role":"${role}"}',true) is null;`:''}${q};commit;`);
const publish=()=>JSON.parse(as('authenticated',PUB,'select public.matchmind_publish_display_v1()::text'));
const history=(d,f)=>JSON.parse(as('anon',null,`select public.matchmind_history_v1(${d?`'${d}'::date,${f}`:''})::text`));
test('bounded window edition, paginated history, neutral label, loud refusal, retention, publisher authority',async()=>{
 try{
  docker(['run','-d','--name',db,'--network','none','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:16.6']);
  let ready=false;for(let i=0;i<120;i++){try{if(docker(['logs',db]).includes('init process complete')){docker(['exec',db,'pg_isready','-U','postgres']);sql('select 1');ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}
  assert.ok(ready,'postgres ready');
  sql(read('backend/fixture-delivery/synthetic-bootstrap.sql'));
  // Production shape: lname is nullable on both tables.
  sql('alter table public.fixtures alter column lname drop not null;');
  const today="(now() at time zone 'UTC')::date";
  // 600 more old predictions (outside the window) so history needs three pages.
  sql(`insert into public.fixtures select 920000+n,2,'Old League','Old Country',(${today}-30-(n%40))::text,'15:00','FT',null,'Old Home '||n,'Old Away '||n,1,1,1,1,0,0,null,'synthetic',null from generate_series(1,600) n;
       insert into public.predictions select fxid,lid,lname,home,away,'X',.4,'Draw',.3,.4,.3,1.1,1.1,date,time,'2026-07-31T12:00:00.000Z',null,'X',355 from public.fixtures where fxid between 920001 and 920600;`);
  // Null league names in the window: one resolvable from another fixture of the competition, one not.
  sql(`insert into public.fixtures values(930001,2,null,'Old Country',(${today}+1)::text,'18:00','NS',null,'Named Home','Named Away',null,null,null,null,null,null,null,'synthetic',null),
                                         (930002,77,null,'Nowhere',(${today}+2)::text,'18:00','NS',null,'Neutral Home','Neutral Away',null,null,null,null,null,null,null,'synthetic',null);
       insert into public.predictions values(930001,2,null,'Named Home','Named Away','1',.5,'Home',.5,.3,.2,1.4,1,(${today}+1)::text,'18:00','2026-11-20T10:00:00.000Z',null,'1',358),
                                            (930002,77,null,'Neutral Home','Neutral Away','2',.5,'Away',.2,.3,.5,1,1.4,(${today}+2)::text,'18:00','2026-11-20T10:00:00.000Z',null,'2',358);`);
  const sourceDigest=()=>sql("select md5(coalesce(jsonb_agg(to_jsonb(p) order by fxid)::text,'')) from public.predictions p;");
  const before=sourceDigest();
  sql(read('backend/fixture-delivery/PROPOSAL-up.sql'));
  // Authority is the server's: nobody is enrolled yet.
  assert.deepEqual(JSON.parse(as('authenticated',PUB,'select public.matchmind_publisher_v1()::text')),{version:'matchmind-publisher/1',publisher:false});
  assert.throws(()=>publish(),/Scoped publisher required/);
  assert.throws(()=>as('anon',null,'select public.matchmind_publisher_v1()'),/permission denied/);
  sql(`insert into mm_fixture_delivery.principals values('${PUB}','publisher',true,now()+interval '1 hour','synthetic-only'),('${A}','research',true,now()+interval '1 hour','synthetic-only');`);
  assert.equal(JSON.parse(as('authenticated',PUB,'select public.matchmind_publisher_v1()::text')).publisher,true);
  assert.equal(JSON.parse(as('authenticated',A,'select public.matchmind_publisher_v1()::text')).publisher,false,'a research principal is not a publisher');
  assert.throws(()=>as('authenticated',A,'select public.matchmind_publish_display_v1()'),/Scoped publisher required/);
  // The edition is the window only.
  const r=publish();
  const total=+sql('select count(*) from public.predictions;');
  const inWindow=+sql(`select count(*) from public.predictions p join public.fixtures f using(fxid) where f.date::date between ${today}-6 and ${today}+7;`);
  assert.equal(r.predictions,inWindow);assert.ok(total>=747&&inWindow===2,'745 old + 2 window predictions');
  assert.equal(r.cards,+sql(`select count(*) from public.fixtures where date::date between ${today}-6 and ${today}+7;`));
  const hist=JSON.parse(as('anon',null,"select public.matchmind_display_v1('history')::text"));
  assert.equal(hist.history_paged,true,'the window edition tells the client to page the rest');
  const label=Object.fromEntries(hist.cards.filter(c=>c.prediction).map(c=>[c.fxid,c.prediction.lname]));
  assert.equal(label[930001],'Old League','null lname resolved from the competition');
  assert.equal(label[930002],'Competition','unresolvable lname gets the neutral label');
  assert.equal(hist.cards.find(c=>c.fxid===930002).lname,'Competition');
  // History pages: everything outside the window, once each, newest first, same edition.
  const seen=new Set(hist.cards.filter(c=>c.prediction).map(c=>c.fxid));let cursor=null,pages=0,last=null;
  do{const p=history(cursor&&cursor.date,cursor&&cursor.fxid);pages++;
   assert.equal(p.version,'matchmind-display/1');assert.equal(p.screen,'history');assert.equal(p.edition_id,r.edition_id);assert.ok(p.cards.length<=250);
   for(const c of p.cards){assert.ok(c.prediction,'history cards carry their prediction');assert.ok(!seen.has(c.fxid),'no repeats');seen.add(c.fxid);
    const k=[c.date,c.fxid];if(last)assert.ok(k[0]<last[0]||k[0]===last[0]&&k[1]<last[1],'keyset order');last=k;}
   cursor=p.next;}while(cursor);
  assert.equal(pages,3);assert.equal(seen.size,total,'edition plus history account for every prediction');
  assert.throws(()=>as('anon',null,"select public.matchmind_history_v1('2026-01-01'::date,null)"),/Incomplete history cursor/);
  assert.equal(sourceDigest(),before,'immutable prediction rows unchanged');
  // Retention keeps storage bounded, and surviving editions are byte-identical.
  for(let i=0;i<4;i++)publish();
  sql("update mm_fixture_delivery.editions set as_of=as_of-interval '2 hours',expires_at=expires_at-interval '2 hours';");
  const kept=sql("select string_agg(md5(payload::text),',' order by as_of desc,edition_id desc) from (select * from mm_fixture_delivery.editions order by as_of desc,edition_id desc limit 2) x;");
  publish();
  assert.equal(+sql('select count(*) from mm_fixture_delivery.editions;'),3,'newest three kept');
  assert.equal(sql("select string_agg(md5(payload::text),',' order by as_of desc,edition_id desc) from (select * from mm_fixture_delivery.editions order by as_of desc,edition_id desc offset 1) x;"),kept,'retained editions unchanged');
  assert.throws(()=>as('authenticated',PUB,'delete from mm_fixture_delivery.editions'),/permission denied/);
  // Production shapes: a 90-leg 'tips' slip in the window, and a board row whose fixture was rescheduled.
  sql(`insert into public.daily_slips select ${today}::text,'tips',0,355,'tips',jsonb_agg(jsonb_build_object('fxid',930001,'d',(${today}+1)::text,'h','Named Home','a','Named Away','code','1','market','1X2','p',.5,'tab',t,'rank',r,'sel','x')) from unnest(array['winner','ou','btts']) t,generate_series(0,29) r;
       update public.shared_records set payload=jsonb_set(payload,'{rows,0,d}',to_jsonb((${today}+3)::text)) where key='board';`);
  const t=publish();
  const slips=JSON.parse(as('anon',null,"select public.matchmind_display_v1('slips')::text")).slips;
  assert.equal(slips.find(x=>x.tier==='tips').legs.length,90,'the 90-leg issued tips slip is published whole');
  assert.ok(t.cards>=r.cards);
  sql(`update public.daily_slips set tier='safe' where tier='tips';`);
  assert.throws(()=>publish(),/Incomplete or unsupported presentation inventory/,'a 90-leg accumulator is still refused');
  sql(`delete from public.daily_slips where day=${today}::text and jsonb_array_length(legs)=90;`);
  // Over the bound: refused loudly, nothing written, nothing truncated.
  const n=+sql('select count(*) from mm_fixture_delivery.editions;');
  sql(`insert into public.fixtures select 940000+n,3,'Big League','Big',(${today}+(n%7))::text,'12:00','NS',null,'B Home '||n,'B Away '||n,null,null,null,null,null,null,null,'synthetic',null from generate_series(1,1600) n;`);
  assert.throws(()=>publish(),/exceeds the 1500-card bound: 16\d\d cards/);
  assert.equal(+sql('select count(*) from mm_fixture_delivery.editions;'),n);
  sql('delete from public.fixtures where fxid between 940001 and 941600;');
  // An undated prediction would fall out of both reads: refused.
  sql(`insert into public.predictions values(999999,1,'X','H','A','1',.5,'Home',.5,.3,.2,1,1,null,null,null,null,'1',358);`);
  assert.throws(()=>publish(),/no dated fixture/);
  sql('delete from public.predictions where fxid=999999;');
  // Revert removes every public entry point added here.
  sql(read('backend/fixture-delivery/PROPOSAL-revert.sql'));
  for(const fn of ['public.matchmind_history_v1(date,bigint)','public.matchmind_publisher_v1()','mm_fixture_delivery.history(date,bigint)','mm_fixture_delivery.publisher_scope()'])
   for(const role of ['anon','authenticated'])assert.equal(sql(`select has_function_privilege('${role}','${fn}','EXECUTE');`),'f',fn+' '+role);
 }finally{try{docker(['rm','-fv',db]);}catch{}}
});
