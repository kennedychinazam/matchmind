/* THE GAPS AN INDEPENDENT REVIEW OF 2e788a8 FOUND IN THE ROLLING-WINDOW TESTS.
 *
 * The production code was sound; these tests were not. The review mutated the shipped code and
 * found survivors, each of which is a real regression that would have reached CI green:
 *
 *   C16/C18/C19  the deduction gate widened to `<= 40`, or to `=== 40 || === 39`, leaks the three
 *                named English clubs onto the World Cup, the Champions League and the Premier
 *                League. The negative case was rendered under league 78 ONLY, so any widening
 *                that happens to miss 78 passed. The operator checklist asks a human to check
 *                La Liga and Serie A; the automated test should not be weaker than the manual one.
 *   C5           `until<=from` was never the deciding guard: the one inverted-envelope case had
 *                `expires_at` in the past, so `until<=now` refused it first. Deleting the term
 *                left all tests passing while an envelope claiming to expire before it was
 *                published would be admitted.
 *   F-5          the Championship note was gated on the league id but not the season, although
 *                the table is drawn for `latestSeasonOf(L)`. Every past and future Championship
 *                season carried a present-tense claim about sanctions that did not apply to it.
 *
 * PROOF CLASS: EMULATION. Offline Chromium on a disposable local origin. No provider, no backend,
 * no credential, no physical device.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require_=createRequire(import.meta.url);
let chromium;
for(const id of [process.env.PWA_PLAYWRIGHT,'playwright','playwright-core'])
 if(id){try{chromium=require_(id).chromium;break;}catch{}}
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

async function open(t){
 const exe=[process.env.PWA_CHROMIUM,process.env.MM_TEST_CHROMIUM,'/opt/pw-browsers/chromium']
  .find(p=>p&&existsSync(p));
 assert.ok(chromium&&exe,'local offline Chromium required');
 const browser=await chromium.launch({executablePath:exe,
  args:['--no-sandbox','--disable-background-networking','--disable-sync']});
 t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},
  timezoneId:'UTC'});
 await context.route('**/*',r=>r.request().url()==='http://review-window.test/'
  ? r.fulfill({status:200,contentType:'text/html',body:html}) : r.abort());
 const page=await context.newPage();
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://review-window.test/');
 return {page,errors};
}

const RESULTS=[
 ['Alpha','Bravo',2,0],['Charlie','Delta',1,1],['Echo','Foxtrot',0,3],
 ['Alpha','Charlie',1,0],['Bravo','Echo',2,2],['Delta','Foxtrot',0,1],
 ['Alpha','Delta',3,1],['Charlie','Echo',2,1],['Bravo','Foxtrot',1,2],
 ['Alpha','Echo',0,0],['Bravo','Charlie',1,3],['Delta','Echo',2,0],
 ['Alpha','Foxtrot',2,1],['Bravo','Delta',0,0],['Charlie','Foxtrot',1,1]
];
/* The three clubs, the competition name, and any minus-signed figure. A leak of ANY of these onto
   a competition that is not league 40 is the defect. */
const LEAK=/Sheffield Wednesday|Leicester|West Brom|Championship|&minus;|−\s*\d/;

const renderAt=`(id,name,season,results)=>{
  const matches=results.map(([home,away,hg,ag],i)=>({date:'2026-09-0'+((i%9)+1),home,away,hg,ag,
   _x:{season,round:'Regular Season - '+(i+1)}}));
  renderStandings({id,name,country:'Synthetic',matches,upcoming:[],sport:'football'},'Alpha','Bravo');
  const box=$('standingsBox');
  return {copy:[...box.querySelectorAll('.subnote')].map(n=>n.textContent).join(' '),
    rows:[...box.querySelectorAll('.frow')].slice(1).map(r=>
      [...r.querySelectorAll('span')].map(x=>x.textContent.trim()).join('|'))};
}`;

