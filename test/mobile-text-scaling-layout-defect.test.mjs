/* TWO LAYOUT DEFECTS THAT A PHONE SHOWS AND A DESKTOP DOES NOT. Both tests FAIL on build 357 and
   are written to fail first.

   PROOF CLASS: EMULATION. Chromium at phone CSS-pixel metrics on a disposable local origin. No
   provider, no backend, no credential, no physical device. Text scaling is emulated by moving the
   root font-size, which is exactly what Chrome Android's Accessibility > Text scaling preference
   moves: index.html sets no font-size on `html` or `body` and uses no viewport-relative type, so
   every size in the sheet is a rem or em of the browser's own root. The reasoning is set out at
   the top of test/mobile-viewport-scaling.test.mjs.

   DEFECT 1 - the Settings "About" row wraps its own version string.
   `.setrow` is a two-column flex row (index.html:374) whose left column carries `min-width:0`
   (index.html:387) and whose right column is an ordinary shrinkable flex item. Neither column
   declares `white-space` and the row cannot wrap. At 360 CSS px the row's content box is 298 px,
   while "MatchMind PRO - v0.9 - build 355" wants 183 px and "Statistical football forecasts"
   wants 151 px: 183 + 151 + 32 (icon) + 21 (gaps) = 387 px. They cannot both fit, so BOTH wrap -
   at the DEFAULT text size, with no accessibility setting involved - and the version string breaks
   mid-value, which is what the Director photographed ("...v0.9 - build" / "355"). Raising text
   scaling makes it three lines.

   DEFECT 2 - above 360 CSS px the top bar has no wrap rescue, so text scaling pushes the page
   sideways. The only media query in the entire sheet is `@media(max-width:360px)` (index.html:292),
   which gives `.topbar` `flex-wrap:wrap`. `.brand` is a flex item with no `min-width:0`, so its
   automatic minimum size is its min-content width and it cannot shrink below it. At 361-393 CSS px
   there is no wrap and no shrink, so the bar overflows the viewport and the whole page gains
   horizontal scroll. This is also the mechanism behind "Chrome used more vertical space than
   Firefox" on one phone: at 360 px (Chrome Android on an S23 Ultra) the query applies and the top
   bar is 106 px tall; at 412 px (the wider display-size setting, and what other browsers report on
   the same handset) it does not and the bar is 72 px. Nothing in the source is conditional on the
   browser or on display-mode - there is no text-size-adjust rule, no safe-area inset and no
   `@media (display-mode: standalone)` anywhere - so the whole browser-to-browser difference is
   this width-fragility being revealed by each browser's own defaults. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';

const require_=createRequire(import.meta.url);
let chromium_;
for(const id of [process.env.PWA_PLAYWRIGHT,'playwright','playwright-core'])
  if(id){ try{ chromium_=require_(id).chromium; break; }catch{} }
const executablePath=[process.env.PWA_CHROMIUM,process.env.MM_TEST_CHROMIUM,
  '/opt/pw-browsers/chromium','/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

async function open(t,width,height){
  assert.ok(chromium_&&executablePath,'local Chromium and a playwright driver are required');
  const browser=await chromium_.launch({executablePath,
    args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync']});
  t.after(()=>browser.close());
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height},
    deviceScaleFactor:3.5,isMobile:true,hasTouch:true});
  await context.route('**/*',r=>r.request().url()==='http://layout-defect.test/'
    ? r.fulfill({status:200,contentType:'text/html',body:html}) : r.abort());
  const page=await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://layout-defect.test/');
  return {browser,page,errors};
}

/* Lines, not pixels: height divided by the element's own computed line-height. A one-line string
   measures 1.0; the mid-value break the Director photographed measures 2.0. */
const MEASURE_ABOUT=`(function(){
  navTo('data');
  /* the build number the shipped page writes into this row at boot (index.html:24143) */
  document.getElementById('verLabel').textContent='v0.9 · build '+APP_BUILD;
  var row=[].slice.call(document.querySelectorAll('#view-data .setrow'))
    .filter(function(r){return /About/.test(r.textContent);})[0];
  var sd=row.querySelector('.sd'), desc=row.querySelector(':scope > span.muted');
  /* Count LINE BOXES, not pixels. Dividing height by computed line-height is wrong here:
     line-height is 'normal' on these elements, so it parses to NaN and the 1.2em fallback is not
     the real line box. A Range over the element's contents gives one client rect per line fragment,
     and all the fragments on a visual line share a top edge - so the number of distinct tops IS the
     number of lines, exactly, whatever the font metrics are. */
  function lines(el){ var range=document.createRange(); range.selectNodeContents(el);
    var tops={},n=0,rects=range.getClientRects();
    for(var i=0;i<rects.length;i++){ if(rects[i].width===0&&rects[i].height===0) continue;
      var key=Math.round(rects[i].top); if(!(key in tops)){tops[key]=1;n++;} }
    range.detach&&range.detach();
    return n; }
  function intrinsic(el){ var o=el.getAttribute('style')||'';
    el.style.whiteSpace='nowrap'; el.style.width='max-content';
    var w=Math.ceil(el.getBoundingClientRect().width);
    el.setAttribute('style',o); return w; }
  var d=document.documentElement;
  return {rootPx:Math.round(parseFloat(getComputedStyle(d).fontSize)*10)/10,
    rowWidth:Math.round(row.getBoundingClientRect().width),
    rowHeight:Math.round(row.getBoundingClientRect().height),
    version:{text:sd.textContent,lines:lines(sd),
             width:Math.round(sd.getBoundingClientRect().width),intrinsic:intrinsic(sd)},
    tagline:{text:desc.textContent,lines:lines(desc),
             width:Math.round(desc.getBoundingClientRect().width),intrinsic:intrinsic(desc)},
    sideways:d.scrollWidth-d.clientWidth};
})()`;

