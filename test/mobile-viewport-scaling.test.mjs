/* VIEWPORT, TEXT SCALING AND TOUCH TARGETS at Galaxy S23 Ultra metrics.

   PROOF CLASS: EMULATION. Chromium, driven through playwright-core, at the CSS-pixel metrics a
   Galaxy S23 Ultra reports (360x772 at a device pixel ratio of 3.5 in Chrome Android, and 412x915
   for the wider display-size setting). The installed-PWA case is a real Chromium app window
   (--app=), so `(display-mode: standalone)` genuinely matches — but it is still a desktop Chromium
   on a local origin. It CANNOT establish real Chrome Android font boosting, real Firefox Android
   behaviour, real iOS Safari, the real status/gesture bars, or anything an operator must see.
   Physical acceptance is audits/release-acceptance/DEVICE-ACCEPTANCE-S23-IPHONE.md.

   HOW TEXT SCALING IS EMULATED, AND WHY THAT IS THE RIGHT KNOB. index.html sets no font-size on
   `html` or `body`, so the root font-size is the browser's own, and every type size in the sheet is
   a `rem` or `em` of it (`grep -c 'font-size:[0-9.]*vw' index.html` is 0). Chrome Android's
   Accessibility > Text scaling preference moves exactly that number. Setting
   `document.documentElement.style.fontSize` reproduces it without touching the page's own CSS.
   100% is 16px; 130% is 20.8px, which is inside the range the Android slider offers.

   ACCESSIBILITY IS NOT THE FIX. The last test here pins that: no `maximum-scale`, no
   `user-scalable=no`, no `text-size-adjust:none`. A layout problem may not be solved by taking the
   reader's text size away. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync,mkdtempSync} from 'node:fs';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {createRequire} from 'node:module';

const require_=createRequire(import.meta.url);
let chromium_;
for(const id of [process.env.PWA_PLAYWRIGHT,'playwright','playwright-core'])
  if(id){ try{ chromium_=require_(id).chromium; break; }catch{} }
const executablePath=[process.env.PWA_CHROMIUM,process.env.MM_TEST_CHROMIUM,
  '/opt/pw-browsers/chromium','/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const repo=new URL('../',import.meta.url);
const html=readFileSync(new URL('index.html',repo),'utf8');

/* Galaxy S23 Ultra: 360x772 CSS px at dpr 3.5 on the default display size, 412x915 on the
   smallest. Both are Chrome Android figures. */
const METRICS=[{name:'S23 Ultra (360x772 @3.5)',width:360,height:772,dpr:3.5},
               {name:'S23 Ultra wide (412x915 @3.5)',width:412,height:915,dpr:3.5}];
const SCALES=[{name:'100% text scaling',root:16},{name:'130% text scaling',root:20.8}];

/* One live match-day, so the Scores feed has real rows to measure instead of an empty state.
   Deliberately long club names: a short name hides a clipping defect. */
const SEED_SCORES=`(function(){
  var day=ymdOffset(0);
  var rows=[['Wolverhampton Wanderers','Brighton & Hove Albion',39,'Premier League','England'],
            ['Borussia Moenchengladbach','TSG 1899 Hoffenheim',78,'Bundesliga','Germany'],
            ['Real Sociedad de Futbol','Rayo Vallecano de Madrid',140,'La Liga','Spain']];
  afState.scores={at:Date.now(),dataAt:Date.now(),v:SCORES_CACHE_V,source:'cloud',
    list:rows.map(function(r,i){return {fxid:i+1,lid:r[2],lname:r[3],lcountry:r[4],llogo:'',
      season:2025,date:day,time:'20:00',ldate:day,status:'NS',elapsed:null,
      home:r[0],away:r[1],gh:null,ga:null};})};
  afState.scoresDate=day; afState.filter='all'; afState.scoreFilter='all';
  navTo('scores'); renderScores();
})()`;

/* The page measurement, shared by the browser-mode and standalone-mode runs.
   `.compchip` carries a `::after` with `inset:-11px -8px` that extends its hit area past its own
   box (index.html:180-183), so its BOX height understates its target by 22 px. It is therefore
   hit-tested the way that comment says it must be: walk outward from the centre with
   elementFromPoint until the chip stops answering. Everything else here declares its own 44 px
   box and extends nothing, so a box measurement is the right measurement for it — and is the only
   safe one inside `.datebar`, which is a horizontal scroller (index.html:165) whose off-screen
   tiles are clipped away from elementFromPoint. */
