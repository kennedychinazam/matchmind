// The League Table's point-deduction caveat is scoped to the competition it is about.
// Offline: no provider or production endpoint is contacted.
//
// The 2026-08-23 provider sweep found three point deductions, all of them in the English
// Championship (league id 40). That finding was printed under EVERY table, so a reader looking at
// the Bundesliga was told about Sheffield Wednesday, Leicester and West Brom. Three named English
// clubs' disciplinary history is not a fact about another competition, and printing it there
// invites the inference that some side in the table on screen is carrying a penalty.
//
// The general limitation - a table derived from results cannot see an administrative deduction -
// is true everywhere and stays, once and briefly, on every table. The specific finding belongs to
// league 40 only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('playwright-core');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');

async function open(t){
 const exe=process.env.MM_TEST_CHROMIUM;assert.ok(exe&&existsSync(exe),'local offline Chromium required');
 const browser=await chromium.launch({executablePath:exe,args:['--no-sandbox','--disable-background-networking','--disable-sync']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844},timezoneId:'UTC'});
 await context.route('**/*',r=>r.request().url()==='http://public-display.test/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
 const page=await context.newPage();await page.goto('http://public-display.test/');return page;
}

/* ONE shaped result set, rendered twice under two different league ids. Six sides, fifteen league
   fixtures, every one in the Regular Season so none of them is a play-off, and no side exceeds the
   2*(teams-1) league-phase bound, so the `over` tripwire stays silent in both renders. */
const SEASON=2026;
const RESULTS=[
 ['Alpha','Bravo',2,0],['Charlie','Delta',1,1],['Echo','Foxtrot',0,3],
 ['Alpha','Charlie',1,0],['Bravo','Echo',2,2],['Delta','Foxtrot',0,1],
 ['Alpha','Delta',3,1],['Charlie','Echo',2,1],['Bravo','Foxtrot',1,2],
 ['Alpha','Echo',0,0],['Bravo','Charlie',1,3],['Delta','Echo',2,0],
 ['Alpha','Foxtrot',2,1],['Bravo','Delta',0,0],['Charlie','Foxtrot',1,1]
];

/* The expected table, computed here independently of the page: 3/1/0, ordered on points, then goal
   difference, then goals for, then name. If the page's arithmetic ever moves, this notices. */
function expectedRows(){
 const R={};
 const bump=(t,gf,ga)=>{const r=R[t]||(R[t]={pts:0,gf:0,ga:0,pl:0});r.pl++;r.gf+=gf;r.ga+=ga;r.pts+=gf>ga?3:gf===ga?1:0;};
 for(const [h,a,hg,ag] of RESULTS){bump(h,hg,ag);bump(a,ag,hg);}
 const names=Object.keys(R).sort((a,b)=>(R[b].pts-R[a].pts)
  ||((R[b].gf-R[b].ga)-(R[a].gf-R[a].ga))||(R[b].gf-R[a].gf)||(a<b?-1:a>b?1:0));
 return names.map((n,i)=>({pos:String(i+1),team:n,pl:String(R[n].pl),
  gd:(R[n].gf-R[n].ga>0?'+':'')+(R[n].gf-R[n].ga),pts:String(R[n].pts)}));
}

async function render(page,id,name){
 return page.evaluate(({id,name,season,results})=>{
  const matches=results.map(([home,away,hg,ag],i)=>({date:'2026-09-0'+((i%9)+1),home,away,hg,ag,
   _x:{season,round:'Regular Season - '+(i+1)}}));
  const L={id,name,country:'Synthetic',matches,upcoming:[],sport:'football'};
  renderStandings(L,'Alpha','Bravo');
  const box=$('standingsBox');
  const rows=[...box.querySelectorAll('.frow')].slice(1).map(r=>{
   const s=[...r.querySelectorAll('span')].map(x=>x.textContent.trim());
   return{pos:s[0],team:s[1],pl:s[2],gd:s[3],pts:s[4]};
  });
  return{notes:[...box.querySelectorAll('.subnote')].map(n=>n.textContent),
   copy:[...box.querySelectorAll('.subnote')].map(n=>n.textContent).join(' '),
   html:box.innerHTML,rows,
   hidden:$('acc-standings').classList.contains('hidden')};
 },{id,name,season:SEASON,results:RESULTS});
}

