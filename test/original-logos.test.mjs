import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {logoURL,validateLogos,collectOriginalLogos} from '../staging/original-logos.mjs';
const STAGE='https://rdcbnvfnxenrpnnwxszs.supabase.co',PROD='https://toqfdrcjzwnlydqekude.supabase.co';
const fixture={fxid:1,lid:39,home:'A',away:'B',home_logo:'https://media.api-sports.io/football/teams/1.png',away_logo:'https://media.api-sports.io/football/teams/2.png',llogo:'https://media.api-sports.io/football/leagues/39.png'};
const identity=({fxid,lid,home,away})=>({fxid,lid,home,away});
const as_of=new Date(Date.now()-1000).toISOString(),expires_at=new Date(Date.now()+3600000).toISOString();
const stageID='11111111-1111-4111-8111-111111111111',sourceID='22222222-2222-4222-8222-222222222222';
function reader({stage=[fixture],source=[fixture],mutate=()=>{},http=()=>200}={}){
 const calls=[];
 const fetcher=async(url,options)=>{
  const u=new URL(url),isStage=u.origin===STAGE;assert.ok(isStage||u.origin===PROD,'only two MatchMind projects');
  assert.equal(options.method,'POST','no production raw GET or raw fallback');assert.equal(options.redirect,'error');assert.equal(u.search,'');
  assert.equal(u.pathname,'/rest/v1/rpc/'+(isStage?'mm_preview_display_v3':'matchmind_display_v1'));
  const args=JSON.parse(options.body);assert.deepEqual(Object.keys(args),['screen']);assert.ok(['scores','predictions','history'].includes(args.screen));
  assert.ok(options.signal instanceof AbortSignal);calls.push({origin:u.origin,screen:args.screen});
  const cards=typeof(isStage?stage:source)==='function'?(isStage?stage:source)(args.screen):(isStage?stage:source);
  const v={version:'matchmind-display/1',edition_id:isStage?stageID:sourceID,as_of,expires_at,screen:args.screen,cards:structuredClone(cards),board:null,records:{engine:null,clv:null},slips:[]};
  mutate(v,{isStage,screen:args.screen});const status=http({isStage,screen:args.screen});return{ok:status===200,status,json:async()=>v};
 };
 return{fetcher,calls};
}

