// Agent 1 — actual deployed staging, Chromium mobile emulation. Never a physical Android claim.
import assert from 'node:assert/strict';
import {createHarness} from './common.mjs';

const profiles=[
 {name:'s23-default',width:360,height:772,dpr:3.5},
 {name:'s23-wide',width:412,height:915,dpr:3.5},
 {name:'responsive-384',width:384,height:844,dpr:3.5},
 {name:'responsive-430',width:430,height:932,dpr:3.5},
];
const scales=[100,130,160,200];
const UA='Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Mobile Safari/537.36';
let failed=false;
async function nav(page,view){await page.locator('.nav-btn[data-view="'+view+'"]').tap();await page.waitForFunction(v=>!document.getElementById('view-'+v).classList.contains('hidden'),view);}
async function layout(page){return page.evaluate(()=>{
 const d=document.documentElement,visible=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
 const nav=[...document.querySelectorAll('.nav-btn')].filter(visible).map(e=>{
  const r=e.getBoundingClientRect(),label=e.querySelector('[data-i18n]');let textOutside=false;
  if(label){const range=document.createRange();range.selectNodeContents(label);textOutside=[...range.getClientRects()].some(t=>t.width>0&&(t.left<r.left-2||t.right>r.right+2||t.bottom>r.bottom+2));}
  const x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
  return{id:e.dataset.view,width:r.width,height:r.height,left:r.left,right:r.right,bottom:r.bottom,textOutside,hit:!!hit&&(hit===e||e.contains(hit))};
 });
 const heads=[...document.querySelectorAll('.topbar .brand,#dataChip,#searchOpen')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return{id:e.id||'brand',left:r.left,right:r.right,top:r.top,bottom:r.bottom};});
 const collisions=[];for(let i=0;i<heads.length;i++)for(let j=i+1;j<heads.length;j++){const a=heads[i],b=heads[j];if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)collisions.push([a.id,b.id]);}
 return{viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},rootPx:parseFloat(getComputedStyle(d).fontSize),horizontalOverflow:d.scrollWidth-d.clientWidth,nav,heads,collisions,activeView:typeof curView==='string'?curView:null,scrollHeight:d.scrollHeight};
});}
function assertLayout(m){
 assert(m.horizontalOverflow<=1,'page has '+m.horizontalOverflow+' CSS px horizontal overflow');
 assert.equal(m.nav.length,5,'all five bottom navigation controls must remain rendered');
 assert.deepEqual(m.collisions,[],'topbar controls overlap');
 for(const n of m.nav){assert(n.width>=44&&n.height>=44,n.id+' target smaller than44 CSS px');assert(n.left>=-1&&n.right<=m.viewport.width+1,n.id+' outside viewport');assert(n.bottom<=m.viewport.height+2,n.id+' below viewport');assert(!n.textOutside,n.id+' label escapes its touch control');assert(n.hit,n.id+' center cannot receive a touch');}
}
async function selectedScores(page){return page.evaluate(()=>({day:afState.scoresDate,filter:afState.filter,status:afState.scoreFilter,list:(afState.scores?.list||[]).map(x=>({fxid:x.fxid,lid:x.lid,home:x.home,away:x.away,status:x.status,day:x.ldate||localDateOf(x)})),rows:[...document.querySelectorAll('#scoresList .scrow')].map(x=>x.querySelector('.fxteams')?.textContent||''),headline:document.getElementById('scoresMeta').textContent}));}
async function functional(h,edition){
 const {page}=h;await nav(page,'scores');
 if(!edition.valid){h.record('Scores completeness, filters and match detail require a live synthetic edition','BLOCKED',{reason:edition.reason,asOf:edition.asOf,expiresAt:edition.expiresAt,observedAt:edition.observedAt});return;}
 await h.check('live synthetic edition is adopted before inspecting missing matches',async()=>{await page.waitForFunction(()=>!!afState.scores&&Array.isArray(afState.scores.list)&&_presentationUntil>Date.now(),null,{timeout:20000});return{asOf:edition.asOf,expiresAt:edition.expiresAt};});
 if(Date.parse(edition.expiresAt)<=Date.now()){h.record('edition expired during preparation; do not diagnose empty slate as a product defect','BLOCKED',{expiresAt:edition.expiresAt});return;}
 const days=await page.evaluate(()=>{const current=afState.scoresDate||ymdOffset(0);return{current,available:[...new Set((afState.scores?.list||[]).map(x=>x.ldate||localDateOf(x)))].sort((a,b)=>Math.abs(Date.parse(a)-Date.parse(current))-Math.abs(Date.parse(b)-Date.parse(current)))};});
 if(!days.available.length){h.record('data-dependent touch/filter checks','BLOCKED',{reason:'current edition contains no score cards'});return;}
 const day=days.available[0],distance=Math.round((Date.parse(day)-Date.parse(days.current))/86400000);
 if(Math.abs(distance)>14){h.record('reachable date for synthetic score cards','BLOCKED',{day,current:days.current,reason:'outside approved finite UI date window'});return;}
 await h.check('date arrows reach the supplied synthetic match day',async()=>{for(let n=0;n<Math.abs(distance);n++)await page.locator('#scoresDateBar '+(distance>0?'.dnNext':'.dnPrev')).tap();const s=await selectedScores(page);assert.equal(s.day,day);return{day,steps:Math.abs(distance)};});
 const snap=await selectedScores(page),base=snap.list.filter(x=>x.day===snap.day);
 await h.check('Scores All contains the complete admitted day, without missing match names',async()=>{
  if(await page.locator('#scoresList [data-sf="all"]').count())await page.locator('#scoresList [data-sf="all"]').tap();
  const s=await selectedScores(page);assert(['all','football',null,undefined].includes(s.filter),'initial day was silently competition-filtered');const missing=base.filter(c=>!s.rows.some(row=>row.includes(c.home)&&row.includes(c.away))).map(c=>c.fxid);assert.equal(s.rows.length,base.length);assert.deepEqual(missing,[]);assert.match(s.headline,new RegExp('·\\s*'+base.length+' matches'));return{day:s.day,expected:base.length,rendered:s.rows.length,missingIds:missing};
 });
 const statusRules={all:()=>true,live:x=>['1H','2H','HT','ET','BT','P','INT','LIVE'].includes(x.status),ns:x=>['NS','TBD'].includes(x.status),ft:x=>['FT','AET','PEN'].includes(x.status)};
 if(base.length)for(const status of ['live','ns','ft','all'])await h.check('Scores '+status+' status filter and return arithmetic',async()=>{await page.locator('#scoresList [data-sf="'+status+'"]').tap();const s=await selectedScores(page),expected=base.filter(statusRules[status]).length;assert.equal(s.rows.length,expected);return{status,expected,rendered:s.rows.length};});
 if(base.length)await h.check('competition menu exposes the competitions actually visible in Scores',async()=>{
  await page.locator('#segCompsS').tap();const ids=await page.locator('#compsDropS [data-f]').evaluateAll(es=>es.map(e=>e.dataset.f));const required=[...new Set(base.map(x=>String(x.lid)))];assert(required.every(id=>ids.includes(id)),'visible Scores competitions missing from selector: '+required.filter(id=>!ids.includes(id)).join(','));
  const id=required[0];await page.locator('#compsDropS [data-f="'+id+'"]').tap();const narrowed=await selectedScores(page);assert.equal(narrowed.rows.length,base.filter(c=>String(c.lid)===id).length);await page.locator('#segCompsS').tap();await page.locator('#compsDropS [data-f="all"]').tap();const restored=await selectedScores(page);assert.equal(restored.rows.length,base.length);return{requiredIds:required,offeredIds:ids};
 });
 // Leave any open filter popup safely, then open an actual visible match through its real row.
 if(await page.locator('#compsDropS:not(.hidden)').count())await page.locator('#segCompsS').tap();
 if(await page.locator('#scoresList .scrow').count()){
  await h.check('touching a genuine score row opens a readable match detail',async()=>{await page.locator('#scoresList .scrow').first().tap();assert(await page.locator('#view-detail').isVisible());assert((await page.locator('#heroPick').textContent()).trim().length>0);assert.doesNotMatch(await page.locator('#heroMeta').textContent(),/null\s*[–-]\s*null|undefined/);return{meta:await page.locator('#heroMeta').textContent(),pick:await page.locator('#heroPick').textContent()};});
  const table=page.locator('#acc-standings');
  if(await table.isVisible())await h.check('league table or its actual limitation is readable and competition-scoped',async()=>{const head=table.locator('.acc-head');if(await head.count())await head.tap();const text=(await page.locator('#standingsBox').textContent()).trim();assert(text.length>0,'visible league table panel is blank');const observed=await page.evaluate(()=>({lid:curDetail?.lid||afState.activeLeagueId,comp:curDetail?.lname||afState.leagues[afState.activeLeagueId]?.name,rows:document.querySelectorAll('#standingsBox .frow').length}));if(+observed.lid!==40)assert(!/Sheffield Wednesday|Leicester|West Brom/.test(text),'another competition was given Championship-specific deductions');return{...observed,text};});
  else h.record('genuine league-table contents and explanatory text','BLOCKED',{reason:'no league-table panel is exposed for this admitted match; no synthetic table was injected'});
  await h.screenshot('actual-match-detail');await nav(page,'scores');
 }
}
async function loginUI(h){const{page}=h;await nav(page,'data');
 if(!await page.locator('#acctPrimary').count()){h.record('login UI and authenticated session','BLOCKED',{reason:'login controls unavailable in current guest/backend state'});return;}
 await h.check('login touch focus and blank submission are handled locally',async()=>{
  const prior=h.report.blocked.filter(x=>/\/auth\//.test(x.path)).length;await page.locator('#acctEmail').tap();assert.equal(await page.evaluate(()=>document.activeElement.id),'acctEmail');await page.locator('#acctEmail').fill('');await page.locator('#acctPass').fill('');await page.locator('#acctPrimary').tap();await page.waitForFunction(()=>/Enter email and password/.test(document.getElementById('toast').textContent));assert.equal(h.report.blocked.filter(x=>/\/auth\//.test(x.path)).length,prior,'blank validation must not attempt Auth');return{scope:'guest form, touch focus and required-field validation only'};
 });
 h.record('successful real login and account synchronization','BLOCKED',{reason:'no owner-provisioned staging account/session or individual hosted-write authority supplied; no authentication request was sent'});
}
for(let index=0;index<profiles.length;index++){
 const profile=profiles[index];let h;
 try{
  h=await createHarness({role:'android-'+profile.name,browserType:'chromium',serviceWorkers:'block',contextOptions:{viewport:{width:profile.width,height:profile.height},screen:{width:profile.width,height:profile.height},deviceScaleFactor:profile.dpr,isMobile:true,hasTouch:true,userAgent:UA,locale:'en-GB',timezoneId:'UTC'}});
  h.report.proofClass='Chromium mobile viewport/touch/UA emulation; root-font accessibility simulation; NOT physical Samsung/Android';h.report.profile=profile;h.report.fontScaleMethod='HTML root font size16/20.8/25.6/32px; not actual Android font boosting or OS settings';
  try{await h.goto();}catch(e){h.record('actual Cloudflare staging origin/build reachable','BLOCKED',{error:String(e.message)});continue;}
  const edition=await h.edition('scores');
  if(index===0){await functional(h,edition);await loginUI(h);}
  for(const view of ['scores','predict','tips','favs','data'])await h.check('touch navigation '+view,async()=>{await nav(h.page,view);return{view};});
  for(const scale of scales){
   await h.page.evaluate(px=>{document.documentElement.style.fontSize=px+'px';},16*scale/100);
   for(const view of ['scores','predict','data'])await h.check(profile.width+'px '+scale+'% text '+view+' layout',async()=>{await nav(h.page,view);await h.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve())));const measured=await layout(h.page);assert.equal(Math.round(measured.rootPx*10),Math.round(16*scale/100*10));assertLayout(measured);return{scalePercent:scale,...measured};});
  }
  await h.page.evaluate(()=>{document.documentElement.style.fontSize='16px';});await nav(h.page,'scores');await h.screenshot('baseline-scores');await nav(h.page,'data');await h.screenshot('baseline-more');
  await h.check('vertical touch scrolling does not displace bottom navigation',async()=>{const session=await h.context.newCDPSession(h.page);await h.page.evaluate(()=>window.scrollTo(0,0));await h.page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>resolve())));const before=await h.page.evaluate(()=>scrollY);await session.send('Input.synthesizeScrollGesture',{x:Math.round(profile.width/2),y:Math.round(profile.height*.65),yDistance:-500,xDistance:0,gestureSourceType:'touch',speed:600});await h.page.waitForTimeout(250);const m=await layout(h.page),after=await h.page.evaluate(()=>scrollY);assertLayout(m);assert(after>before||m.scrollHeight<=profile.height,'scrollable More page did not move after a touch gesture');return{before,after,scrollHeight:m.scrollHeight};});
  await h.check('no uncaught page exception during Android simulation',async()=>{assert.deepEqual(h.report.pageErrors,[]);return{consoleErrors:h.report.consoleErrors};});
 }catch(e){if(h)h.record('Android QA harness completed','FAIL',{error:String(e.stack||e.message)});else{failed=true;console.error('Android browser unavailable:',e.message);}}
 finally{if(h){const report=await h.finish();failed ||= report.counts.FAIL>0;console.log('ANDROID_STAGING_QA '+JSON.stringify({role:report.role,counts:report.counts,browserVersion:report.browserVersion}));}}
}
process.exitCode=failed?1:0;
