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
const runComp=(page,o)=>page.evaluate(({counts,lid})=>{
 const at='2026-11-13T12:00:00Z',home='Leganes',away='Burgos';
 // Build 355's own route to the goals panel: an engine over the competition's matches, DAMPEN registered, rates().
 const matches=Array.from({length:counts},(_,i)=>({date:'2026-0'+(1+i%9)+'-1'+(i%9),home:'H'+i,away:'A'+i,hg:i%4,ag:(i*7)%3}));
 const ref=Object.create(footballEngine);ref.matches=matches;registerLeagueDampen({id:lid,name:'Premier League',matches});
 const R=ref.marketsFor(1.8,.9,ref.rates()),raw=footballEngine.marketsFor(1.8,.9,null);
 const n=matches.length,c={n,btts:0,o15:0,o25:0,o35:0};for(const m of matches){const t=m.hg+m.ag;if(m.hg>0&&m.ag>0)c.btts++;if(t>1.5)c.o15++;if(t>2.5)c.o25++;if(t>3.5)c.o35++;}
 const comp={lid,source:'api-football/competition-60m',source_at:at,from:'2021-11-13',to:'2026-11-13',rates:c,standings:{season:2026,rows:[{rank:1,team:home,played:2,won:2,drawn:0,lost:0,gf:5,ga:1,points:6},{rank:2,team:'Other',played:2,won:1,drawn:0,lost:1,gf:2,ga:2,points:3},{rank:3,team:away,played:2,won:0,drawn:0,lost:2,gf:1,ga:5,points:0}]}};
 publishedCompetitionsAccept({edition_id:'edition-'+lid+'-'+counts,competitions:[comp]});
 const card={fxid:990997,lid,lname:'Premier League',lcountry:'England',date:'2026-11-14',time:'20:00',status:'NS',home,away,gh:null,ga:null,ft_h:null,ft_a:null,prediction:null,analysis:{source:'published-board',source_at:at,xg_home:1.8,xg_away:.9,result:{p_home:.51,p_draw:.29,p_away:.2}}};
 const f=fixturePresentationRow(card,null),L={id:lid,name:'Premier League',country:'England',matches:[],upcoming:[f],_presentation:true};afState.leagues={[lid]:L};
 showPublishedFixture(L,f);
 const tx=id=>$(id).textContent.replace(/\s+/g,'');
 return{goals:tx('goalsRows'),table:tx('standingsBox'),selected:[...document.querySelectorAll('#standingsBox tr.selected')].map(r=>r.children[1].textContent),
  exp:['Over1.5'+pct(R.over[1.5]),'Over2.5'+pct(R.over[2.5]),'Over3.5'+pct(R.over[3.5]),'BTTS'+pct(R.btts)],differs:pct(R.over[2.5])!==pct(raw.over[2.5])||pct(R.btts)!==pct(raw.btts),
  rawExp:['Over2.5'+pct(raw.over[2.5]),'BTTS'+pct(raw.btts)]};
},o);
for(const [mode,html] of [['source',source],['real-preview',generated]]){
 test(`${mode}: goals markets equal 355's damped engine path from the published counts`,async t=>{
  const r=await runComp(await open(t,html),{counts:60,lid:39});
  assert.ok(r.differs,'competition damping changes the line, so the test can tell');for(const e of r.exp)assert.ok(r.goals.includes(e),e+' in '+r.goals);
  assert.match(r.goals,/over60results/);assert.match(r.goals,/Notanissuedpick/);
 });
 test(`${mode}: under 30 results goals are 355's undamped line, and the table keeps 355's caveats`,async t=>{
  const r=await runComp(await open(t,html),{counts:20,lid:39});
  for(const e of r.rawExp)assert.ok(r.goals.includes(e),e+' in '+r.goals);assert.match(r.goals,/fewerthan30results/);
  assert.match(r.table,/pointdeductionsarenotshown/);assert.match(r.table,/Earlydays—3matchesplayed/);assert.match(r.table,/1Leganes2\+46/);assert.match(r.table,/3Burgos2-40/);
  assert.deepEqual(r.selected,['Leganes','Burgos']);
 });
}
test('envelope admits only the closed optional competitions key and remembers it for that edition',async t=>{
 const page=await open(t,source);
 const r=await page.evaluate(()=>{
  const now=Date.now(),card={fxid:5,lid:39,lname:'Premier League',lcountry:'England',date:'2026-11-14',time:'20:00',status:'NS',elapsed:null,home:'Leganes',away:'Burgos',gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:new Date(now-60000).toISOString(),provider:'af',prediction:null};
  const env=x=>({version:'matchmind-display/1',edition_id:'e1',as_of:new Date(now-60000).toISOString(),expires_at:new Date(now+3600000).toISOString(),screen:'scores',cards:[card],board:null,records:{engine:null,clv:null},slips:[],...x});
  const comp={lid:39,source:'api-football/competition-60m',from:'2021-11-13',to:'2026-11-13',rates:{n:40,btts:20,o15:30,o25:20,o35:9}};
  const out={};const tryIt=(k,v)=>{try{fixtureEnvelope(v,'scores');out[k]='ok';}catch(e){out[k]=e.message;}};
  tryIt('without',env({}));tryIt('with',env({competitions:[comp]}));out.remembered=publishedCompetition(39)?.rates?.n;
  tryIt('unknownKey',env({extra:1}));tryIt('unknownField',env({competitions:[{...comp,raw:1}]}));tryIt('inconsistent',env({competitions:[{...comp,rates:{...comp.rates,o35:25}}]}));
  tryIt('duplicate',env({competitions:[comp,comp]}));return out;});
 assert.equal(r.without,'ok');assert.equal(r.with,'ok');assert.equal(r.remembered,40);
 for(const k of ['unknownKey','unknownField','inconsistent','duplicate'])assert.notEqual(r[k],'ok',k);
});
