/* WHAT THE ANALYSIS SCREEN IS ALLOWED TO SAY ABOUT A PLAYED MATCH WITH NO GRADED PICK.
   Four defects, every one asserted on the RENDERED DOM rather than inferred from state:

   D1  renderFixtures emitted a four-sentence paragraph under EVERY matchday holding one such
       fixture, and it occupied that space permanently.
   D2  Both causes that paragraph named are impossible. "Either the app was not open before
       kick-off" cannot apply: forecasts are published by the scheduled publisher
       (.github/workflows/publish-picks.yml running robot/publish.mjs) and every shared write path
       refuses a non-publisher. "or the pick was withheld … because it did not clear that
       competition's bar" cannot either: since build 199 a withheld row KEEPS its pick, so such a
       fixture has a truthy f.pick and is never one of these rows.
   D3  The chip read "No pick" for every provenance at once - a published row that issued no pick,
       a proven withhold, a board snapshot, a state with no record of any kind, a local archive
       with no row, an archive read that FAILED, an edition past its expiry, and a bare row from
       the results feed carrying no provenance whatever. One label for eight, seven of which it
       cannot establish, and an unreadable record shown as though the engine had chosen to abstain.
   D4  backfillPredictions writes prediction rows for matches ALREADY PLAYED, stamped
       build = RECONSTRUCTED. renderLedger and engineRecordPayload both exclude exactly those rows;
       this feed gave them a plain tick or cross. One pick, two answers.

   Synthetic offline Chromium at phone width and under enlarged text; every non-document request is
   intercepted. Invented teams only. No backend, no provider, no credential, no production row. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let chromium;
for(const id of [process.env.PWA_PLAYWRIGHT,'playwright','playwright-core'])
  if(id){try{chromium=require(id).chromium;break;}catch{}}
const executablePath=[process.env.MM_TEST_CHROMIUM,process.env.PWA_CHROMIUM,
  '/opt/pw-browsers/chromium','/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

async function open(t,viewport){
  assert.ok(chromium&&executablePath,'local offline Chromium required');
  const browser=await chromium.launch({executablePath,
    args:['--no-sandbox','--disable-background-networking','--disable-sync']});
  const errors=[];
  t.after(async()=>{await browser.close();assert.deepEqual(errors,[],'no page runtime errors');});
  const context=await browser.newContext({serviceWorkers:'block',
    viewport:viewport||{width:390,height:844}});
  await context.route('**/*',r=>r.request().url()==='http://pick-provenance.test/'
    ?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://pick-provenance.test/');
  return page;
}

/* ── THE PUBLISHED SLATE ──────────────────────────────────────────────────────────────────────
   One valid bounded edition on TODAY, in the delivery contract's own shape, carrying every
   provenance a presentation row can actually have:
     · 24 PLAYED cards with neither a prediction row nor a board row. Four causes collapse into
       this one state and the data cannot separate them. This is the population the removed
       paragraph claimed to explain.
     ·  1 PLAYED card with no prediction row but WITH a board row carrying a gate reason. The
       board is one upserted snapshot, rebuilt each run and structurally never covering a played
       match, so it is a DATED observation and must read as one.
     ·  1 PLAYED card whose prediction row carries withheld_at and no pick - proven, and named.
     ·  3 PLAYED cards with published picks: one hit, one miss, one Draw No Bet that ended level
       (a void). Their grades must not move by one character.
     ·  1 UPCOMING card whose prediction row carries withheld_at. It has no result, so the feed's
       long-standing rule keeps it out of the played list; its chip is asserted through fxCells.
   raw_allowed:false - an ordinary caller, so every read goes through the fixed display screens. */
