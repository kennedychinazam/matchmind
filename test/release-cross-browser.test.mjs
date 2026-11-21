// Release check in Chromium, Firefox or WebKit (MM_RELEASE_BROWSER) at 320px and 390px. Offline:
// the real index.html is served from memory and the display server is an in-page double that
// speaks the bounded-window contract (window edition + paged history + publisher answer).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const driver=require(process.env.PWA_PLAYWRIGHT||'playwright-core');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const engine=process.env.MM_RELEASE_BROWSER||'chromium';
assert.ok(['chromium','firefox','webkit'].includes(engine));
const launch=()=>driver[engine].launch(engine==='chromium'?{executablePath:process.env.PWA_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']}:{});
const rig=()=>{
 const day=n=>new Date(Date.now()+n*86400000).toISOString().slice(0,10),stamp=new Date(Date.now()-60000).toISOString();
 const card=(fxid,d,pred,status)=>({fxid,lid:39,lname:'Premier League',lcountry:'England',date:day(d),time:'15:00',status:status||(d<0?'FT':'NS'),elapsed:null,home:'Home '+fxid,away:'Away '+fxid,
  gh:d<0?2:null,ga:d<0?1:null,ft_h:d<0?2:null,ft_a:d<0?1:null,ht_h:null,ht_a:null,updated_at:stamp,provider:'af',home_logo:'https://media.api-sports.io/football/teams/'+fxid+'.png',away_logo:'https://media.api-sports.io/football/teams/'+(fxid+1)+'.png',llogo:'https://media.api-sports.io/football/leagues/39.png',
  prediction:pred?{lid:39,lname:'Premier League',home:'Home '+fxid,away:'Away '+fxid,pick:'1',pick_prob:.61,market:'1X2',p_home:.61,p_draw:.22,p_away:.17,xg_home:1.6,xg_away:.9,kickoff:day(d),ktime:'15:00',made_at:stamp,withheld_at:null,final_pick:'1',build:358}:null});
 const window_=[card(1001,-2,true),card(1002,0,false),card(1003,2,true),card(1004,5,false)];
 const old=Array.from({length:12},(_,i)=>card(2000+i,-10-i,true));
 const env={version:'matchmind-display/1',edition_id:'e1',as_of:stamp,expires_at:new Date(Date.now()+3600e3).toISOString(),board:null,records:{engine:null,clv:null},slips:[]};
 window.__calls=[];window.__publisher=false;
 supa={auth:{getSession:async()=>({data:{session:null},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},from:()=>{throw Error('raw table reached');},
  rpc:async(name,args)=>{window.__calls.push(name);
   if(name==='matchmind_fixture_access_v1')return{data:{version:'matchmind-fixture-access/1',raw_allowed:false,expires_at:null},error:null};
   if(name==='matchmind_publisher_v1')return{data:{version:'matchmind-publisher/1',publisher:window.__publisher},error:null};
   if(name==='matchmind_display_v1'){const s=args.screen;const cards=s==='scores'?window_.map(c=>({...c,prediction:null})):s==='records'||s==='slips'?[]:s==='history'?window_.filter(c=>c.prediction):window_;
    return{data:{...env,screen:s,cards,...(s==='history'?{history_paged:true}:{})},error:null};}
   if(name==='matchmind_history_v1'){const first=!args.before_date;const page=first?old.slice(0,8):old.slice(8);
    return{data:{...env,screen:'history',cards:page,next:first?{date:page[7].date,fxid:page[7].fxid}:null},error:null};}
   return{data:null,error:{message:'unknown rpc'}};}};
};
for(const width of [320,390])test(engine+' '+width+'px: window edition plus paged history, guest and signed-in publisher authority',async t=>{
 const browser=await launch();t.after(()=>browser.close());
 const ctx=await browser.newContext({serviceWorkers:'block',viewport:{width,height:844}});
 await ctx.addInitScript(()=>{try{localStorage.setItem('mm_intro','1');}catch{}});
 await ctx.route('**/*',r=>r.request().url()==='http://release.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
 const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://release.test/');await page.waitForFunction(()=>typeof fixtureDisplayLoad==='function');
 const x=await page.evaluate(async rigSrc=>{
  eval('('+rigSrc+')()');fixtureDeliveryReset();
  const h=await fixtureDisplayLoad('history');
  const ids=h.cards.map(c=>c.fxid);
  await loadFixturePresentation();
  try{renderFixtures();}catch(e){return{err:'renderFixtures '+e.message};}
  const scores=await fixtureTable('fixtures').select('*');
  const guest=isPublisher();
  authUser={id:'00000000-0000-4000-8000-000000000001'};
  const notEnrolled=await publisherAuthorityRefresh();
  window.__publisher=true;const enrolled=await publisherAuthorityRefresh();const after=isPublisher();
  authUser=null;const signedOut=isPublisher();
  const crestHtml=crest('Home 1001'),badge=competitionBadge(afState.leagues[39]||{}),scoresLogos=(scores.data||[]).filter(r=>r.home_logo).length;
  const doc=document.scrollingElement;
  return{ids,archive:Object.keys(afState.archive||{}).length,scores:(scores.data||[]).length,scoresErr:scores.error,guest,notEnrolled,enrolled,after,signedOut,overflow:doc.scrollWidth>innerWidth+1,calls:window.__calls,crestHtml,badge,scoresLogos,text:document.body.innerText};
 },rig.toString());
 assert.equal(x.err,undefined);
 assert.equal(new Set(x.ids).size,14,'2 window predictions + 12 paged history predictions, each once');
 assert.ok(x.archive>=14,'every issued prediction reaches the archive');
 assert.equal(x.scores,4);assert.equal(x.scoresErr,null);
 assert.equal(x.guest,false);assert.equal(x.notEnrolled,false);assert.equal(x.enrolled,true);assert.equal(x.after,true);assert.equal(x.signedOut,false);
 assert.equal(x.calls.filter(c=>c==='matchmind_history_v1').length>=2,true);
 assert.equal(x.overflow,false,'no sideways scroll');
 assert.match(x.crestHtml,/<img class="crest" src="https:\/\/media\.api-sports\.io\/football\/teams\/1001\.png"/,'Build 355 team crest');
 assert.match(x.badge,/<img src="https:\/\/media\.api-sports\.io\/football\/leagues\/39\.png"/,'Build 355 league logo');
 assert.equal(x.scoresLogos,4,'Scores rows carry their crests');
 assert.ok(!/api key/i.test(x.text),'no API key wording on the public page');
 assert.deepEqual(errors,[]);
});