test('EVERY competition except the Championship is free of its deductions, not just one of them',
async t=>{
 const {page,errors}=await open(t);
 /* The page's own fitted-competition map, plus the ids a widened gate would most plausibly leak
    onto: the World Cup, the Champions League and the Premier League sit immediately below 40, so
    a `<= 40` gate reaches all three. Union, de-duplicated, so this tracks the map as it grows. */
 const mapped=await page.evaluate(()=>Object.keys(LEAGUE_FIT_NAME).map(Number)
  .filter(n=>Number.isFinite(n)));
 assert.ok(mapped.includes(40),'league 40 should be in the fitted map');
 assert.ok(mapped.includes(78),'league 78 should be in the fitted map');
 const ids=[...new Set([...mapped,1,2,3,4,5,9,11,13,15,39,41,42,45,48,61,78,88,94,135,140,143,848])];
 assert.ok(ids.length>=20,'expected a broad competition set, got '+ids.length+' ids');
 const leaked=[];
 for(const id of ids){
  if(id===40) continue;
  const r=await page.evaluate(([fn,id,name,season,results])=>
   (new Function('return '+fn))()(id,name,season,results),
   [renderAt,id,'Synthetic '+id,2026,RESULTS]);
  if(LEAK.test(r.copy)) leaked.push(id+': '+r.copy.slice(0,120));
  /* And the general line is still there, exactly once, on every one of them. */
  const n=(r.copy.match(/point deductions are not shown/g)||[]).length;
  if(n!==1) leaked.push(id+': the general line appears '+n+' times');
 }
 assert.deepEqual(leaked,[],'competitions carrying another league\'s disciplinary history:\n  '
  +leaked.join('\n  '));
 assert.deepEqual(errors,[],'page errors');
});

test('the Championship note is gated on the season as well as the league',async t=>{
 const {page,errors}=await open(t);
 const seen={};
 for(const season of [2019,2026,2029]){
  const r=await page.evaluate(([fn,id,name,season,results])=>
   (new Function('return '+fn))()(id,name,season,results),
   [renderAt,40,'Championship',season,RESULTS]);
  seen[season]=/Sheffield Wednesday/.test(r.copy);
  /* Whatever the season, the general limitation is stated once and the table is still drawn. */
  assert.equal((r.copy.match(/point deductions are not shown/g)||[]).length,1,
   'season '+season+' lost the general line');
  assert.equal(r.rows.length,6,'season '+season+' did not render the table');
 }
 assert.equal(seen[2026],true,'the season the sweep measured must still carry the finding');
 assert.equal(seen[2019],false,
  'a 2019-20 Championship table claims a discrepancy from deductions that had not happened');
 assert.equal(seen[2029],false,
  'a 2029-30 Championship table claims a discrepancy from deductions that have long expired');
 assert.deepEqual(errors,[],'page errors');
});

test('an envelope that expires before it was published is refused by that term alone',async t=>{
 const {page,errors}=await open(t);
 /* The inversion must be the ONLY fault: expiry is in the FUTURE, so `until<=now` cannot fire,
    the gap is negative so the 24-hour ceiling cannot fire, and as_of is inside the 30s skew
    tolerance so the not-yet-published guard cannot fire either. Only `until<=from` is left. */
 const r=await page.evaluate(()=>{
  const now=Date.now();
  const mk=(asOf,exp)=>({version:'matchmind-display/1',screen:'history',
   edition_id:'11111111-1111-4111-8111-111111111111',
   as_of:new Date(asOf).toISOString(),expires_at:new Date(exp).toISOString(),
   cards:[],board:null,records:{engine:null,clv:null},slips:[]});
  const run=env=>{try{fixtureEnvelope(env,'history');return 'ACCEPTED';}
   catch(e){return 'refused: '+e.message;}};
  return {inverted:run(mk(now+10000,now+5000)),
    /* controls: the same envelope the right way round is accepted, so the test cannot pass
       because fixtureEnvelope rejects everything. */
    valid:run(mk(now-1000,now+3600000)),
    exactly24h:run(mk(now-1000,now-1000+86400000))};
 });
 assert.match(r.inverted,/Display edition expired or unavailable/,
  'an envelope expiring 5s before its own as_of was ACCEPTED: '+r.inverted);
 assert.equal(r.valid,'ACCEPTED','the control envelope should be accepted');
 assert.equal(r.exactly24h,'ACCEPTED','an exactly-24-hour envelope sits on the bound and is valid');
 assert.deepEqual(errors,[],'page errors');
});