const BUILT_AT='2026-11-08T06:30:00.000Z';
const SLATE=`
 globalThis.mmSlate=(opts)=>{
  opts=opts||{};
  const date=new Date().toISOString().slice(0,10);
  const asof=new Date(Date.now()-1000).toISOString();
  const expires=new Date(Date.now()+60000).toISOString();
  const pred=(home,away,time,over)=>Object.assign({lid:39,lname:'Synthetic Premier',home,away,
    pick:'1',pick_prob:.6,market:'Winner',p_home:.6,p_draw:.25,p_away:.15,xg_home:1.8,xg_away:.9,
    kickoff:date,ktime:time,made_at:asof,withheld_at:null,final_pick:null,build:355},over||{});
  const noPick={pick:null,pick_prob:null,market:null,p_home:null,p_draw:null,p_away:null,
    xg_home:null,xg_away:null};
  const card=(fxid,home,away,time,score,prediction)=>({fxid,lid:39,lname:'Synthetic Premier',
    lcountry:'Synthetic',date,time,status:score?'FT':'NS',elapsed:null,home,away,
    gh:score?score[0]:null,ga:score?score[1]:null,ft_h:score?score[0]:null,ft_a:score?score[1]:null,
    ht_h:null,ht_a:null,updated_at:asof,provider:'af',prediction:prediction||null});
  const cards=[];
  /* MANY played fixtures with no issued pick - 24, the count in the reported paragraph. */
  if(opts.unissued!==false) for(let i=0;i<24;i++)
    cards.push(card(991001+i,'Home '+(i+1),'Away '+(i+1),'12:'+String(i).padStart(2,'0'),[1,1]));
  /* Played, no prediction row, but the board still carries it from when it was upcoming. */
  const boardCard=card(991300,'Board Home','Board Away','13:30',[2,0]);
  cards.push(boardCard);
  /* Three published picks, already graded today. */
  cards.push(card(991100,'Hit Home','Hit Away','14:00',[2,1],pred('Hit Home','Hit Away','14:00')));
  cards.push(card(991101,'Miss Home','Miss Away','14:15',[0,2],pred('Miss Home','Miss Away','14:15')));
  cards.push(card(991102,'Void Home','Void Away','14:30',[1,1],
    pred('Void Home','Void Away','14:30',{pick:'1D',market:'Draw No Bet'})));
  /* A PROVEN withheld decision, played, with no pick ever issued. An all-null probability vector
     is admissible under the contract; a half-null one is not. */
  cards.push(card(991200,'Withheld Home','Withheld Away','15:00',[1,0],
    Object.assign(pred('Withheld Home','Withheld Away','15:00'),noPick,{withheld_at:asof})));
  /* The same proof before kick-off. 23:59 today, so it is upcoming whenever this runs. */
  cards.push(card(991201,'Pending Home','Pending Away','23:59',null,
    Object.assign(pred('Pending Home','Pending Away','23:59'),noPick,{withheld_at:asof})));
  const board={v:1,ahead:7,builtAt:'${BUILT_AT}',n:1,notPassed:0,noBars:0,
    rows:[{f:boardCard.fxid,l:39,n:'Synthetic Premier',d:date,t:boardCard.time,
      h:boardCard.home,a:boardCard.away,p:null,q:null,m:null,g:'low',z:false,
      pw:null,pd:null,pq:null,xh:null,xa:null}]};
  window.rawCalls=[];
  const q=()=>{const x={then:ok=>Promise.resolve({data:[],error:null}).then(ok)};
    for(const n of ['select','eq','in','gte','lte','order','range','limit'])x[n]=()=>x;return x;};
  supa={rpc:async(name,args)=>name==='matchmind_fixture_access_v1'
      ?{data:{version:'matchmind-fixture-access/1',raw_allowed:false},error:null}
      :{data:{version:'matchmind-display/1',
          edition_id:'33333333-3333-4333-8333-333333333333',as_of:asof,expires_at:expires,
          screen:args.screen,
          cards:['predictions','scores','history'].includes(args.screen)?cards:[],
          board:args.screen==='predictions'?board:null,
          records:{engine:null,clv:null},slips:[]},error:null},
    from:name=>{rawCalls.push(name);return q();},
    auth:{getSession:async()=>({data:{session:null},error:null})}};
  return {date,cards};
 };
 /* The rendered feed, read as STRUCTURE as well as text. */
 globalThis.mmFeed=()=>{
  const list=$('fixtureList')||{children:[],querySelectorAll:()=>[]};
  const rows=[...list.querySelectorAll('.fxrow')].map(r=>{
   const chip=r.querySelector('.predchip');
   return {text:r.textContent,
     chip:chip?chip.textContent.trim():null,
     chipTag:chip?chip.tagName.toLowerCase():null,
     chipTitle:chip?(chip.getAttribute('title')||''):null,
     chipName:chip?(chip.getAttribute('aria-label')||''):null};
  });
  /* document.body.textContent includes the <script> element's own source, so it answers a
     question about SOURCE, not about screen. This walks the markup and skips the places code and
     styling live, keeping hidden views in - the claim is that the text is nowhere on screen, not
     merely nowhere visible on this tab. */
  const skip=new Set(['SCRIPT','STYLE','TEMPLATE','NOSCRIPT']);
  const screenText=(()=>{let out='';
   const walk=document.createTreeWalker(document.body,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT,
     {acceptNode:n=>n.nodeType===1&&skip.has(n.tagName)?NodeFilter.FILTER_REJECT
        :NodeFilter.FILTER_ACCEPT});
   for(let n=walk.nextNode();n;n=walk.nextNode()) if(n.nodeType===3) out+=n.nodeValue+' ';
   return out;})();
  return {rows,text:list.textContent||'',body:screenText,
    attrs:[...document.querySelectorAll('[title],[aria-label],[placeholder],[alt]')]
      .map(e=>[e.getAttribute('title'),e.getAttribute('aria-label'),
               e.getAttribute('placeholder'),e.getAttribute('alt')].join(' ')).join(' '),
    notes:[...list.querySelectorAll('.subnote')].map(n=>n.textContent)};
 };
 globalThis.mmRender=async(opts)=>{
  opts=opts||{};
  await loadCloudLeagues(true);
  const date=new Date().toISOString().slice(0,10);
  if(opts.stub){
   /* Exactly what ensureLeagueFromScore pushes into a presentation league: a bare row with no
      _displayCard and therefore no provenance of any kind. */
   const L=afState.leagues[39];
   L._presentation=true;
   L.upcoming.push({fxid:992500,date,time:'16:00',home:'Stub Home',away:'Stub Away'});
   afState.cloudFix[992500]={fxid:992500,lid:39,gh:1,ga:0,status:'FT',date,
     home:'Stub Home',away:'Stub Away',settlement:'final'};
  }
  navTo('predict');
  afState.selectedDate=date;
  renderFixtures();
  return mmFeed();
 };
`;

