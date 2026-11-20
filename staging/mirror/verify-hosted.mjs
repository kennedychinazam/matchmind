// Read-only hosted acceptance; fixed staging RPCs and the separate preview URL. No production access.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const require=createRequire(import.meta.url),pw=require(process.env.PWA_PLAYWRIGHT||'playwright-core');
/* MM_BROWSER selects the engine (chromium default, unchanged). Firefox and WebKit use the
   Playwright-installed build; --no-sandbox and MM_TEST_CHROMIUM are Chromium-only. */
const BROWSER=process.env.MM_BROWSER||'chromium';if(!['chromium','firefox','webkit'].includes(BROWSER))throw Error('MM_BROWSER must be chromium, firefox or webkit');
const URL_BASE='https://kennedychinazam.github.io/matchmind-preview/';
const STAGE='https://rdcbnvfnxenrpnnwxszs.supabase.co',KEY='sb_publishable_WKB88h4KAPtLVphsfNF9fg_W90ym80y';
const expected=process.env.MM_EXPECTED_COMMIT;
let checks=0;const check=(ok,msg)=>{if(!ok)throw Error(msg);checks++;console.log('PASS '+msg);};
const rpc=async(name,body={})=>{const r=await fetch(STAGE+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:KEY,'Content-Type':'application/json'},body:JSON.stringify(body)});check(r.ok,name+' HTTP '+r.status);return r.json();};
const marker=(await(await fetch(URL_BASE+'SOURCE-COMMIT.txt',{cache:'no-store'})).text()).trim();
check(!expected||marker===expected,'hosted source commit matches expected development commit');
const status=await rpc('mm_preview_status_v1');check(status?.mode==='real-read-only'&&Date.parse(status.expires_at)>Date.now(),'current verified real mirror exists');
/* Verify the reader the hosted page actually calls. A build that reads v3 is checked through v3; an earlier hosted
   build that reads v2 is checked through v2, so this script can run before the v3 rollout reaches staging. */
