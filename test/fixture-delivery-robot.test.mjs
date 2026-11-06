// Publisher health counts use its verified session, never a public raw REST feed.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../robot/publish.mjs',import.meta.url),'utf8');
function rig({user='A',session='A',raw=true,switchDuringRead=false}={}){
 const code=source.match(/async function publisherCounts\([\s\S]*?(?=\nasync function openApp)/)?.[0];
 assert.ok(code,'publisher counts must be session-scoped before raw grants are restricted');
 const calls=[];const context=vm.createContext({authUser:user?{id:user}:null,_cloudAccountEpoch:1,isPublisher:()=>!!user});
 const client={auth:{getSession:async()=>({data:{session:session?{user:{id:session},access_token:'invented-not-a-real-token'}:null},error:null})},rpc:async()=>({data:{version:'matchmind-fixture-access/1',raw_allowed:raw},error:null}),from:table=>{calls.push(table);const q={select:()=>q,not:()=>q,eq:()=>q,then:(ok,bad)=>Promise.resolve().then(()=>{if(switchDuringRead){context.authUser={id:'B'};context._cloudAccountEpoch++;}return{count:table==='predictions'?145:3,error:null};}).then(ok,bad)};return q;}};
 context.supa=client;
 const page={evaluate:fn=>vm.runInContext('('+fn.toString()+')("2026-11-03")',context)};
 const fn=vm.runInNewContext(code+';publisherCounts');
 return{run:()=>fn(page,'2026-11-03'),calls};
}
// BUILD 357: this forbade ONE literal spelling of one URL, so a different spelling
// (?select=%2A, a variable in place of ${table}, string concatenation) would have passed it,
// and it passes trivially on a file that builds no URL at all. The robot constructs no raw
// REST URL of any kind - its counts go through the authenticated client, which the five
// behavioural tests below prove - so assert that directly instead. The weaker form is kept
// as the second assertion because it names the exact shape the proposal set out to remove.
test('robot never issues raw REST requests; counts go through the authenticated client',()=>{
 assert.doesNotMatch(source,/\/rest\/v1\//,'the robot constructs a raw REST URL');
 assert.doesNotMatch(source,/\/rest\/v1\/\$\{table\}\?select=\*/);
 assert.match(source,/client\.from\(table\)\.select\(col,\s*\{\s*count:\s*'exact',\s*head:\s*true\s*\}\)/,
   'the authenticated head-count read is gone, so the negative assertions above prove nothing');
});
test('anonymous publisher counts return unavailable without a table read',async()=>{const r=rig({user:null,session:null});const v=await r.run();assert.equal(v.predictions,null);assert.equal(r.calls.length,0);});
test('ordinary authenticated account cannot use publisher count diagnostics',async()=>{const r=rig({raw:false});assert.equal((await r.run()).predictions,null);assert.equal(r.calls.length,0);});
test('wrong-session owner is rejected before count reads',async()=>{const r=rig({session:'B'});assert.equal((await r.run()).predictions,null);assert.equal(r.calls.length,0);});
test('authorized publisher receives fixed count metrics and no table rows',async()=>{const r=rig();const v=await r.run();assert.deepEqual(JSON.parse(JSON.stringify(v)),{predictions:145,slipsToday:3,sharedBars:3});assert.deepEqual(r.calls,['predictions','daily_slips','competition_measures']);});
test('identity switching during diagnostics discards obsolete counts',async()=>{const r=rig({switchDuringRead:true});assert.equal((await r.run()).predictions,null);});