const MEASURE=`(function(){
  var d=document.documentElement;
  function boxes(sel){ return [].slice.call(document.querySelectorAll(sel))
    .filter(function(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0;}); }
  function hit(el){
    var r=el.getBoundingClientRect(), cx=Math.round(r.left+r.width/2), cy=Math.round(r.top+r.height/2);
    function owns(x,y){ var n=document.elementFromPoint(x,y);
      while(n){ if(n===el) return true; n=n.parentElement; } return false; }
    if(!owns(cx,cy)) return null;
    function reach(dx,dy){ var n=0; for(var i=1;i<=80;i++){ if(owns(cx+dx*i,cy+dy*i)) n=i; else break; } return n; }
    return {w:reach(-1,0)+reach(1,0)+1, h:reach(0,-1)+reach(0,1)+1};
  }
  function targets(sel,label,hitTest){ return boxes(sel).map(function(e){
    var r=e.getBoundingClientRect(), h=hitTest?hit(e):null;
    return {what:label,box:{w:Math.round(r.width),h:Math.round(r.height)},
            tap:{w:Math.max(Math.round(r.width),h?h.w:0),h:Math.max(Math.round(r.height),h?h.h:0)},
            hitTested:!!hitTest, hitAnswered:!!h,
            id:e.id||e.dataset.view||e.dataset.sf||(e.textContent||'').trim().slice(0,14)};}); }
  var fs=function(sel){var e=document.querySelector(sel);
    return e?Math.round(parseFloat(getComputedStyle(e).fontSize)*10)/10:null;};
  return {
    innerWidth:innerWidth, innerHeight:innerHeight, dpr:devicePixelRatio,
    rootPx:Math.round(parseFloat(getComputedStyle(d).fontSize)*10)/10,
    standalone:matchMedia('(display-mode: standalone)').matches,
    sideways:d.scrollWidth-d.clientWidth,
    pageHeight:d.scrollHeight,
    navCount:document.querySelectorAll('.nav-btn').length,
    scoreRows:document.querySelectorAll('#scoresList .scrow').length,
    /* the fixed bottom bar must stay inside the viewport and inside the padding the app reserves */
    navBar:(function(){var n=document.querySelector('.nav');if(!n)return null;
      var r=n.getBoundingClientRect();
      return {top:Math.round(r.top),bottom:Math.round(r.bottom),h:Math.round(r.height),
              viewportBottom:Math.round(d.clientHeight)};})(),
    targets:[].concat(
      targets('.nav-btn','bottom navigation tab',false),
      targets('#searchOpen','search button',false),
      targets('#segCompsS','Scores competition chip',true),
      targets('#scoresList .sfchip','Scores status chip',false),
      targets('#scoresDateBar .dnav','Scores date arrow',false)),
    starBox:(function(){var e=document.querySelector('#scoresList .mstar');if(!e)return null;
      var r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height)};})(),
    fonts:{navLabel:fs('.nav-btn'),meta:fs('#scoresMeta'),teamName:fs('#scoresList .tline'),
           statusCell:fs('#scoresList .scstat'),statusChip:fs('#scoresList .sfchip'),
           sectionLabel:fs('#view-scores .sec-label')}
  };
})()`;

