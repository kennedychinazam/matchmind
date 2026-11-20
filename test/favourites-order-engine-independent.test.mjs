// The Favourites order must not depend on the JavaScript engine's sort algorithm.
// renderFavMatches' comparator used to return 1 or -1 for two matches with the same kick-off,
// never 0. That is an inconsistent comparator, and its result is engine-defined: V8 kept the
// starred order, SpiderMonkey permuted it (Firefox CI run 43603832774 opened "Home 23" from the
// row Chromium shows as "Home 24"). Firefox is not installable in every environment, so this test
// runs the SAME render in Chromium under two different, individually correct sort algorithms.
// A consistent comparator gives one order under both; the old one did not.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
import {realTransform} from '../staging/build-real-preview.mjs';
const require=createRequire(import.meta.url),driver=require('playwright-core');
const exe=[process.env.MM_TEST_CHROMIUM,'/opt/pw-browsers/chromium','/usr/bin/chromium'].find(p=>p&&existsSync(p));
const html=realTransform(readFileSync(new URL('../index.html',import.meta.url),'utf8'),readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8')).html;
test('same-kick-off favourites keep their starred order under any correct sort algorithm',async t=>{
 const browser=await driver.chromium.launch({executablePath:exe,args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},timezoneId:'UTC'});
 await context.addInitScript(()=>localStorage.setItem('mm-real-preview:mm_intro','1'));
 await context.route('**/*',r=>new URL(r.request().url()).origin==='http://favorder.test'?r.fulfill({contentType:'text/html',body:html}):r.abort());
 const page=await context.newPage();await page.goto('http://favorder.test/');
 const r=await page.evaluate(()=>{
  const day=new Date(Date.now()+86400000).toISOString().slice(0,10);
  const starred=Array.from({length:48},(_,i)=>({fxid:910000+i,date:day,time:'20:00',home:'Home '+i,away:'Away '+i,lid:null}));
  // one earlier and one later kick-off, starred out of order, so real ordering is still checked
  starred.splice(10,0,{fxid:1,date:day,time:'21:30',home:'Late',away:'L',lid:null});
  starred.push({fxid:2,date:day,time:'12:00',home:'Early',away:'E',lid:null});
  const native=Array.prototype.sort;
  // A textbook top-down merge sort that takes the RIGHT element when cmp(left,right)>0. Correct
  // and stable for any consistent comparator; not what V8 does for this input.
  function mergeSort(cmp){const a=[...this];const go=x=>{if(x.length<2)return x;const m=x.length>>1,l=go(x.slice(0,m)),r=go(x.slice(m)),o=[];let i=0,j=0;
    while(i<l.length&&j<r.length)o.push(cmp(l[i],r[j])>0?r[j++]:l[i++]);return o.concat(l.slice(i),r.slice(j));};
   const s=go(a);for(let i=0;i<s.length;i++)this[i]=s[i];return this;}
  const order=sorter=>{Array.prototype.sort=sorter;try{afState.favM=starred.map(x=>({...x}));afState.favTab='matches';renderFavMatches();
    return [...document.querySelectorAll('#favFeed .favrow .tline:first-child')].map(e=>{const c=e.cloneNode(true);c.querySelectorAll('.crest').forEach(x=>x.remove());return c.textContent.trim();});}finally{Array.prototype.sort=native;}};
  return {v8:order(native),merge:order(mergeSort),want:['Early',...Array.from({length:48},(_,i)=>'Home '+i),'Late']};
 });
 assert.equal(r.v8.length,50);
 assert.deepEqual(r.merge,r.v8,'the Favourites order changes with the sort algorithm, so it differs between browsers');
 assert.deepEqual(r.v8,r.want,'kick-off order first, then the order the matches were starred in');
});