/* ── A LOCALLY FITTED COMPETITION ─────────────────────────────────────────────────────────────
   A real corpus, one played fixture. Here the archive is the only source, the absence of a row
   genuinely cannot be attributed to any one cause, and whether the read even succeeded is its own
   separate fact. The read is DRIVEN, not faked: a raw-allowed caller whose predictions table
   answers with an error is how a refused or broken archive read reaches the screen. */
const LOCAL=`
 globalThis.mmLocalLeague=()=>{
  const date=new Date().toISOString().slice(0,10);
  const teams=['Alpha','Beta','Gamma','Delta','Epsilon','Zeta'];
  const ms=[];let d=Date.parse('2026-01-05T00:00:00Z');
  for(let i=0;i<teams.length;i++)for(let j=0;j<teams.length;j++){
   if(i===j)continue;
   ms.push({date:new Date(d).toISOString().slice(0,10),time:'19:45',home:teams[i],away:teams[j],
     hg:i%3,ag:j%2,ft_h:i%3,ft_a:j%2,fgh:null,fga:null,status:'FT'});
   d+=3*86400000;
  }
  const L={id:39,name:'Local League',country:'Synthetic',sport:'football',matches:ms,
    upcoming:[{fxid:992001,date,time:'13:00',home:'Alpha',away:'Beta',status:'FT'}],
    teamIds:{Alpha:1,Beta:2},histTried:true};
  afState.leagues={39:L};afState.leagueOrder=[39];afState.activeLeagueId=39;
  afState.selectedDate=date;afState.scores=null;
  afState.cloudFix={992001:{fxid:992001,lid:39,gh:2,ga:1,status:'FT',date,
    home:'Alpha',away:'Beta',settlement:'final'}};
  return L;
 };
 globalThis.mmLocalArchiveRead=async(mode)=>{
  const L=mmLocalLeague();
  afState.archive=null;
  window.archiveReads=0;
  authUser={id:'00000000-0000-0000-0000-00000000beef'};
  const chain=()=>{const x={then:(ok)=>Promise.resolve(
     mode==='fail'?{data:null,error:{message:'refused'}}:{data:[],error:null}).then(ok)};
   for(const n of ['select','eq','in','gte','gt','lte','lt','is','not','order','range','limit'])
     x[n]=()=>x;
   return x;};
  supa={rpc:async(name)=>name==='matchmind_fixture_access_v1'
      ?{data:{version:'matchmind-fixture-access/1',raw_allowed:true,
         expires_at:new Date(Date.now()+60000).toISOString()},error:null}
      :{data:null,error:{message:'no display read on this path'}},
    from:()=>{archiveReads++;return chain();},
    auth:{getSession:async()=>({data:{session:null},error:null})}};
  fixtureDeliveryReset();
  await loadArchive();
  navTo('predict');
  afState.selectedDate=new Date().toISOString().slice(0,10);
  renderFixtures();
  return Object.assign(mmFeed(),{archiveReads:window.archiveReads,
    raw:fixtureRawCurrent(),archive:afState.archive,
    archiveState:(typeof _archiveRead==='undefined'?null:_archiveRead)});
 };
 /* applyGatePass's archive arm, replicated field for field (it is pinned byte-identical to build
    344, so it is read from rather than run): the archived pick is copied onto the row and frozen. */
 globalThis.mmArchivedPick=(build)=>{
  const L=mmLocalLeague();
  const date=new Date().toISOString().slice(0,10);
  const a=archiveRow({kickoff:date,ktime:'13:00',pick:'1',pick_prob:.62,market:'Winner',
    p_home:.62,p_draw:.2,p_away:.18,xg_home:1.6,xg_away:.8,
    made_at:new Date(Date.now()-86400000).toISOString(),withheld_at:null,final_pick:null,build});
  afState.archive={992001:a};
  try{_archiveRead='loaded';}catch(e){}
  const f=L.upcoming[0];
  f.pick=a.pick;f.prob=a.prob;f.pW=a.pW;f.pD=a.pD;f.pL=a.pL;
  if(a.market)f.market=a.market;
  f.frozen=true;f.publishedAt=a.at||null;
  navTo('predict');
  afState.selectedDate=date;
  renderFixtures();
  return Object.assign(mmFeed(),{recon:a.recon});
 };
`;

