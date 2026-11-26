// Bounded asset metadata, read by the protected runner; no database writes or provider API calls.
import{isPresentationTimestamp}from'../backend/fixture-delivery/contract.mjs';
import{createHash}from'node:crypto';import{writeFileSync}from'node:fs';import{pathToFileURL}from'node:url';
const STAGE='https://rdcbnvfnxenrpnnwxszs.supabase.co',PROD='https://toqfdrcjzwnlydqekude.supabase.co';
const STAGE_KEY='sb_publishable_WKB88h4KAPtLVphsfNF9fg_W90ym80y',PROD_KEY='sb_publishable_wrXk5NFfWkrCdLgiQsaMHg_7lRPeO4-';
export function logoURL(value,kind){if(value==null||value==='')return null;if(typeof value!=='string'||!new RegExp('^https://media\\.api-sports\\.io/football/'+kind+'/[1-9][0-9]*\\.png$').test(value))throw Error('Unapproved original logo URL');return value;}
export function validateLogos(c){if(c?.version!=='matchmind-original-logos/1'||!Array.isArray(c.fixtures)||c.fixtures.length>1500)throw Error('Invalid original-logo catalog');const ids=new Set();for(const f of c.fixtures){if(!Number.isSafeInteger(f.fxid)||ids.has(f.fxid)||!Number.isSafeInteger(f.lid)||typeof f.home!=='string'||typeof f.away!=='string'||f.home.length>160||f.away.length>160)throw Error('Invalid logo identity');ids.add(f.fxid);logoURL(f.home_logo,'teams');logoURL(f.away_logo,'teams');logoURL(f.llogo,'leagues');}const hash=createHash('sha256').update(JSON.stringify(c.fixtures)).digest('hex');if(c.content_sha256!==hash)throw Error('Logo catalog checksum mismatch');if(Buffer.byteLength(JSON.stringify(c))>524288)throw Error('Logo catalog too large');return c;}
const LOGO_FIELDS={home_logo:'teams',away_logo:'teams',llogo:'leagues'};
function logoIdentity(card){
 if(!card||!Number.isSafeInteger(card.fxid)||card.fxid<1||!Number.isSafeInteger(card.lid)||card.lid<1||
   typeof card.home!=='string'||!card.home.trim()||card.home.length>160||typeof card.away!=='string'||!card.away.trim()||card.away.length>160)throw Error('Invalid original logo identity');
 const out={fxid:card.fxid,lid:card.lid,home:card.home,away:card.away};
 for(const [key,kind] of Object.entries(LOGO_FIELDS))if(Object.hasOwn(card,key))out[key]=logoURL(card[key],kind);
 return out;
}
async function logoMembership(origin,key,endpoint,maxCards,maxBytes,fetcher,{allowPaged=false}={}){
 const views=[];
 for(const screen of ['scores','predictions','history']){
  const r=await fetcher(origin+'/rest/v1/rpc/'+endpoint,{method:'POST',redirect:'error',headers:{apikey:key,'Content-Type':'application/json'},body:JSON.stringify({screen}),signal:AbortSignal.timeout(30000)});
  if(!r.ok)throw Error('Approved original logo read HTTP '+r.status);
  const v=await r.json(),now=Date.now();
  if(!v||Buffer.byteLength(JSON.stringify(v))>maxBytes||v.version!=='matchmind-display/1'||v.screen!==screen||
    typeof v.edition_id!=='string'||! /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(v.edition_id)||
    !isPresentationTimestamp(v.as_of)||!isPresentationTimestamp(v.expires_at)||Date.parse(v.as_of)>now||Date.parse(v.expires_at)<=now||
    Date.parse(v.expires_at)<=Date.parse(v.as_of)||Date.parse(v.expires_at)-Date.parse(v.as_of)>86400000||
    !Array.isArray(v.cards)||v.cards.length>maxCards||v.history_paged===true&&!allowPaged)throw Error('Invalid or incomplete original logo edition');
  if(views.length&&(v.edition_id!==views[0].edition_id||v.as_of!==views[0].as_of||v.expires_at!==views[0].expires_at))throw Error('Edition changed during original logo read');
  const seen=new Set();for(const card of v.cards){if(seen.has(card?.fxid))throw Error('Duplicate original logo identity');seen.add(card?.fxid);logoIdentity(card);}
  views.push(v);
 }
 const members=new Map();
 for(const v of views)for(const card of v.cards){
  const projected=logoIdentity(card),old=members.get(projected.fxid);
  if(old&&JSON.stringify(old)!==JSON.stringify(projected))throw Error('Original logo identity or metadata mismatch');
  members.set(projected.fxid,projected);
 }
 if(!members.size||members.size>maxCards)throw Error('Logo membership bound failed');
 return{members,edition_id:views[0].edition_id,as_of:views[0].as_of};
}
export async function collectOriginalLogos(fetcher=fetch){
 const stage=await logoMembership(STAGE,STAGE_KEY,'mm_preview_display_v3',1500,2097152,fetcher);
 // Current materializations may predate optional logo fields. Supplement only from
 // the approved public finite screens, never from source tables or provider APIs.
 // A paged source window suffices only when it contains every known stage member;
 // no history pages are followed. Stage membership itself must be complete.
 const needsSource=[...stage.members.values()].some(c=>Object.keys(LOGO_FIELDS).some(k=>!Object.hasOwn(c,k)));
 const source=needsSource?await logoMembership(PROD,PROD_KEY,'matchmind_display_v1',3000,4194304,fetcher,{allowPaged:true}):null;
 const fixtures=[];
 for(const card of stage.members.values()){
  const supplemental=source?.members.get(card.fxid);
  if(source&&(!supplemental||card.lid!==supplemental.lid||card.home!==supplemental.home||card.away!==supplemental.away))throw Error('Original logo identity mismatch or incomplete source membership');
  const f={fxid:card.fxid,lid:card.lid,home:card.home,away:card.away};
  for(const [key,kind] of Object.entries(LOGO_FIELDS)){
   if(Object.hasOwn(card,key)){
    if(supplemental&&Object.hasOwn(supplemental,key)&&card[key]!==supplemental[key])throw Error('Original logo metadata mismatch');
    f[key]=card[key];
   }else{
    if(!supplemental||!Object.hasOwn(supplemental,key))throw Error('Original logo metadata unavailable');
    f[key]=logoURL(supplemental[key],kind);
   }
  }
  fixtures.push(f);
 }
 fixtures.sort((a,b)=>a.fxid-b.fxid);
 return validateLogos({version:'matchmind-original-logos/1',edition_id:stage.edition_id,as_of:stage.as_of,
  ...(source?{source_edition_id:source.edition_id,source_as_of:source.as_of}:{}),captured_at:new Date().toISOString(),
  content_sha256:createHash('sha256').update(JSON.stringify(fixtures)).digest('hex'),fixtures});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{if(!process.argv[2])throw Error('Catalog output path required');const c=await collectOriginalLogos();writeFileSync(process.argv[2],JSON.stringify(c)+'\n');console.log(JSON.stringify({logo_fixtures:c.fixtures.length,content_sha256:c.content_sha256,missing_team_images:c.fixtures.filter(f=>!f.home_logo||!f.away_logo).length,missing_competition_images:c.fixtures.filter(f=>!f.llogo).length}));}catch(e){console.error(e.message);process.exitCode=1;}}
