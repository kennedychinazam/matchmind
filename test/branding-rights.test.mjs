/* Synthetic offline Chromium only; every non-document request is intercepted. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let chromium;
for(const id of ['playwright','playwright-core','/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright']){
  try{chromium=require(id).chromium;break;}catch{}
}
const executablePath=[process.env.MM_TEST_CHROMIUM,'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
async function open(t){
  assert.ok(chromium&&executablePath,'local Chromium required');
  const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync']});
  const errors=[],images=[];
  t.after(async()=>{await browser.close();assert.deepEqual(errors,[]);assert.deepEqual(images,[],'no third-party image request attempted');});
  const ctx=await browser.newContext({serviceWorkers:'block'});
  await ctx.route('**/*',r=>{
    if(r.request().url()==='http://branding-rights.test/?branding=1&logos=1') return r.fulfill({status:200,contentType:'text/html',body:source});
    if(r.request().resourceType()==='image'||r.request().url().includes('synthetic-media.invalid')) images.push(r.request().url());
    return r.abort();
  });
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://branding-rights.test/?branding=1&logos=1',{waitUntil:'load'});
  return page;
}
test('cached club and competition images never enter rendered surfaces; raw model inputs survive',async t=>{
  const page=await open(t);
  const result=await page.evaluate(async()=>{
    /* BUILD 357 - `restoreState` no longer admits a raw legacy cache unless raw source access
       is currently granted, which is the point of the bounded presentation contract. The
       authorized collector path is exactly where a cached provider logo could still reach a
       rendered surface, so the grant is taken through the real `fixtureAccess` gate rather
       than by relaxing the fence. */
    cloudEnabled=()=>true;authUser={id:'collector'};
    supa={rpc:async()=>({error:null,data:{version:'matchmind-fixture-access/1',raw_allowed:true,
      expires_at:new Date(Date.now()+60000).toISOString()}}),from:()=>{throw Error('no raw table read in this test');}};
    if(!await fixtureAccess()) throw new Error('synthetic raw grant was refused');
    const home='Synthetic Home',away='Synthetic Away',day=todayStrLocal();
    const media='https://synthetic-media.invalid/';
    const fixture={fxid:990011,date:day,time:'12:00',home,away,pick:'1',pW:.6,pD:.2,pL:.2};
    const score={...fixture,lid:39,lname:'Synthetic League',lcountry:'Synthetic',llogo:media+'competition.png',status:'NS',ldate:day};
    const match={date:'2026-01-01',home,away,gh:2,ga:1};
    const league={id:39,name:'Synthetic League',country:'Synthetic',sport:'football',logo:media+'league.png',flag:'<img src="'+media+'flag.png">',upcoming:[fixture],matches:Array.from({length:16},()=>({...match})),teamIds:{[home]:214,[away]:4716}};
    localStorage.setItem('mm_branding','1');
    localStorage.setItem('mm_state',JSON.stringify({fb:[match],af:{leagues:{39:league},leagueOrder:[39],logos:{[home]:media+'club.png',[away]:media+'away.png'},scores:{at:Date.now(),list:[score]},selectedDate:day,filter:'all'}}));
    if(!restoreState()) throw new Error('synthetic legacy cache did not restore');
    const originalLogos=JSON.stringify(afState.logos);
    $('heroHome').innerHTML=heroSide(home,'Home');$('heroAway').innerHTML=heroSide(away,'Away');
    renderScores();renderSearch('Synthetic');
    // Substitute selection policy only; exercise the real feed/dropdown renderers.
    predictsComp=()=>true;
    visibleLeagues=()=>[afState.leagues[39]];
    renderFixtures();buildCompsDrop('compsDrop');
    const before=JSON.stringify(afState.leagues[39].matches);
    const row=hydrateLeanRow({home_id:214,away_id:4716,lid:39,date:day,home,away,gh:2,ga:1});
    const x=providerExtras(row);
    return {enabled:THIRD_PARTY_BRANDING_ENABLED,images:document.querySelectorAll('img').length,
      rendered:['heroHome','heroAway','scoresList','searchResults','fixtureList','compsDrop'].map(id=>({id,html:$(id)?.innerHTML||''})),
      logoMetadataKept:JSON.stringify(afState.logos)===originalLogos,historyKept:JSON.stringify(afState.leagues[39].matches)===before,
      ids:[x.tid_h,x.tid_a],leagueName:afState.leagues[39].name};
  });
  assert.equal(result.enabled,false);assert.equal(result.images,0);
  assert.equal(result.logoMetadataKept,true);assert.equal(result.historyKept,true);
  assert.deepEqual(result.ids,[214,4716]);assert.equal(result.leagueName,'Synthetic League');
  for(const r of result.rendered){assert.doesNotMatch(r.html,/synthetic-media|<img/i,r.id);}
  assert.match(result.rendered.find(r=>r.id==='heroHome').html,/SY/);
  assert.match(result.rendered.find(r=>r.id==='scoresList').html,/Synthetic League/);
  assert.match(result.rendered.find(r=>r.id==='compsDrop').html,/Synthetic League/);
  assert.match(result.rendered.find(r=>r.id==='fixtureList').html,/Synthetic League/);
  assert.match(result.rendered.find(r=>r.id==='searchResults').html,/Synthetic League/);
  await page.waitForTimeout(75);
});
test('neutral initials are text; share canvas draws no club or competition images',async t=>{
  const page=await open(t);
  const result=await page.evaluate(()=>{
    const sink=document.createElement('div');sink.innerHTML=crest('<img src=x>')+heroSide('<img src=x>','<img src=x>');
    const calls=[];const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(...args){calls.push(args.length);return draw.apply(this,args);};
    const c=renderShareCanvas({home:'Synthetic Home',away:'Synthetic Away',comp:'Synthetic League',pick:'Home win',conf:'60%',date:'3 Nov 2026',logo:'https://synthetic-media.invalid/share.png'});
    return {images:sink.querySelectorAll('img').length,text:sink.textContent,calls,png:c.toDataURL('image/png').startsWith('data:image/png;base64,')};
  });
  assert.equal(result.images,0);assert.match(result.text,/<img src=x>/);
  assert.deepEqual(result.calls,[]);assert.equal(result.png,true);
});