const VERBOSE=/was not open before kick-off/i;
const GRADE=/[✓✗]/;

test('the verbose no-pick paragraph is gone and every played row keeps a compact status',async t=>{
  const page=await open(t);
  const seen=await page.evaluate(async([slate])=>{
    eval(slate);mmSlate();return await mmRender({stub:true});
  },[SLATE]);
  /* 30 rows: 24 with no record at all, 1 board-only, 1 withheld-and-played, 3 graded, 1 bare stub.
     The upcoming withheld card has no result, so the feed's own rule keeps it out of the played
     list; its chip is asserted separately. */
  assert.equal(seen.rows.length,30,'the feed did not render every fixture: '+seen.rows.length);
  /* THE PARAGRAPH, AND THE CLAIM INSIDE IT, on rendered text rather than on the source. */
  assert.doesNotMatch(seen.text,VERBOSE,'the feed still blames whether the app was open');
  assert.doesNotMatch(seen.body,VERBOSE,'the screen still blames whether the app was open');
  assert.doesNotMatch(seen.text,/accuracy record/i,
    'a permanent note about the accuracy record still sits under the matchday');
  assert.doesNotMatch(seen.text,/Frozen picks are never re-calculated/i);
  assert.doesNotMatch(seen.text,/did not clear that competition/i,
    'the feed still names a cause that cannot produce one of these rows');
  /* AND NO EQUIVALENT BANNER: any block-level note left in the feed that talks about picks must be
     too short to be a paragraph of screen furniture. */
  for(const n of seen.notes)
    assert.ok(!/pick/i.test(n)||n.trim().length<=120,
      'a long explanatory note still sits in the feed: '+n.trim().slice(0,160));
  /* EVERY ROW KEEPS A COMPACT STATUS, and compact means compact. */
  for(const r of seen.rows){
    assert.ok(r.chip,'a row lost its status entirely: '+r.text.trim());
    assert.ok(r.chip.length<=24,'the per-match status is not compact: '+r.chip);
  }
  /* THE GRADES ARE UNTOUCHED. 2-1 on 1 is a hit, 0-2 a miss, a level Draw No Bet a void. */
  const by=p=>seen.rows.find(r=>r.text.includes(p)).chip;
  assert.equal(by('Hit Home'),'1 ✓','a published hit no longer grades as a hit');
  assert.equal(by('Miss Home'),'1 ✗','a published miss no longer grades as a miss');
  assert.equal(by('Void Home'),'1 DNB void','a level Draw No Bet no longer grades as a void');
});