test('DEFECT: the Settings About metadata must not wrap at S23 Ultra metrics',{timeout:120000},
 async t=>{
  const {page,errors}=await open(t,360,772);
  const seen=[];
  for(const root of [16,20.8]){
    seen.push(await page.evaluate(({root,measure})=>{
      document.documentElement.style.fontSize=root+'px'; return eval(measure);
    },{root,measure:MEASURE_ABOUT}));
  }
  for(const m of seen) console.log('About row at root '+m.rootPx+'px: '+JSON.stringify(m));
  for(const m of seen)
    /* Recorded, not asserted: this is the arithmetic that makes the wrap inevitable while both
       strings share one line, and it stops being true once either is given a line of its own. */
    console.log('  root '+m.rootPx+'px: row '+m.rowWidth+' CSS px wide, version wants '+
      m.version.intrinsic+' px, tagline wants '+m.tagline.intrinsic+
      ' px, plus a 32 px icon and 21 px of gaps = '+
      (m.version.intrinsic+m.tagline.intrinsic+53)+' px on one line');
  for(const m of seen){
    assert.equal(m.version.lines,1,
      'at root '+m.rootPx+'px the version string '+JSON.stringify(m.version.text)+
      ' wraps onto '+m.version.lines+' lines in '+m.version.width+' CSS px, so the build number '+
      'breaks away from the word "build"');
    assert.equal(m.tagline.lines,1,
      'at root '+m.rootPx+'px the tagline '+JSON.stringify(m.tagline.text)+' wraps onto '+
      m.tagline.lines+' lines');
    assert.ok(m.sideways<=1,
      'at root '+m.rootPx+'px the Settings view scrolls sideways by '+m.sideways+' CSS px');
  }
  assert.deepEqual(errors,[],'page runtime errors');
});

test('DEFECT: text scaling must not push the page sideways above the 360px breakpoint',
 {timeout:180000},async t=>{
  /* 375, 390 and 393 CSS px are iPhone SE/13 mini, iPhone 14/15 and Pixel 8 widths: all above the
     one media query in the sheet and all inside the band it leaves unrescued. 360 and 412 are the
     two S23 Ultra figures and are expected to pass today — they are measured here as the control,
     so a failure cannot be read as "the harness overflows everywhere". */
  const results=[];
  for(const width of [360,375,390,393,412]){
    const {page,errors,browser}=await open(t,width,844);
    for(const root of [16,19.2,20.8,22.4]){
      results.push(await page.evaluate(({root,width})=>{
        document.documentElement.style.fontSize=root+'px';
        navTo('scores');
        const d=document.documentElement, sideways=d.scrollWidth-d.clientWidth;
        let worst=null;
        if(sideways>0){
          for(const el of document.querySelectorAll('.topbar, .topbar *, .nav, .nav *, #view-scores *')){
            const r=el.getBoundingClientRect();
            if(r.width>0&&r.right>d.clientWidth+0.5&&(!worst||r.right>worst.right))
              worst={tag:el.tagName,cls:String(el.className||'').slice(0,30),
                     right:Math.round(r.right),width:Math.round(r.width)};
          }
        }
        return {width,root,sideways,
          topbarHeight:Math.round(document.querySelector('.topbar').getBoundingClientRect().height),
          worst};
      },{root,width}));
    }
    assert.deepEqual(errors,[],width+'px: page runtime errors');
    await browser.close();
  }
  for(const r of results) console.log('  '+JSON.stringify(r));
  /* Recorded so the browser-to-browser difference in the Director's report is in the evidence:
     the same page, the same text size, 34 CSS px taller at 360 than at 412. */
  const at=(w,root)=>results.find(r=>r.width===w&&r.root===root);
  console.log('top bar height, same page and same text size: 360px -> '+at(360,16).topbarHeight+
    ' CSS px, 412px -> '+at(412,16).topbarHeight+' CSS px');
  for(const r of results)
    assert.ok(r.sideways<=1,
      'at '+r.width+' CSS px with the root font-size at '+r.root+'px the page scrolls sideways by '+
      r.sideways+' CSS px'+(r.worst?', widest overflowing box: '+JSON.stringify(r.worst):''));
});
