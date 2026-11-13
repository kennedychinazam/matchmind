// Read-only hosted acceptance; fixed staging RPCs and the separate preview URL. No production access.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PWA_PLAYWRIGHT||'playwright-core');
const URL_BASE='https://kennedychinazam.github.io/matchmind-preview/';
const STAGE='https://rdcbnvfnxenrpnnwxszs.supabase.co',KEY='sb_publishable_WKB88h4KAPtLVphsfNF9fg_W90ym80y';
const expected=process.env.MM_EXPECTED_COMMIT;
let checks=0;const check=(ok,msg)=>{if(!ok)throw Error(msg);checks++;console.log('PASS '+msg);};
const rpc=async(name,body={})=>{const r=await fetch(STAGE+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});check(r.ok,name+' HTTP '+r.status);return r.json();};
const marker=(await(await fetch(URL_BASE+'SOURCE-COMMIT.txt',{cache:'no-store'})).text()).trim();
check(!expected||marker===expected,'hosted source commit matches expected development commit');
const status=await rpc('mm_preview_status_v1');check(status?.mode==='real-read-only'&&Date.parse(status.expires_at)>Date.now(),'current verified real mirror exists');
const scores=await rpc('mm_preview_display_v2',{screen:'scores'}),history=await rpc('mm_preview_display_v2',{screen:'history'});
const predictions=await rpc('mm_preview_display_v2',{screen:'predictions'});
const union=new Map([...scores.cards,...history.cards,...predictions.cards].map(c=>[c.fxid,c]));
const legacy=await rpc('mm_preview_display_v1',{screen:'history'});
check(legacy.cards.length===history.cards.length&&legacy.cards.every(c=>!Object.hasOwn(c,'analysis')&&JSON.stringify(c.prediction)===JSON.stringify(history.cards.find(h=>h.fxid===c.fxid)?.prediction)),'legacy preview reader strips optional analysis and preserves original predictions');
check(union.size===status.cards,'approved fixture inventory count represented across public screens');
const logos=await(await fetch(URL_BASE+'LOGO-MANIFEST.json')).json();
check(logos.fixtures.length===union.size&&logos.fixtures.every(f=>{const c=union.get(f.fxid);return c&&c.lid===f.lid&&c.home===f.home&&c.away===f.away;}),'original image catalog matches approved fixture identities');
check(history.cards.filter(c=>c.prediction).length===status.predictions,'linked published prediction count preserved');
check(![...union.values()].some(c=>/^(QA\b|Synthetic\b)/i.test(c.home+' ')||/^(QA\b|Synthetic\b)/i.test(c.away+' ')),'no fictional QA fixtures in real mirror');
check(scores.cards.some(c=>['NS','TBD'].includes(c.status)&&Date.parse(c.date+'T'+c.time+':00Z')>Date.now()),'real upcoming football fixtures present');
const browser=await chromium.launch({executablePath:process.env.MM_TEST_CHROMIUM,args:['--no-sandbox']});
try{
 for(const width of [320,390]){
  const context=await browser.newContext({viewport:{width,height:844},timezoneId:'Africa/Lagos',serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('mm-real-preview:mm_intro','1'));
  const page=await context.newPage(),requests=[],errors=[];page.on('request',r=>requests.push({url:r.url(),method:r.method()}));page.on('pageerror',e=>errors.push(e.message));
  await page.goto(URL_BASE,{waitUntil:'load'});
  await page.waitForFunction(()=>Object.keys(afState.leagues||{}).length>0,null,{timeout:30000});
  const state=await page.evaluate(async()=>{
   await loadCloudLeagues(true);await afScoresFromCloud();
   afState.filter='all';const all=visibleLeagues(),L=all.find(l=>l.upcoming.some(f=>publishedPrediction(f))),f=L?.upcoming.find(f=>publishedPrediction(f));
   const scoreIds=afState.scores.list.map(s=>s.fxid);
   if(!f)return{missing:true,scoreIds};
   const before=JSON.stringify(afState.archive);showPublishedFixture(L,f);
   const detail={id:f.fxid,probability:publishedPrediction(f).pick_prob,home:f.home,away:f.away,heroIdentity:$('heroHome').textContent.includes(f.home)&&$('heroAway').textContent.includes(f.away),bars:$('outcomeRows').textContent,resultVisible:!$('acc-result').classList.contains('hidden'),note:$('analysisText').textContent};
   afState.filter=String(L.id);afState.selectedDate=forecastDate(f);afState.archiveDate=null;navTo('predict');renderFixtures();const filtered=$('fixtureList').textContent;
   const row=afState.scores.list.find(s=>['NS','TBD'].includes(s.status));if(row){const item=ensureLeagueFromScore(row);await openFixture(item.L.id,item.f);}
   const badControls=[...document.querySelectorAll('input,button,select,textarea')].filter(e=>['afKey','aiKeyInput','afSaveKey','aiSaveBtn','afKeyUse','aiKeyUse'].includes(e.id));
   return{scoreIds,detail,filtered,archivePreserved:before===JSON.stringify(afState.archive),guest:authUser===null,apiControls:badControls.length,bar:$('stagingBar').textContent,overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  check(!state.missing&&state.detail.heroIdentity,width+'px source-backed published detail available');
  const original=history.cards.find(c=>c.fxid===state.detail.id)?.prediction;
  check(original&&state.detail.resultVisible&&state.detail.probability===original.pick_prob,width+'px original published probability unchanged');
  check(state.scoreIds.length===scores.cards.length&&state.scoreIds.every(id=>scores.cards.some(c=>c.fxid===id)),width+'px Scores inventory matches reader');
  check(state.filtered.includes(state.detail.home)&&state.filtered.includes(state.detail.away),width+'px competition filter retains selected real fixture');
  check(state.archivePreserved&&state.guest&&!state.apiControls&&!state.overflow,width+'px guest/privacy/archive/mobile checks');
  check(!/forecast retained|retained for history|not a device re-estimate/i.test(state.detail.note),width+'px no intrusive forecast-retention explanations');
  check(/REAL DATA.*READ-ONLY/.test(state.bar),width+'px real-data indicator verified');
  check(!requests.some(r=>r.url.includes('toqfdrcjzwnlydqekude')||r.url.includes('/auth/')||r.url.includes('/functions/')),width+'px no production/auth/Edge requests');
  check(requests.filter(r=>r.url.includes('.supabase.co')).every(r=>r.method==='POST'&&/^https:\/\/rdcbnvfnxenrpnnwxszs\.supabase\.co\/rest\/v1\/rpc\/mm_preview_(?:display_v2|status_v1)$/.test(r.url)),width+'px network limited to staging read RPCs');
  check(errors.length===0,width+'px no runtime errors');
  await page.evaluate(()=>{afState.filter='all';afState.scoreFilter='all';navTo('scores');renderScores();scrollTo(0,0);});
  await page.waitForFunction(()=>[...document.querySelectorAll('#scoresList img.crest,#scoresList img.competition-logo')].filter(e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}).every(e=>e.complete&&e.naturalWidth>0));
  check(await page.locator('#scoresList img.crest').count()>0,width+'px original club crests render in Scores');
  await page.screenshot({path:`real-preview-${width}-scores.png`});
  await page.evaluate(day=>{navTo('predict');if(day)afState.selectedDate=day;renderFixtures();scrollTo(0,0);},history.cards.find(c=>c.prediction)?.prediction.kickoff);
  const readable=await page.evaluate(()=>[...$('fixtureList').querySelectorAll('.tline')].filter(e=>e.offsetHeight).every(e=>e.scrollWidth<=e.clientWidth+1));
  check(readable,width+'px Analysis team names wrap without clipping');
  const originalStyle=await page.evaluate(()=>({edge: /EDGE\s*\+\d/.test($('fixtureList').textContent),rows:[...$('fixtureList').querySelectorAll('.fxrow')].map(r=>{const t=r.querySelector('.fxteams').getBoundingClientRect(),p=r.querySelector('.predchip')?.getBoundingClientRect();return!p||p.left>=t.right-1;}),logos:$('fixtureList').querySelectorAll('img.crest').length}));
  check(!originalStyle.edge&&originalStyle.rows.every(Boolean)&&originalStyle.logos>0,width+'px original right-hand badges and crests, no EDGE decorations');
  await page.waitForFunction(()=>[...document.querySelectorAll('#fixtureList img.crest,#fixtureList img.competition-logo')].filter(e=>{const r=e.getBoundingClientRect();return r.top<innerHeight&&r.bottom>0;}).every(e=>e.complete&&e.naturalWidth>0));
  await page.screenshot({path:`real-preview-${width}-analysis.png`});
  const publishedRow=page.locator('#fixtureList .fxrow').filter({hasText:'Ospitaletto'}).first();if(await publishedRow.count()){await publishedRow.scrollIntoViewIfNeeded();await page.waitForTimeout(300);await page.screenshot({path:`real-preview-${width}-analysis-picks.png`});}

  const publishedBadges=await page.evaluate(cards=>[...$('fixtureList').querySelectorAll('.fxrow')].map(r=>{const text=r.querySelector('.predchip:not(.muted-chip)')?.textContent,names=r.querySelector('.fxteams').textContent,c=cards.find(c=>c.prediction&&c.prediction.kickoff===afState.selectedDate&&names.includes(c.home)&&names.includes(c.away));return{text,expected:c?chipCode(c.prediction.pick)+' · '+Math.round(c.prediction.pick_prob*100)+'%':null};}).filter(x=>x.text?.includes('%')),history.cards);
  check(publishedBadges.length>0&&publishedBadges.every(b=>b.text.trim()===b.expected),width+'px green pick badges match original published selections and probabilities');
  await page.locator('#fixtureList .fxrow .tline').nth(1).click();
  check(await page.evaluate(()=>curView==='detail'),width+'px team-name tap opens detail without status interception');
  for(const [id,label] of [[1570019,'published'],[1594900,'retained']]){
   const source=history.cards.find(c=>c.fxid===id);if(!source?.prediction)continue;
   const shown=await page.evaluate(async id=>{const before=JSON.stringify(afState.archive);openFixtureById(id);scrollTo(0,0);const a=afState.archive[id];return{prob:afState.leagues[afState.activeLeagueId]?.upcoming?.find(f=>f.fxid===id)?.prob,hero:$('heroPick').textContent,raw:$('heroPick').closest('.hero').dataset.originalProbability,date:$('heroPick').closest('.hero').dataset.originalKickoff,publishedAt:$('heroPick').closest('.hero').dataset.publishedAt,status:$('heroStrong').textContent,note:$('analysisText').textContent,archiveUnchanged:before===JSON.stringify(afState.archive),overflow:document.documentElement.scrollWidth>innerWidth+1};},id);
   check(shown.archiveUnchanged&&!shown.overflow,width+'px '+label+' detail preserves archive and mobile layout');
   check(shown.hero.includes(Math.round(100*source.prediction.pick_prob)+'%')&&shown.raw===String(source.prediction.pick_prob),width+'px '+label+' original selection probability visible');
   check(shown.status===''&&!/retained for history|forecast retained/i.test(shown.note)&&shown.date===source.prediction.kickoff+'T'+(source.prediction.ktime||'')&&shown.publishedAt===source.prediction.made_at,width+'px '+label+' original dated context without forecast-status messages');
   await page.waitForFunction(()=>[...document.querySelectorAll('#heroHome img,#heroAway img')].every(e=>e.complete&&e.naturalWidth>0));
   check(await page.locator('#heroHome img,#heroAway img').count()===2,width+'px '+label+' genuine match-detail crests');
   await page.screenshot({path:`real-preview-${width}-detail-${label}.png`});
  }
  const dated=await page.evaluate(async()=>{
   await dailySharedLoad(todayStrLocal(),true);
   const candidate=Object.values(afState.leagues).flatMap(L=>L.upcoming).find(f=>{const p=publishedPrediction(f);return p&&p.kickoff!==f.date;});const id=candidate?.fxid;let pair;for(const L of Object.values(afState.leagues)){const f=L.upcoming.find(f=>f.fxid===id);if(f){pair={L,f};break;}}
   if(!pair||!publishedPrediction(pair.f))return null;const {f}=pair,p=publishedPrediction(f),snapshot=JSON.stringify(afState.archive);
   afState.filter='all';afState.archiveDate=null;navTo('predict');afState.selectedDate=f.date;renderFixtures();
   const absent=p.kickoff===f.date||![...$('fixtureList').querySelectorAll('.fxrow')].some(r=>r.querySelector('.fxteams')?.textContent.includes(p.home));
   afState.selectedDate=p.kickoff;renderFixtures();const oldRow=[...$('fixtureList').querySelectorAll('.fxrow')].find(r=>r.querySelector('.fxteams')?.textContent.includes(p.home));
   const badge=oldRow?.querySelector('.predchip')?.textContent;showPublishedFixture(pair.L,f);const oldKey=$('heroPick').closest('.hero').dataset.selectionKey;
   const row=(_sharedSlips.rows||[]).find(r=>r.legs?.some(l=>l.fxid===id&&l.code!==p.pick)),leg=row?.legs.find(l=>l.fxid===id&&l.code!==p.pick);let issued=null;
   if(leg){openIssuedForecast(leg);const hero=$('heroPick').closest('.hero');issued={matches:$('heroPick').textContent===chipCode(leg.code)+' · '+probabilityPercent(leg.p,0),distinct:hero.dataset.selectionKey!==oldKey,original:hero.dataset.originalProbability===String(leg.p),date:hero.dataset.originalKickoff===leg.d+'T'+(leg.t||'')};}
   return{absent,dated:badge===chipCode(p.pick)+' · '+probabilityPercent(p.pick_prob,0),issued,unchanged:snapshot===JSON.stringify(afState.archive)};
  });
  if(dated){
   check(dated.absent&&dated.dated&&dated.unchanged,width+'px older published forecast stays on original date without replacing issued selections');
   if(dated.issued)check(Object.values(dated.issued).every(Boolean),width+'px separate issued selection opens its own original probability and dated identity');
   else console.log('UNAVAILABLE CASE '+width+'px separate issued selection for rescheduled fixture');
  }else console.log('UNAVAILABLE CASE '+width+'px rescheduled historical forecast in current approved inventory');

  // These checks inspect the actual rendered generated preview, not source-code markers.
  const cases=[['published',history.cards.find(c=>c.prediction)],['no-pick',history.cards.find(c=>!c.prediction&&c.analysis)],['completed',history.cards.find(c=>['FT','AET','PEN'].includes(c.status))],['dnb',history.cards.find(c=>['1D','2D'].includes(c.prediction?.pick))]];
  const detailEvidence=[];
  for(const [label,card] of cases){
   if(!card){console.log('UNAVAILABLE CASE '+width+'px '+label+' in current approved hosted inventory');continue;}
   const detail=await page.evaluate(async({id})=>{
    openFixtureById(id);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    const ids=['acc-result','acc-goals','acc-combo','acc-htft','acc-score','acc-scorers','acc-form','acc-standings','acc-analysis'];
    const panels=ids.map(id=>{const e=$(id);if(e)e.classList.add('open');return{id,visible:!!e&&!e.classList.contains('hidden'),text:e?.textContent.trim()||'',title:e?.querySelector('.acc-head .t')?.textContent||''};});
    const order=[...$('results').querySelectorAll('.acc')].filter(e=>ids.includes(e.id)&&!e.classList.contains('hidden')).map(e=>e.id);
    const tooLong=[],clipped=[];
    for(const e of $('results').querySelectorAll('*')){
     if(e.closest('#analysisText.published-writeup')||e.children.length||!e.textContent.trim()||!e.getClientRects().length)continue;
     const range=document.createRange();range.selectNodeContents(e);
     const lines=new Set([...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>Math.round(r.top)));
     if(lines.size>2)tooLong.push({id:e.id,text:e.textContent.trim(),lines:lines.size});
     if(e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2)clipped.push({id:e.id,text:e.textContent.trim()});
    }
    return{panels,order,tooLong,clipped,pick:$('heroPick').textContent,original:$('heroPick').closest('.hero').dataset.originalProbability,bars:$('outcomeRows').textContent,xg:$('xgInfo').textContent,overflow:document.documentElement.scrollWidth>innerWidth+1,body:$('results').textContent,forms:$('formBox').textContent,h2h:$('h2hBox').textContent};
   },{id:card.fxid});
   const ids=['acc-result','acc-goals','acc-combo','acc-htft','acc-score','acc-scorers','acc-form','acc-standings','acc-analysis'];
   check(detail.panels.every(p=>p.visible&&p.text),width+'px '+label+' all nine analysis accordions present with values or accurate state');
   check(JSON.stringify(detail.order)===JSON.stringify(ids),width+'px '+label+' original accordion order');
   check(!detail.overflow&&!detail.tooLong.length&&!detail.clipped.length,width+'px '+label+' non-AI fields fit two lines without clipping: '+JSON.stringify({tooLong:detail.tooLong,clipped:detail.clipped}));
   if(card.prediction)check(detail.original===String(card.prediction.pick_prob),width+'px '+label+' issued probability identity exact');
   else check(!detail.original&&!/\d+(?:\.\d+)?%/.test(detail.pick),width+'px '+label+' no fabricated issued pick');
   const vector=card.prediction&&[card.prediction.p_home,card.prediction.p_draw,card.prediction.p_away].every(x=>typeof x==='number')?card.prediction:card.analysis?.result;
   if(vector)for(const key of ['p_home','p_draw','p_away'])check(detail.bars.includes((vector[key]*100).toFixed(1)+'%'),width+'px '+label+' original '+key+' displayed');
   for(const [key,panel] of [['goals','acc-goals'],['combos','acc-combo'],['htft','acc-htft'],['correct_scores','acc-score'],['scorers','acc-scorers']]){
    const text=detail.panels.find(p=>p.id===panel).text;
    for(const row of card.analysis?.[key]||[])check(text.includes(row.label),width+'px '+label+' approved '+key+' row '+row.label+' displayed');
   }
   if(card.analysis?.h2h?.length)check(card.analysis.h2h.every(h=>detail.h2h.includes(h.home)&&detail.h2h.includes(h.away)),width+'px '+label+' approved H2H identities displayed');
   if(card.analysis?.writeup)check(detail.body.replace(/\s+/g,' ').includes(card.analysis.writeup.text.replace(/ ¶ /g,' ').replace(/\s+/g,' ')),width+'px '+label+' approved AI write-up preserved');
   detailEvidence.push({label,fxid:card.fxid,...detail});
   await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:`real-preview-${width}-restored-${label}.png`,fullPage:true});
  }
  check(detailEvidence.some(d=>d.label==='published'),width+'px a normal published pick was exercised');
  // Browser History API roundtrip from a real list row after scrolling down the Analysis feed.
  const listDay=history.cards.filter(c=>c.prediction).map(c=>c.prediction.kickoff).sort((a,b)=>history.cards.filter(c=>c.prediction?.kickoff===b).length-history.cards.filter(c=>c.prediction?.kickoff===a).length)[0];
  await page.evaluate(day=>{afState.filter='all';afState.archiveDate=null;afState.selectedDate=day;navTo('predict');renderFixtures();},listDay);
  const target=page.locator('#fixtureList .fxrow .tline').last();await target.scrollIntoViewIfNeeded();
  await page.waitForTimeout(150);
  const listSnapshot=()=>page.evaluate(()=>({view:curView,tab:lastTab,date:afState.selectedDate,archiveDate:afState.archiveDate,filter:afState.filter,scoreFilter:afState.scoreFilter,scroll:scrollY,rows:[...$('fixtureList').querySelectorAll('.fxrow')].map(e=>e.textContent),accordions:[...$('view-predict').querySelectorAll('.acc')].map(e=>[e.id,e.className])}));
  const before=await listSnapshot();await target.click();await page.waitForFunction(()=>curView==='detail');
  await page.goBack();await page.waitForFunction(()=>curView==='predict');await page.waitForTimeout(150);
  const restored=await listSnapshot();const {scroll:beforeScroll,...beforeState}=before,{scroll:restoredScroll,...restoredState}=restored;
  check(Math.abs(beforeScroll-restoredScroll)<=2&&JSON.stringify(beforeState)===JSON.stringify(restoredState),width+'px browser Back restores Analysis date/filter/order/accordion/scroll');
  await page.goForward();await page.waitForFunction(()=>curView==='detail');await page.locator('#backToFeed').click();await page.waitForFunction(()=>curView==='predict');await page.waitForTimeout(150);
  const appBack=await listSnapshot();check(Math.abs(appBack.scroll-beforeScroll)<=2&&appBack.date===before.date&&appBack.filter===before.filter&&JSON.stringify(appBack.rows)===JSON.stringify(before.rows),width+'px Forward then in-app Back restores same Analysis location');
  writeFileSync(`real-preview-${width}-restored.json`,JSON.stringify({commit:marker,edition:status.edition_id,cases:detailEvidence,navigation:{before,restored,appBack},checks},null,2));

  await page.screenshot({path:`real-preview-${width}-detail-issued.png`});
  await page.screenshot({path:`real-preview-${width}.png`,fullPage:false});
  writeFileSync(`real-preview-${width}.json`,JSON.stringify({commit:marker,status,fixture:state.detail,network:requests},null,2));await context.close();
 }
}finally{await browser.close();}
console.log(JSON.stringify({checks,commit:marker,edition:status.edition_id,cards:status.cards,predictions:status.predictions,payload_sha256:status.payload_sha256,published_at:status.published_at,source_updated_at:status.source_updated_at}));
