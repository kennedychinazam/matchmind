/* SCORES SLATE COMPLETENESS — can the Scores feed show an incomplete slate while looking settled?

   PROOF CLASS: Chromium, driven through playwright-core, on a disposable local origin whose only
   response is this worktree's index.html. No provider request, no backend, no credential, no
   production row, no physical device. The slate is SEEDED directly into `afState.scores` and
   `renderScores()` is called, because the question under test is the FILTERING AND RENDERING of a
   known-complete slate, not its delivery. That makes every count below arithmetic rather than
   network-dependent.

   WHAT THIS FILE GUARDS. The reader is told "Updated 3 min ago · 18 matches" and is entitled to
   believe the rows under that line are those matches. Five ordinary movements must not cost them a
   row: changing the date, narrowing to one competition and back to All, flipping the status chips
   back to All, leaving the tab and coming back, and starring/unstarring a match. A sixth —
   reloading with state retained — is where build 357 loses them, and the last three cases pin the
   three mechanisms that let it happen without saying so.

   SEVERITY: the four tests marked DEFECT below FAIL on this build. They are written to fail first,
   on purpose. They are not flaky and they do not depend on wall-clock timing. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';

/* NO SILENT SKIP. Resolve the driver the way the rest of the suite does and ASSERT, so a missing
   browser is loud instead of letting this whole file vanish from a run that still exits 0. */
const require_=createRequire(import.meta.url);
let chromium_;
for(const id of [process.env.PWA_PLAYWRIGHT,'playwright','playwright-core'])
  if(id){ try{ chromium_=require_(id).chromium; break; }catch{} }