const hostedPage=await(await fetch(URL_BASE,{cache:'no-store'})).text();
const DISPLAY=hostedPage.includes('mm_preview_display_v3')?'mm_preview_display_v3':'mm_preview_display_v2';
check(hostedPage.includes(DISPLAY),'hosted page reads '+DISPLAY);
const scores=await rpc(DISPLAY,{screen:'scores'}),history=await rpc(DISPLAY,{screen:'history'});
const predictions=await rpc(DISPLAY,{screen:'predictions'});
const slipsScreen=await rpc(DISPLAY,{screen:'slips'}),recordsScreen=await rpc(DISPLAY,{screen:'records'});
const union=new Map([...scores.cards,...history.cards,...predictions.cards].map(c=>[c.fxid,c]));
const legacy=await rpc('mm_preview_display_v1',{screen:'history'});
check(legacy.cards.length===history.cards.length&&legacy.cards.every(c=>!Object.hasOwn(c,'analysis')&&JSON.stringify(c.prediction)===JSON.stringify(history.cards.find(h=>h.fxid===c.fxid)?.prediction)),'legacy preview reader strips optional analysis and preserves original predictions');
check(union.size===status.cards,'approved fixture inventory count represented across public screens');
const logos=await(await fetch(URL_BASE+'LOGO-MANIFEST.json')).json();
check(logos.fixtures.length===union.size&&logos.fixtures.every(f=>{const c=union.get(f.fxid);return c&&c.lid===f.lid&&c.home===f.home&&c.away===f.away;}),'original image catalog matches approved fixture identities');
check(history.cards.filter(c=>c.prediction).length===status.predictions,'linked published prediction count preserved');
check(![...union.values()].some(c=>/^(QA\b|Synthetic\b)/i.test(c.home+' ')||/^(QA\b|Synthetic\b)/i.test(c.away+' ')),'no fictional QA fixtures in real mirror');
check(scores.cards.some(c=>['NS','TBD'].includes(c.status)&&Date.parse(c.date+'T'+c.time+':00Z')>Date.now()),'real upcoming football fixtures present');
console.log('BROWSER '+BROWSER);
const browser=await pw[BROWSER].launch(BROWSER==='chromium'?{executablePath:process.env.MM_TEST_CHROMIUM,args:['--no-sandbox']}:{});
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
  check(requests.filter(r=>r.url.includes('.supabase.co')).every(r=>r.method==='POST'&&(r.url==='https://rdcbnvfnxenrpnnwxszs.supabase.co/rest/v1/rpc/'+DISPLAY||r.url==='https://rdcbnvfnxenrpnnwxszs.supabase.co/rest/v1/rpc/mm_preview_status_v1')),width+'px network limited to staging read RPCs');
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

  const publishedBadges=await page.evaluate(cards=>[...$('fixtureList').querySelectorAll('.fxrow')].map(r=>{const text=r.querySelector('.predchip:not(.muted-chip)')?.textContent,names=r.querySelector('.fxteams').textContent,c=cards.find(c=>c.prediction&&c.prediction.kickoff===afState.selectedDate&&names.includes(c.home)&&names.includes(c.away));return{text,expected:c?chipCode(c.prediction.pick)+' · '+Math.round(c.prediction.pick_prob*100)+'%':null,graded:c?[chipCode(c.prediction.pick)+' ✓',chipCode(c.prediction.pick)+' ✗']:[]};}).filter(x=>x.text&&x.expected),history.cards);
  check(publishedBadges.length>0&&publishedBadges.every(b=>b.text.trim()===b.expected||b.graded.includes(b.text.trim())),width+'px green pick badges match original published selections and probabilities');
  // Result and outcome agreement: reader record, Scores, Analysis row and match detail.
  const outcomeOf=c=>{const h=c.ft_h??c.gh,a=c.ft_a??c.ga,k=c.prediction.pick,r=h>a?'1':h===a?'X':'2';
   if(k==='1D'||k==='2D')return r==='X'?'Void':r===k[0]?'Won':'Lost';
   return ['1','X','2','1X','X2','12'].includes(k)?(k.includes(r)?'Won':'Lost'):null;};
  const day=n=>new Date(Date.now()-n*86400000).toISOString().slice(0,10);
  const gradeable=history.cards.filter(c=>c.prediction&&!c.prediction.withheld_at&&c.prediction.kickoff===c.date&&c.date>=day(5)&&c.date<=day(-5)&&scores.cards.some(x=>x.fxid===c.fxid));
  const done=gradeable.filter(c=>c.status==='FINISHED'&&Number.isInteger(c.ft_h??c.gh)&&Number.isInteger(c.ft_a??c.ga)&&outcomeOf(c));
  const samples=[...['Won','Lost','Void'].map(o=>done.find(c=>outcomeOf(c)===o)).filter(Boolean),gradeable.find(c=>c.status==='NS'),gradeable.find(c=>c.status==='POSTPONED')].filter(Boolean);
  for(const c of samples){
   const want=c.status==='FINISHED'?outcomeOf(c):'Pending',score=(c.ft_h??c.gh)+'–'+(c.ft_a??c.ga);
   const seen=await page.evaluate(c=>{afState.filter='all';afState.archiveDate=null;navTo('predict');afState.selectedDate=c.date;renderFixtures();
    const row=[...$('fixtureList').querySelectorAll('.fxrow')].find(r=>{const t=r.querySelector('.fxteams').textContent;return t.includes(c.home)&&t.includes(c.away);});
    const out={pending:chipCode(c.prediction.pick)+' · '+probabilityPercent(c.prediction.pick_prob,0),code:chipCode(c.prediction.pick),prob:row?.querySelector('.predchip')?.dataset.originalProbability,time:row?.querySelector('.fxtime').innerText.replace(/\s+/g,' ').trim(),badge:row?.querySelector('.predchip')?.textContent,outcome:row?.querySelector('.predchip')?.dataset.outcome,score:(s=>s&&s.gh!=null?s.gh+'–'+s.ga:null)(afState.scores.list.find(s=>s.fxid===c.fxid))};
    openFixtureById(c.fxid);const line=[...$('heroMeta').querySelectorAll('.hm-dt')].find(e=>/90-minute score/.test(e.textContent));
    return{...out,detail:line?.textContent||null,detailOutcome:line?.dataset.outcome||null};},c);
   check(want==='Pending'?seen.badge===seen.pending:seen.badge===seen.code+{Won:' ✓',Lost:' ✗',Void:' · Void'}[want]&&seen.prob===String(c.prediction.pick_prob),width+'px '+c.fxid+' Analysis chip in Build 355 form with the issued pick');
   check(seen.outcome===want,width+'px '+c.fxid+' Analysis outcome '+want+' from verified result');
   if(c.status==='FINISHED'){check(seen.time===score+' FT'&&seen.score===score&&seen.detail==='90-minute score '+score+' · '+want&&seen.detailOutcome===want,width+'px '+c.fxid+' same final score and outcome in Scores, Analysis and detail');}
   else check(!/FT/.test(seen.time)&&seen.detail===null,width+'px '+c.fxid+' unfinished fixture carries no final score');
  }
  if(!done.length)console.log('UNAVAILABLE CASE '+width+'px finished issued prediction inside the date strip');
  /* TIPS ISSUE CONTINUITY. The tab shows the issue for the reader's local today when the edition
     holds one, otherwise the previous day's issue under its own date, otherwise an explicit empty
     state. Whichever of the three the published edition supports is asserted. None is skipped. */
  const tipsReady=await page.evaluate(async()=>{navTo('tips');tipState.days=0;renderTips();
   for(let i=0;i<80&&!(_sharedSlips.loaded&&_sharedSlips.day===todayStrLocal()&&_tipsPrev.loaded&&_tipsPrev.forDay===todayStrLocal());i++)await new Promise(r=>setTimeout(r,250));
   return{today:todayStrLocal(),prev:dayStrLocal(-1),loaded:_sharedSlips.loaded&&_tipsPrev.loaded&&!_sharedSlips.error&&!_tipsPrev.error};});
  check(tipsReady.loaded,width+'px Tips issue reads completed for '+tipsReady.today+' and '+tipsReady.prev);
  const issues=[tipsReady.today,tipsReady.prev].map(day=>slipsScreen.slips.find(x=>x.tier==='tips'&&x.day===day&&x.legs.length)).filter(Boolean);
  const dateText=day=>new Date(day+'T12:00:00Z').toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});
  console.log('TIPS CASE '+width+'px reader day '+tipsReady.today+', published issues '+(issues.map(x=>x.day).join(' and ')||'none'));
  if(!issues.length){
   const empty=await page.evaluate(()=>{tipState.tab='winner';renderTips();return{text:$('tipList').textContent.trim(),bar:!!$('tipIssueBar')&&!$('tipIssueBar').classList.contains('hidden')};});
   check(empty.text==='No Tips have been issued for today or yesterday.'&&!empty.bar,width+'px Tips states that no issue exists for today or yesterday');
  }
  for(const issue of issues){
   const previous=issue.day!==tipsReady.today;
   for(const market of ['winner','ou','btts']){
    const legs=issue.legs.filter(l=>l.tab===market).sort((a,b)=>a.rank-b.rank),legCards=legs.map(l=>union.get(l.fxid));
    const exact=legCards.every(c=>c&&!['AET','PEN'].includes(c.status)),verified=legCards.filter(c=>c&&['FINISHED','AET','PEN'].includes(c.status)&&Number.isInteger(c.gh)&&Number.isInteger(c.ga)).length;
    const seen=await page.evaluate(async({day,market,verified,many})=>{
     if(many){tipState.issue=day;}tipState.tab=market;renderTips();
     for(let i=0;i<60;i++){const t=$('tipList').querySelector('.subnote')?.textContent||'';if($('tipIssueBar').dataset.issue===day&&t.startsWith(verified+' of '))break;await new Promise(r=>setTimeout(r,250));renderTips();}
     const bar=$('tipIssueBar');
     return{issue:bar.dataset.issue,label:$('tipIssueLabel').textContent,switches:[...bar.querySelectorAll('[data-issue]')].map(b=>b.dataset.issue+(b.classList.contains('active')?'*':'')),
      foot:$('tipList').querySelector('.subnote')?.textContent||'',banker:$('bankerCard').textContent,
      rows:[...$('tipList').querySelectorAll('.fxrow')].map(r=>({sel:r.querySelector('.lname b').textContent,prob:r.querySelector('.predchip').textContent,mark:(r.querySelector('.tip-outcome')?.textContent||'').replace(/[^A-Za-z]/g,'')})),
      overflow:document.documentElement.scrollWidth>innerWidth+1||bar.scrollWidth>bar.clientWidth+1};},{day:issue.day,market,verified,many:issues.length>1});
    const tag=width+'px Tips '+issue.day+' '+market;
    check(seen.issue===issue.day&&seen.label.startsWith('Issued for '+dateText(issue.day))&&(previous?/previous issue|latest available/.test(seen.label)&&!/Today/.test(seen.banker):seen.label==='Issued for '+dateText(issue.day)),tag+' shown under its own issue date: '+seen.label);
    check(issues.length>1?seen.switches.length===2&&seen.switches.includes(issue.day+'*'):seen.switches.length===0,tag+' issue switch matches the published issues');
    check(seen.rows.length===legs.length&&seen.rows.every((r,i)=>r.sel===legs[i].sel&&r.prob===Math.round(legs[i].p*100)+'%'),tag+' original selections, order and probabilities');
    const m=/^(\d+) of (\d+) results verified/.exec(seen.foot);
    check(m&&+m[2]===legs.length&&(exact?+m[1]===verified:+m[1]>0||!verified),tag+' counter '+verified+' of '+legs.length+': '+seen.foot);
    check(seen.rows.every(r=>['Won','Lost','Void','Pending'].includes(r.mark))&&seen.rows.filter(r=>r.mark!=='Pending').length===+m[1]&&!seen.overflow,tag+' every row states Won, Lost, Void or Pending');
   }
  }
  if(issues.length>1)await page.evaluate(()=>{delete tipState.issue;});
  /* ACCURACY PANEL. The note always reads "Voids excluded, updated <record time>." and nothing
     follows the market table. Asserted against the published engine record. Without a published
     record there is nothing to assert, and that is reported as unavailable, not as a pass. */
  const engine=recordsScreen.records.engine;
  if(engine){
   const acc=await page.evaluate(async()=>{navTo('data');for(let i=0;i<80&&_engineRecord.state==='pending';i++)await new Promise(r=>setTimeout(r,250));renderMoreRecord();
    return{state:_engineRecord.state,at:_engineRecord.computedAt,want:'Voids excluded'+recordUpdatedText()+'.',note:$('recordNote')?.textContent||null,notes:$('moreRecordLine').querySelectorAll('.subnote').length,
     line:$('moreRecordLine').textContent,table:$('moreRecordBreak').textContent,tableNotes:$('moreRecordBreak').querySelectorAll('.subnote').length,overflow:document.documentElement.scrollWidth>innerWidth+1};});
   check(acc.state==='loaded'&&Date.parse(acc.at)===Date.parse(engine.computed_at),width+'px Accuracy reads the published engine record of '+engine.computed_at);
   check(acc.note===acc.want&&/^Voids excluded, updated \S.*\.$/.test(acc.note)&&acc.notes===1,width+'px Accuracy note: '+acc.note);
   check(!/From |had the stake returned|same record on every device|\d+ voids? excluded/.test(acc.line),width+'px Accuracy note carries no start date, void count, stake or device wording');
   check(acc.tableNotes===0&&!/handful of picks|read the count before the percentage/.test(acc.table)&&!acc.overflow,width+'px no small-sample sentence under the Accuracy market table');
  }else console.log('UNAVAILABLE CASE '+width+'px no published engine record, so the Accuracy note cannot be read');
  await page.evaluate(day=>{afState.filter='all';afState.archiveDate=null;navTo('predict');if(day)afState.selectedDate=day;renderFixtures();scrollTo(0,0);},history.cards.find(c=>c.prediction)?.prediction.kickoff);
  await page.locator('#fixtureList .fxrow .tline').nth(1).click();
  check(await page.evaluate(()=>curView==='detail'),width+'px team-name tap opens detail without status interception');
  for(const [id,label] of [[1570019,'published'],[1594900,'retained']]){
   const source=history.cards.find(c=>c.fxid===id);if(!source?.prediction)continue;
   const shown=await page.evaluate(async id=>{const before=JSON.stringify(afState.archive);openFixtureById(id);scrollTo(0,0);const a=afState.archive[id];return{prob:afState.leagues[afState.activeLeagueId]?.upcoming?.find(f=>f.fxid===id)?.prob,hero:$('heroPick').textContent,raw:$('heroPick').closest('.hero').dataset.originalProbability,date:$('heroPick').closest('.hero').dataset.originalKickoff,publishedAt:$('heroPick').closest('.hero').dataset.publishedAt,status:$('heroStrong').textContent,note:$('analysisText').textContent,archiveUnchanged:before===JSON.stringify(afState.archive),overflow:document.documentElement.scrollWidth>innerWidth+1};},id);
   check(shown.archiveUnchanged&&!shown.overflow,width+'px '+label+' detail preserves archive and mobile layout');
   check(shown.hero.includes(Math.round(100*source.prediction.pick_prob)+'%')&&shown.raw===String(source.prediction.pick_prob),width+'px '+label+' original selection probability visible');
   check(shown.status===(source.prediction.withheld_at?'Pick withdrawn':'')&&!/retained for history|forecast retained/i.test(shown.note)&&shown.date===source.prediction.kickoff+'T'+(source.prediction.ktime||'')&&shown.publishedAt===source.prediction.made_at,width+'px '+label+' original dated context without forecast-status messages');
   await page.waitForFunction(()=>[...document.querySelectorAll('#heroHome img,#heroAway img')].every(e=>e.complete&&e.naturalWidth>0));
   check(await page.locator('#heroHome img,#heroAway img').count()===2,width+'px '+label+' genuine match-detail crests');
   await page.screenshot({path:`real-preview-${width}-detail-${label}.png`});
  }
  const dated=await page.evaluate(async()=>{
   await dailySharedLoad(todayStrLocal(),true);
   /* The Analysis date strip is a rolling 14 days, today-7 to today+6, and renderFixtures moves any
      other selectedDate back to today. A rescheduled forecast whose original or new date is outside
      the strip cannot be opened by setting selectedDate. Prefer a fixture with both dates inside the
      strip. Otherwise check each date where the app actually presents the forecast. */
   const day=n=>new Date(Date.now()-n*86400000).toISOString().slice(0,10),inStrip=d=>d>=day(7)&&d<=day(-6);
   const moved=Object.values(afState.leagues).flatMap(L=>L.upcoming).filter(f=>{const p=publishedPrediction(f);return p&&p.kickoff!==f.date;});
   const candidate=moved.find(f=>inStrip(f.date)&&inStrip(publishedPrediction(f).kickoff))||moved[0];const id=candidate?.fxid;let pair;for(const L of Object.values(afState.leagues)){const f=L.upcoming.find(f=>f.fxid===id);if(f){pair={L,f};break;}}
   if(!pair||!publishedPrediction(pair.f))return null;const {f}=pair,p=publishedPrediction(f),snapshot=JSON.stringify(afState.archive);
   afState.filter='all';afState.archiveDate=null;navTo('predict');afState.selectedDate=f.date;renderFixtures();
   const newShown=afState.selectedDate===f.date;
   const absent=!newShown||![...$('fixtureList').querySelectorAll('.fxrow')].some(r=>r.querySelector('.fxteams')?.textContent.includes(p.home));
   afState.selectedDate=p.kickoff;renderFixtures();const oldShown=afState.selectedDate===p.kickoff;
   const oldRow=oldShown?[...$('fixtureList').querySelectorAll('.fxrow')].find(r=>r.querySelector('.fxteams')?.textContent.includes(p.home)):null;
   const want=chipCode(p.pick)+' · '+probabilityPercent(p.pick_prob,0);
   showPublishedFixture(pair.L,f);const oldHero=$('heroPick').closest('.hero'),oldKey=oldHero.dataset.selectionKey;
   /* Original date outside the strip: the forecast has no feed row, so its detail must carry the
      original pick, probability and kickoff. Inside the strip the feed row is still required. */
   const badge=oldShown?oldRow?.querySelector('.predchip')?.textContent:($('heroPick').textContent===want&&oldHero.dataset.originalKickoff===p.kickoff+'T'+(p.ktime||'')&&oldHero.dataset.originalProbability===String(p.pick_prob)?want:null);
   const row=(_sharedSlips.rows||[]).find(r=>r.legs?.some(l=>l.fxid===id&&l.code!==p.pick)),leg=row?.legs.find(l=>l.fxid===id&&l.code!==p.pick);let issued=null;
   if(leg){openIssuedForecast(leg);const hero=$('heroPick').closest('.hero');issued={matches:$('heroPick').textContent===chipCode(leg.code)+' · '+probabilityPercent(leg.p,0),distinct:hero.dataset.selectionKey!==oldKey,original:hero.dataset.originalProbability===String(leg.p),date:hero.dataset.originalKickoff===leg.d+'T'+(leg.t||'')};}
   return{absent,dated:badge===want,issued,unchanged:snapshot===JSON.stringify(afState.archive),id,newShown,oldShown};
  });
  if(dated){
   console.log('DATED CASE '+width+'px fixture '+dated.id+' new date '+(dated.newShown?'inside':'outside')+' strip, original date '+(dated.oldShown?'inside':'outside')+' strip');
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
     /* clientWidth/clientHeight are 0 for display:inline boxes in every engine, while Firefox
        reports their content size as scrollWidth/scrollHeight (Chromium and WebKit report 0). An
        inline box cannot clip its own text, so it is judged by its nearest ancestor that clips:
        every line fragment must lie inside that ancestor's padding box. */
     const inline=getComputedStyle(e).display==='inline';let clipper=null;
     if(inline){for(let a=e.parentElement;a&&a!==document.body;a=a.parentElement){if(getComputedStyle(a).overflow!=='visible'){clipper=a;break;}}}
     const outside=clipper&&[...e.getClientRects()].some(r=>{const c=clipper.getBoundingClientRect(),l=c.left+clipper.clientLeft,t=c.top+clipper.clientTop;return r.left<l-2||r.top<t-2||r.right>l+clipper.clientWidth+2||r.bottom>t+clipper.clientHeight+2;});
     if(inline?outside:(e.scrollWidth>e.clientWidth+2||e.scrollHeight>e.clientHeight+2))clipped.push({id:e.id,text:e.textContent.trim(),tag:e.tagName,cls:e.className,display:getComputedStyle(e).display,overflow:getComputedStyle(e).overflow,font:getComputedStyle(e).fontFamily+' '+getComputedStyle(e).fontSize+'/'+getComputedStyle(e).lineHeight,sw:e.scrollWidth,cw:e.clientWidth,sh:e.scrollHeight,ch:e.clientHeight});
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
  /* The feed re-renders when a newer edition arrives, which detaches the row being scrolled to. The
     row is re-resolved and the scroll retried. The click below re-resolves it too. */
  const target=page.locator('#fixtureList .fxrow .tline').last();
  for(let attempt=0;;attempt++){try{await target.scrollIntoViewIfNeeded({timeout:5000});break;}catch(e){if(attempt>=4)throw e;await page.waitForTimeout(400);}}
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
