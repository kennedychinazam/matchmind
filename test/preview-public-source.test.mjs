import test from 'node:test';
import assert from 'node:assert/strict';
import {collectPublicEdition} from '../staging/mirror/public-edition-source.mjs';
const now=new Date('2026-11-25T12:00:00Z');
const card={fxid:123,lid:39,lname:'Synthetic competition',lcountry:'England',date:'2026-11-25',time:'20:00',status:'NS',elapsed:null,home:'Synthetic Home',away:'Synthetic Away',gh:null,ga:null,ft_h:null,ft_a:null,ht_h:null,ht_a:null,updated_at:'2026-11-25T11:58:00Z',provider:'af',prediction:null};
function fetcher(change=()=>{}){
 const seen=[];const fetch=async(url,options)=>{
  assert.equal(String(url),'https://toqfdrcjzwnlydqekude.supabase.co/rest/v1/rpc/matchmind_display_v1');
  assert.equal(options.method,'POST');assert.equal(options.redirect,'error');
  const {screen}=JSON.parse(options.body);seen.push(screen);
  const e={version:'matchmind-display/1',edition_id:'11111111-2222-4333-8444-555555555555',screen,as_of:'2026-11-25T11:58:00Z',expires_at:'2026-11-26T11:58:00Z',cards:['scores','predictions','history'].includes(screen)?[{...card,private_raw_field:'excluded'}]:[],board:null,records:{engine:null,clv:null},slips:[]};change(e);
  return {ok:true,text:async()=>JSON.stringify(e)};
 };return {fetch,seen};
}
test('capture uses five approved read-only projections and excludes unapproved fields',async()=>{
 const f=fetcher();const result=await collectPublicEdition(now,f.fetch);
 assert.deepEqual(f.seen,['scores','predictions','history','records','slips']);assert.equal(result.cards,1);assert.equal(result.window_cards,1);assert.deepEqual(result.payload.cards,[card]);
});
test('mixed edition identities fail before any staging publication',async()=>{
 const f=fetcher(e=>{if(e.screen==='history')e.edition_id='21111111-2222-4333-8444-555555555555';});
 await assert.rejects(collectPublicEdition(now,f.fetch),/changed during capture/);
});
test('expired source is rejected instead of relabelled fresh',async()=>{
 const f=fetcher(e=>{e.expires_at='2026-11-25T11:59:00Z';});await assert.rejects(collectPublicEdition(now,f.fetch),/expired/);
});
test('an unexpired but stale source is not relabelled as a fresh capture',async()=>{
 const f=fetcher(e=>{e.as_of='2026-11-25T11:30:00Z';e.expires_at='2026-11-26T11:30:00Z';});await assert.rejects(collectPublicEdition(now,f.fetch),/stale/);
});
test('conflicting fixture identities are refused',async()=>{
 const f=fetcher(e=>{if(e.screen==='history')e.cards[0].home='different team';});await assert.rejects(collectPublicEdition(now,f.fetch),/Conflicting/);
});
test('a source HTTP failure has no raw-table fallback',async()=>{
 let calls=0;await assert.rejects(collectPublicEdition(now,async url=>{calls++;assert.match(String(url),/\/rpc\/matchmind_display_v1$/);return{ok:false,status:500};}),/HTTP 500/);assert.equal(calls,5);
});
