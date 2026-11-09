/* Source regression for actual staging QA run 42656018990: visible Scores competition 1
   disappeared from its selector because prediction-history admission was applied to Scores.
   Synthetic local-only Chromium; no authentication, provider or backend requests. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require_=createRequire(import.meta.url);
let chromium;
for(const id of [process.env.PWA_PLAYWRIGHT,'playwright-core','playwright'])if(id){try{chromium=require_(id).chromium;break;}catch{}}
const executablePath=[process.env.MM_TEST_CHROMIUM,process.env.PWA_CHROMIUM,'/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('Scores selector uses the displayed day inventory without requiring prediction history',{timeout:60000},async t=>{
  assert.ok(chromium&&executablePath,'Chromium and driver required; no silent skip');
  const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking']});
  t.after(()=>browser.close());
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:360,height:772},isMobile:true,hasTouch:true});
  await context.route('**/*',r=>r.request().url()==='http://scores-inventory.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
  const page=await context.newPage();await page.goto('http://scores-inventory.test/');
  const out=await page.evaluate(()=>{
    const today=ymdOffset(0),tomorrow=ymdOffset(1);
    const fixture=(id,lid,name,date)=>({fxid:id,lid,lname:name,lcountry:'Synthetic Country',ldate:date,date,time:'20:00',status:'NS',home:'QA Home '+id,away:'QA Away '+id,gh:null,ga:null});
    const list=[fixture(1,1,'Synthetic League',today),fixture(2,1,'Synthetic League',today),fixture(3,2,'Scores-only Cup <img src=x onerror=alert(1)>',today),fixture(4,3,'Tomorrow League',tomorrow)];
    afState.scores={list,at:Date.now(),dataAt:Date.now(),v:SCORES_CACHE_V,source:'cloud'};
    afState.leagues={1:{id:1,name:'Synthetic League',country:'Synthetic Country',upcoming:[],matches:[],sport:'football',_presentation:true}};
    afState.leagueOrder=[1];afState.filter='all';afState.scoreFilter='all';afState.scoresDate=today;
    const before=JSON.stringify({scores:afState.scores,leagues:afState.leagues});
    const items=id=>[...document.querySelectorAll('#'+id+' .lgitem[data-f]')].map(e=>({id:e.dataset.f,count:Number(e.lastElementChild.textContent),label:e.textContent}));
    navTo('scores');renderScores();buildCompsDrop('compsDropS');
    const todayItems=items('compsDropS');const injectedElements=document.querySelectorAll('#compsDropS img').length;
    const option=document.querySelector('#compsDropS [data-f="2"]');if(option)option.click();
    const selected={filter:afState.filter,rows:document.querySelectorAll('#scoresList .scrow').length,label:compsLabel()};
    document.querySelector('#compsDropS [data-f="all"]').click();
    const restored=document.querySelectorAll('#scoresList .scrow').length;
    afState.scoresDate=tomorrow;renderScores();buildCompsDrop('compsDropS');const tomorrowItems=items('compsDropS');
    afState.scoresDate=today;buildCompsDrop('compsDrop');const predictionItems=items('compsDrop');
    return {injectedElements,todayItems,tomorrowItems,selected,restored,predictionItems,preserved:before===JSON.stringify({scores:afState.scores,leagues:afState.leagues})};
  });
  assert.deepEqual(out.todayItems.map(x=>[x.id,x.count]),[['all',3],['football',3],['1',2],['2',1]],'admitted Scores competition must remain selectable with no private history');
  assert.equal(out.injectedElements,0,'source names remain literal text');assert.match(out.todayItems.find(x=>x.id==='2').label,/<img/);
  assert.equal(out.selected.filter,2);assert.equal(out.selected.rows,1);assert.match(out.selected.label,/Scores-only Cup/);
  assert.equal(out.restored,3,'All restores exact selected-day slate');
  assert.deepEqual(out.tomorrowItems.map(x=>[x.id,x.count]),[['all',1],['football',1],['3',1]]);
  assert.deepEqual(out.predictionItems.map(x=>x.id),['all'],'prediction history eligibility is unchanged');
  assert.equal(out.preserved,true,'scores and engine source structures are never mutated');
});
