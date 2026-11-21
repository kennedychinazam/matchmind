// Build 361: the match detail draws Goals Markets, Half-time / Full-time, Likely Scorers, Form, Head to head,
// the League Table and the written analysis from matchmind_match_context_v1 with Build 355's own functions.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8').replace(/\r\n/g,'\n');
const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
function extract(head){const a=html.indexOf(head);assert.ok(a>=0&&html.indexOf(head,a+1)<0,'unique '+head);let i=html.indexOf('{',a),d=0;for(;i<html.length;i++){if(html[i]==='{')d++;else if(html[i]==='}'&&!--d)break;}return html.slice(a,i+1);}
// SHA-256 of each function as it stands at Build 355 (036f09b); they must still be byte-identical.
const UNCHANGED_355={
 'function renderHTFT(':'5db6cf4e7029acb90d6e65cf489c62121fb6e3be572c4b60b10369456c31f9c6','function htftFor(':'3676e79750213ede1d3a35d90bf02b1e4c73ba82347e7dd01310f43d7378659e',
 'function halfEngine(':'1b4980be0bca3d58e9899ae5dce698dc9b7f658b9862c7e70b68c28f5fd1e4d8','function htftGrid(':'052597051d66902438692bae8be60f1250f8a1d1c02ffea4fc92ec88eb716545',
 'function tableAt(':'230d3d4e807347ddceeb2a6fc747bc48fc69e1d67e4fa38939800e06dc64c17f','function seasonRoster(':'f71c34b32d36a7d71b138dce99fc382cb7a84a192e48b1e295daef3a4606c95a',
 'function tableAsOf(':'bd5762b62d94f979163be6d18067f54d46bcd5199b7048b1bb3c356edeecbb96','function latestSeasonOf(':'c4cefd0770daca019051fb7a61ba4ffdcd23ded24b029b60e24f336b6771197c',
 'function formRow(':'3f5b78feb1d57ed1ae45106dfde1fb64e0a199aa2c655c251baa4f6d105406d4','  form(team, k=5, upTo){':'26254a60677484a70b441a3c7085b8199975f53060694e7c89a89a57f0c1111d',
 '  h2h(home, away, upTo){':'b63dd43775d23c6176b6ddc51dd4954e8073aea8f5af8a58ad7fb0c41cfdfe63','  scorerProbs(team, lambdaTeam, scorers){':'b14043a0fe579f42de9430f4ce864745a44a6f65afb1e14ebfb8669bd65e4805',
 '  rates(upTo){':'deaba1ea0c80ef1871d8390ec786df6a36fa0d260bc9beb64769735f4d555e7d','  marketsFor(':'63bcd53fa023945566645954975fc754bded4a03d32dab188b94246d9141fce5'};
test('Build 355 panel functions are unchanged',()=>{
 for(const [h,sha] of Object.entries(UNCHANGED_355))assert.equal(createHash('sha256').update(extract(h)).digest('hex'),sha,h);
});
test('the published detail draws the seven panels from the match context with 355 functions',()=>{
 const r=extract('async function renderMatchContext('),pa=extract('function renderPublishedAnalysis(');
 for(const call of ["client.rpc('matchmind_match_context_v1',{fxid})"])assert.ok(extract('async function matchContextLoad(').includes(call));
 for(const call of ['renderHTFT(CL,','renderStandings(CL,','E.form(home,5,cut)','E.form(away,5,cut)','E.h2h(home,away,cut)','footballEngine.scorerProbs(home,s.xh,C.scorers)','publishedGrid(s.xh,s.xa,L,{rates:matchContextRates(C.matches)})','runAIWriter(aiProvider,enginePayloadStr(ctx),credential)','formRow(formH)','No previous meetings in the dataset.'])
  assert.ok(r.includes(call),call);
 assert.ok(pa.includes('renderMatchContext(L,f,S)'));
 for(const gone of ['Form not published.','Head-to-head meetings not published.','League table unavailable for this competition.','AI write-up not published.','Scorer probabilities not published.','Half-time/full-time probabilities not published.'])
  assert.ok(!pa.includes(gone)&&!r.includes(gone),'no empty state: '+gone);
 assert.ok(r.includes("note('Model information. Not an issued pick.')"),'HT/FT keeps the honest caption');
 assert.ok(/Model information\. Not an issued pick\./.test(r),'scorers caption');
 // A played match never sees its own result as prior form: the cut is this fixture's index.
 assert.ok(r.includes('m.date===f.date&&m.home===home&&m.away===away'));
 // Stale responses never paint another match.
 assert.ok((r.match(/gen!==_analysisGeneration/g)||[]).length>=4);
});
test('written analysis follows the issued pick, never a pick computed in the browser',()=>{
 const a=extract('function publishedLocalAnalysis('),v=extract('function publishedLocalVerdict(');
 for(const s of [a,v]){assert.ok(!s.includes('ladderPick')&&!s.includes('headlinePick'));assert.ok(!s.includes('—'));}
});
test('matchContextDecode admits the closed wire shape and refuses anything else',()=>{
 const ctx=vm.createContext({});
 vm.runInContext(`const MATCH_CONTEXT_VERSION='matchmind-match-context/1';const MATCH_CONTEXT_BOUNDS={matches:6000,teams:1500,upcoming:1000,scorers:40,rounds:400};${extract('function matchContextDecode(')};var api={matchContextDecode};`,ctx);
 const {matchContextDecode:dec}=vm.runInContext('api',ctx);
 const good={version:'matchmind-match-context/1',fxid:5,lid:7,season:2026,home:'A',away:'B',from:'2021-11-21',to:'2026-11-21',as_of:'2026-11-21T10:00:00Z',
  teams:['A','B'],rounds:['Regular Season'],m:[[0,0,1,2,1,1,0,2021,0],[1,1,0,0,0,null,null,2021,null]],up:[[0,1,2026]],scorers:{season:2026,home:[['P. One',3,5]],away:[]}};
 const C=JSON.parse(JSON.stringify(dec(good,5)));
 assert.deepEqual(C.matches[0],{date:'2021-11-21',home:'A',away:'B',hg:2,ag:1,hth:1,hta:0,_x:{season:2021,round:'Regular Season'}});
 assert.deepEqual(C.matches[1]._x,{season:2021},'an absent round is absent, as 355 providerExtras left it');
 assert.deepEqual(C.scorers,[{name:'P. One',team:'A',goals:3,apps:5}]);
 const bad=[x=>{x.fxid=6;},x=>{x.version='x';},x=>{x.m[0][1]=9;},x=>{x.m[0][3]=-1;},x=>{x.m[0].push(1);},x=>{x.m.reverse();},x=>{x.m[0][0]=99999;},
  x=>{x.scorers.home[0][1]=0;},x=>{x.teams=Array(1501).fill('t');},x=>{x.up[0]=[0];},x=>{x.m[0][8]=4;}];
 for(const f of bad){const v=structuredClone(good);f(v);assert.throws(()=>dec(v,5));}
});
test('Build 361 ships the client and the service worker together',()=>{
 assert.match(html,/const APP_BUILD = 362;/);assert.match(sw,/const CACHE = 'matchmind-v362';/);
});