test('provenance decides the status: the eight states are told apart, not pooled',async t=>{
  const page=await open(t);
  const seen=await page.evaluate(async([slate])=>{
    eval(slate);mmSlate();
    const feed=await mmRender({stub:true});
    /* The upcoming withheld row never enters the played list, so its chip is read where it is
       built. gateNow returns the stored verdict for a frozen fixture; GATE_TEXT had no key for
       'withheld' and printed "No strong read" over a decision the record states outright. */
    const L=afState.leagues[39],up=L.upcoming.find(f=>f.fxid===991201);
    return Object.assign(feed,{upcoming:fxCells(L,up,scoreMap()).chip,
      upcomingGate:gateNow(L,up)});
  },[SLATE]);
  const row=p=>seen.rows.find(r=>r.text.includes(p));
  /* A PROVEN withheld decision says so, played and before kick-off. */
  const w=row('Withheld Home');
  assert.ok(w,'the withheld row did not render');
  assert.match(w.chip,/withheld/i,'a proven withhold does not read as withheld: '+w.chip);
  assert.equal(seen.upcomingGate,'withheld','the stored verdict is not the one under test');
  assert.match(seen.upcoming,/withheld/i,
    'a withheld fixture before kick-off does not read as withheld: '+seen.upcoming);
  assert.doesNotMatch(seen.upcoming,/no strong read/i,
    'a proven withhold was recast as a weak read: '+seen.upcoming);
  /* The board-only row is a DATED observation of one rebuilt snapshot, and says so. */
  const b=row('Board Home');
  assert.ok(b,'the board-only row did not render');
  assert.match(b.chip,/^Board: no pick$/i,
    'a board-only state does not name the board: '+b.chip);
  assert.doesNotMatch(b.chip,/withheld/i);
  assert.match(b.chipTitle,/2026-11-08 06:30/,
    'the board observation is not dated to the board that made it: '+b.chipTitle);
  assert.match(b.chipTitle,/rebuilt every run|one snapshot/i,
    'the board observation is stated as a timeless fact: '+b.chipTitle);
  /* The 24 fixtures with no record of any kind name the FACT and no cause, and must not imply a
     withhold has been ruled out. */
  const named=/Hit|Miss|Void|Withheld|Board|Stub|Pending/;
  const none=seen.rows.filter(r=>/Home \d/.test(r.text)&&!named.test(r.text));
  assert.equal(none.length,24,'the no-record population did not render: '+none.length);
  for(const r of none){
    assert.doesNotMatch(r.chip,/withheld/i,
      'an unexplained absence was labelled a deliberate abstention: '+r.chip);
    assert.doesNotMatch(r.chip,/\bno pick issued\b/i,
      'four indistinguishable causes were reported as a published decision: '+r.chip);
    assert.doesNotMatch(r.chip,/board/i,
      'a state with no board row cites a board: '+r.chip);
    assert.match(r.chip,/^No record$/i,
      'the unknowable state is not reported as such: '+r.chip);
    assert.doesNotMatch(r.chipTitle,/not withheld|was not withheld/i,
      'the title rules out a withhold it cannot rule out: '+r.chipTitle);
    assert.match(r.chipTitle,/cannot be told apart|does not say why/i,
      'the title claims to know a cause: '+r.chipTitle);
  }
  /* A bare row from the results feed carries no provenance at all and is not a verified edition. */
  const stub=row('Stub Home');
  assert.ok(stub,'the bare presentation-league row did not render');
  assert.match(stub.chip,/^Unavailable$/i,'a provenance-free row claims a status: '+stub.chip);
  assert.doesNotMatch(stub.chip,/\bno pick issued\b/i,
    'a bare results-feed row was treated as a verified edition that issued no pick: '+stub.chip);
  assert.doesNotMatch(stub.chip,/withheld/i);
  /* The one sentence is OPTIONAL and reachable: a title for a pointer, an accessible name for
     assistive technology. It is never permanent furniture, and never that claim. */
  for(const r of seen.rows.filter(x=>!GRADE.test(x.chip)&&!/void/.test(x.chip))){
    assert.ok(r.chipTitle&&r.chipTitle.length>0,'the compact status carries no title: '+r.chip);
    assert.ok(r.chipTitle.length<=300,'the title is a paragraph again: '+r.chipTitle);
    assert.doesNotMatch(r.chipTitle,VERBOSE,'the title still blames whether the app was open');
    assert.ok(r.chipName&&r.chipName.length>0,
      'the interactive status has no accessible name: '+r.chip);
  }
});