test('original logo URLs retain numeric media paths and refuse executable or unrelated assets',()=>{
 assert.equal(logoURL(fixture.home_logo,'teams'),fixture.home_logo);assert.equal(logoURL(null,'teams'),null);assert.equal(logoURL('','teams'),null);
 for(const u of ['javascript:alert(1)','https://media.api-sports.io/football/teams/1.svg','https://example.com/logo.png',fixture.home_logo+'?key=secret','https://media.api-sports.io/football/teams/0.png'])assert.throws(()=>logoURL(u,'teams'));
});
test('approved same-edition staging metadata makes only three fixed RPC reads and never a production raw GET',async()=>{
 const {fetcher,calls}=reader(),catalog=await collectOriginalLogos(fetcher);
 assert.equal(calls.length,3);assert.ok(calls.every(c=>c.origin===STAGE));assert.deepEqual(catalog.fixtures,[fixture]);
 assert.equal(catalog.edition_id,stageID);assert.equal(catalog.as_of,as_of);assert.ok(!Object.hasOwn(catalog,'source_edition_id'));
 assert.equal(catalog.content_sha256,createHash('sha256').update(JSON.stringify([fixture])).digest('hex'));assert.throws(()=>validateLogos({...catalog,content_sha256:'bad'}));
});
test('older staging shapes use only finite approved public RPC metadata and retain exact stage membership',async()=>{
 const extra={...fixture,fxid:9,home:'Extra club'},second={...fixture,fxid:2,home:'C',away:'D'};
 const {fetcher,calls}=reader({stage:screen=>screen==='history'?[identity(second)]:[identity(fixture)],source:[{...second,unapproved:'excluded'},fixture,extra]});
 const catalog=await collectOriginalLogos(fetcher);assert.equal(calls.length,6);assert.deepEqual(catalog.fixtures,[fixture,second]);assert.equal(catalog.source_edition_id,sourceID);assert.equal(catalog.edition_id,stageID);
 assert.ok(calls.slice(3).every(c=>c.origin===PROD));assert.ok(!JSON.stringify(catalog).includes('unapproved'));
});
test('legitimate null or empty logo values preserve every fixture without created crests or production reads',async()=>{
 const noLogos={...fixture,home_logo:null,away_logo:'',llogo:null};const {fetcher,calls}=reader({stage:[noLogos]});
 const catalog=await collectOriginalLogos(fetcher);assert.deepEqual(catalog.fixtures,[{...noLogos,away_logo:null}]);assert.equal(calls.length,3);
});
test('explicit source null logos are legitimate but absent source metadata is not fabricated',async()=>{
 const stage=[identity(fixture)],source=[{...fixture,home_logo:null}];assert.equal((await collectOriginalLogos(reader({stage,source}).fetcher)).fixtures[0].home_logo,null);
 await assert.rejects(collectOriginalLogos(reader({stage,source:[identity(fixture)]}).fetcher),/metadata unavailable/);
});
for(const side of ['stage','source'])for(const changed of ['edition_id','as_of','expires_at'])test(`${side} ${changed} change across screens fails before catalog acceptance`,async()=>{
 const {fetcher}=reader({stage:[identity(fixture)],mutate:(v,{isStage,screen})=>{if((side==='stage')===isStage&&screen==='history')v[changed]=changed==='edition_id'?'33333333-3333-4333-8333-333333333333':new Date(Date.parse(v[changed])-100).toISOString();}});
 await assert.rejects(collectOriginalLogos(fetcher),/Edition changed/);
});
for(const field of ['lid','home','away'])test(`source ${field} must exactly match the staging fixture identity`,async()=>{
 const bad={...fixture,[field]:field==='lid'?40:'Different club'};
 await assert.rejects(collectOriginalLogos(reader({stage:[identity(fixture)],source:[bad]}).fetcher),/identity mismatch/);
});
test('same-edition screen conflicts and duplicate identities are refused rather than overwritten',async()=>{
 await assert.rejects(collectOriginalLogos(reader({stage:screen=>[{...fixture,home:screen==='history'?'Different club':'A'}]}).fetcher),/identity or metadata mismatch/);
 await assert.rejects(collectOriginalLogos(reader({stage:[fixture,fixture]}).fetcher),/Duplicate/);
 await assert.rejects(collectOriginalLogos(reader({stage:[identity(fixture)],source:screen=>[{...fixture,home_logo:screen==='history'?'https://media.api-sports.io/football/teams/3.png':fixture.home_logo}]}).fetcher),/metadata mismatch/);
});
test('incomplete source membership and conflicting supplied logos fail without dropping stage fixtures',async()=>{
 const second={...identity(fixture),fxid:2};await assert.rejects(collectOriginalLogos(reader({stage:[identity(fixture),second]}).fetcher),/incomplete source membership/);
 await assert.rejects(collectOriginalLogos(reader({stage:[{...identity(fixture),home_logo:fixture.away_logo}]}).fetcher),/metadata mismatch/);
});
for(const side of ['stage','source'])test(`${side} unapproved logo URL is refused without a raw fallback`,async()=>{
 const {fetcher}=reader({stage:[identity(fixture)],mutate:(v,{isStage})=>{if((side==='stage')===isStage)v.cards[0].home_logo='https://example.com/foreign.png';}});
 await assert.rejects(collectOriginalLogos(fetcher),/Unapproved original logo URL/);
});
for(const side of ['stage','source'])test(`${side} HTTP refusal cannot trigger source-table fallback`,async()=>{
 const {fetcher,calls}=reader({stage:[identity(fixture)],http:({isStage})=>((side==='stage')===isStage)?401:200});
 await assert.rejects(collectOriginalLogos(fetcher),/HTTP 401/);assert.equal(calls.length,side==='stage'?1:4);
});
test('malformed, expired, paged or empty editions cannot certify complete logo coverage',async()=>{
 for(const mutate of [v=>{v.screen='other';},v=>{v.version='unknown';},v=>{v.edition_id=null;},v=>{v.as_of=null;},v=>{v.expires_at=as_of;},v=>{v.history_paged=true;},v=>{v.cards=null;},v=>{v.cards[0].fxid=0;},v=>{v.cards[0].home='';}])await assert.rejects(collectOriginalLogos(reader({mutate}).fetcher),/Invalid|incomplete/);
 await assert.rejects(collectOriginalLogos(reader({stage:[]}).fetcher),/membership bound/);
});
test('stage union, source count and response-byte bounds fail instead of truncating',async()=>{
 const cards=n=>Array.from({length:n},(_,i)=>({...fixture,fxid:i+1,home_logo:null,away_logo:null,llogo:null}));
 const catalog=await collectOriginalLogos(reader({stage:cards(1500)}).fetcher);assert.equal(catalog.fixtures.length,1500);
 await assert.rejects(collectOriginalLogos(reader({stage:screen=>screen==='history'?[{...fixture,fxid:1501}]:cards(1500)}).fetcher),/membership bound/);
 await assert.rejects(collectOriginalLogos(reader({stage:[identity(fixture)],source:cards(3001)}).fetcher),/Invalid or incomplete/);
 for(const isStageSide of [true,false])await assert.rejects(collectOriginalLogos(reader({stage:[identity(fixture)],mutate:(v,{isStage})=>{if(isStage===isStageSide)v.unused='x'.repeat(isStage?2097152:4194304);}}).fetcher),/Invalid or incomplete/);
});

test('paged public history can supplement every known stage member without following pages',async()=>{
 const {fetcher,calls}=reader({stage:[identity(fixture)],mutate:(v,{isStage,screen})=>{if(!isStage&&screen==='history')v.history_paged=true;}});
 const catalog=await collectOriginalLogos(fetcher);assert.deepEqual(catalog.fixtures,[fixture]);assert.equal(calls.length,6);
 assert.deepEqual(calls.filter(c=>c.origin===PROD).map(c=>c.screen),['scores','predictions','history']);
});
test('paged public history cannot hide missing stage membership',async()=>{
 const missing={...identity(fixture),fxid:2};
 const {fetcher,calls}=reader({stage:[identity(fixture),missing],mutate:(v,{isStage,screen})=>{if(!isStage&&screen==='history')v.history_paged=true;}});
 await assert.rejects(collectOriginalLogos(fetcher),/incomplete source membership/);assert.equal(calls.length,6);
});
test('paged staging membership remains incomplete even when the source could contain all cards',async()=>{
 const {fetcher,calls}=reader({mutate:(v,{isStage,screen})=>{if(isStage&&screen==='history')v.history_paged=true;}});
 await assert.rejects(collectOriginalLogos(fetcher),/Invalid or incomplete/);assert.equal(calls.length,3);assert.ok(calls.every(c=>c.origin===STAGE));
});
