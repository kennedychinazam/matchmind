/* Read-only synthetic browser fixtures; only the exact intercepted document is allowed.
   No real forecast, signed-in session, provider, DB or paid inference is used. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let chromium;
for(const id of ['playwright','playwright-core','/opt/node-tools/node_modules/playwright/index.js']){
  try{chromium=require(id).chromium;break;}catch{}
}
const executablePath=[process.env.MM_TEST_CHROMIUM,'/opt/pw-browsers/chromium','/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
async function open(t,viewport={width:390,height:844}){
  assert.ok(chromium&&executablePath,'local Chromium required');
  const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking','--disable-component-update','--disable-sync']});
  t.after(()=>browser.close());
  const context=await browser.newContext({viewport,serviceWorkers:'block'});
  await context.route('**/*',r=>r.request().url()==='http://takeover-ui.test/'
    ?r.fulfill({status:200,contentType:'text/html',body:source}):r.abort());
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://takeover-ui.test/',{waitUntil:'load'});
  t.after(()=>assert.deepEqual(errors,[]));
  return page;
}
async function analyzeSynthetic(page){
  return page.evaluate(async()=>{
    footballEngine.load(Array.from({length:48},(_,i)=>({Date:`2026-08-${String(i%24+1).padStart(2,'0')}`,
      HomeTeam:i%2?'Synthetic B':'Synthetic A',AwayTeam:i%2?'Synthetic A':'Synthetic B',FTHG:i%2?0:3,FTAG:i%2?2:1})));
    currentSport='football';refreshTeams();$('homeTeam').value='Synthetic A';$('awayTeam').value='Synthetic B';await analyze();
    return {heading:$('acc-analysis').querySelector('.t').textContent,verdict:$('verdictBox').textContent,text:$('analysisText').textContent};
  });
}
test('built-in analysis is identified as statistical; successful provider retains attribution',async t=>{
  const page=await open(t);
  const local=await analyzeSynthetic(page);
  assert.match(local.heading,/statistical analysis/i);
  assert.match(local.text,/Synthetic A/);
  await page.evaluate(()=>{aiKeys[aiProvider]='synthetic-test-only';runAIWriter=async()=>({text:'Synthetic provider prose.',label:'Synthetic provider',via:'personal'});});
  const provider=await analyzeSynthetic(page);
  assert.match(provider.heading,/Synthetic provider/);
  assert.match(provider.verdict,/Written by Synthetic provider/);
  await page.evaluate(()=>{runAIWriter=async()=>{throw new Error('synthetic AI failure')};});
  const failed=await analyzeSynthetic(page);
  assert.match(failed.heading,/statistical analysis/i);
  assert.match(failed.verdict,/built-in analysis/);
});
test('DNB export carries conditional and outright frozen disclosure while winners remain plain',async t=>{
  const page=await open(t);
  const result=await page.evaluate(()=>{
    const texts=[],original=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,...args){texts.push(text);return original.call(this,text,...args)};
    const shown={pW:.125,pD:.175,pL:.70};
    $('heroConf').textContent='84.8% confidence';setShareCard(true,{home:'Synthetic A',away:'Synthetic B',pick:'Synthetic B (DNB)',conf:'84.8%'});
    setHeroDnb('2D',shown);shown.pL=.01; // later caller mutation must not alter exported snapshot
    renderShareCanvas(shareCtx);const away=[...texts];texts.length=0;
    setHeroDnb('1D',{pW:.70,pD:.175,pL:.125});renderShareCanvas(shareCtx);const home=[...texts];texts.length=0;
    setHeroDnb('1',{pW:.70,pD:.175,pL:.125});renderShareCanvas(shareCtx);const winner=[...texts];
    setShareCard(false,null);$('heroConf').textContent='';setHeroDnb('2D',{pW:.125,pD:.175,pL:.70});
    CanvasRenderingContext2D.prototype.fillText=original;
    return {away,home,winner,withheld:shareCtx,noteHidden:$('heroDnb').classList.contains('hidden')};
  });
  for(const side of ['away','home']){
    assert.match(result[side].join(' '),/excluding draws/);
    assert.match(result[side].join(' '),/70\.0% win.*17\.5% draw, stake returned.*12\.5% loss/);
  }
  assert.ok(result.winner.includes('84.8% confidence'));
  assert.doesNotMatch(result.winner.join(' '),/excluding draws/);
  assert.equal(result.withheld,null);assert.equal(result.noteHidden,true);
});
test('accordion heads focus and toggle by keyboard with expanded state',async t=>{
  const page=await open(t);await analyzeSynthetic(page);
  const head=page.locator('#acc-analysis .acc-head');
  await head.focus();assert.equal(await head.evaluate(e=>document.activeElement===e),true);
  const original=await head.getAttribute('aria-expanded');assert.equal(original,'true');
  await head.press('Enter');assert.equal(await head.getAttribute('aria-expanded'),'false');
  assert.equal(await page.locator('#acc-analysis .acc-body').isVisible(),false);
  await head.press('Space');assert.equal(await head.getAttribute('aria-expanded'),'true');
  assert.equal(await page.locator('#acc-analysis .acc-body').isVisible(),true);
  assert.ok(await head.getAttribute('aria-controls'));
});
test('320px topbar and five tabs fit without page sideways scrolling',async t=>{
  const page=await open(t,{width:320,height:844});
  // CDN fonts are deliberately blocked. Wider fallback metrics must not clip the header.
  for(const font of ['', 'system-ui', 'DejaVu Sans', 'sans-serif']){
    await page.evaluate(font=>document.body.style.fontFamily=font,font);
    for(const theme of ['dark','light']){
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      for(const view of ['scores','predict','tips','favs','data']){
        await page.locator('.nav-btn[data-view="'+view+'"]').click();
        const size=await page.evaluate(()=>{
          const search=$('searchOpen').getBoundingClientRect();
          return {width:innerWidth,scroll:document.documentElement.scrollWidth,search:search.right,
            targetWidth:search.width,targetHeight:search.height,
            brand:document.querySelector('.brand').getBoundingClientRect().right,
            status:$('dataChip').getBoundingClientRect().right};
        });
        assert.ok(size.scroll<=size.width,`${font||'default'}/${theme}/${view}: ${size.scroll}>${size.width}`);
        assert.ok(size.search<=size.width,'Search stays on screen');
        assert.ok(size.targetWidth>=44 && size.targetHeight>=44,'Search retains its 44px target');
        assert.ok(size.brand<=size.width && size.status<=size.width,'Brand and status stay on screen');
      }
    }
    assert.match(await page.locator('.brand').innerText(),/MatchMind.*PRO/s);
    assert.match(await page.locator('#dataChip').innerText(),/Sample data/);
    assert.equal(await page.getByRole('button',{name:'Search',exact:true}).isVisible(),true);
  }
});
test('non-AI fixture transitions clear the preceding provider heading',async t=>{
  const page=await open(t);
  await page.evaluate(()=>{aiKeys[aiProvider]='synthetic-test-only';runAIWriter=async()=>({text:'Synthetic provider prose.',label:'Synthetic provider',via:'personal'});});
  await analyzeSynthetic(page);
  const missing=await page.evaluate(()=>{showNoAnalysis('Synthetic A','Synthetic B');return $('analysisHeading').textContent;});
  assert.doesNotMatch(missing,/Synthetic provider|AI write-up/i);
  await analyzeSynthetic(page);
  const fallback=await page.evaluate(async()=>{
    // Only the provider boundary is replaced. No response, state write or record update follows.
    afAuto=async()=>{throw new Error('synthetic provider unavailable')};
    await apiAnalyze({home:'Synthetic A',away:'Synthetic B',date:'2026-11-02',fxid:991357},{name:'Synthetic cup',matches:[]});
    return $('analysisHeading').textContent;
  });
  assert.match(fallback,/API-Football/);assert.doesNotMatch(fallback,/Synthetic provider|AI write-up/i);
});
test('empty injury data does not claim verified health; reported injuries stay named',async t=>{
  const page=await open(t);await analyzeSynthetic(page);
  const seen=await page.evaluate(()=>{
    const base={sport:'football',home:'Synthetic A',away:'Synthetic B',pred:footballEngine.predict('Synthetic A','Synthetic B'),formH:[],formA:[],h2h:[]};
    return {empty:localAnalysis({...base,injuries:{'Synthetic A':[],'Synthetic B':[]}}),missing:localAnalysis({...base,injuries:null}),
      reported:localAnalysis({...base,injuries:{'Synthetic A':[{name:'Synthetic Player',reason:'synthetic injury'}],'Synthetic B':[]}})};
  });
  assert.doesNotMatch(seen.empty,/clean bill of health/i);
  assert.match(seen.empty,/no injuries reported in the available data/i);
  assert.doesNotMatch(seen.missing,/clean bill of health/i);
  assert.match(seen.reported,/Synthetic Player/);
});
test('programmatic accordion changes synchronize expanded state',async t=>{
  const page=await open(t);await analyzeSynthetic(page);
  const head=page.locator('#acc-analysis .acc-head');
  await page.evaluate(()=>$('acc-analysis').classList.remove('open'));
  await page.waitForFunction(()=>document.querySelector('#acc-analysis .acc-head').getAttribute('aria-expanded')==='false',{},{timeout:1000});
  await page.evaluate(()=>$('acc-analysis').classList.add('open'));
  await page.waitForFunction(()=>document.querySelector('#acc-analysis .acc-head').getAttribute('aria-expanded')==='true',{},{timeout:1000});
  assert.equal(await head.getAttribute('aria-expanded'),'true');
});
test('divergent board confidence cannot export contradictory DNB probabilities',async t=>{
  const page=await open(t);
  const seen=await page.evaluate(()=>{
    _boardRecord={state:'loaded',payload:{v:1,rows:[{f:991357,p:'2D',q:.90}]},at:1};
    const board=heroBoardVerdict(991357,'Synthetic A','Synthetic B',true);
    setShareCard(true,{home:'Synthetic A',away:'Synthetic B',pick:board.label,conf:pct(board.prob)});
    $('heroConf').textContent=pct(board.prob)+' confidence';
    setHeroDnb(board.code,{pW:.125,pD:.175,pL:.70});
    return {context:shareCtx,disabled:$('shareCardBtn').disabled,status:$('shareStatus')?.textContent,
      rowHidden:$('shareRow').classList.contains('hidden'),hero:$('heroConf').textContent};
  });
  assert.equal(seen.context,null);assert.equal(seen.disabled,true);assert.equal(seen.rowHidden,false);
  assert.match(seen.status,/unavailable.*do not match/i);assert.equal(seen.hero,'90.0% confidence');
  const missing=await page.evaluate(()=>{
    setShareCard(true,{home:'Synthetic A',away:'Synthetic B',pick:'Synthetic B (DNB)',conf:'90.0%'});
    setHeroDnb('2D',{pW:.10,pL:.90});
    return {context:shareCtx,disabled:$('shareCardBtn').disabled,status:$('shareStatus').textContent};
  });
  assert.equal(missing.context,null);assert.equal(missing.disabled,true);assert.match(missing.status,/not available/i);
  const recovered=await page.evaluate(()=>{
    setShareCard(true,{home:'Synthetic A',away:'Synthetic B',pick:'Synthetic B WIN',conf:'70.0%'});
    setHeroDnb('2',{pW:.125,pD:.175,pL:.70});
    return {disabled:$('shareCardBtn').disabled,status:$('shareStatus').textContent};
  });
  assert.equal(recovered.disabled,false);assert.equal(recovered.status,'');
});