test('an expired edition is reported as unavailable, never as a published decision',async t=>{
  const page=await open(t);
  const seen=await page.evaluate(async([slate])=>{
    eval(slate);mmSlate();
    await mmRender();
    /* The accepted edition's own life has passed and no newer one has been read, so nothing about
       any individual match is established any more. */
    _presentationUntil=Date.now()-1000;
    renderFixtures();
    return mmFeed();
  },[SLATE]);
  const rows=seen.rows.filter(r=>!GRADE.test(r.chip||'')&&!/void/.test(r.chip||''));
  assert.ok(rows.length>=26,'the slate did not survive the re-render: '+rows.length);
  for(const r of rows){
    assert.match(r.chip,/^Unavailable$/i,
      'an expired edition still reports a published state: '+r.chip);
    assert.doesNotMatch(r.chip,/\bno pick issued\b/i,
      'an expired edition masquerades as an edition that issued no pick: '+r.chip);
    assert.doesNotMatch(r.chip,/withheld/i,
      'an expired edition masquerades as a withheld decision: '+r.chip);
    assert.doesNotMatch(r.chip,/board/i,
      'an expired edition is still quoted as a board observation: '+r.chip);
  }
});

test('a failed archive read is reported as unavailable, not as a missing pick',async t=>{
  const page=await open(t);
  const seen=await page.evaluate(async([slate,local])=>{
    eval(slate);eval(local);return await mmLocalArchiveRead('fail');
  },[SLATE,LOCAL]);
  assert.equal(seen.raw,true,'the harness did not reach the private archive path at all');
  assert.ok(seen.archiveReads>0,'the archive read was never attempted');
  assert.equal(seen.rows.length,1,'the local played fixture did not render');
  const chip=seen.rows[0].chip;
  assert.match(chip,/^Unavailable$/i,'a refused archive read does not say so: '+chip);
  assert.doesNotMatch(chip,/withheld/i,'an unreadable record was called an abstention: '+chip);
  assert.doesNotMatch(chip,/\bno pick\b/i,
    'an unreadable record was reported as a pick that was not issued: '+chip);
  assert.match(seen.rows[0].chipTitle,/could not be read/i,
    'the read failure is not named in the explanation: '+seen.rows[0].chipTitle);
  assert.equal(seen.archiveState,'failed','the refused read was not recorded as a failure');
  assert.doesNotMatch(seen.body,VERBOSE);
});

test('a locally archived absence names the fact and refuses to name a cause',async t=>{
  const page=await open(t);
  const seen=await page.evaluate(async([slate,local])=>{
    eval(slate);eval(local);return await mmLocalArchiveRead('ok');
  },[SLATE,LOCAL]);
  assert.equal(seen.rows.length,1,'the local played fixture did not render');
  assert.deepEqual(seen.archive,{},'the control archive is not an empty, successful read');
  const chip=seen.rows[0].chip,title=seen.rows[0].chipTitle;
  /* The archive WAS read and holds no row for this fixture. The fact is known; on this path the
     cause is genuinely unknowable, and a locally fitted competition has no published edition to
     attribute anything to. */
  assert.match(chip,/^Not archived$/i,
    'the local absence is not reported as an unavailable archive record: '+chip);
  assert.doesNotMatch(chip,/withheld/i,'an unknowable absence was called an abstention: '+chip);
  assert.doesNotMatch(chip,/\bno pick issued\b/i,
    'a locally fitted competition claims a published edition it never had: '+chip);
  assert.ok(title&&title.length>0,'the local status carries no title');
  assert.match(title,/cannot establish why|no reason is claimed/i,
    'the local title claims to know a cause: '+title);
  assert.doesNotMatch(title,VERBOSE,'the local title still blames whether the app was open');
  assert.equal(seen.archiveState,'loaded','the archive read did not succeed in this control');
  assert.doesNotMatch(seen.body,VERBOSE);
});

test('a pick rebuilt after the match is labelled, not graded, while a real pick still grades',
 async t=>{
  const page=await open(t);
  const seen=await page.evaluate(async([slate,local])=>{
    eval(slate);eval(local);
    const rebuilt=mmArchivedPick(-1);          // RECONSTRUCTED, as backfillPredictions stamps it
    const issued=mmArchivedPick(355);          // an ordinary pre-kick-off forecast
    return {rebuilt,issued};
  },[SLATE,LOCAL]);
  assert.equal(seen.rebuilt.recon,true,'archiveRow did not mark the row as a reconstruction');
  assert.equal(seen.issued.recon,false,'the control row was marked a reconstruction');
  const reb=seen.rebuilt.rows[0],iss=seen.issued.rows[0];
  /* The control first: an issued pick on a 2-1 win still grades exactly as before. */
  assert.equal(iss.chip,'1 ✓','an issued pre-match pick stopped grading: '+iss.chip);
  /* And the rebuild carries a label instead of a verdict the ledger refuses to count. */
  assert.doesNotMatch(reb.chip,GRADE,
    'a post-match reconstruction was still graded with a tick or a cross: '+reb.chip);
  assert.match(reb.chip,/rebuilt/i,'a post-match reconstruction is not labelled: '+reb.chip);
  assert.match(reb.chip,/^1\b/,'the rebuilt chip lost the pick it is about: '+reb.chip);
  assert.match(reb.chipTitle,/not .*issued before kick-off|not counted in the accuracy record/i,
    'the rebuilt chip does not say it is outside the record: '+reb.chipTitle);
});

