// Shared offline-tested guard for the existing ai-analyze fixture cache.
// This module cannot call a provider, write data, or grant source authority.
export const CACHE_GUARD_VERSION='matchmind-fixture-cache/1';
function unavailable(message,status=503){const e=new Error(message);e.status=status;return e;}
export function cacheIsFresh(stamp,maxAge,now=Date.now()){
 const time=typeof stamp==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(stamp)?Date.parse(stamp):NaN;
 if(!Number.isFinite(time)||!Number.isFinite(now)||time>now||!Number.isFinite(maxAge)||maxAge<=0)throw unavailable('Stored cache time cannot be verified.');
 return now-time<maxAge;
}
export async function authorizeFixtureCache({fxid,mode,userClient}){
 if(fxid==null&&mode!=='context')return; // Standalone user prompt/menu has no fixture cache.
 if(!Number.isSafeInteger(fxid)||fxid<1)throw unavailable('A valid fixture identity is required.',400);
 let access;try{access=await userClient.rpc('matchmind_fixture_access_v1',{});}catch{throw unavailable('Fixture access cannot be verified.');}
 if(access?.error||access?.data?.version!=='matchmind-fixture-access/1'||typeof access.data.raw_allowed!=='boolean')throw unavailable('Fixture access cannot be verified.');
 if(access.data.raw_allowed===true){if(typeof access.data.expires_at!=='string'||!Number.isFinite(Date.parse(access.data.expires_at))||Date.parse(access.data.expires_at)<=Date.now())throw unavailable('Fixture access has expired.');return;}
 let display;try{display=await userClient.rpc('matchmind_display_v1',{screen:'predictions'});}catch{throw unavailable('Current fixture availability cannot be verified.');}
 if(display?.error||display?.data?.version!=='matchmind-display/1'||!Array.isArray(display.data.cards)||typeof display.data.expires_at!=='string'||!Number.isFinite(Date.parse(display.data.expires_at))||Date.parse(display.data.expires_at)<=Date.now())throw unavailable('Current fixture availability cannot be verified.');
 if(!display.data.cards.some(c=>c&&Number.isSafeInteger(c.fxid)&&c.fxid===fxid))throw unavailable('This fixture is not in the current approved display.',403);
}
function text(x,max,{empty=true}={}){if(typeof x!=='string'||x.length>max||(!empty&&!x.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(x))throw unavailable('Stored analysis is unavailable.');return x;}
function closed(x,keys){if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length!==keys.length||Object.keys(x).some(k=>!keys.includes(k)))throw unavailable('Stored analysis is unavailable.');}
export function validateCachedContext(payload){
 closed(payload,['context','sources']);const c=payload.context;closed(c,['notes','homeMult','awayMult','confidence','risk','parsed']);
 if(!Array.isArray(c.notes)||c.notes.length>6||!['high','medium','low'].includes(c.confidence)||typeof c.parsed!=='boolean'||!['homeMult','awayMult'].every(k=>typeof c[k]==='number'&&Number.isFinite(c[k])&&c[k]>=.8&&c[k]<=1.2))throw unavailable('Stored context is unavailable.');
 if(!Array.isArray(payload.sources)||payload.sources.length>12)throw unavailable('Stored sources are unavailable.');
 const sources=payload.sources.map(s=>{closed(s,['title','uri']);const title=text(s.title,240),uri=text(s.uri,2048,{empty:false});let u;try{u=new URL(uri);}catch{throw unavailable('Stored source is unavailable.');}if(u.protocol!=='https:'||u.username||u.password)throw unavailable('Stored source is unavailable.');return{title,uri};});
 return{context:{notes:c.notes.map(n=>text(n,1200)),homeMult:c.homeMult,awayMult:c.awayMult,confidence:c.confidence,risk:text(c.risk,300),parsed:c.parsed},sources};
}
export function validateCachedAnalysis(hit){return{text:text(hit.text,32768,{empty:false}),providerLabel:hit.model==null?null:text(hit.model,120)};}