const executablePath=[process.env.PWA_CHROMIUM,process.env.MM_TEST_CHROMIUM,
  '/opt/pw-browsers/chromium','/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

/* Galaxy S23 Ultra in Chrome Android reports 360 CSS px at a device pixel ratio of 3.5. */
const S23={width:360,height:772};

async function open(t){
  assert.ok(chromium_&&executablePath,'local Chromium and a playwright driver are required');
  const browser=await chromium_.launch({executablePath,
    args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync']});
  t.after(()=>browser.close());
  const context=await browser.newContext({serviceWorkers:'block',viewport:S23,
    deviceScaleFactor:3.5,isMobile:true,hasTouch:true});
  /* Everything except this one origin is aborted, so the test cannot reach a provider even by
     accident, and the Google Fonts link in <head> cannot make it network-dependent. */
  await context.route('**/*',r=>r.request().url().startsWith('http://scores-slate.test/')
    ? r.fulfill({status:200,contentType:'text/html',body:html}) : r.abort());
  const page=await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://scores-slate.test/');
  return {page,errors};
}

/* page.waitForFunction treats a returned Promise as truthy, so an async predicate never actually
   waits on this playwright-core. Poll from Node with page.evaluate, which does await. */
async function settle(page,fn,message,timeoutMs=20000){
  const deadline=Date.now()+timeoutMs;
  for(;;){
    if(await page.evaluate(fn)) return;
    if(Date.now()>deadline) throw new Error('timed out: '+message);
    await new Promise(r=>setTimeout(r,100));
  }
}

/* The seeded slate: three days x three competitions x two matches = 18 rows, every one of them a
   row the reader is entitled to see. Yesterday is finished, today and tomorrow are not kicked off,
   so the status chips have something to select on each day. Written as a string because it is
   installed both by evaluate() and by an initScript before a reload. */
const SEED=`(function(){
  var days=[ymdOffset(-1),ymdOffset(0),ymdOffset(1)];
  var comps=[[39,'Premier League'],[140,'La Liga'],[78,'Bundesliga']];
  var list=[],id=1;
  for(var di=0;di<days.length;di++) for(var ci=0;ci<comps.length;ci++) for(var k=0;k<2;k++){
    var d=days[di],lid=comps[ci][0],ln=comps[ci][1],ft=(di===0);
    list.push({fxid:id++,lid:lid,lname:ln,lcountry:'Testland',llogo:'',season:2025,
      date:d,time:'20:00',ldate:d,status:ft?'FT':'NS',elapsed:null,
      home:ln+' H'+k,away:ln+' A'+k,gh:ft?1:null,ga:ft?0:null});
  }
  return {days:days,list:list};
})()`;

/* Helpers injected into the page once per load. */
const HELPERS=`
  window.__seed=function(){
    var s=${SEED};
    afState.scores={at:Date.now(),dataAt:Date.now(),v:SCORES_CACHE_V,source:'cloud',list:s.list};
    afState.filter='all'; afState.scoreFilter='all'; afState.scoresDate=s.days[1];
    window.__days=s.days; window.__all=s.list;
    return s;
  };
  window.__rows=function(){
    return [...document.querySelectorAll('#scoresList .scrow')]
      .map(function(r){return r.querySelector('.fxteams').textContent;});
  };
  window.__headlineCount=function(){
    var m=/·\\s*(\\d+)\\s*matches/.exec(document.getElementById('scoresMeta').textContent);
    return m?+m[1]:null;
  };
  window.__dayRows=function(day){
    return afState.scores.list.filter(function(s){return (s.ldate||localDateOf(s))===day;}).length;
  };`;

test('every match on the chosen day survives moving between dates',{timeout:120000},async t=>{
  const {page,errors}=await open(t);
  const r=await page.evaluate(h=>{
    eval(h); const s=__seed();
    const out={};
    for(const d of s.days){ afState.scoresDate=d; renderScores(); out[d]={rows:__rows().length,expected:__dayRows(d)}; }
    /* back to the first day: the row set must be identical to what it was, not merely the same size */
    afState.scoresDate=s.days[0]; renderScores(); out.firstAgain=__rows();
    afState.scoresDate=s.days[1]; renderScores();
    afState.scoresDate=s.days[0]; renderScores(); out.firstThirdTime=__rows();
    return out;
  },HELPERS);
  for(const d of Object.keys(r).filter(k=>/^\d{4}-/.test(k))){
    assert.equal(r[d].rows,r[d].expected,
      d+': the feed rendered '+r[d].rows+' of the '+r[d].expected+' matches that day holds');
    assert.equal(r[d].rows,6,d+': the seeded slate holds six matches a day');
  }
  assert.deepEqual(r.firstThirdTime,r.firstAgain,'returning to a date gave a different row set');
  assert.deepEqual(errors,[],'page runtime errors');
});

test('narrowing to one competition and choosing All again restores the whole slate',{timeout:120000},async t=>{
  const {page,errors}=await open(t);
  const r=await page.evaluate(h=>{
    eval(h); __seed();
    renderScores(); const full=__rows();
    const steps=[];
    for(const lid of [39,140,78]){
      afState.filter=lid; renderScores(); steps.push({lid,rows:__rows().length});
      afState.filter='all'; renderScores(); steps.push({lid:'all',rows:__rows().length,same:JSON.stringify(__rows())===JSON.stringify(full)});
    }
    /* 'football' is the all-football pseudo-selection and must not narrow a football slate either */
    afState.filter='football'; renderScores(); const footballRows=__rows();
    afState.filter='all'; renderScores();
    return {full:full.length,steps,footballSame:JSON.stringify(footballRows)===JSON.stringify(full)};
  },HELPERS);
  assert.equal(r.full,6,'the day under test holds six matches');
  for(const s of r.steps){
    if(s.lid==='all'){
      assert.equal(s.rows,6,'choosing All competitions left '+s.rows+' of 6 matches on screen');
      assert.equal(s.same,true,'choosing All competitions returned a different row set');
    } else {
      assert.equal(s.rows,2,'competition '+s.lid+' holds two matches that day, rendered '+s.rows);
    }
  }
  assert.equal(r.footballSame,true,'"All football" narrowed an all-football slate');
  assert.deepEqual(errors,[],'page runtime errors');
});

test('the status chips return the whole slate when All is chosen again',{timeout:120000},async t=>{
  const {page,errors}=await open(t);
  const r=await page.evaluate(h=>{
    eval(h); const s=__seed();
    afState.scoresDate=s.days[0];   // the finished day, so Finished and Upcoming both mean something
    renderScores(); const full=__rows();
    const out={full:full.length,steps:[]};
    for(const sf of ['live','ns','ft','all']){
      afState.scoreFilter=sf; renderScores();
      out.steps.push({sf,rows:__rows().length,same:JSON.stringify(__rows())===JSON.stringify(full)});
    }
    /* and the chip the reader has to tap to get back must be present and marked while filtered */
    afState.scoreFilter='live'; renderScores();
    out.allChipPresent=!!document.querySelector('#scoresList .sfchip[data-sf="all"]');
    out.activeChip=(document.querySelector('#scoresList .sfchip.active')||{}).dataset
      ? document.querySelector('#scoresList .sfchip.active').dataset.sf : null;
    afState.scoreFilter='all'; renderScores();
    return out;
  },HELPERS);
  assert.equal(r.full,6);
  const byChip=Object.fromEntries(r.steps.map(s=>[s.sf,s]));
  assert.equal(byChip.ft.rows,6,'every match on the finished day is finished');
  assert.equal(byChip.live.rows,0,'none of the seeded matches is live');
  assert.equal(byChip.ns.rows,0,'none of the matches on the finished day is unplayed');
  assert.equal(byChip.all.rows,6,'All left '+byChip.all.rows+' of 6 matches on screen');
  assert.equal(byChip.all.same,true,'All returned a different row set');
  assert.equal(r.allChipPresent,true,'no All chip to get back to the full slate');
  assert.equal(r.activeChip,'live','the active status chip does not say which filter is on');
  assert.deepEqual(errors,[],'page runtime errors');
});

test('leaving the Scores tab and coming back does not cost a row',{timeout:120000},async t=>{
  const {page,errors}=await open(t);
  const r=await page.evaluate(h=>{
    eval(h); __seed();
    navTo('scores'); renderScores(); const full=__rows();
    const out={full:full.length,visits:[]};
    for(const tab of ['predict','tips','favs','data']){
      navTo(tab);
      navTo('scores'); renderScores();
      out.visits.push({tab,rows:__rows().length,same:JSON.stringify(__rows())===JSON.stringify(full),
                       count:__headlineCount()});
    }
    return out;
  },HELPERS);
  assert.equal(r.full,6);
  for(const v of r.visits){
    assert.equal(v.rows,6,'after visiting '+v.tab+' the Scores feed rendered '+v.rows+' of 6 matches');
    assert.equal(v.same,true,'after visiting '+v.tab+' the row set changed');
    assert.equal(v.count,6,'after visiting '+v.tab+' the header claimed '+v.count+' matches');
  }
  assert.deepEqual(errors,[],'page runtime errors');
});

test('starring a match, visiting Favourites and unstarring it leaves the slate complete',{timeout:120000},async t=>{
  const {page,errors}=await open(t);
  const r=await page.evaluate(h=>{
    eval(h); __seed();
    navTo('scores'); renderScores(); const full=__rows();
    const out={full:full.length};
    document.querySelector('#scoresList .mstar[data-star]').click();
    out.starred=afState.favM.length;
    out.afterStar={rows:__rows().length,same:JSON.stringify(__rows())===JSON.stringify(full)};
    /* the favourites-only view, both of its tabs, then back */
    navTo('favs'); afState.favTab='matches'; renderFavs();
    out.favRows=document.querySelectorAll('#favFeed .favrow').length;
    afState.favTab='leagues'; renderFavs();
    afState.favTab='matches'; renderFavs();
    navTo('scores'); renderScores();
    out.afterFavs={rows:__rows().length,same:JSON.stringify(__rows())===JSON.stringify(full)};
    document.querySelector('#scoresList .mstar[data-star]').click();
    out.unstarred=afState.favM.length;
    out.afterUnstar={rows:__rows().length,same:JSON.stringify(__rows())===JSON.stringify(full)};
    return out;
  },HELPERS);
  assert.equal(r.full,6);
  assert.equal(r.starred,1,'the star did not register');
  assert.equal(r.favRows,1,'the favourites-only feed did not show the starred match');
  assert.equal(r.unstarred,0,'the star did not clear');
  for(const k of ['afterStar','afterFavs','afterUnstar']){
    assert.equal(r[k].rows,6,k+': the Scores feed rendered '+r[k].rows+' of 6 matches');
    assert.equal(r[k].same,true,k+': the row set changed');
  }
  assert.deepEqual(errors,[],'page runtime errors');
});

/* ───────────────────── DEFECT, build 357: the four red cases ─────────────────────
   Each of these fails on this build. Together they are one fault with three mechanisms:
   a retained competition id narrows the Scores feed; the header keeps reporting the UNFILTERED
   count; and the Scores tab offers no control that can set it back to All. */

test('DEFECT: a reload with retained state must not hide part of the slate silently',
 {timeout:120000},async t=>{
  const {page,errors}=await open(t);
  /* Write exactly what saveState() writes, with the competition setting left on one league — the
     state a reader reaches by tapping a competition in Search (index.html:5805) and then reloading.
     footballSource 'custom-csv' is the branch restoreState() accepts without raw provider
     authority, so this needs no credential and no backend.
     RETAINING the setting is deliberate (index.html:21861-21865). What is not acceptable is
     retaining it INVISIBLY: either every match the day holds is on screen, or the view says a
     competition filter is on, gives the full count, and offers a control that clears it. */
  await page.evaluate(h=>{
    eval(h); const s=__seed();
    localStorage.setItem('mm_tab','scores');
    localStorage.setItem('mm_public_state_v1',JSON.stringify({
      footballSource:'custom-csv',personalPartitionVersion:1,
      fb:[{home:'Seed H',away:'Seed A',gh:1,ga:0,date:'2026-01-01'}],bb:[],
      af:{season:2025,leagues:{},leagueOrder:[],activeLeagueId:null,selectedDate:'',
          filter:39,logos:{},
          scores:{at:Date.now(),dataAt:Date.now(),v:SCORES_CACHE_V,source:'cloud',list:s.list}}
    }));
  },HELPERS);
  await page.goto('http://scores-slate.test/?reload');
  await page.evaluate(h=>{eval(h);},HELPERS);
  /* Wait for the boot timer to finish painting rather than sleeping a fixed amount. */
  await settle(page,()=>!!(afState.scores&&afState.scores.list&&afState.scores.list.length)
    && document.getElementById('scoresMeta').textContent!=='Loading matches…',
    'the restored Scores feed never settled');
  const r=await page.evaluate(()=>{
    const day=afState.scoresDate;
    const dayHolds=afState.scores.list.filter(s=>(s.ldate||localDateOf(s))===day).length;
    document.getElementById('segCompsS').click();
    const canClear=!!document.querySelector('#compsDropS .lgitem[data-f="all"]');
    return {tab:curView,restoredFilter:afState.filter,cached:afState.scores.list.length,dayHolds,
      rows:__rows().length,headline:__headlineCount(),
      meta:document.getElementById('scoresMeta').textContent.replace(/\s+/g,' ').trim(),
      chip:document.getElementById('segCompsS').textContent.trim(),canClear};
  });
  assert.equal(r.tab,'scores','the retained tab was not Scores');
  assert.equal(r.cached,18,'the retained slate was not restored');
  assert.equal(r.dayHolds,6,'the retained slate holds six matches on the day shown');
  /* Independent review: the three assertions below sat inside `if(r.rows!==r.dayHolds)` and
     nothing pinned the retained setting to have survived the reload at all. A mutant that
     ignored it outright (`const cf = 'all'`), which both hides a real regression and loses a
     user setting, passed this test untouched. The branch is now required to exist. */
  assert.equal(r.restoredFilter,39,
    'the retained competition setting did not survive the reload, so this test was not'+
    ' exercising a narrowed feed at all');
  assert.ok(r.rows<r.dayHolds,
    'the retained competition setting did not narrow the feed, so the disclosure contract'+
    ' below is untested: rows='+r.rows+' dayHolds='+r.dayHolds);
  if(r.rows!==r.dayHolds){
    const why='after a reload the feed rendered '+r.rows+' of the '+r.dayHolds+
      ' matches the day holds, because the retained competition setting ('+r.restoredFilter+
      ') narrowed Scores. Header: '+JSON.stringify(r.meta)+'. Chip: '+JSON.stringify(r.chip)+'. ';
    assert.doesNotMatch(r.chip,/All competitions/,
      why+'The competition chip claims the feed is unfiltered.');
    assert.ok(new RegExp('\\b'+r.dayHolds+'\\b').test(r.meta),
      why+'The header does not give the '+r.dayHolds+' matches the day actually holds.');
    assert.equal(r.canClear,true,
      why+'And the Scores competition control offers no All competitions item, so the reader '+
      'cannot widen the feed back out from the tab they are on.');
  }
  assert.deepEqual(errors,[],'page runtime errors');
});

test('DEFECT: the match count in the header must equal the rows rendered',{timeout:120000},async t=>{
  const {page,errors}=await open(t);
  const r=await page.evaluate(h=>{
    eval(h); __seed();
    const comp=[],status=[];
    /* The competition setting is the SILENT one: nothing in the Scores view marks it, so the
       header count is the only number the reader has, and it is the unfiltered one. */
    for(const f of ['all',39,140,61]){
      afState.filter=f; afState.scoreFilter='all'; renderScores();
      comp.push({filter:f,headline:__headlineCount(),rows:__rows().length});
    }
    /* The status chips DO mark themselves, so this set is recorded rather than asserted. */
    afState.filter='all';
    for(const sf of ['live','ns','ft']){
      afState.scoreFilter=sf; renderScores();
      status.push({status:sf,headline:__headlineCount(),rows:__rows().length});
    }
    afState.filter='all'; afState.scoreFilter='all'; renderScores();
    return {comp,status};
  },HELPERS);
  console.log('status-chip header counts (recorded, not asserted): '+JSON.stringify(r.status));
  for(const c of r.comp)
    assert.equal(c.headline,c.rows,
      'competition setting '+JSON.stringify(c.filter)+': the header claims '+c.headline+
      ' matches while '+c.rows+' rows are on screen, and nothing in the Scores view says a '+
      'competition filter is on');
  assert.deepEqual(errors,[],'page runtime errors');
});

test('DEFECT: an empty filtered slate must say so instead of rendering nothing',{timeout:120000},async t=>{
  const {page,errors}=await open(t);
  const r=await page.evaluate(h=>{
    eval(h); __seed();
    /* 61 is a competition the slate carries no row for — the shape a stale retained setting takes
       after loadCloudLeagues rebuilds and drops the league the reader had chosen. */
    afState.filter=61; renderScores();
    const box=document.getElementById('scoresList');
    const out={rows:__rows().length,headline:__headlineCount(),
      meta:document.getElementById('scoresMeta').textContent,
      /* text with the four status chips removed: what is LEFT is what explains the emptiness */
      leftover:[...box.children].filter(c=>!c.classList.contains('sfilters'))
        .map(c=>c.textContent.trim()).join(' ').trim()};
    afState.filter='all'; renderScores();
    return out;
  },HELPERS);
  assert.equal(r.rows,0,'control: this competition has no rows on the day shown');
  assert.notEqual(r.leftover,'',
    'the feed rendered nothing but the status chips and said nothing: header reads '+
    JSON.stringify(r.meta)+' while zero rows are on screen');
  assert.match(r.leftover+' '+r.meta,/no matches|filter|competition/i,
    'nothing on screen tells the reader why the feed is empty');
  assert.deepEqual(errors,[],'page runtime errors');
});

test('DEFECT: the Scores competition control must always offer All competitions',{timeout:120000},async t=>{
  const {page,errors}=await open(t);
  const r=await page.evaluate(h=>{
    eval(h); __seed();
    const out={};
    /* (1) opening the control from the Scores tab, which is what a reader does */
    navTo('scores'); renderScores();
    document.getElementById('segCompsS').click();
    out.onOpen={hidden:document.getElementById('compsDropS').classList.contains('hidden'),
                items:[...document.querySelectorAll('#compsDropS .lgitem')].length,
                hasAll:!!document.querySelector('#compsDropS .lgitem[data-f="all"]')};
    /* (2) the public presentation shape: competitions with fixtures but no local match corpus,
           which is every reader who is not carrying raw provider authority */
    afState.leagues={39:{id:39,name:'Premier League',country:'England',upcoming:[{fxid:1,pick:'1'}],
                         matches:[],sport:'football',_presentation:true},
                     140:{id:140,name:'La Liga',country:'Spain',upcoming:[{fxid:2,pick:'1'}],
                          matches:[],sport:'football',_presentation:true}};
    afState.leagueOrder=[39,140]; afState.filter=39;
    buildCompsDrop('compsDropS');
    out.presentation={items:[...document.querySelectorAll('#compsDropS .lgitem')].map(e=>e.dataset.f||'discover'),
                      hasAll:!!document.querySelector('#compsDropS .lgitem[data-f="all"]'),
                      label:compsLabel()};
    /* (3) the chip must not claim the feed is unfiltered while it is filtered */
    afState.leagues={}; afState.leagueOrder=[]; afState.filter=39;
    out.labelWithUnknownLeague=compsLabel();
    afState.filter='all';
    return out;
  },HELPERS);
  assert.equal(r.onOpen.hidden,false,'tapping the Scores competition chip did not open the control');
  assert.equal(r.presentation.hasAll,true,
    'in the public presentation shape the control offers only '+JSON.stringify(r.presentation.items)+
    ' — no way back to All competitions while the feed is filtered to '+r.presentation.label);
  assert.ok(r.onOpen.items>0,
    'tapping the Scores competition chip on a freshly opened Scores tab revealed an EMPTY control: '+
    'renderCompsDrop() is only reached from renderFixtures(), so compsDropS is never built until '+
    'the Predict tab has been visited');
  assert.equal(r.onOpen.hasAll,true,
    'the Scores competition control offers no All competitions item, so a reader on Scores cannot '+
    'widen the feed back out');
  assert.doesNotMatch(r.labelWithUnknownLeague,/All competitions/,
    'the competition chip reads '+JSON.stringify(r.labelWithUnknownLeague)+
    ' while the feed is filtered to competition 39');
  assert.deepEqual(errors,[],'page runtime errors');
});
