/* REGRESSIONS THE INDEPENDENT REVIEW FOUND, AND THE MUTANTS THAT PROVED THE SUITE BLIND TO THEM.
 *
 * PROOF CLASS: EMULATION. Chromium at phone CSS-pixel metrics on a disposable local origin. No
 * provider, no backend, no credential, no physical device. Text scaling is emulated by moving the
 * root font-size, which is what Chrome Android's Accessibility > Text scaling preference moves:
 * index.html sets no font-size on `html` or `body` and uses no viewport-relative type.
 *
 * WHY THESE EXIST. The first pass at the top bar added `min-width:0` to `.brand` and was accepted
 * on a measurement of the page's horizontal scroll, which it did drive to zero. That measurement
 * could not see the real fault. `min-width:0` lets the flex ITEM shrink while its children keep
 * `min-width:auto`, so the wordmark and the PRO badge overflowed the brand's content box to the
 * right, under `#dataChip`, which is opaque and later in the DOM and therefore painted over them.
 * The badge was simply gone, with no scrollbar to reveal it. A mutant that tripled the badge's
 * horizontal padding - massively worsening the occlusion - survived both mobile test files.
 *
 * So: measure OCCLUSION as well as overflow, and measure the Settings row across a real matrix
 * rather than at the two cells that happened to be reported.
 */
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

async function open(t){
  assert.ok(chromium_&&executablePath,'local Chromium and a playwright driver are required');
  const browser=await chromium_.launch({executablePath,
    args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync']});
  t.after(()=>browser.close());
  return browser;
}
async function at(browser,width,root,run,arg){
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width,height:800},
    deviceScaleFactor:2,isMobile:true,hasTouch:true});
  await context.route('**/*',r=>r.request().url()==='http://review-regress.test/'
    ? r.fulfill({status:200,contentType:'text/html',body:html}) : r.abort());
  const page=await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://review-regress.test/');
  await page.evaluate(r=>{ document.documentElement.style.fontSize=r+'px'; void document.body.offsetHeight; },root);
  const out=await page.evaluate(run,arg);
  await context.close();
  return {out,errors};
}

/* Intersection area in BOTH axes, so a box merely sharing a row does not count. */
const OCCLUSION=`(function(){
  var rect=function(s){ var e=document.querySelector(s); return e?e.getBoundingClientRect():null; };
  var area=function(a,b){ if(!a||!b) return 0;
    var x=Math.min(a.right,b.right)-Math.max(a.left,b.left);
    var y=Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top);
    return (x>0&&y>0)?Math.round(x*y):0; };
  var pro=rect('.brand .pro'), brand=rect('.brand');
  var chip=rect('#dataChip'), search=rect('#searchOpen'), right=rect('.topright');
  return {proVsChip:area(pro,chip), proVsSearch:area(pro,search), brandVsRight:area(brand,right),
    proWidth:pro?Math.round(pro.width):0,
    topbar:Math.round(rect('.topbar').height),
    sideways:document.documentElement.scrollWidth-document.documentElement.clientWidth};
})()`;

test('the brand and its badge are never painted under the status chip, at any phone width or text size',
async t=>{
  const browser=await open(t);
  const widths=[320,360,361,375,390,393,412,430,480];
  const roots=[16,19.2,20.8,22.4,24,28.8,32];
  const bad=[];
  for(const w of widths) for(const root of roots){
    const {out,errors}=await at(browser,w,root,OCCLUSION);
    assert.deepEqual(errors,[],`page errors at ${w}px root ${root}px`);
    /* The badge must be a real badge, not a sliver: occlusion used to eat it down to one letter. */
    assert.ok(out.proWidth>0,`the PRO badge has no width at ${w}px root ${root}px`);
    if(out.proVsChip>0||out.proVsSearch>0)
      bad.push(`${w}px root${root}px badge overlapped by `
        +(out.proVsChip>0?`the status chip by ${out.proVsChip}px²`:'')
        +(out.proVsSearch>0?` the search button by ${out.proVsSearch}px²`:''));
    if(out.sideways>1) bad.push(`${w}px root${root}px page scrolls sideways by ${out.sideways}px`);
  }
  assert.deepEqual(bad,[],'the top bar overlaps or overflows:\n  '+bad.join('\n  '));
});

/* The Settings About row: the reported defect was a break INSIDE the version value. Forbidding the
   whole `.sd` from wrapping fixed that and reintroduced page scroll above ~140% scaling, so the
   contract is: the VALUE does not break, the label before it may wrap, and the page never scrolls
   sideways. Measured across a matrix, because the first version of this check looked at two cells. */
