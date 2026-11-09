// Actual Cloudflare staging URL; simulated Linux WebKit iPhones, never physical iOS Safari.
// No account creation/sign-in, provider generation, privileged key or hosted write.
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {devices} from 'playwright';
import {createHarness} from './common.mjs';

const definitions=[
 {role:'iphone-se-webkit',device:'iPhone SE',viewport:{width:375,height:667},dpr:2},
 {role:'iphone-modern-webkit',device:'iPhone 14',viewport:{width:390,height:844},dpr:3},
];
const outcomes=[];
const brief=e=>String(e?.message||e).slice(0,1200);
async function geometry(page){return page.evaluate(()=>{
 const root=document.documentElement,nav=document.querySelector('.bottomnav'),r=nav?.getBoundingClientRect();
 return{width:innerWidth,height:innerHeight,scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,clientHeight:root.clientHeight,scrollY,rootFont:getComputedStyle(root).fontSize,
 visualViewport:visualViewport?{width:visualViewport.width,height:visualViewport.height,offsetTop:visualViewport.offsetTop,offsetLeft:visualViewport.offsetLeft,scale:visualViewport.scale}:null,
 nav:r?{top:r.top,bottom:r.bottom,height:r.height}:null,
 buttons:[...document.querySelectorAll('.nav-btn')].map(n=>{const b=n.getBoundingClientRect();return{view:n.dataset.view,width:b.width,height:b.height};})};
});}
function assertGeometry(g){
 assert.ok(g.scrollWidth<=g.clientWidth+1,`Page horizontal overflow: ${g.scrollWidth-g.clientWidth}px at ${g.width}px`);
 assert.equal(g.buttons.length,5,'five navigation tabs');
 for(const b of g.buttons){assert.ok(b.width>=44&&b.height>=44,`${b.view} touch box ${b.width}x${b.height} below existing project44px floor`);}
 assert.ok(g.nav&&g.nav.bottom<=g.height+1,`fixed navigation must remain within viewport; observed=${JSON.stringify(g)}`);
}
for(const definition of definitions){
 let h;
 try{
  const descriptor=devices[definition.device];assert.ok(descriptor,`Playwright lacks ${definition.device}`);
  const{defaultBrowserType,...profile}=descriptor;
  h=await createHarness({role:definition.role,browserType:'webkit',contextOptions:{...profile,viewport:definition.viewport,deviceScaleFactor:definition.dpr,locale:'en-GB',timezoneId:'Africa/Lagos'},serviceWorkers:'block'});
  h.record('proof class','PASS',{engine:'Playwright WebKit on Linux',deviceProfile:definition.device,viewport:definition.viewport,deviceScaleFactor:definition.dpr,
   limitation:'Browser/device-profile simulation only. Not physical iOS, real Safari, Dynamic Type, hardware touch, safe-area/keyboard/address-bar behavior or an installed PWA.'});
  try{await h.goto();}catch(e){h.record('actual staging navigation','BLOCKED',{error:brief(e),repro:'Open the actual configured HTTPS Cloudflare staging URL; no localhost replay or proxy bypass.'});continue;}
  const page=h.page;
  const edition=await h.edition('scores');
  const expiration=Date.parse(edition.expiresAt||edition.data?.expires_at||'');
  const dataCurrent=()=>edition.valid&&Number.isFinite(expiration)&&Date.now()<expiration;
  h.record('synthetic edition prerequisite',dataCurrent()?'PASS':'BLOCKED',{valid:edition.valid,reason:edition.reason,asOf:edition.asOf,expiresAt:edition.expiresAt,observedAt:edition.observedAt,
   note:'Unavailable or expired synthetic data is not classified as a product missing-match defect.'});
  await h.check('WebKit default phone layout and touch navigation geometry',async()=>{const observed=await geometry(page);assertGeometry(observed);return observed;});
  await page.screenshot({path:resolve(process.env.EVIDENCE_DIR||'qa-evidence',definition.role+'-initial-viewport.png'),fullPage:false});
  h.report.errors??=[];h.report.errors.push({ERROR:'Initial QA run reported eight fixed-navigation failures per profile',ROOT_CAUSE:'Verified harness selector defect: .nav matched no element; actual approved markup uses .bottomnav. No product clipping established by those failures.',EVIDENCE:'Initial CI reports retained separately; index.html:298 defines .bottomnav and index.html:1011 renders that class.',PROPOSED_SOLUTION:'Query the actual .bottomnav element and retain the original viewport/touch-size assertions; record numeric geometry and viewport screenshots.',ALTERNATIVES:'Explicitly inspect nav-button parent element; replacing the selector is smaller and matches approved markup.',IMPACT:'Initial navigation geometry results were false failures cascading into unrelated scenarios. Physical iOS acceptance remains unverified.',VERIFICATION:'Rerun both WebKit profiles against actual staging with non-null nav geometry and unchanged bounds.',STATUS:'Harness correction implemented; actual staging rerun required'});
  await h.screenshot('initial-scores');
  await h.check('all five navigation tabs respond to simulated touch',async()=>{
   for(const view of ['predict','tips','favs','data','scores']){
    await page.locator(`.nav-btn[data-view="${view}"]`).tap();
    assert.equal(await page.locator('#view-'+view).isVisible(),true,`${view} did not become visible`);
    assertGeometry(await geometry(page));
   }
  });
  async function dataCheck(name,fn){
   if(!dataCurrent()){h.record(name,'BLOCKED',{reason:edition.reason||'EXPIRED',expiresAt:edition.expiresAt});return;}
   try{const details=await fn();h.record(name,details?.notExercised?'BLOCKED':'PASS',details||{});}
   catch(e){
    if(!dataCurrent()){h.record(name,'BLOCKED',{reason:'Synthetic edition expired during the case',expiresAt:edition.expiresAt,error:brief(e)});return;}
    let screenshot=null;try{screenshot=await h.screenshot('failure-'+name.replace(/[^a-z0-9]+/gi,'-').slice(0,70));}catch{}
    h.record(name,'FAIL',{error:brief(e),screenshot,repro:'Actual deployed URL, '+definition.device+' viewport; default English, guest, read-only bounded staging edition.'});
   }
  }
  await dataCheck('bounded edition loads into the actual WebKit application',async()=>{
   await page.waitForFunction(()=>typeof afState!=='undefined'&&Object.keys(afState.leagues||{}).length>0,null,{timeout:30000});
   const state=await page.evaluate(()=>({leagues:Object.keys(afState.leagues||{}).length,until:_presentationUntil,asOf:_presentationAsOf}));
   assert.ok(state.leagues>0);assert.ok(state.until>Date.now());return state;
  });
  await dataCheck('Analysis feed renders and can open a genuinely admitted fixture',async()=>{
   await page.locator('.nav-btn[data-view="predict"]').tap();
   const count=await page.locator('#fixtureList .fxrow').count();
   const text=await page.locator('#fixtureList').innerText();
   assert.ok(count>0||/no|nothing|unavailable|not yet|no matches/i.test(text),'Analysis is blank rather than an explicit empty/unavailable state');
   // Only click a genuinely rendered fixture; never seed a replacement match or call openFixture directly.
   const actionable=page.locator('#fixtureList .fxrow.favrow'),actionableCount=await actionable.count();
   if(actionableCount>0){await actionable.first().tap();assert.equal(await page.locator('#view-detail').isVisible(),true);assertGeometry(await geometry(page));await h.screenshot('analysis-detail');}
   else h.record('Analysis match-detail touch prerequisite','BLOCKED',{reason:'No actionable admitted fixture is rendered; static historical rows are not treated as buttons.'});
   return{renderedFixtures:count,actionableFixtures:actionableCount,emptyState:count===0?text.slice(0,300):null};
  });
  await dataCheck('Scores status filters keep rendered count and selected labels truthful',async()=>{
   await page.locator('.nav-btn[data-view="scores"]').tap();
   const available=await page.locator('#scoresList [data-sf]').count();
   if(!available){const text=await page.locator('#scoresMeta').innerText();assert.match(text,/no matches|unavailable|loading/i);return{filterControls:0,state:text};}
   const observed=[];
   for(const status of ['live','ns','ft','all']){
    await page.locator(`#scoresList [data-sf="${status}"]`).tap();
    const selected=await page.locator(`#scoresList [data-sf="${status}"]`).getAttribute('class');assert.match(selected||'',/active/);
    observed.push({filter:status,rows:await page.locator('#scoresList .scrow').count(),meta:await page.locator('#scoresMeta').innerText()});
    assertGeometry(await geometry(page));
   }
   return{observed};
  });
  await dataCheck('WebKit Scores competition menu covers the visible day without losing rows',async()=>{
   await page.locator('.nav-btn[data-view="scores"]').tap();
   const base=await page.evaluate(()=>{const day=afState.scoresDate;return{day,rows:(afState.scores?.list||[]).filter(x=>(x.ldate||localDateOf(x))===day).map(x=>({lid:String(x.lid),fxid:x.fxid}))};});
   if(!base.rows.length)return{notExercised:true,reason:'No supplied rows on the current selected day; no source data injected.'};
   await page.locator('#segCompsS').tap();
   try{
    const offered=await page.locator('#compsDropS [data-f]').evaluateAll(es=>es.map(e=>e.dataset.f));
    const required=[...new Set(base.rows.map(x=>x.lid))];assert.ok(required.every(id=>offered.includes(id)),`Visible Scores competitions absent from menu: ${required.filter(id=>!offered.includes(id)).join(',')}`);
    await page.locator(`#compsDropS [data-f="${required[0]}"]`).tap();
    assert.equal(await page.locator('#scoresList .scrow').count(),base.rows.filter(x=>x.lid===required[0]).length);
    await page.locator('#segCompsS').tap();await page.locator('#compsDropS [data-f="all"]').tap();
    assert.equal(await page.locator('#scoresList .scrow').count(),base.rows.length);
    return{day:base.day,requiredIds:required,offeredIds:offered};
   }finally{if(await page.locator('#compsDropS:not(.hidden)').count())await page.locator('#segCompsS').tap();}
  });
  await dataCheck('match detail exposes League Table or an honest visible availability explanation',async()=>{
   await page.locator('.nav-btn[data-view="scores"]').tap();
   const row=page.locator('#scoresList .scrow.favrow');
   if(!(await row.count()))return{notExercised:true,reason:'No fixture is rendered for the current edition/date; no synthetic substitute injected.'};
   await row.first().tap();assert.equal(await page.locator('#view-detail').isVisible(),true);
   const panel=page.locator('#acc-standings');
   const visible=await panel.isVisible();
   if(visible){await panel.locator('.acc-head').tap();const body=await page.locator('#standingsBox').innerText();assert.ok(body.trim().length>0,'League Table opens blank');assertGeometry(await geometry(page));await h.screenshot('league-table');return{visible:true,tableOrExplanation:body.slice(0,600)};}
   const body=await page.locator('#view-detail').innerText();
   assert.match(body,/\b(?:league table|standings)\b[^\n]*(?:unavailable|not available|not supplied|not published)|(?:unavailable|not available|not supplied|not published)[^\n]*\b(?:league table|standings)\b/i,'The requested League Table is hidden with no visible availability explanation');
   return{visible:false,explicitLimitation:true};
  });
  await h.check('Search dialog opens and closes by simulated touch',async()=>{
   await page.locator('.nav-btn[data-view="scores"]').tap();await page.locator('#searchOpen').tap();
   try{assert.equal(await page.locator('#searchOverlay').isVisible(),true);await page.locator('#searchInput').fill('Synthetic');assertGeometry(await geometry(page));}
   finally{if(await page.locator('#searchOverlay').isVisible())await page.locator('#searchClose').tap();}
   assert.equal(await page.locator('#searchOverlay').isVisible(),false);
  });
  await h.check('login UI protects password and validates empty fields without sending credentials',async()=>{
   await page.locator('.nav-btn[data-view="data"]').tap();
   const email=page.locator('#acctEmail'),password=page.locator('#acctPass');
   assert.equal(await email.isVisible(),true);assert.equal(await password.isVisible(),true);assert.equal(await password.getAttribute('type'),'password');
   await email.fill('');await password.fill('');await page.locator('#acctPrimary').tap();
   assert.match(await page.locator('#toast').textContent(),/enter email and password/i);
   assertGeometry(await geometry(page));await h.screenshot('login-empty-validation');
  });
  await h.check('WebKit vertical scrolling keeps fixed navigation reachable',async()=>{
   await page.locator('.nav-btn[data-view="data"]').tap();
   const scroll=await page.evaluate(async()=>{
    window.scrollTo(0,0);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const before=scrollY,maximum=Math.max(0,document.documentElement.scrollHeight-innerHeight);
    window.scrollTo(0,document.documentElement.scrollHeight);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    return{before,after:scrollY,maximum};
   });
   if(scroll.maximum>1)assert.ok(scroll.after>scroll.before+1,'A genuinely scrollable More page did not scroll');
   assertGeometry(await geometry(page));await h.screenshot('vertical-scroll-bottom');
   await page.evaluate(()=>window.scrollTo(0,0));return scroll;
  });
  h.record('genuine successful login and sync','BLOCKED',{reason:'No test-account credentials supplied; no new account, live credential submission or implicit hosted state write is performed.'});
  await h.check('130 percent browser-root text stress retains navigation and wrapping',async()=>{
   // Explicit CSS root-size stress, not real iOS Dynamic Type or an OS accessibility preference.
   await page.evaluate(()=>{document.documentElement.style.fontSize='20.8px';});
   for(const view of ['scores','data']){await page.locator(`.nav-btn[data-view="${view}"]`).tap();assertGeometry(await geometry(page));}
   await h.screenshot('text-root-130-percent');
   await page.evaluate(()=>{document.documentElement.style.fontSize='';});
  });
  await h.check('WebKit application has no page runtime errors',async()=>{assert.deepEqual(h.report.pageErrors,[]);});
  h.record('physical iOS acceptance','BLOCKED',{required:['Real Safari/iOS on an iPhone SE and a modern notched iPhone','VoiceOver and genuine Dynamic Type','Software keyboard, address-bar/safe-area rotation behavior','Home-screen installation, standalone/offline/update lifecycle and genuine touch/scroll physics'],note:'Linux Playwright WebKit device emulation cannot establish these results.'});
 }catch(e){
  if(h)h.record('iPhone scenario infrastructure or script failure','FAIL',{error:brief(e)});
  else{
   const directory=resolve(process.env.EVIDENCE_DIR||'staging/qa-evidence');mkdirSync(directory,{recursive:true});
   const report={role:definition.role,engine:'WebKit',proofClass:'Simulation only',checks:[{name:'WebKit launch capability',status:'BLOCKED',details:{error:brief(e)}}],errors:[{ERROR:'WebKit/browser harness could not start',ROOT_CAUSE:'Observed launch/import error; no real iOS result inferred',EVIDENCE:brief(e),PROPOSED_SOLUTION:'Install the pinned Playwright WebKit browser and supported Linux dependencies in the CI job',ALTERNATIVES:'Physical iPhone Safari acceptance by an authorized owner; Chromium is not a Safari substitute',IMPACT:'WebKit coverage unavailable',VERIFICATION:'Successful engine launch and actual-URL scenario evidence',STATUS:'BLOCKED'}]};
   writeFileSync(resolve(directory,definition.role+'-report.json'),JSON.stringify(report,null,2)+'\n');outcomes.push(report);
  }
 }finally{if(h){await h.finish();outcomes.push(h.report);}}
}
const failed=outcomes.some(r=>(r.checks||[]).some(c=>c.status==='FAIL'));
console.log(JSON.stringify({browser:'Simulated iPhone WebKit; not physical iOS Safari',profiles:outcomes.map(r=>({role:r.role,pass:r.checks?.filter(c=>c.status==='PASS').length,fail:r.checks?.filter(c=>c.status==='FAIL').length,blocked:r.checks?.filter(c=>c.status==='BLOCKED').length}))}));
process.exitCode=failed?1:0;