function assertUsable(m,where){
  assert.ok(m.sideways<=1,where+': the page scrolls sideways by '+m.sideways+' CSS px');
  assert.equal(m.navCount,5,where+': expected five navigation tabs');
  assert.ok(m.scoreRows>=3,where+': the seeded Scores feed rendered '+m.scoreRows+' rows');
  /* 44 CSS px is this project's own floor (index.html:189, 254, 276, 290 all state it), not
     WCAG 2.5.8's 24: every one of these controls measures 44 or more today, so 44 is the
     regression floor and a drop to 24 would be a silent loss. */
  for(const t of m.targets){
    if(t.hitTested) assert.ok(t.hitAnswered,
      where+': '+t.what+' '+JSON.stringify(t.id)+' does not answer elementFromPoint at its own '+
      'centre, so its real tap target could not be measured');
    assert.ok(t.tap.w>=44&&t.tap.h>=44,
      where+': '+t.what+' '+JSON.stringify(t.id)+' has a '+t.tap.w+'x'+t.tap.h+
      ' CSS px tap target (box '+t.box.w+'x'+t.box.h+'), below the 44px floor');
  }
  /* Readability, as a REGRESSION floor rather than an invented standard. Measured at the browser
     default root of 16px, the smallest type the Scores view puts on screen today is the uppercase
     `.sec-label` at 0.68rem = 10.9 CSS px; the status cell and the navigation labels are 11.2-11.4.
     The floor here is 10.5, which is today's smallest rounded down: it catches a type size being
     cut, which is the regression this check exists for, without asserting a number the project has
     never met. Under text scaling every one of these only grows, which is why the same floor holds
     at 130%. The 10.9px label is noted in the report as a standing readability observation for the
     operator to judge on hardware, not as a defect reproduced here. */
  for(const [k,v] of Object.entries(m.fonts)){
    assert.ok(v!=null,where+': could not measure the '+k+' font size');
    assert.ok(v>=10.5,where+': '+k+' renders at '+v+' CSS px, below the 10.5px regression floor');
  }
  if(m.navBar){
    assert.ok(m.navBar.bottom<=m.navBar.viewportBottom+1,
      where+': the bottom navigation bar ends '+(m.navBar.bottom-m.navBar.viewportBottom)+
      ' CSS px past the bottom of the viewport');
    assert.ok(m.navBar.h>=44,where+': the bottom navigation bar is only '+m.navBar.h+' CSS px tall');
  }
}

