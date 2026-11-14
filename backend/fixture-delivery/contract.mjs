/* Versioned private materialization boundary. No network, credentials, model fitting, or SQL execution. */
export const CONTRACT_VERSION='matchmind-display/1';
export const MAX_DOCUMENT_BYTES=1048576;
const str=(max=160,nullable=false,pattern)=>({type:'string',max,nullable,...(pattern?{pattern}:{})});
const num=(min=0,max=1e9,nullable=false,integer=false)=>({type:'number',min,max,nullable,integer});
const bool={type:'boolean'};
const object=(properties,required=Object.keys(properties),nullable=false)=>({type:'object',properties,required,nullable});
const array=(items,max)=>({type:'array',items,max});
const count=num(0,1e9,false,true), id=num(1,Number.MAX_SAFE_INTEGER,false,true), score=num(0,100,true,true), probability=num(0,1,true);
const date={...str(10,false,'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),format:'date'}, stamp={...str(40,true,'^[0-9]{4}-[0-9]{2}-[0-9]{2}T'),format:'timestamp'}, text=str(160), nullableText=str(160,true);
const prediction=object({lid:id,lname:text,home:text,away:text,pick:nullableText,pick_prob:probability,market:nullableText,p_home:probability,p_draw:probability,p_away:probability,xg_home:num(0,100,true),xg_away:num(0,100,true),kickoff:date,ktime:str(12,true),made_at:stamp,withheld_at:stamp,final_pick:nullableText,build:num(0,1e6,false,true)},undefined,true);
const analysisProbability=object({label:str(80),prob:num(0,1)});
const historyMatch=object({date,home:text,away:text,gh:num(0,100,false,true),ga:num(0,100,false,true)});
// Optional, closed published analysis; independent of the immutable prediction object.
export const ANALYSIS_SCHEMA=object({source:str(80),source_at:stamp,history_source_at:stamp,xg_home:num(0,100),xg_away:num(0,100),
 result:object({p_home:num(0,1),p_draw:num(0,1),p_away:num(0,1)}),
 goals:array(analysisProbability,8),combos:array(analysisProbability,12),htft:array(analysisProbability,9),correct_scores:array(analysisProbability,12),scorers:array(analysisProbability,16),
 form:object({home:array(str(1,false,'^[WDL]$'),5),away:array(str(1,false,'^[WDL]$'),5)}),h2h:array(historyMatch,5),
 standings:object({season:num(1900,2200,false,true),rows:array(object({rank:num(1,100,false,true),team:text,played:count,won:count,drawn:count,lost:count,gf:count,ga:count,points:num(-100,1000,false,true)}),64)}),
 writeup:object({text:str(32768),source:str(80),source_at:stamp})},['source','source_at']);
export const CARD_SCHEMA=object({fxid:id,lid:id,lname:text,lcountry:str(100),date,time:str(12,true),status:str(24),elapsed:num(0,200,true,true),home:text,away:text,gh:score,ga:score,ft_h:score,ft_a:score,ht_h:score,ht_a:score,updated_at:stamp,provider:str(80,true),prediction});
CARD_SCHEMA.properties.analysis=ANALYSIS_SCHEMA;
const boardRow=object({f:id,l:id,n:text,d:date,t:str(12,true),h:text,a:text,p:nullableText,q:probability,m:nullableText,g:nullableText,z:bool,pw:probability,pd:probability,pq:probability,xh:num(0,100,true),xa:num(0,100,true)});
const board=object({v:num(1,1,false,true),ahead:num(7,7,false,true),builtAt:stamp,n:count,notPassed:count,noBars:count,rows:array(boardRow,1000)},undefined,true);
const tuple={type:'array',items:count,min:3,max:3};
const marketCounts={type:'map',max:32,key:'^[A-Za-z0-9 /.+_-]{1,60}$',values:tuple};
const days={type:'map',max:5000,key:'^[0-9]{4}-[0-9]{2}-[0-9]{2}$',values:marketCounts};
const engine=object({v:num(1,1,false,true),days,total:count,graded:count,withheld:count,excluded:count,pending:count,orphan:count,off:count,ungradeable:count,voidLate:count});
const stat=object({n:count,mean:num(-1e9,1e9),se:num(0,1e9,true)},undefined,true);
const clv=object({v:num(1,1,false,true),raw:stat,devig:stat,beat:count,tie:count,lost:count,from:{...date,nullable:true},to:{...date,nullable:true}});
const record=payload=>object({key:str(8),payload,build:num(0,1e6,false,true),computed_at:stamp},undefined,true);
const legProperties={fxid:id,d:date,t:str(12,true),h:text,a:text,lid:{...id,nullable:true},code:str(40),market:str(60),p:probability,o:num(1,1e6,true),tab:str(30),rank:count,sel:str(240)};
const leg=object(legProperties,['fxid','d','h','a','code','p']);
const slip=object({day:date,tier:str(40),odds:num(0,1e12),build:num(0,1e6,false,true),step:str(80),legs:array(leg,40)});
export const PAYLOAD_SCHEMA=object({cards:array(CARD_SCHEMA,1000),board,records:object({engine:record(engine),clv:record(clv)}),slips:array(slip,128)});
// RFC3339 subset shared with PostgreSQL: explicit zone, calendar-valid, no leap seconds;
// offset displacement is limited to PostgreSQL's supported +/-15:59. Never rewrite the input.
export function isPresentationTimestamp(value){
 if(typeof value!=='string'||value.length>40||!/^\d{4}-\d{2}-\d{2}T(?:[01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9](?:\.[0-9]{1,9})?(?:Z|[+-](?:0[0-9]|1[0-5]):[0-5][0-9])$/.test(value)||+value.slice(0,4)===0||!Number.isFinite(Date.parse(value)))return false;
 const date=value.slice(0,10),parsed=new Date(date+'T00:00:00.000Z');
 return Number.isFinite(+parsed)&&parsed.toISOString().slice(0,10)===date;
}
function walk(value,s,path,depth){
 if(depth>12)throw Error('Display nesting exceeds limit');
 if(value===null){if(s.nullable)return;throw Error(path+': null not permitted');}
 if(s.type==='string'){if(typeof value!=='string'||value.length>s.max||/[\u0000-\u001f\u007f]/.test(value)||(s.pattern&&!new RegExp(s.pattern).test(value)))throw Error(path+': invalid text');if(s.format==='date'&&(!Number.isFinite(Date.parse(value+'T00:00:00.000Z'))||new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)!==value))throw Error(path+': invalid date');if(s.format==='timestamp'&&!isPresentationTimestamp(value))throw Error(path+': invalid timestamp');return;}
 if(s.type==='number'){if(typeof value!=='number'||!Number.isFinite(value)||value<s.min||value>s.max||(s.integer&&!Number.isSafeInteger(value)))throw Error(path+': invalid number');return;}
 if(s.type==='boolean'){if(typeof value!=='boolean')throw Error(path+': invalid boolean');return;}
 if(s.type==='array'){if(!Array.isArray(value)||value.length>(s.max??1000)||value.length<(s.min??0))throw Error(path+': invalid array');value.forEach((v,i)=>walk(v,s.items,path+'['+i+']',depth+1));return;}
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.getPrototypeOf(value)!==Object.prototype)throw Error(path+': invalid object');
 const keys=Object.keys(value);
 if(s.type==='map'){if(keys.length>s.max)throw Error(path+': too many keys');for(const k of keys){if(['__proto__','prototype','constructor'].includes(k)||!new RegExp(s.key).test(k))throw Error(path+': invalid map key');walk(value[k],s.values,path+'.'+k,depth+1);}return;}
 if(keys.some(k=>!Object.hasOwn(s.properties,k))||s.required.some(k=>!Object.hasOwn(value,k)))throw Error(path+': unsupported or missing field');
 for(const k of keys)walk(value[k],s.properties[k],path+'.'+k,depth+1);
}
function vector(v){if(v.every(x=>x===null))return;if(v.some(x=>x===null)||Math.abs(v.reduce((a,b)=>a+b,0)-1)>0.0002)throw Error('Invalid published probability vector');}
export function validatePresentationPayload(value){
 const bytes=Buffer.byteLength(JSON.stringify(value));if(bytes>MAX_DOCUMENT_BYTES)throw Error('Display payload exceeds byte limit');walk(value,PAYLOAD_SCHEMA,'display',0);
 const ids=new Set();for(const c of value.cards){if(ids.has(c.fxid))throw Error('Duplicate fixture in display');ids.add(c.fxid);const p=c.prediction;if(p){const v=[p.p_home,p.p_draw,p.p_away];vector(v);}if(c.analysis?.result)vector(Object.values(c.analysis.result));}
 if(value.board){if(value.board.n!==value.board.rows.length)throw Error('Incomplete published board inventory');const seen=new Set();for(const row of value.board.rows){if(seen.has(row.f))throw Error('Duplicate board fixture');seen.add(row.f);if(!ids.has(row.f))throw Error('Board fixture missing display identity');vector([row.pw,row.pd,row.pq]);const c=value.cards.find(c=>c.fxid===row.f);if(c.lid!==row.l||c.home!==row.h||c.away!==row.a||c.date!==row.d||c.time!==row.t)throw Error('Board fixture identity mismatch');}}
 for(const slip of value.slips)for(const leg of slip.legs)if(!ids.has(leg.fxid))throw Error('Unaccounted issued slip fixture inventory');
 if(value.records.engine&&value.records.engine.key!=='engine'||value.records.clv&&value.records.clv.key!=='clv')throw Error('Record identity mismatch');
 return value;
}
export function buildPresentationPayload({fixtures,predictions=[],board=null,records={engine:null,clv:null},slips=[]}){
 if(!Array.isArray(fixtures)||!Array.isArray(predictions))throw Error('Complete source inventory required');
 const preds=new Map();for(const p of predictions){if(preds.has(p.fxid))throw Error('Duplicate immutable prediction');preds.set(p.fxid,p);}
 const cards=fixtures.map(f=>{const c={};for(const key of Object.keys(CARD_SCHEMA.properties)){if(key==='prediction'||key==='analysis')continue;if(!Object.hasOwn(f,key))throw Error('Missing source field '+key);c[key]=f[key];}const p=preds.get(f.fxid);if(f.analysis)c.analysis=structuredClone(f.analysis);c.prediction=p?Object.fromEntries(Object.keys(prediction.properties).map(k=>{if(!Object.hasOwn(p,k))throw Error('Missing immutable prediction '+k);return[k,p[k]];})):null;return c;});
 for(const key of preds.keys())if(!cards.some(c=>c.fxid===key))throw Error('Unaccounted required prediction inventory '+key);
 // Explicitly projected facts only; never return original objects, snapshots or provider JSON.
 return validatePresentationPayload({cards,board:board===null?null:structuredClone(board),records:structuredClone(records),slips:structuredClone(slips)});
}

export const ACCESS_VERSION='matchmind-fixture-access/1';
export const SCREENS=Object.freeze(['scores','predictions','history','records','slips']);
export function presentationEnvelope({edition_id,as_of,expires_at,payload},screen,now=new Date()){
 if(!SCREENS.includes(screen))throw Error('Unsupported display screen');
 if(typeof edition_id!=='string'||!/^[-a-f0-9]{36}$/.test(edition_id)||!isPresentationTimestamp(as_of)||!isPresentationTimestamp(expires_at))throw Error('Invalid edition identity');
 const at=now instanceof Date?now:new Date(now),issued=new Date(as_of),expiry=new Date(expires_at);
 if(!Number.isFinite(+at)||issued>at||expiry<=at||issued.toISOString().slice(0,10)!==at.toISOString().slice(0,10)||+expiry-+issued>86400000)throw Error('Current presentation unavailable');
 validatePresentationPayload(payload);
 return {version:CONTRACT_VERSION,edition_id,as_of,expires_at,screen,cards:['scores','predictions','history'].includes(screen)?structuredClone(payload.cards):[],board:screen==='predictions'?structuredClone(payload.board):null,records:screen==='records'?structuredClone(payload.records):{engine:null,clv:null},slips:screen==='slips'?structuredClone(payload.slips):[]};
}
