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

test('unreferenced out-of-window history is excluded without dropping the complete window',async()=>{
 const f=fetcher(e=>{if(e.screen==='history')e.cards.push({...card,fxid:124,date:'2026-11-18'});});
 const result=await collectPublicEdition(now,f.fetch);
 assert.deepEqual(result.payload.cards.map(c=>c.fxid),[123]);assert.equal(result.window_cards,1);
});

const issued=c=>({lid:c.lid,lname:c.lname,home:c.home,away:c.away,pick:'1',pick_prob:.6,market:'Winner',p_home:.6,p_draw:.2,p_away:.2,xg_home:1.7,xg_away:.8,kickoff:c.date,ktime:c.time,made_at:'2026-11-25T11:58:00Z',withheld_at:null,final_pick:null,build:355});
const boardFor=c=>({v:1,ahead:7,builtAt:'2026-11-25T11:58:00Z',n:1,notPassed:0,noBars:0,rows:[{f:c.fxid,l:c.lid,n:c.lname,d:c.date,t:c.time,h:c.home,a:c.away,p:'1',q:.6,m:'Winner',g:null,z:true,pw:.6,pd:.2,pq:.2,xh:1.7,xa:.8}]});
const slipFor=(c,day='2026-11-25')=>({day,tier:'banker',odds:2,build:355,step:'issued',legs:[{fxid:c.fxid,d:c.date,h:c.home,a:c.away,code:'1',p:.6}]});
function inventory(cards,{board=null,slips=[],change=()=>{}}={}){return fetcher(e=>{
 if(['scores','predictions','history'].includes(e.screen))e.cards=structuredClone(cards);
 if(e.screen==='predictions')e.board=structuredClone(board);if(e.screen==='slips')e.slips=structuredClone(slips);change(e);
});}
test('inclusive UTC window retains both boundary days and excludes only unreferenced dates outside them',async()=>{
 const cards=['2026-11-18','2026-11-19','2026-11-25','2026-12-02','2026-12-03'].map((date,i)=>({...card,fxid:i+1,date}));
 const result=await collectPublicEdition(now,inventory(cards).fetch);assert.deepEqual(result.payload.cards.map(c=>c.date),['2026-11-19','2026-11-25','2026-12-02']);
 assert.deepEqual(result.analysis_warnings[0].membership,{source_cards:5,window_cards:3,referenced_cards:0,retained_cards:3,retained_outside_window_cards:0,excluded_unreferenced_outside_window_cards:2});
 assert.ok(Object.values(result.analysis_warnings[0].membership).every(Number.isInteger));
});
test('all board and selected-slip references survive outside the window with original claims intact',async()=>{
 const boardCard={...card,fxid:124,date:'2026-11-18'},slipCard={...card,fxid:125,date:'2026-12-03'},discard={...card,fxid:126,date:'2026-11-17'};
 boardCard.prediction=issued(boardCard);slipCard.prediction=issued(slipCard);
 const cards=[card,boardCard,slipCard,discard],before=JSON.stringify(cards),board=boardFor(boardCard),slips=[slipFor(slipCard)];
 const result=await collectPublicEdition(now,inventory(cards,{board,slips}).fetch,{previousIssue:false});
 assert.deepEqual(result.payload.cards,[card,boardCard,slipCard]);assert.deepEqual(result.payload.board,board);assert.deepEqual(result.payload.slips,slips);
 assert.equal(result.window_cards,1);assert.equal(result.predictions,2);assert.equal(JSON.stringify(cards),before);
 assert.deepEqual(result.analysis_warnings[0].membership,{source_cards:4,window_cards:1,referenced_cards:2,retained_cards:3,retained_outside_window_cards:2,excluded_unreferenced_outside_window_cards:1});
});
test('previous-day selection retains its references only when the reviewed continuity option is enabled',async()=>{
 const old={...card,fxid:124,date:'2026-11-17'},stale={...card,fxid:125,date:'2026-11-16'},slips=[slipFor(old,'2026-11-24'),slipFor(stale,'2026-11-23')];
 const get=()=>inventory([card,old,stale],{slips}).fetch;
 const current=await collectPublicEdition(now,get(),{previousIssue:false});assert.deepEqual(current.payload.cards,[card]);assert.deepEqual(current.payload.slips,[]);
 const previous=await collectPublicEdition(now,get(),{previousIssue:true});assert.deepEqual(previous.payload.cards,[card,old]);assert.deepEqual(previous.payload.slips,[slips[0]]);
});
test('missing board/current-slip/selected-previous-slip references fail rather than shorten an issued artifact',async()=>{
 const absent={...card,fxid:999,date:'2026-11-17'};
 for(const options of [{board:boardFor(absent)},{slips:[slipFor(absent)]},{slips:[slipFor(absent,'2026-11-24')]}])await assert.rejects(collectPublicEdition(now,inventory([card],options).fetch,{previousIssue:true}),/Missing or invalid public fixture reference/);
 // A deliberately unselected prior issue is outside the current-only projection.
 assert.deepEqual((await collectPublicEdition(now,inventory([card],{slips:[slipFor(absent,'2026-11-24')]}).fetch,{previousIssue:false})).payload.cards,[card]);
});
test('invalid calendar dates and conflicting excluded rows are not concealed by membership filtering',async()=>{
 for(const date of ['2026-02-30','2026-13-01','2026-1-01',null])await assert.rejects(collectPublicEdition(now,inventory([card,{...card,fxid:124,date}]).fetch),/invalid date|invalid text|null not permitted/);
 const old={...card,fxid:124,date:'2026-11-18'};
 await assert.rejects(collectPublicEdition(now,inventory([card,old],{change:e=>{if(e.screen==='history')e.cards[1].home='Conflicting club';}}).fetch),/Conflicting/);
 await assert.rejects(collectPublicEdition(now,inventory([card,card]).fetch),/Duplicate/);
});
test('unreferenced historical reconstructions are excluded; retained unsupported predictions fail explicitly',async()=>{
 const old={...card,fxid:124,date:'2026-11-18'};old.prediction={...issued(old),build:-1};
 assert.deepEqual((await collectPublicEdition(now,inventory([card,old]).fetch)).payload.cards,[card]);
 for(const build of [-1,0,61]){
  const retained={...card,prediction:{...issued(card),build}};
  await assert.rejects(collectPublicEdition(now,inventory([retained]).fetch),/not an admitted issued record/);
 }
 await assert.rejects(collectPublicEdition(now,inventory([card,old],{board:boardFor(old)}).fetch),/not an admitted issued record/);
});
test('required staging inventory is never truncated to fit the smaller reviewed bound',async()=>{
 const window=Array.from({length:1501},(_,i)=>({...card,fxid:i+1}));
 await assert.rejects(collectPublicEdition(now,inventory(window).fetch),/invalid array/);
 const tail=Array.from({length:1500},(_,i)=>({...card,fxid:i+10000,date:'2026-11-18'}));
 const result=await collectPublicEdition(now,inventory([card,...tail]).fetch);assert.deepEqual(result.payload.cards,[card]);assert.equal(result.analysis_warnings[0].membership.excluded_unreferenced_outside_window_cards,1500);
});

test('retained claims require an original nonfuture issuance time and a published pick',async()=>{
 for(const patch of [{made_at:null},{made_at:undefined},{made_at:'2026-11-25T12:00:00.001Z'},{pick:null}]){
  const retained={...card,prediction:{...issued(card),...patch}};
  await assert.rejects(collectPublicEdition(now,inventory([retained]).fetch),/not an admitted issued record/);
 }
 const retained={...card,prediction:{...issued(card),made_at:now.toISOString(),build:62}};
 assert.deepEqual((await collectPublicEdition(now,inventory([retained]).fetch)).payload.cards,[retained]);
});