test('the accuracy record is unmoved by the presence of unissued fixtures',async t=>{
  const page=await open(t);
  const seen=await page.evaluate(async([slate])=>{
    eval(slate);
    const record=()=>{
      _engineRecord={state:'loaded',
        payload:{v:1,days:{[new Date().toISOString().slice(0,10)]:{Winner:[7,3,1]}},
          total:11,graded:11,withheld:0,
          excluded:0,pending:0,orphan:0,off:0,ungradeable:0,voidLate:0},
        build:355,computedAt:new Date(Date.now()-1000).toISOString(),at:Date.now()};
      renderStrongPicks();
      return $('recordLine').textContent;
    };
    mmSlate();
    const withUnissued=await mmRender();
    const lineA=record();
    /* The same published picks, none of the unissued fixtures. */
    mmSlate({unissued:false});
    fixtureDeliveryReset();
    const withoutUnissued=await mmRender();
    const lineB=record();
    return {lineA,lineB,rowsWith:withUnissued.rows.length,rowsWithout:withoutUnissued.rows.length,
      feedWith:withUnissued.text};
  },[SLATE]);
  assert.ok(seen.rowsWith>=seen.rowsWithout+24,
    'the two slates are not actually different: '+seen.rowsWith+' vs '+seen.rowsWithout);
  assert.match(seen.lineA,/7\/10 correct · 70\.0%/,'the record line did not render: '+seen.lineA);
  assert.equal(seen.lineA,seen.lineB,
    'unissued fixtures moved the accuracy figure: '+seen.lineA+' | '+seen.lineB);
  /* And the screen no longer needs a paragraph to promise it. */
  assert.doesNotMatch(seen.feedWith,VERBOSE);
  assert.doesNotMatch(seen.feedWith,/accuracy record/i);
});

test('the compact status stays readable at 360px and under enlarged text, with no sideways scroll',
 async t=>{
  const page=await open(t,{width:360,height:640});
  const seen=await page.evaluate(async([slate])=>{
    eval(slate);mmSlate();
    await mmRender({stub:true});
    const measure=()=>{
      const d=document.documentElement;
      const chips=[...document.querySelectorAll('#fixtureList .statuschip')].map(c=>{
        const r=c.getBoundingClientRect();
        const cs=getComputedStyle(c);
        return {w:Math.round(r.width),h:Math.round(r.height),right:Math.round(r.right),
          overflow:cs.overflow,wrap:cs.whiteSpace,ellipsis:cs.textOverflow,
          text:c.textContent.trim()};
      });
      const rows=[...document.querySelectorAll('#fixtureList .fxrow')].map(r=>{
        const b=r.getBoundingClientRect();return {h:Math.round(b.height)};
      });
      const l=$('fixtureList');
      return {sideways:d.scrollWidth-d.clientWidth,chips,rows,
        listOverflow:l?l.scrollWidth-l.clientWidth:0};
    };
    const normal=measure();
    /* Enlarged text. Every size in this stylesheet is a rem, so moving the root size is how a
       device text-scaling setting reaches this layout. */
    document.documentElement.style.fontSize='24px';
    renderFixtures();
    const large=measure();
    document.documentElement.style.fontSize='';
    const vp=document.querySelector('meta[name=viewport]');
    return {normal,large,viewport:vp?vp.getAttribute('content'):''};
  },[SLATE]);
  /* The affordance has to exist at all: a span with a tooltip is not reachable by touch. */
  assert.ok(seen.normal.chips.length>=26,
    'the compact status is not an addressable element: '+seen.normal.chips.length);
  for(const label of ['normal','large']){
    const m=seen[label];
    assert.ok(m.sideways<=1,label+' text: the page scrolls sideways by '+m.sideways+'px');
    assert.ok(m.listOverflow<=1,label+' text: the feed overflows by '+m.listOverflow+'px');
    for(const c of m.chips){
      assert.ok(c.w>0&&c.h>0,label+' text: a status chip has no box: '+JSON.stringify(c));
      /* Nothing may be cut off. A nowrap chip that cannot fit either truncates or pushes the row
         sideways, so the label wraps and the box never clips. */
      assert.notEqual(c.wrap,'nowrap',label+' text: the status cannot wrap: '+JSON.stringify(c));
      assert.equal(c.overflow,'visible',label+' text: the status clips: '+JSON.stringify(c));
      assert.notEqual(c.ellipsis,'ellipsis',
        label+' text: the status label is ellipsised: '+JSON.stringify(c));
      assert.ok(c.right<=360,label+' text: a status chip runs off the screen at '+c.right+'px');
    }
    for(const r of m.rows)
      assert.ok(r.h>=44,label+' text: a fixture row is '+r.h+' CSS px, under the 44px floor');
  }
  /* Zoom is never taken away from the reader. */
  assert.doesNotMatch(seen.viewport,/maximum-scale|user-scalable/i,
    'the viewport meta restricts zoom: '+seen.viewport);
});

