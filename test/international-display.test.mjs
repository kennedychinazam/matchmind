import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let chromium;
for(const path of [process.env.PWA_PLAYWRIGHT,'playwright-core','playwright'])if(path){try{chromium=require(path).chromium;break;}catch{}}
const executablePath=[process.env.PWA_CHROMIUM,process.env.MM_TEST_CHROMIUM,'/usr/bin/chromium','/usr/bin/google-chrome'].find(path=>path&&existsSync(path));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('public Analysis competition menu includes admitted unpriced international fixtures without private history',{timeout:60000},async t=>{
 assert.ok(chromium&&executablePath,'Chromium and Playwright driver required');
 const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:320,height:740},isMobile:true,hasTouch:true});
 await context.route('**/*',r=>r.request().url()==='http://international-display.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
 await context.addInitScript(()=>localStorage.setItem('mm_intro','1'));
 const page=await context.newPage();await page.goto('http://international-display.test/');
 const out=await page.evaluate(()=>{
  const date=todayStrLocal(),fixture={fxid:987654321,date,time:'18:00',home:'Synthetic National A',away:'Synthetic National B',_presentation:true,pick:null};
  afState.leagues={1:{id:1,name:'World Cup',country:'World',sport:'football',matches:[],upcoming:[fixture],_presentation:true},9999:{id:9999,name:'Synthetic Unfitted Domestic',country:'Test',sport:'football',matches:[],upcoming:[{...fixture,fxid:987654322}],_presentation:false}};
  afState.leagueOrder=[1,9999];afState.filter='all';afState.selectedDate=date;
  const before=JSON.stringify(afState.leagues);navTo('predict');buildCompsDrop('compsDrop');
  const items=[...document.querySelectorAll('#compsDrop [data-f]')].map(x=>({id:x.dataset.f,count:Number(x.lastElementChild.textContent)}));
  const option=document.querySelector('#compsDrop [data-f="1"]');if(option)option.click();
  return {items,filter:afState.filter,rows:[...document.querySelectorAll('#fixtureList .fxrow')].map(x=>x.textContent),preserved:JSON.stringify(afState.leagues)===before};
 });
 assert.deepEqual(out.items,[{id:'all',count:1},{id:'football',count:1},{id:'1',count:1}]);
 assert.equal(out.filter,1);assert.equal(out.rows.length,1);assert.match(out.rows[0],/Synthetic National A/);assert.equal(out.preserved,true);
});