test('browser mode at S23 Ultra metrics, at 100% and at 130% text scaling',{timeout:180000},async t=>{
  assert.ok(chromium_&&executablePath,'local Chromium and a playwright driver are required');
  const browser=await chromium_.launch({executablePath,
    args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync']});
  t.after(()=>browser.close());
  const report=[];
  for(const d of METRICS){
    const context=await browser.newContext({serviceWorkers:'block',
      viewport:{width:d.width,height:d.height},deviceScaleFactor:d.dpr,isMobile:true,hasTouch:true});
    await context.route('**/*',r=>r.request().url()==='http://viewport-scaling.test/'
      ? r.fulfill({status:200,contentType:'text/html',body:html}) : r.abort());
    const page=await context.newPage();
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.goto('http://viewport-scaling.test/');
    for(const s of SCALES){
      const m=await page.evaluate(({root,seed,measure})=>{
        document.documentElement.style.fontSize=root+'px';
        eval(seed); return eval(measure);
      },{root:s.root,seed:SEED_SCORES,measure:MEASURE});
      const where='browser, '+d.name+', '+s.name;
      assert.equal(m.standalone,false,where+': this context is not browser display mode');
      assert.equal(m.rootPx,Math.round(s.root*10)/10,where+': the emulated root font-size did not take');
      assertUsable(m,where);
      report.push({mode:'browser',device:d.name,scaling:s.name,viewport:m.innerWidth+'x'+m.innerHeight,
        dpr:m.dpr,rootPx:m.rootPx,sideways:m.sideways,pageHeight:m.pageHeight,
        smallestTap:Math.min(...m.targets.map(x=>Math.min(x.tap.w,x.tap.h))),
        smallestFont:Math.min(...Object.values(m.fonts)),
        favouriteStarBox:m.starBox?m.starBox.w+'x'+m.starBox.h:null});
    }
    assert.deepEqual(errors,[],d.name+': page runtime errors');
    await context.close();
  }
  console.log('EMULATED BROWSER-MODE RENDERING (not physical hardware):');
  for(const r of report) console.log('  '+JSON.stringify(r));
});

test('installed-PWA display mode at S23 Ultra metrics, at 100% and at 130% text scaling',
 {timeout:180000},async t=>{
  assert.ok(chromium_&&executablePath,'local Chromium and a playwright driver are required');
  /* Only a real Chromium app window makes `(display-mode: standalone)` match; CDP's emulated media
     features do not cover display-mode on this build, which was checked rather than assumed. An
     app window needs a real origin, so the shell is served from a local HTTP server and the service
     worker is left unregistered — the worker's own behaviour is already covered by
     test/mobile-pwa-acceptance.test.mjs and test/pwa-lifecycle.test.mjs. */
  const assets={'/':[html,'text/html; charset=utf-8'],'/index.html':[html,'text/html; charset=utf-8'],
    '/manifest.webmanifest':[readFileSync(new URL('manifest.webmanifest',repo),'utf8'),'application/manifest+json']};
  const server=createServer((req,res)=>{
    const a=assets[new URL(req.url,'http://127.0.0.1').pathname];
    if(!a){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':a[1],'Cache-Control':'no-store'});
    res.end(a[0]);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port+'/';
  const report=[];
  for(const d of METRICS){
    const profile=mkdtempSync(tmpdir()+'/mm-pwa-');
    const context=await chromium_.launchPersistentContext(profile,{executablePath,viewport:null,
      args:['--no-sandbox','--disable-background-networking','--disable-component-update',
            '--disable-sync','--app='+origin,'--window-size='+d.width+','+d.height]});
    try{
      /* The app window is opened by the browser itself, so wait for its page rather than creating
         one; polling is from Node because this driver's waitForFunction cannot await a predicate. */
      let page=null;
      for(let i=0;i<100&&!page;i++){
        page=context.pages().find(p=>p.url().startsWith(origin))||null;
        if(!page) await new Promise(r=>setTimeout(r,100));
      }
      assert.ok(page,d.name+': the Chromium app window never opened the shell');
      const errors=[]; page.on('pageerror',e=>errors.push(e.message));
      await page.waitForLoadState('load');
      /* The app window's inner size is whatever the window manager gave it; force the CSS viewport
         to the device metrics so the two modes are compared at the same width. */
      await page.setViewportSize({width:d.width,height:d.height}).catch(()=>{});
      for(const s of SCALES){
        const m=await page.evaluate(({root,seed,measure})=>{
          document.documentElement.style.fontSize=root+'px';
          eval(seed); return eval(measure);
        },{root:s.root,seed:SEED_SCORES,measure:MEASURE});
        const where='standalone, '+d.name+', '+s.name;
        assert.equal(m.standalone,true,where+': (display-mode: standalone) does not match');
        assertUsable(m,where);
        report.push({mode:'standalone',device:d.name,scaling:s.name,
          viewport:m.innerWidth+'x'+m.innerHeight,rootPx:m.rootPx,sideways:m.sideways,
          pageHeight:m.pageHeight,
          smallestTap:Math.min(...m.targets.map(x=>Math.min(x.tap.w,x.tap.h))),
          smallestFont:Math.min(...Object.values(m.fonts))});
      }
      assert.deepEqual(errors,[],d.name+': page runtime errors in the app window');
    } finally { await context.close(); }
  }
  server.close();
  console.log('EMULATED STANDALONE-MODE RENDERING (a Chromium app window, not an installed PWA on hardware):');
  for(const r of report) console.log('  '+JSON.stringify(r));
});

test('nothing in the shell takes the reader\'s text scaling away',{timeout:60000},async t=>{
  const meta=/<meta\s+name="viewport"\s+content="([^"]*)"\s*\/?>/i.exec(html);
  assert.ok(meta,'no viewport meta in index.html');
  assert.equal(meta[1],'width=device-width, initial-scale=1.0',
    'the viewport meta changed: '+JSON.stringify(meta[1]));
  assert.doesNotMatch(meta[1],/maximum-scale/i,'the viewport meta caps the reader\'s zoom');
  assert.doesNotMatch(meta[1],/user-scalable\s*=\s*(no|0)/i,'the viewport meta disables pinch zoom');
  assert.doesNotMatch(html,/text-size-adjust\s*:\s*(none|0)/i,
    'text-size-adjust:none disables the reader\'s text scaling preference');
  /* No viewport-relative type: if any appears, the rem-based scaling emulation above stops being
     the right knob and these tests would silently measure the wrong thing. */
  assert.equal((html.match(/font-size\s*:\s*[0-9.]+v[wh]/g)||[]).length,0,
    'viewport-relative font sizes appeared; the text-scaling emulation here no longer covers them');
});
