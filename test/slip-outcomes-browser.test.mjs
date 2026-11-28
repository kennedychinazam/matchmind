// Real full-app Chrome rendering, actual board candidate/price paths, invented fixtures only.
import test from'node:test';import assert from'node:assert/strict';import{readFileSync,existsSync}from'node:fs';import{createRequire}from'node:module';
const{chromium}=createRequire(import.meta.url)('playwright-core');
async function open(t,width=390){
 const executablePath=process.env.MM_TEST_CHROMIUM;assert.ok(executablePath&&existsSync(executablePath));const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:844},timezoneId:'UTC'});context.setDefaultTimeout(5000);await context.addInitScript(()=>localStorage.setItem('mm_intro','1'));
 const html=readFileSync(process.env.MM_SLIP_OUTCOMES_HTML||new URL('../index.html',import.meta.url),'utf8');await context.route('**/*',r=>r.request().url()==='http://slip-outcomes.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());const p=await context.newPage();await p.goto('http://slip-outcomes.test/');return p;
}
async function render(p,{mixed=false,missingDraw=false,missingPrice=false,ordinary=false}={}){
 return p.evaluate(({mixed,missingDraw,missingPrice,ordinary})=>{
  supa=null;const date=new Date(Date.now()+86400000).toISOString().slice(0,10);
  const fixtures=[0,1].map(i=>({fxid:990101+i,date,time:'20:00',home:'Synthetic Home '+(i+1),away:'Synthetic Away '+(i+1),pick:ordinary||mixed&&i===1?'1':'1D',prob:.75,_displayCard:true}));
  const rows=fixtures.map((f,i)=>({f:f.fxid,l:39,p:ordinary||mixed&&i===1?'1':i===0?'1D':'2D',q:ordinary||mixed&&i===1?.8:.75,m:ordinary||mixed&&i===1?'Winner':'Draw No Bet',g:null,pd:missingDraw?null:.2}));
  afState.leagues={39:{id:39,name:'Synthetic League',country:'Synthetic',sport:'football',_presentation:true,matches:[],upcoming:fixtures}};afState.leagueOrder=[39];
  _boardRecord={state:'loaded',payload:{v:1,rows},at:Date.now()};_boardIx=null;
  _dailyOdds.loaded=true;_dailyOdds.byFx={990101:{dnbh:1.8,dnba:2,h:1.8,d:3.2,a:4},990102:{dnbh:2,dnba:1.6,h:1.6,d:3.2,a:4}};if(missingPrice)delete _dailyOdds.byFx[990102];
  slipState.today=false;slipState.leagues=null;slipState.markets=new Set(['DNB','1X2']);slipState.riskPct=30;slipState.n=2;slipState.targetOdds=null;
  tipState.tab='slip';navTo('tips');renderTips();
  const before=JSON.stringify({board:_boardRecord.payload,archive:afState.archive,fixtures:afState.leagues[39].upcoming});localStorage.setItem('mm_personal_v1:owner:sentinel','invented retained personal bytes');
  genSlip();return{before,after:JSON.stringify({board:_boardRecord.payload,archive:afState.archive,fixtures:afState.leagues[39].upcoming}),text:$('slipOut').innerText};
 },{mixed,missingDraw,missingPrice,ordinary});
}
const shot=async(p,name)=>{await p.waitForFunction(()=>!document.getElementById('toast').classList.contains('show'));return p.screenshot({path:new URL('../../mm10-evidence/'+name,import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')});};
function outcomes(text,values){for(const[label,value]of Object.entries(values))assert.match(text,new RegExp(label+'\\s+'+value+'(?:\\.0)?%','i'),label+' matches independent enumeration');}
for(const width of[320,390])test(width+'px actual DNB slip shows disjoint probabilities and preserves issued inputs',async t=>{
 const p=await open(t,width),r=await render(p);assert.equal(r.after,r.before);outcomes(r.text,{'Full win':36,'Reduced return':24,'Stake back':4,'Lose':36});assert.doesNotMatch(r.text,/56\.3%|44% chance|Every leg must win/);assert.match(r.text,/independent matches/i);assert.match(r.text,/Max\s*\$10\s*return\s*\$28\.80/i);
 await p.locator('#slipOut').scrollIntoViewIfNeeded();assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await shot(p,'dnb-outcomes-'+width+'.png');
 await p.getByRole('button',{name:'Why?',exact:true}).click();const why=await p.locator('#slipWhyBox').innerText();assert.match(why,/gross return/i);assert.match(why,/14\.85/);assert.match(why,/no losing leg/i);assert.equal(await p.evaluate(()=>localStorage.getItem('mm_personal_v1:owner:sentinel')),'invented retained personal bytes');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await shot(p,'dnb-why-'+width+'.png');
});
test('actual mixed DNB and ordinary slip uses the unconditional full-win event',async t=>{
 const p=await open(t),r=await render(p,{mixed:true});outcomes(r.text,{'Full win':48,'Reduced return':16,'Stake back':0,'Lose':36});assert.equal(r.after,r.before);assert.doesNotMatch(r.text,/To land\s+60/);
});
test('missing draw probability has no fabricated DNB odds of winning or losing',async t=>{
 const p=await open(t),r=await render(p,{missingDraw:true});assert.match(r.text,/probability unavailable/i);assert.doesNotMatch(r.text,/Full win\s+56\.3|44% chance|Every leg must win/);await p.getByRole('button',{name:'Why?',exact:true}).click();assert.doesNotMatch(await p.locator('#slipWhyBox').innerText(),/gross return\s*\$\d|Average outcome\s*\$\d/i);assert.equal(r.after,r.before);await p.locator('#slipOut').scrollIntoViewIfNeeded();await shot(p,'dnb-missing-probability-390.png');
});
test('partial bookmaker prices cannot produce aggregate or expected money figures',async t=>{
 const p=await open(t),r=await render(p,{missingPrice:true});assert.match(r.text,/not all priced|No price shown/i);assert.doesNotMatch(r.text,/\$\d+\.\d\d/);await p.getByRole('button',{name:'Why?',exact:true}).click();assert.doesNotMatch(await p.locator('#slipWhyBox').innerText(),/\$\d+\.\d\d/);assert.equal(r.after,r.before);
});
test('ordinary slip preserves the product probability and complement',async t=>{
 const p=await open(t),r=await render(p,{ordinary:true});assert.match(r.text,/(?:Full win|To land)\s+64(?:\.0)?%/i);assert.match(r.text,/36(?:\.0)?%/);assert.equal(r.after,r.before);
});
