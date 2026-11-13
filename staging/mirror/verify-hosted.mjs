// Read-only hosted acceptance; fixed staging RPCs and the separate preview URL. No production access.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),{chromium}=require('playwright-core');
const URL_BASE='https://kennedychinazam.github.io/matchmind-preview/';
const STAGE='https://rdcbnvfnxenrpnnwxszs.supabase.co',KEY='sb_publishable_WKB88h4KAPtLVphsfNF9fg_W90ym80y';
const expected=process.env.MM_EXPECTED_COMMIT;
const check=(ok,msg)=>{if(!ok)throw Error(msg);console.log('PASS '+msg);};
const rpc=async(name,body={})=>{const r=await fetch(STAGE+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});check(r.ok,name+' HTTP '+r.status);return r.json();};
const marker=(await(await fetch(URL_BASE+'SOURCE-COMMIT.txt',{cache:'no-store'})).text()).trim();
check(!expected||marker===expected,'hosted source commit matches expected development commit');
const status=await rpc('mm_preview_status_v1');check(status?.mode==='real-read-only'&&Date.parse(status.expires_at)>Date.now(),'current verified real mirror exists');
const scores=await rpc('mm_preview_display_v1',{screen:'scores'}),history=await rpc('mm_preview_display_v1',{screen:'history'});
const predictions=await rpc('mm_preview_display_v1',{screen:'predictions'});
const union=new Map([...scores.cards,...history.cards,...predictions.cards].map(c=>[c.fxid,c]));
check(union.size===status.cards,'approved fixture inventory count represented across public screens');
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
   afState.filter='all';const all=visibleLeagues(),L=all.find(l=>l.upcoming.some(f=>f.pick&&f.prob!=null&&!f.gated)),f=L?.upcoming.find(f=>f.pick&&f.prob!=null&&!f.gated);
   const scoreIds=afState.scores.list.map(s=>s.fxid);
   if(!f)return{missing:true,scoreIds};
   const before=JSON.stringify(afState.archive);showPublishedFixture(L,f);
   const detail={id:f.fxid,probability:f.prob,home:f.home,away:f.away,heroIdentity:$('heroHome').textContent.includes(f.home)&&$('heroAway').textContent.includes(f.away),bars:$('outcomeRows').textContent,resultVisible:!$('acc-result').classList.contains('hidden'),note:$('analysisText').textContent};
   afState.filter=String(L.id);afState.selectedDate=f.date;afState.archiveDate=null;navTo('predict');renderFixtures();const filtered=$('fixtureList').textContent;
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
  check(state.detail.note.toLowerCase().includes('league table')&&state.detail.note.toLowerCase().includes('unavailable'),width+'px standings limitation stated without fabrication');
  check(/REAL DATA.*READ-ONLY/.test(state.bar),width+'px real-data indicator verified');
  check(!requests.some(r=>r.url.includes('toqfdrcjzwnlydqekude')||r.url.includes('/auth/')||r.url.includes('/functions/')),width+'px no production/auth/Edge requests');
  check(requests.filter(r=>r.url.includes('.supabase.co')).every(r=>r.method==='POST'&&/^https:\/\/rdcbnvfnxenrpnnwxszs\.supabase\.co\/rest\/v1\/rpc\/mm_preview_(display|status)_v1$/.test(r.url)),width+'px network limited to staging read RPCs');
  check(errors.length===0,width+'px no runtime errors');
  await page.evaluate(()=>{afState.filter='all';afState.scoreFilter='all';navTo('scores');renderScores();scrollTo(0,0);});
  await page.screenshot({path:`real-preview-${width}-scores.png`});
  await page.evaluate(day=>{navTo('predict');if(day)afState.selectedDate=day;renderFixtures();scrollTo(0,0);},history.cards.find(c=>c.fxid===1570019)?.date);
  const readable=await page.evaluate(()=>[...$('fixtureList').querySelectorAll('.tline')].filter(e=>e.offsetHeight).every(e=>e.scrollWidth<=e.clientWidth+1));
  check(readable,width+'px Analysis team names wrap without clipping');
  await page.screenshot({path:`real-preview-${width}-analysis.png`});
  await page.locator('#fixtureList .fxrow .tline').nth(1).click();
  check(await page.evaluate(()=>curView==='detail'),width+'px team-name tap opens detail without status interception');
  for(const [id,label] of [[1570019,'published'],[1594900,'retained']]){
   const source=history.cards.find(c=>c.fxid===id);if(!source?.prediction)continue;
   const shown=await page.evaluate(async id=>{const before=JSON.stringify(afState.archive);openFixtureById(id);scrollTo(0,0);const a=afState.archive[id];return{prob:afState.leagues[afState.activeLeagueId]?.upcoming?.find(f=>f.fxid===id)?.prob,hero:$('heroConf').textContent,status:$('heroStrong').textContent,note:$('analysisText').textContent,archiveUnchanged:before===JSON.stringify(afState.archive),overflow:document.documentElement.scrollWidth>innerWidth+1};},id);
   check(shown.archiveUnchanged&&!shown.overflow,width+'px '+label+' detail preserves archive and mobile layout');
   check(shown.hero.includes((100*source.prediction.pick_prob).toFixed(1)+'%'),width+'px '+label+' original selection probability visible');
   if(label==='retained')check(shown.status==='Earlier forecast retained'&&!/confirmed postponement|non-play beyond|Pick expired/.test(shown.note),width+'px earlier forecast uses neutral provenance wording');
   await page.screenshot({path:`real-preview-${width}-detail-${label}.png`});
  }
  await page.screenshot({path:`real-preview-${width}.png`,fullPage:false});
  writeFileSync(`real-preview-${width}.json`,JSON.stringify({commit:marker,status,fixture:state.detail,network:requests},null,2));await context.close();
 }
}finally{await browser.close();}
console.log(JSON.stringify({commit:marker,edition:status.edition_id,cards:status.cards,predictions:status.predictions,payload_sha256:status.payload_sha256,published_at:status.published_at,source_updated_at:status.source_updated_at}));