const ABOUT=`(function(){
  navTo('data');
  document.getElementById('verLabel').textContent='v0.9 · build '+APP_BUILD;
  void document.body.offsetHeight;
  var rows=[].slice.call(document.querySelectorAll('#view-data .setrow'));
  var row=rows.filter(function(r){return /About/.test(r.textContent);})[0];
  var lines=function(el){ var r=document.createRange(); r.selectNodeContents(el);
    var seen=[], rects=r.getClientRects();
    for(var i=0;i<rects.length;i++){ var top=Math.round(rects[i].top);
      if(rects[i].width>0.5 && seen.indexOf(top)<0) seen.push(top); }
    return seen.length||1; };
  var ver=document.getElementById('verLabel');
  var card=row.closest('.card')||row.parentElement;
  return {verLines:lines(ver), verText:ver.textContent,
    rowOverflow:Math.max(0,Math.round(row.scrollWidth-row.clientWidth)),
    cardOverflow:Math.max(0,Math.round(card.scrollWidth-card.clientWidth)),
    sideways:document.documentElement.scrollWidth-document.documentElement.clientWidth};
})()`;

test('the Settings version value never breaks and never pushes the page sideways',async t=>{
  const browser=await open(t);
  const bad=[];
  for(const w of [320,360,375,390,412]) for(const root of [16,20.8,22.4,24,28.8,32]){
    const {out,errors}=await at(browser,w,root,ABOUT);
    assert.deepEqual(errors,[],`page errors at ${w}px root ${root}px`);
    assert.match(out.verText,/build \d+/,'the version value was not written into the row');
    if(out.verLines!==1)
      bad.push(`${w}px root${root}px the version value "${out.verText}" broke onto ${out.verLines} lines`);
    if(out.sideways>1)
      bad.push(`${w}px root${root}px page scrolls sideways by ${out.sideways}px `
        +`(row overflow ${out.rowOverflow}px, card overflow ${out.cardOverflow}px)`);
  }
  assert.deepEqual(bad,[],'the About row overflows:\n  '+bad.join('\n  '));
});

/* The provenance chip builds three double-quoted attributes per row by concatenation. escapeHtml
   left " and ' alone, so a quote in any non-constant interpoland would close the attribute and let
   more attributes onto the existing button. The public feed had no reachable path, but the guard
   belongs in the escaper rather than in an argument about reachability. */
test('escapeHtml closes the attribute-injection route the status chip opened',async t=>{
  const browser=await open(t);
  const {out,errors}=await at(browser,390,16,`(function(){
    var hostile='" onfocus="window.__pwned=1" x="';
    var escaped=escapeHtml(hostile);
    var probe=document.createElement('div');
    probe.innerHTML='<button type="button" title="'+escaped+'" aria-label="'+escaped+'">x</button>';
    var b=probe.firstChild;
    return {escaped:escaped, quotes:(escaped.match(/"/g)||[]).length,
      attrs:[].slice.call(b.attributes).map(function(a){return a.name;}).sort(),
      titleRoundTrips:b.getAttribute('title')===hostile,
      buttons:(probe.innerHTML.match(/<button/g)||[]).length,
      pwned:typeof window.__pwned!=='undefined'};
  })()`);
  assert.deepEqual(errors,[],'page errors');
  assert.equal(out.quotes,0,'escapeHtml still leaves raw double quotes in: '+out.escaped);
  assert.deepEqual(out.attrs,['aria-label','title','type'],
    'a hostile value added attributes to the chip: '+out.attrs.join(','));
  assert.equal(out.titleRoundTrips,true,'the escaped title does not round-trip to its original text');
  assert.equal(out.buttons,1,'more than one element was produced');
  assert.equal(out.pwned,false,'an injected handler ran');
});

/* The two branches that both answered "Unavailable" said different things about where the row came
   from, and one of them was wrong: a competition whose raw access this device does not hold did not
   come from the results feed. Naming an unestablished source is the defect class the provenance
   work exists to remove, so the states are separate and their sentences must stay distinct. */
test('a row with no raw authority is not described as having come from the results feed',async t=>{
  const browser=await open(t);
  const {out,errors}=await at(browser,390,16,`(function(){
    var codes=Object.keys(PICK_STATUS);
    var stub=PICK_STATUS.nostub, noauth=PICK_STATUS.noauthority;
    return {codes:codes, haveBoth:!!stub&&!!noauth,
      sameLabel:stub&&noauth?stub.label===noauth.label:null,
      stubWhy:stub?stub.why:null, noauthWhy:noauth?noauth.why:null};
  })()`);
  assert.deepEqual(errors,[],'page errors');
  assert.equal(out.haveBoth,true,'the two unavailable states were not separated: '+out.codes.join(','));
  assert.equal(out.sameLabel,true,'both states should still read "Unavailable" on screen');
  assert.match(out.stubWhy,/results feed/,'the stub sentence should name the results feed');
  assert.doesNotMatch(out.noauthWhy,/results feed/,
    'the no-authority sentence still claims the row came from the results feed');
  assert.match(out.noauthWhy,/no current access/i,
    'the no-authority sentence does not say what is actually unknown');
});