test('another competition is never told about the Championship deductions',async t=>{
 const page=await open(t);
 const bund=await render(page,78,'Bundesliga');
 assert.equal(bund.hidden,false,'the panel is on screen');
 for(const forbidden of ['Sheffield Wednesday','Leicester','West Brom','Championship'])
  assert.ok(!bund.copy.includes(forbidden),
   `the Bundesliga table must not mention ${forbidden}: ${JSON.stringify(bund.copy)}`);
 /* Nor by number: a reader must not be able to read a deduction off another league's panel. */
 assert.ok(!/−\s?\d|&minus;|docked/i.test(bund.copy),'no deduction figure appears on another competition');
 /* The general limitation is still said, once, and briefly. */
 const deduction=bund.notes.filter(n=>/point deductions are not shown/.test(n));
 assert.equal(deduction.length,1,'the derived-table limitation is stated exactly once');
 assert.ok(deduction[0].length<=140,'and briefly: '+deduction[0].length+' characters');
 assert.match(deduction[0],/Derived from results/);
});

test('the Championship itself may carry its own finding, and is gated on the league id',async t=>{
 const page=await open(t);
 const champ=await render(page,40,'Championship');
 const deduction=champ.notes.filter(n=>/point deductions are not shown/.test(n));
 assert.equal(deduction.length,1,'the general limitation is still stated exactly once here too');
 assert.ok(deduction[0].length<=140,'and briefly: '+deduction[0].length+' characters');
 assert.match(champ.copy,/Sheffield Wednesday/,'the specific finding belongs on the competition it is about');
 assert.match(champ.copy,/Leicester/);
 assert.match(champ.copy,/West Brom/);

 /* The gate is the ID, not the display name: a competition merely NAMED "Championship" does not
    inherit league 40's disciplinary history, and league 40 keeps it under any name. */
 const impostor=await render(page,78,'Championship');
 assert.ok(!impostor.copy.includes('Sheffield Wednesday'),'the name alone must not unlock the finding');
 const renamed=await render(page,40,'Sky Bet Championship');
 assert.match(renamed.copy,/Sheffield Wednesday/,'and the id alone is enough');
});

test('scoping the copy leaves the standings arithmetic untouched',async t=>{
 const page=await open(t);
 const expected=expectedRows();
 const bund=await render(page,78,'Bundesliga');
 const champ=await render(page,40,'Championship');
 assert.deepEqual(bund.rows,expected,'positions, played, goal difference and points are the derived table');
 assert.deepEqual(champ.rows,bund.rows,'the same input gives the same table in both competitions');
 /* And nothing resembling an applied deduction reaches the numbers. */
 assert.equal(bund.rows.reduce((n,r)=>n+Number(r.pts),0),
  RESULTS.reduce((n,[,,h,a])=>n+(h===a?2:3),0),'total points are exactly what the results award');
 assert.equal(bund.rows.reduce((n,r)=>n+Number(r.pl),0),RESULTS.length*2);
});

test('the league-phase tripwire branch is unchanged and still fires on its own',async t=>{
 const page=await open(t);
 const r=await page.evaluate(({season})=>{
  /* Two sides only, so 2*(teams-1) is 2, and three meetings exceed it. */
  const matches=[['One','Two',1,0],['Two','One',0,1],['One','Two',2,2]].map(([home,away,hg,ag],i)=>
   ({date:'2026-09-0'+(i+1),home,away,hg,ag,_x:{season,round:'Regular Season - '+(i+1)}}));
  renderStandings({id:78,name:'Bundesliga',country:'Synthetic',matches,upcoming:[],sport:'football'},'One','Two');
  return[...$('standingsBox').querySelectorAll('.subnote')].map(n=>n.textContent);
 },{season:SEASON});
 assert.ok(r.some(n=>/may include matches that are not league fixtures/.test(n)),'the tripwire still fires');
 assert.ok(r.some(n=>/point deductions are not shown/.test(n)),'and the general limitation is still said beside it');
 assert.ok(!r.join(' ').includes('Sheffield Wednesday'),'without importing another league\'s finding');
});