test('the longer explanation is reachable on request and does not open the match',async t=>{
  const page=await open(t);
  const seen=await page.evaluate(async([slate])=>{
    eval(slate);mmSlate();
    await mmRender();
    let opened=0;const realOpen=openFixture;openFixture=()=>{opened++;};
    try{
      const chip=document.querySelector('#fixtureList .statuschip');
      if(!chip) return {chip:false};
      chip.scrollIntoView({block:'center'});
      const r=chip.getBoundingClientRect();
      /* The visible chip is small on purpose. Its HIT AREA must clear 44 CSS px, so a tap 16px
         above and below its centre must still land on it. */
      const hits=[-16,0,16].map(dy=>{
        const el=document.elementFromPoint(Math.round(r.left+r.width/2),
                                           Math.round(r.top+r.height/2+dy));
        return !!(el&&(el===chip||chip.contains(el)));
      });
      chip.click();
      const toastEl=$('toast');
      return {chip:true,tag:chip.tagName.toLowerCase(),hits,opened,
        toast:toastEl?toastEl.textContent:'',
        shown:toastEl?toastEl.classList.contains('show'):false,
        title:chip.getAttribute('title')||'',name:chip.getAttribute('aria-label')||''};
    }finally{openFixture=realOpen;}
  },[SLATE]);
  assert.equal(seen.chip,true,'there is no compact status element to ask');
  assert.equal(seen.tag,'button','the status is not an interactive affordance: '+seen.tag);
  assert.deepEqual(seen.hits,[true,true,true],
    'the status hit area is under 44 CSS px tall: '+JSON.stringify(seen.hits));
  assert.equal(seen.shown,true,'asking for the explanation showed nothing');
  assert.ok(seen.toast.length>20,'the explanation on request is empty: '+seen.toast);
  assert.doesNotMatch(seen.toast,VERBOSE,'the explanation still blames whether the app was open');
  assert.equal(seen.opened,0,'asking about the status opened the match instead');
  assert.ok(seen.name.includes(seen.title),'the accessible name omits the explanation');
});

/* A static guard beside the rendered ones. The claim survives in two code comments, which document
   precisely what was removed and why - but it must exist nowhere a renderer can reach. Every line
   of index.html that carries the phrase has to be a comment line, so the string cannot be emitted
   by any path, visible or not. */
test('the false claim survives only as a comment and can never be rendered',()=>{
  const lines=html.split(/\r?\n/);
  const hits=lines.map((l,i)=>[i+1,l]).filter(([,l])=>/open before kick-off/i.test(l));
  assert.ok(hits.length>0,'the comments documenting the removal are gone too');
  for(const [n,l] of hits)
    assert.match(l,/^\s*(\/\*|\*|\/\/|[·•✓⚠─-]|·)/,
      'index.html:'+n+' carries the phrase outside a comment: '+l.trim().slice(0,120));
  /* And no emitting statement anywhere mentions it. */
  for(const [n,l] of hits)
    assert.doesNotMatch(l,/html\s*\+=|innerHTML|textContent\s*=/,
      'index.html:'+n+' could render the phrase: '+l.trim().slice(0,120));
});
