// The real client functions in an offline VM with invented doubles. No network.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const span=(a,b)=>{const i=source.indexOf(a),j=source.indexOf(b,i+a.length);assert.ok(i>=0&&j>i,'source boundary '+a);return source.slice(i,j);};
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
test('the page names no publisher email and grants nothing until the server says publisher',async()=>{
 assert.ok(!/PUBLISHER_EMAIL|\+robot@/.test(source));
 let answer={version:'matchmind-publisher/1',publisher:false},calls=0,skills=0;
 const supa={rpc:async name=>{calls++;assert.equal(name,'matchmind_publisher_v1');return{data:answer,error:null};}};
 const ctx=vm.createContext({supa,authUser:null,_cloudAccountEpoch:1,_leaguesLoadedAt:1,refreshSkills:()=>{skills++;}});
 vm.runInContext(span('let _publisherAuthority=','function sharedBarKnown(L){'),ctx);
 assert.equal(await ctx.publisherAuthorityRefresh(),false,'guest');assert.equal(calls,0);
 ctx.authUser={id:'U1'};assert.equal(ctx.isPublisher(),false,'signed in is not authority');
 assert.equal(await ctx.publisherAuthorityRefresh(),false);assert.equal(ctx.isPublisher(),false);
 answer={version:'matchmind-publisher/1',publisher:true};
 assert.equal(await ctx.publisherAuthorityRefresh(),true);assert.equal(ctx.isPublisher(),true);assert.equal(skills,1);
 ctx.authUser={id:'U2'};assert.equal(ctx.isPublisher(),false,'another account does not inherit it');
 ctx.authUser={id:'U1'};ctx._cloudAccountEpoch=2;assert.equal(ctx.isPublisher(),false,'a new account epoch clears it');
 answer={version:'other',publisher:true};assert.equal(await ctx.publisherAuthorityRefresh(),false,'unknown answer shape refused');
 supa.rpc=async()=>({data:null,error:{message:'denied'}});assert.equal(await ctx.publisherAuthorityRefresh(),false);
});
test('history pages are read to the end, merged once, and any bad page fails the whole read',async()=>{
 const ed={edition_id:'E',as_of:'T'};const card=f=>({fxid:f});
 const pages=[{...ed,cards:[card(5),card(4)],next:{date:'2026-10-01',fxid:4}},{...ed,cards:[card(3)],next:null}];
 let calls=[];const client={rpc:async(name,args)=>{calls.push([name,args]);return{data:structuredClone(pages[calls.length-1]),error:null};}};
 const c={client};const ctx=vm.createContext({_fixtureDelivery:c,fixtureDeliveryCurrent:x=>x===c,fixtureEnvelope:(v,screen)=>{assert.equal(screen,'history');return v;}});
 vm.runInContext(span('const FIXTURE_HISTORY_MAX_PAGES=','function fixturePublicRows('),ctx);
 const payload={...ed,cards:[card(9),card(5)]};
 await ctx.fixtureHistoryPages(c,payload);
 assert.equal(JSON.stringify(payload.cards.map(x=>x.fxid)),"[9,5,4,3]");
 assert.equal(JSON.stringify(calls),JSON.stringify([['matchmind_history_v1',{}],['matchmind_history_v1',{before_date:'2026-10-01',before_fxid:4}]]));
 for(const bad of [{...pages[0],edition_id:'OTHER'},{...pages[0],next:{date:'x',fxid:1}},{error:true}]){
  calls=[];client.rpc=async()=>bad.error?{data:null,error:{message:'no'}}:{data:structuredClone(bad),error:null};
  await assert.rejects(ctx.fixtureHistoryPages(c,{...ed,cards:[]}));
 }
 client.rpc=async()=>({data:{...ed,cards:[card(1)],next:{date:'2026-01-01',fxid:1}},error:null});
 await assert.rejects(ctx.fixtureHistoryPages(c,{...ed,cards:[]}),/page bound/,'an endless history is refused, not cut');
});
