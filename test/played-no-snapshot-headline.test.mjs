/* Build 357 blocker closure: a PLAYED fixture with NO pre-match snapshot.
   index.html:9746 states the rule plainly: "For a match already played, show the pick AS IT WAS
   MADE rather than recomputing. Recomputing trains on data that now contains this very match -
   hindsight". The code honours it only when an archived pick exists. With no snapshot it falls
   through to a full recompute and then presents the result as "The engine's headline call for
   this match" with a confidence percentage, on a match whose result is already in the corpus.
   Because it is recomputed from whatever corpus is loaded at that instant, the same finished
   fixture renders differently from one moment to the next.
   Synthetic offline Chromium; every non-document request intercepted. Invented teams only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
let chromium;
for(const id of [process.env.PWA_PLAYWRIGHT,'playwright','playwright-core'])
  if(id){try{chromium=require(id).chromium;break;}catch{}}
const executablePath=[process.env.MM_TEST_CHROMIUM,process.env.PWA_CHROMIUM,
  '/opt/pw-browsers/chromium','/usr/bin/chromium','/usr/bin/google-chrome'].find(p=>p&&existsSync(p));
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

async function open(t){
  assert.ok(chromium&&executablePath,'local offline Chromium required');
  const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking','--disable-sync']});
  const errors=[];
  t.after(async()=>{await browser.close();assert.deepEqual(errors,[],'no page runtime errors');});
  const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});
  await context.route('**/*',r=>r.request().url()==='http://played-snapshot.test/'
    ?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://played-snapshot.test/');
  return page;
}

/* A local (non-presentation) competition with a real corpus, holding ONE finished fixture that
   has no archived prediction. `extra` adds further results, which is how the corpus differs
   between two renders of the same match. */
const SETUP=`
 /* The team pickers are <select> elements. Assigning .value with no matching <option> leaves it
    empty and analyze() stops at its "pick two different teams" guard, which is how a first
    version of this harness silently tested nothing. The options are created here. */
 globalThis.mkRow=(date,home,away,hg,ag)=>({date,time:'19:45',home,away,hg,ag,hth:0,hta:0,
   ft_h:hg,ft_a:ag,fgh:null,fga:null,pgh:null,pga:null,status:'FT'});
 globalThis.buildLeague=(extra)=>{
  const teams=['Alpha','Beta','Gamma','Delta','Epsilon','Zeta'];
  const ms=[];let d=Date.parse('2026-01-05T00:00:00Z');
  for(let i=0;i<teams.length;i++)for(let j=0;j<teams.length;j++){
   if(i===j)continue;
   ms.push(mkRow(new Date(d).toISOString().slice(0,10),teams[i],teams[j],i%3,j%2));d+=3*86400000;
  }
  /* The corpus difference between two renders of the SAME finished match. */
  for(let k=0;k<(extra||0);k++){ms.push(mkRow(new Date(d).toISOString().slice(0,10),'Gamma','Delta',4,0));d+=3*86400000;}
  ms.push(mkRow('2026-03-01','Alpha','Beta',0,1));   // the fixture under test, already played
  const L={id:39,name:'Synthetic League',country:'Synthetic',sport:'football',matches:ms,
    upcoming:[{fxid:970001,date:'2026-03-01',time:'17:30',home:'Alpha',away:'Beta',status:'FT',gh:0,ga:1}],
    teamIds:{Alpha:1,Beta:2},histTried:true};
  afState.leagues={39:L};afState.leagueOrder=[39];afState.activeLeagueId=39;
  afState.cloudFix={970001:{fxid:970001,gh:0,ga:1,status:'FT',date:'2026-03-01',
    home:'Alpha',away:'Beta',settlement:'final'}};
  afState.archive={};          // NO pre-match snapshot for this fixture
  footballEngine.matches=ms;currentSport='football';
  try{registerLeagueDampen(L);}catch(e){}
  for(const id of ['homeTeam','awayTeam'])
    $(id).innerHTML=teams.map(t=>'<option value="'+t+'">'+t+'</option>').join('');
  return L;
 };
 globalThis.renderPlayed=async(extra)=>{
  buildLeague(extra);
  $('homeTeam').value='Alpha';$('awayTeam').value='Beta';
  if($('homeTeam').value!=='Alpha'||$('awayTeam').value!=='Beta')
    throw new Error('harness did not select the two teams');
  pendingMeta={lid:39,fxid:970001,comp:'Synthetic League',date:'2026-03-01',time:'17:30',
    home:'Alpha',away:'Beta',status:'FT'};
  await analyze();
  if(pendingMetaPlayed!==true) throw new Error('harness did not reach a PLAYED fixture');
  if(pendingMetaPick!=null) throw new Error('harness accidentally supplied an archived pick');
  return {pick:$('heroPick').textContent,conf:$('heroConf').textContent,
          strong:$('heroStrong').textContent,bars:$('outcomeRows').textContent,
          resultSide:$('resultSide')?$('resultSide').textContent:null};
 };
`;

test('a played fixture with no snapshot is not given a headline call or a confidence figure',async t=>{
  const page=await open(t);
  const seen=await page.evaluate(async setup=>{eval(setup);return await renderPlayed(0);},SETUP);
  /* The page itself says these numbers were recalculated with the result in the data. It must not
     then assert them as the engine's call, nor attach a confidence percentage to them.
     These assertions cover the WHOLE hero region, not three fields checked separately.
     Independent QA showed the earlier field-by-field version passed while the screen still made a
     hindsight claim carrying a moving percentage, simply by rewording it and moving it one
     element across. */
  const hero=[seen.pick,seen.conf,seen.strong].join(' | ');
  assert.doesNotMatch(hero,/\d+(\.\d+)?\s*%/,
    'a percentage appears in the hero for a fixture with no stored forecast: '+hero);
  /* An ASSERTED call, not a denial of one. "No prediction was published for this match" is the
     correct text and must not trip this. */
  assert.doesNotMatch(hero,/\bthe engine'?s\b[^|]*\b(call|read|pick|forecast|prediction)\b/i,
    'a hindsight recalculation was presented as the engine call: '+hero);
  assert.doesNotMatch(hero,/confidence/i,'the hero still speaks of confidence: '+hero);
  /* The positive side needs a SUBJECT, so an unrelated "… unavailable" cannot satisfy it. */
  assert.match(seen.pick,/\bno (pre-match )?(published )?(forecast|prediction)\b|\b(forecast|prediction) (was |is )?(not )?(published|stored)\b|statistical prediction unavailable/i,
    'the hero did not say the prediction was never published: '+seen.pick);
});

test('the same played fixture does not change its headline when the corpus grows',async t=>{
  const page=await open(t);
  const a=await page.evaluate(async setup=>{eval(setup);return await renderPlayed(0);},SETUP);
  const b=await page.evaluate(async()=>await renderPlayed(12));
  /* Compare the WHOLE hero, not two fields that are constants once the fix is in. With only
     pick and conf this became a tautology after the fix and could catch nothing. */
  assert.equal(a.pick,b.pick,'the headline moved between two renders of the same finished match');
  assert.equal(a.conf,b.conf,'the confidence moved between two renders of the same finished match');
  assert.equal(a.strong,b.strong,'the hero explanation moved between two renders');
  assert.doesNotMatch([a.pick,a.conf,a.strong,b.pick,b.conf,b.strong].join(' | '),
    /\d+(\.\d+)?\s*%/,'a percentage reached the hero on either render');
});
