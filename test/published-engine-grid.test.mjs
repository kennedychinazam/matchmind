// Build 355 parity: Combos and Correct Score in the published detail are the unchanged engine grid
// (footballEngine.marketsFor) on the published model expected goals. Offline; external traffic aborted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {realTransform} from '../staging/build-real-preview.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PWA_PLAYWRIGHT||'playwright-core');
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const generated=realTransform(source,readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8')).html;
async function open(t,html){
 const browser=await chromium.launch({executablePath:process.env.MM_TEST_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
 await context.route('**/*',r=>r.request().url()==='http://grid.test/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
 await context.addInitScript(()=>{localStorage.setItem('mm_intro','1');localStorage.setItem('mm-real-preview:mm_intro','1');});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));t.after(()=>assert.deepEqual(errors,[]));await page.goto('http://grid.test/');return page;
}
const run=(page,o)=>page.evaluate(({issued,xg})=>{
 const at='2026-11-13T12:00:00Z',analysis={source:'published-board',source_at:at,...(xg?{xg_home:1.8,xg_away:.9}:{}),result:{p_home:.51,p_draw:.29,p_away:.2}};
 const p=issued?{lid:140,lname:'La Liga 2',home:'Leganes',away:'Burgos',pick:'1X',pick_prob:.8,market:'Double Chance',p_home:.6,p_draw:.2,p_away:.2,xg_home:xg?1.7:null,xg_away:xg?.8:null,kickoff:'2026-11-14',ktime:'20:00',made_at:at,withheld_at:null}:null;
 const card={fxid:990998,lid:140,lname:'La Liga 2',lcountry:'Spain',date:'2026-11-14',time:'20:00',status:'NS',home:'Leganes',away:'Burgos',gh:null,ga:null,ft_h:null,ft_a:null,prediction:p,analysis};
 const f=fixturePresentationRow(card,null),L={id:140,name:'La Liga 2',country:'Spain',matches:[],upcoming:[f],_presentation:true};afState.leagues={140:L};
 const before=JSON.stringify(card);let refit=0;const pr=footballEngine.predict;footballEngine.predict=function(){refit++;return pr.apply(this,arguments);};
 showPublishedFixture(L,f);
 const M=footballEngine.marketsFor(p?1.7:1.8,p?.8:.9,null);
 return{combo:$('comboRows').textContent.replace(/\s+/g,''),score:$('scoreRows').textContent.replace(/\s+/g,''),bars:$('outcomeRows').textContent,refit,unchanged:JSON.stringify(card)===before,
  hO25:pct(M.combos.hO25),cs:(p?M.topByPick['1X']:M.topScores).map(s=>s.score+pct(p?s.given:s.p))};
},o);
for(const [mode,html] of [['source',source],['real-preview',generated]]){
 test(`${mode}: issued pick - grid uses issued xG, itemises the issued pick, never alters it`,async t=>{
  const r=await run(await open(t,html),{issued:true,xg:true});
  assert.equal(r.refit,0);assert.ok(r.unchanged);assert.match(r.bars,/60.0%/);
  assert.ok(r.combo.includes('1&Over2.5'+r.hO25));assert.match(r.combo,/Notanissuedpick/);
  for(const s of r.cs)assert.ok(r.score.includes(s),s+" in "+r.score);assert.match(r.score,/sharesouttheissuedpick,unchanged/);
 });
 test(`${mode}: no pick - grid uses board xG and lists likeliest scores`,async t=>{
  const r=await run(await open(t,html),{issued:false,xg:true});
  assert.ok(r.combo.includes(r.hO25));assert.match(r.score,/Likeliestfinalscores/);for(const s of r.cs)assert.ok(r.score.includes(s),s+" in "+r.score);
 });
 test(`${mode}: missing xG - both panels say unavailable for this fixture`,async t=>{
  const r=await run(await open(t,html),{issued:false,xg:false});
  assert.equal(r.combo,'Comboprobabilitiesunavailableforthisfixture.');assert.equal(r.score,'Correct-scoreprobabilitiesunavailableforthisfixture.');
 });
}
