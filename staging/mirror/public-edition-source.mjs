// Read only the existing, anonymously approved public edition. Never reopen source-table access.
import {CARD_SCHEMA,PAYLOAD_SCHEMA,validatePresentationPayload,isPresentationTimestamp} from '../../backend/fixture-delivery/contract.mjs';
import {SOURCE,SOURCE_KEY,project,windowFor,previousIssueEnabled} from './source-contract.mjs';
const SCREENS=['scores','predictions','history','records','slips'];
const canonical=value=>JSON.stringify(value,(_k,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
export async function collectPublicEdition(now=new Date(),fetcher=fetch,{previousIssue=previousIssueEnabled()}={}){
 const envelopes=await Promise.all(SCREENS.map(async screen=>{
  const r=await fetcher(new URL('/rest/v1/rpc/matchmind_display_v1',SOURCE),{
   method:'POST',redirect:'error',headers:{apikey:SOURCE_KEY,'Content-Type':'application/json'},
   body:JSON.stringify({screen}),signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error(`Public ${screen} edition read HTTP ${r.status}`);
  const text=await r.text();if(Buffer.byteLength(text)>4*1024*1024)throw Error('Public edition response exceeds bound');
  const e=JSON.parse(text);
  if(e.version!=='matchmind-display/1'||e.screen!==screen||typeof e.edition_id!=='string'||
    !/^[a-f0-9-]{36}$/.test(e.edition_id)||!isPresentationTimestamp(e.as_of)||!isPresentationTimestamp(e.expires_at)||
    Date.parse(e.as_of)>+now||+now-Date.parse(e.as_of)>15*60000||Date.parse(e.expires_at)<=+now||Date.parse(e.expires_at)-Date.parse(e.as_of)>86400000||
    !Array.isArray(e.cards)||e.cards.length>3000||!Array.isArray(e.slips))throw Error('Invalid, stale or expired public edition');
  return e;
 }));
 const first=envelopes[0];
 if(envelopes.some(e=>e.edition_id!==first.edition_id||e.as_of!==first.as_of||e.expires_at!==first.expires_at))throw Error('Public edition changed during capture; retain previous mirror');
 const w=windowFor(now),byId=new Map();
 for(const e of envelopes.slice(0,3)){
  const screenIds=new Set();
  for(const raw of e.cards){
  const card=project(raw,CARD_SCHEMA);
  // Check identity, real calendar dates and approved fixture facts before deciding
  // membership. A malformed outside-window row must not disappear through filtering.
  validatePresentationPayload({cards:[{...card,prediction:null}],board:null,records:{engine:null,clv:null},slips:[]});
  if(screenIds.has(card.fxid))throw Error('Duplicate public fixture identity');screenIds.add(card.fxid);
  const old=byId.get(card.fxid);
  if(old){
   if(canonical({...old,prediction:null})!==canonical({...card,prediction:null})||
      old.prediction&&card.prediction&&canonical(old.prediction)!==canonical(card.prediction))throw Error('Conflicting public fixture identity');
   if(card.prediction)old.prediction=card.prediction;
  }else byId.set(card.fxid,card);
  }
 }
 if(byId.size>3000)throw Error('Public fixture inventory exceeds source bound');
 const previous=new Date(Date.parse(w.day)-86400000).toISOString().slice(0,10);
 const payload={cards:[],
  board:project(envelopes[1].board,PAYLOAD_SCHEMA.properties.board),
  records:project(envelopes[3].records,PAYLOAD_SCHEMA.properties.records),
  slips:envelopes[4].slips.filter(s=>s.day===w.day||previousIssue&&s.day===previous).map(s=>project(s,PAYLOAD_SCHEMA.properties.slips.items))};
 // Match the existing publisher: the full inclusive UTC window plus every
 // board/selected-slip reference, rather than the source's wider history inventory.
 const referenced=new Set();
 const reference=id=>{if(!Number.isSafeInteger(id)||id<1||!byId.has(id))throw Error('Missing or invalid public fixture reference');referenced.add(id);};
 for(const row of payload.board?.rows||[])reference(row.f);
 for(const slip of payload.slips)for(const leg of slip.legs)reference(leg.fxid);
 const all=[...byId.values()],inWindow=c=>c.date>=w.from&&c.date<=w.to;
 payload.cards=all.filter(c=>inWindow(c)||referenced.has(c.fxid)).sort((a,b)=>a.fxid-b.fxid);
 // Retain the card and its original claim together or fail. Never turn a retained
 // reconstruction/older unsupported record into a newly issued prediction.
 if(payload.cards.some(({prediction:p})=>p&&(!Number.isInteger(p.build)||p.build<62||p.pick==null||
  !isPresentationTimestamp(p.made_at)||Date.parse(p.made_at)>+now)))throw Error('Retained public prediction is not an admitted issued record');
 validatePresentationPayload(payload); // Reviewed staging bounds still apply to all retained cards.
 const membership={source_cards:all.length,window_cards:all.filter(inWindow).length,referenced_cards:referenced.size,
  retained_cards:payload.cards.length,retained_outside_window_cards:payload.cards.filter(c=>!inWindow(c)).length,
  excluded_unreferenced_outside_window_cards:all.length-payload.cards.length};
 if(!payload.cards.length)throw Error('No approved public fixtures');
 const stamps=payload.cards.map(c=>c.updated_at).filter(s=>s&&Number.isFinite(Date.parse(s))).sort((a,b)=>Date.parse(a)-Date.parse(b));
 return {payload,captured_at:now.toISOString(),from:w.from,to:w.to,
  window_cards:payload.cards.filter(c=>c.date>=w.from&&c.date<=w.to).length,cards:payload.cards.length,
  predictions:payload.cards.filter(c=>c.prediction).length,latest_source_update:stamps.at(-1)??null,
  source_edition_id:first.edition_id,source_as_of:first.as_of,
  analysis_warnings:[{state:'bounded-public-projection',membership,reason:'Raw source history and competition facts are not read. Full current-client detail parity requires separate staging acceptance.'}]};
}
