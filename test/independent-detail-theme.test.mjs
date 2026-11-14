// Independent rendered theme acceptance. All data is local synthetic test input and all traffic is blocked.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {realTransform} from '../staging/build-real-preview.mjs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PWA_PLAYWRIGHT||'playwright-core');
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8'),manifest=readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8');
for(const [mode,html] of [['source',source],['generated',realTransform(source,manifest).html]])for(const width of [320,390])test(`independent ${mode} ${width}px: light/dark detail remains readable and fits`,async t=>{
 const browser=await chromium.launch({executablePath:process.env.MM_TEST_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({viewport:{width,height:844},serviceWorkers:'block'});await context.route('**/*',r=>r.request().url()==='http://theme-review.test/'?r.fulfill({contentType:'text/html',body:html}):r.abort());
 await context.addInitScript(()=>{localStorage.setItem('mm_intro','1');localStorage.setItem('mm-real-preview:mm_intro','1');});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('http://theme-review.test/');
 await page.evaluate(()=>{
  const stamp='2026-11-13T12:00:00Z',home='Leicester City',away='Brighton & Hove Albion';
  const prediction={home,away,lname:'Premier League',pick:'1D',pick_prob:.807,p_home:.589,p_draw:.2728,p_away:.1382,xg_home:1.7,xg_away:.8,kickoff:'2026-11-14',ktime:'18:00',made_at:stamp,market:'DNB'};
  const analysis={source:'local-approved-test-shape',source_at:stamp,goals:[{label:'Over 2.5',prob:.56}],combos:[{label:'1 & Over 2.5',prob:.34}],htft:[{label:'1/1',prob:.32}],correct_scores:[{label:'2–0',prob:.12}],scorers:[{label:'Verified test player',prob:.38}],form:{home:['W','D','L'],away:['L','W','D']},h2h:[{date:'2026-08-10',home,away,gh:2,ga:1}],standings:{season:2026,rows:[{rank:1,team:home,played:10,gf:17,ga:9,points:20},{rank:8,team:away,played:10,gf:11,ga:14,points:12}]},writeup:{text:'Local synthetic prose tests the existing theme and supporting caption only. No live AI or prediction is generated.',source:'server-cache/openrouter/anthropic/claude-sonnet-4.5:thinking-20261101',source_at:stamp}};
  const card={fxid:990988,lid:39,lname:'Premier League',lcountry:'England',date:'2026-11-14',time:'18:00',status:'NS',home,away,prediction,analysis};
  const f=fixturePresentationRow(card,null),L={id:39,name:card.lname,country:card.lcountry,_presentation:true,matches:[],upcoming:[f]};afState.leagues={39:L};showPublishedFixture(L,f);document.querySelectorAll('#view-detail .acc').forEach(e=>e.classList.add('open'));
 });
 const results=[];
 for(const theme of ['dark','light']){
  const result=await page.evaluate(theme=>{
   setTheme(theme);
   const rgb=s=>(s.match(/[\d.]+/g)||[]).slice(0,3).map(Number),luma=s=>rgb(s).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((n,v,i)=>n+v*[.2126,.7152,.0722][i],0);
   const background=e=>{for(let n=e;n;n=n.parentElement){const c=getComputedStyle(n).backgroundColor;if(c!=='rgba(0, 0, 0, 0)'&&c!=='transparent')return c;}return'rgb(255,255,255)';};
   const contrast=e=>{const a=luma(getComputedStyle(e).color),b=luma(background(e));return(Math.max(a,b)+.05)/(Math.min(a,b)+.05);};
   const fields=[...document.querySelectorAll('#view-detail .subnote,#view-detail .plabel,#view-detail .hm-comp,#view-detail .hm-dt,#view-detail .tname>div:not(.venue),#view-detail #heroDnb,#view-detail #verdictBox,#view-detail .published-meeting span,#view-detail .published-table td')].filter(e=>e.getClientRects().length&&e.textContent.trim());
   const lines=e=>{const range=document.createRange();range.selectNodeContents(e);return new Set([...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>Math.round(r.top))).size;};
   return{theme:document.documentElement.dataset.theme,background:getComputedStyle($('acc-result')).backgroundColor,text:getComputedStyle($('outcomeRows').querySelector('.plabel')).color,contrasts:[...document.querySelectorAll('#view-detail .acc-head .t,#view-detail .plabel,#analysisText')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent,ratio:contrast(e)})),long:fields.filter(e=>lines(e)>2).map(e=>({text:e.textContent,lines:lines(e)})),overflow:document.documentElement.scrollWidth>innerWidth+1,vector:$('outcomeRows').textContent,pick:$('heroPick').textContent,country:$('heroMeta').textContent,sections:document.querySelectorAll('#view-detail .acc:not(.hidden)').length};
  },theme);
  assert.equal(result.theme,theme);assert.equal(result.sections,9);assert.equal(result.overflow,false);assert.deepEqual(result.long,[]);assert.ok(result.contrasts.every(c=>c.ratio>=4.5),JSON.stringify(result.contrasts));assert.match(result.vector,/58.9%/);assert.match(result.country,/Premier League.*England/);
  results.push(result);
  if(process.env.MM_UI_SCREENSHOTS){mkdirSync(process.env.MM_UI_SCREENSHOTS,{recursive:true});await page.screenshot({path:process.env.MM_UI_SCREENSHOTS+`/independent-${mode}-${theme}-${width}.png`,fullPage:true});}
 }
 assert.notEqual(results[0].text,results[1].text);assert.notEqual(results[0].background,results[1].background);assert.deepEqual(errors,[]);
});
