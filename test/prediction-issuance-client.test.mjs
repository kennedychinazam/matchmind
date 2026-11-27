// Actual archive flush, synthetic deferred prices and SDK; no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const section=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i);return source.slice(i,j);};
function fixture(){
 let now=Date.parse('2026-11-27T12:00:00Z'),resume;const writes=[],reads=[];
 class Clock extends Date{static now(){return now;}}
 const client={},authority={ok:true};
 const row=id=>({fxid:id,kickoff:'2026-11-27',ktime:'12:01',pick:'1',pick_prob:.7,made_at:'2026-11-27T11:59:59Z'});
 const ctx=vm.createContext({Date:Clock,console,Map,Set,supa:client,authUser:{id:'A'},_cloudAccountEpoch:1,_publisherAuthority:authority,archiveDenied:false,archiveQueue:new Map([[1,row(1)]]),driftQueue:new Map(),archiveTimer:null,DRIFT_PER_FLUSH:4,afState:{archive:{}},archiveWritable:()=>!ctx.archiveDenied,isPublisher:()=>ctx._publisherAuthority.ok&&ctx.authUser?.id==='A',archiveFailure:(...x)=>ctx.failures.push(x),failures:[],archiveRow:r=>r,setTimeout:()=>1,clearTimeout:()=>{},stampPublicationPrices:()=>new Promise(r=>resume=r),fixtureTable:()=>({upsert:async(rows,opts)=>{writes.push({rows:structuredClone(rows),opts});return{};},select:()=>({in:async(_key,ids)=>{reads.push(ids);return{data:ids.map(fxid=>({fxid,pick:'X',made_at:'server-time'}))};}}),update:()=>({eq:async()=>({})})})});
 vm.runInContext(section('function kickoffUTC(','function localHM('),ctx);
 const helper=source.indexOf('function predictionWriteContext('),start=source.indexOf('async function flushPredictionArchive()');
 if(helper>=0)vm.runInContext(source.slice(helper,start),ctx);
 vm.runInContext(section('async function flushPredictionArchive()','const LEAN_TABLE'),ctx);
 return{ctx,writes,reads,row,setNow:n=>now=Date.parse(n),resume:()=>resume(),start:()=>ctx.flushPredictionArchive()};
}
for(const change of ['kickoff','identity','epoch','client','authority'])test('deferred price read cannot dispatch after '+change,async()=>{
 const f=fixture(),work=f.start();
 if(change==='kickoff')f.setNow('2026-11-27T12:01:00Z');
 if(change==='identity')f.ctx.authUser={id:'B'};
 if(change==='epoch')f.ctx._cloudAccountEpoch++;
 if(change==='client')f.ctx.supa={};
 if(change==='authority')f.ctx._publisherAuthority={ok:false};
 f.resume();await work;assert.equal(f.writes.length,0);
});
test('benign price failure still publishes valid rows with duplicate-ignore and canonical readback',async()=>{
 const f=fixture();f.ctx.stampPublicationPrices=async()=>{throw Error('synthetic prices unavailable');};await f.start();assert.equal(f.writes.length,1);assert.equal(f.writes[0].opts.ignoreDuplicates,true);assert.equal(f.ctx.afState.archive[1].pick,'X');assert.equal(f.ctx.afState.archive[1].made_at,'server-time');
});
test('expired member is excluded while valid fresh member is still published',async()=>{
 const f=fixture();f.ctx.archiveQueue.set(2,{...f.row(2),ktime:'12:02'});const work=f.start();f.setNow('2026-11-27T12:01:00Z');f.resume();await work;assert.deepEqual(f.writes[0].rows.map(r=>r.fxid),[2]);
});

for(const change of ['identity','epoch','client'])test('canonical readback cannot merge after '+change,async()=>{
 const f=fixture();let finish;f.ctx.stampPublicationPrices=async()=>{};
 f.ctx.fixtureTable=()=>({upsert:async()=>({}),select:()=>({in:()=>new Promise(r=>finish=r)})});
 const work=f.start();for(let n=0;n<20&&!finish;n++)await Promise.resolve();assert.ok(finish);
 if(change==='identity')f.ctx.authUser={id:'B'};if(change==='epoch')f.ctx._cloudAccountEpoch++;if(change==='client')f.ctx.supa={};
 f.ctx.afState={archive:{marker:{pick:'new owner'}}};finish({data:[{fxid:1,pick:'old owner'}]});await work;
 assert.deepEqual(Object.keys(f.ctx.afState.archive),['marker']);
});
test('drift failure after identity change cannot undo new owner state',async()=>{
 const f=fixture();f.ctx.archiveQueue.clear();f.ctx.driftQueue.set(1,{fxid:1,final_pick:'X',_wasFinal:'1'});let finish;
 f.ctx.fixtureTable=()=>({update:()=>({eq:()=>new Promise(r=>finish=r)})});const work=f.start();assert.ok(finish);
 f.ctx.authUser={id:'B'};f.ctx.afState={archive:{1:{finalPick:'new owner'}}};finish({error:{message:'denied'}});await work;
 assert.equal(f.ctx.afState.archive[1].finalPick,'new owner');assert.equal(f.ctx.failures.length,0);
});

test('same-owner denial releases every untried optimistic drift guard',async()=>{
 const f=fixture();f.ctx.archiveQueue.clear();for(const [id,old]of [[1,'1'],[2,'2'],[3,'X']]){f.ctx.driftQueue.set(id,{fxid:id,final_pick:'1X',_wasFinal:old});f.ctx.afState.archive[id]={finalPick:'1X'};}
 f.ctx.archiveFailure=()=>{f.ctx.archiveDenied=true;return true;};let writes=0;
 f.ctx.fixtureTable=()=>({update:()=>({eq:async()=>{writes++;return{error:{message:'denied'}};}})});await f.start();
 assert.equal(writes,1);assert.deepEqual(Object.values(f.ctx.afState.archive).map(r=>r.finalPick),['1','2','X']);
});
