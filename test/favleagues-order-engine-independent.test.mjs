// TEST ONLY: synthetic fixtures. The "Competitions & teams" Favourites feed (renderFavLeagues)
// must list same-kick-off matches in one order whatever the engine's sort algorithm. Its
// comparator answered `ka<kb?-1:1`, never 0, so ties were engine-defined (same defect as 2251823).
// It also slices to 40 rows, so the tie order decided WHICH matches were shown at all.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {realTransform} from '../staging/build-real-preview.mjs';
const require=createRequire(import.meta.url),driver=require('playwright-core');
const exe=[process.env.MM_TEST_CHROMIUM,'/opt/pw-browsers/chromium','/usr/bin/chromium'].find(p=>p&&existsSync(p));
const html=realTransform(readFileSync(new URL('../index.html',import.meta.url),'utf8'),readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8')).html;
test('same-kick-off favourite-competition matches keep feed order under any correct sort algorithm',async t=>{
 const browser=await driver.chromium.launch({executablePath:exe,args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},timezoneId:'UTC'});
 await context.addInitScript(()=>localStorage.setItem('mm-real-preview:mm_intro','1'));
 await context.route('**/*',r=>new URL(r.request().url()).origin==='http://favlg.test'?r.fulfill({contentType:'text/html',body:html}):r.abort());
 const page=await context.newPage();await page.goto('http://favlg.test/');
 const r=await page.evaluate(()=>{
  const day=new Date(Date.now()+86400000).toISOString().slice(0,10);
  const up=Array.from({length:30},(_,i)=>({fxid:920000+i,date:day,time:'20:00',home:'TEST Home '+i,away:'TEST Away '+i}));
  up.splice(7,0,{fxid:3,date:day,time:'21:30',home:'TEST Late',away:'L'});
  up.push({fxid:4,date:day,time:'12:00',home:'TEST Early',away:'E'});
  const native=Array.prototype.sort;
  function mergeSort(cmp){const a=[...this];const go=x=>{if(x.length<2)return x;const m=x.length>>1,l=go(x.slice(0,m)),r=go(x.slice(m)),o=[];let i=0,j=0;
    while(i<l.length&&j<r.length)o.push(cmp(l[i],r[j])>0?r[j++]:l[i++]);return o.concat(l.slice(i),r.slice(j));};
   const s=go(a);for(let i=0;i<s.length;i++)this[i]=s[i];return this;}
  const order=sorter=>{const saved={leagues:afState.leagues,order:afState.leagueOrder,favL:afState.favL,favT:afState.favT};
   Array.prototype.sort=sorter;try{afState.leagues={990001:{id:990001,name:'TEST League',upcoming:up.map(x=>({...x})),matches:[]}};
    afState.leagueOrder=[990001];afState.favL=[990001];afState.favT=[];renderFavLeagues();
    return [...document.querySelectorAll('#favLeagueFeed .favrow .tline:first-child')].map(e=>{const c=e.cloneNode(true);c.querySelectorAll('.crest').forEach(x=>x.remove());return c.textContent.trim();});}
   finally{Array.prototype.sort=native;Object.assign(afState,{leagues:saved.leagues,leagueOrder:saved.order,favL:saved.favL,favT:saved.favT});}};
  return {v8:order(native),merge:order(mergeSort),want:['TEST Early',...Array.from({length:30},(_,i)=>'TEST Home '+i),'TEST Late']};
 });
 assert.equal(r.v8.length,32);
 assert.deepEqual(r.merge,r.v8,'the feed order changes with the sort algorithm, so it differs between browsers');
 assert.deepEqual(r.v8,r.want,'kick-off order first, then provider order');
});
