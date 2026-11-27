// Actual app functions, inert storage/DOM/SDK and no network or provider calls.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import{readFileSync}from'node:fs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function fn(name){const f=source.indexOf('function '+name+'('),a=source.slice(f-6,f)==='async '?f-6:f,b=source.indexOf('\n}',a);assert.ok(a>=0&&b>a,'actual function '+name);return source.slice(a,b+2);}
function node(){return{textContent:'',innerHTML:'',style:{},classList:{toggle(){}},removeAttribute(){},addEventListener(){}};}
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve();};
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};}
function harness(){
 let now=Date.parse('2026-11-27T12:00:00Z'),next=0;const timers=new Map(),nodes=new Map(),events=[];
 const $=id=>{if(!nodes.has(id))nodes.set(id,node());return nodes.get(id);};
 const c=vm.createContext({Promise,Map,Set,AbortController,Object,Date:class extends Date{static now(){return now;}},setTimeout:(fn,ms)=>{const id=++next;timers.set(id,{fn,at:now+ms});return id;},clearTimeout:id=>timers.delete(id),supa:{},authUser:null,_cloudAccountEpoch:0,_fixtureDelivery:{},_presentationAsOf:0,_presentationUntil:0,_chipBase:'',_dataSourceExplicit:false,curView:'scores',lastTab:'scores',afState:{leagues:{},leagueOrder:[],logos:{},archive:{},cloudFix:{},scores:null},$: $,document:{visibilityState:'visible'},window:{addEventListener:(...args)=>events.push(args)},refreshDataChip:()=>{},fixtureRawCurrent:()=>false,renderFixtures:()=>{},renderFavs:()=>{},renderTips:()=>{},renderStrongPicks:()=>{},renderMoreRecord:()=>{},loadLeans:()=>{},_engineRecord:{state:'pending',at:0},_clvRecord:{state:'pending',at:0},_engineRecordLoading:null,RECORDS_TABLE:'shared_records',ENGINE_RECORD_KEY:'engine',CLV_RECORD_KEY:'clv',fixtureEnvelope:d=>d,fixturePresentationRow:r=>r,archiveRow:r=>r,settledRow:r=>r,unsettled90:()=>false,isFinishedScore:()=>false,_boardIx:null,_loadIssues:[],_loadShort:0,_leaguesLoadedAt:0,_archiveRead:'pending',_boardRecord:{state:'pending'}});
 const start=source.indexOf('/* Public read recovery');assert.ok(start>=0);vm.runInContext(source.slice(start,source.indexOf('/* Bounded provider presentation',start)),c);
 const current=source.slice(source.indexOf('function fixtureDeliveryCurrent(c){'),source.indexOf('function fixtureDetachRaw(c){'));vm.runInContext(current,c);
 vm.runInContext(source.split(/\r?\n/).find(s=>s.startsWith('function fixtureDeliveryReset(){')),c);vm.runInContext('fixtureDeliveryReset();',c);
 for(const name of ['fixtureDetachRaw','fixtureAccess','fixtureDisplayLoad','fixtureDisplayAttempt','fixtureDisplayPair','fixtureHistoryPages','loadSharedRecords','loadFixturePresentation','fixturePublicRows'])vm.runInContext(fn(name),c);
 c.FIXTURE_HISTORY_MAX_PAGES=400;
 const tick=async ms=>{now+=ms;for(const[id,t]of[...timers])if(t.at<=now){timers.delete(id);t.fn();}await flush();};
 return{c,$,timers,events,tick,run:s=>vm.runInContext(s,c),advance:ms=>{now+=ms;}};
}
test('accepted cloud Scores never leave the active public badge at Sample data',()=>{
 const nodes={dataChip:node()},c=vm.createContext({_dataSourceExplicit:false,_presentationAsOf:0,_presentationUntil:0,_chipBase:'',afState:{leagues:{},scores:{source:'cloud',list:[{fxid:1}]}},COMP_IDS:[],label:'Sample data',curView:'scores',lastTab:'scores',supa:{},$:id=>nodes[id],fixtureRawCurrent:()=>false,Date,setDataChip:s=>{c.label=s;}});
 const start=source.indexOf('/* Public read recovery');if(start>=0)vm.runInContext(source.slice(start,source.indexOf('/* Bounded provider presentation',start)),c);
 vm.runInContext(fn('refreshDataChip')+'\nrefreshDataChip();',c);assert.match(nodes.dataChip.textContent||c.label,/Published/);assert.doesNotMatch(nodes.dataChip.textContent||c.label,/Sample/);
});
test('failed empty-cache repaint remains unavailable instead of claiming an empty date',()=>{
 const nodes={scoresMeta:node(),scoresTitle:node(),scoresList:node(),scoresRetry:node()};nodes.scoresMeta.textContent='Matches temporarily unavailable. Please try again.';
 const c=vm.createContext({navigationRetains:()=>false,$:id=>nodes[id],afState:{scores:{source:'cloud',list:[]},scoresDate:'2026-11-27'},scoresDayList:()=>['2026-11-27'],ymdOffset:()=> '2026-11-27',renderScoresDateBar:()=>{},Date,curView:'scores',lastTab:'scores',supa:{},authUser:null,_cloudAccountEpoch:0,_dataSourceExplicit:false,fixtureDeliveryCurrent:()=>true,refreshDataChip:()=>{}});
 const start=source.indexOf('/* Public read recovery');if(start>=0){vm.runInContext(source.slice(start,source.indexOf('/* Bounded provider presentation',start)),c);vm.runInContext("const a=publicReadBegin('scores');publicReadFinish('scores',a,'failed');",c);}
 if(source.includes('function renderScoresRows('))vm.runInContext(fn('renderScoresRows'),c);
 vm.runInContext(fn('renderScores')+'\nrenderScores();',c);assert.match(nodes.scoresMeta.textContent,/unavailable/);assert.doesNotMatch(nodes.scoresMeta.textContent,/No matches/);
});
test('a timed-out screen releases deduplication and late success cannot replace its successful retry',async()=>{
 const h=harness(),first=deferred();let calls=0;h.c.supa.rpc=()=>++calls===1?first.promise:Promise.resolve({error:null,data:{edition_id:'new',as_of:'2026-11-27T12:00:00Z',cards:[]}});
 const p=h.run("fixtureDisplayLoad('scores')");await flush();const duplicate=h.run("fixtureDisplayLoad('scores')");const a=assert.rejects(p,/deadline/),b=assert.rejects(duplicate,/deadline/);await h.tick(12000);await Promise.all([a,b]);assert.equal(calls,1);assert.equal(h.c._fixtureDelivery.screenPending.size,0);
 await h.run("fixtureDisplayLoad('scores')");first.resolve({error:null,data:{edition_id:'obsolete',as_of:'2026-11-27T11:00:00Z',cards:[]}});await flush();assert.equal(h.c._fixtureDelivery.screens.get('scores').edition_id,'new');assert.equal(calls,2);
});
test('public read deadline propagates to a real query abort hook and observes late rejection',async()=>{
 const h=harness(),pending=deferred();let signal;h.c.factory=()=>({abortSignal:s=>{signal=s;return pending.promise;}});
 const p=h.run('publicReadRequest(factory,publicReadContext())'),failed=assert.rejects(p,/deadline/);await flush();await h.tick(12000);await failed;assert.equal(signal.aborted,true);pending.reject(Error('late invented private failure'));await flush();assert.equal(h.timers.size,0);
});
test('elapsed wall deadline rejects a result even when a throttled timer has not fired',async()=>{
 const h=harness();let signal;h.c.factory=()=>({abortSignal:s=>{signal=s;h.advance(12001);return Promise.resolve({tooLate:true});}});
 await assert.rejects(h.run('publicReadRequest(factory,publicReadContext())'),/deadline/);assert.equal(signal.aborted,true);assert.equal(h.timers.size,0);
});
test('late access acknowledgement after timeout cannot restore raw authority',async()=>{
 const h=harness(),first=deferred();h.c.authUser={id:'A'};h.run('fixtureDeliveryReset()');h.c.supa.rpc=()=>first.promise;
 const p=h.run('fixtureAccess()');await flush();await h.tick(12000);assert.equal(await p,false);first.resolve({error:null,data:{version:'matchmind-fixture-access/1',raw_allowed:true,expires_at:'2026-11-27T12:00:40Z'}});await flush();assert.equal(h.c._fixtureDelivery.rawAllowed,false);assert.equal(h.c._fixtureDelivery.promise,null);
});
test('history whole-operation deadline prevents partial archive adoption',async()=>{
 const h=harness();let calls=0;const payload={edition_id:'one',as_of:'2026-11-27T12:00:00Z',cards:[{fxid:1}]};h.c.payload=payload;
 h.c.supa.rpc=async()=>{h.advance(10000);calls++;return{error:null,data:{edition_id:payload.edition_id,as_of:payload.as_of,cards:[{fxid:calls+1}],next:{date:'2026-11-26',fxid:calls+1}}};};
 await assert.rejects(h.run('fixtureHistoryPages(_fixtureDelivery,payload)'),/deadline/);assert.ok(calls<=5);assert.deepEqual(payload.cards,[{fxid:1}]);
});
test('the same Analysis budget spans edition restarts instead of resetting per pair',async()=>{
 const h=harness(),budgets=[];let calls=0;h.c.fixtureDisplayLoad=async(screen,budget)=>{budgets.push(budget);h.advance(10000);if(++calls>4)throw Error('Public read deadline exceeded');return{edition_id:screen+'-'+calls,as_of:'2026-11-27T12:00:00Z'};};
 await assert.rejects(h.run("fixtureDisplayPair('predictions','history')"),/deadline/);assert.equal(new Set(budgets).size,1);assert.ok(budgets.length<=6);
});
test('record deadline releases retry and an obsolete failure cannot clear a later account success',async()=>{
 const h=harness(),old=deferred();let response=old.promise;h.c.supa.rpc=async(name)=>name==='matchmind_fixture_access_v1'?{error:null,data:{version:'matchmind-fixture-access/1',raw_allowed:false}}:response;
 const p=h.run('loadSharedRecords()');await flush();await h.tick(12000);await p;assert.equal(h.c._engineRecord.state,'failed');assert.equal(h.run("publicReadState('records').state"),'failed');
 h.c.authUser={id:'B'};h.c._cloudAccountEpoch++;response=Promise.resolve({error:null,data:{edition_id:'new',as_of:'2026-11-27T12:00:00Z',cards:[],board:null,records:{engine:{key:'engine',payload:{total:7},computed_at:'2026-11-27T12:00:00Z',build:368},clv:null}}});await h.run('loadSharedRecords()');old.reject(Error('old private failure'));await flush();assert.equal(h.c._engineRecord.payload.total,7);assert.equal(h.run("publicReadState('records').state"),'loaded');assert.equal(h.c._engineRecordLoading,null);
});
test('obsolete Analysis error leaves newer context data and status untouched',async()=>{
 const h=harness(),old=deferred();h.c.fixtureDisplayPair=()=>old.promise;const p=h.run('loadFixturePresentation()');await flush();h.c.authUser={id:'B'};h.c._cloudAccountEpoch++;h.c.afState.leagues={39:{_presentation:true,upcoming:[{pick:'original'}]}};h.c._presentationUntil=Date.parse('2026-11-27T13:00:00Z');h.$('fixturesMeta').textContent='new account status';old.reject(Error('old account error'));await p;assert.equal(h.$('fixturesMeta').textContent,'new account status');assert.equal(h.c.afState.leagues[39].upcoming[0].pick,'original');
});
test('failed record recovers in-place on one coalesced visible reconnect, not on hidden events',async()=>{
 const h=harness();h.c.curView='data';let records=0,results=0;h.c.loadSharedRecords=async()=>{records++;};h.c.loadCloudResults=async()=>{results++;};h.run("const a=publicReadBegin('records');publicReadFinish('records',a,'failed');publicReadInstall();");assert.equal(h.events[0][0],'online');h.events[0][1]();h.events[0][1]();assert.equal(h.timers.size,1);await h.tick(250);assert.equal(records,1);assert.equal(results,1);h.c.document.visibilityState='hidden';assert.equal(h.run('publicReadRecover()'),false);await h.tick(250);assert.equal(records,1);
});
test('resource scopes and attempts reject stale commits without affecting independent resources',()=>{
 const h=harness(),old=h.run("publicReadBegin('scores')"),newer=h.run("publicReadBegin('scores')");h.c.old=old;h.c.newer=newer;assert.equal(h.run("publicReadFinish('scores',old,'failed')"),false);assert.equal(h.run("publicReadFinish('scores',newer,'loaded',{asOf:Date.now()})"),true);assert.equal(h.run("publicReadState('records').state"),'idle');h.c._cloudAccountEpoch++;assert.equal(h.run("publicReadState('scores').state"),'idle');assert.equal(h.run("publicReadFinish('scores',newer,'failed')"),false);
});
test('explicit CSV or sample selection keeps its own badge',()=>{
 const h=harness();h.c._dataSourceExplicit=true;h.$('dataChip').textContent='Custom CSV';assert.equal(h.run('publicDataChip()'),false);assert.equal(h.$('dataChip').textContent,'Custom CSV');
});
test('missing SDK recovery is an explicit Reload action without clearing stored data',async()=>{
 const h=harness();let reloads=0;h.c.supa=null;h.c.location={reload:()=>{reloads++;}};h.run("const a=publicReadBegin('scores');publicReadFinish('scores',a,'failed');");assert.equal(h.$('scoresRetry').textContent,'Reload');assert.equal(reloads,0);await h.run("publicReadRetry('scores')");assert.equal(reloads,1);
});
