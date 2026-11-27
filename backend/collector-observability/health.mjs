// Private operational projections. Never return provider payloads, headers, errors or credentials.
/** @param {unknown} v */
const timestamp=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T/.test(v)&&Number.isFinite(Date.parse(v))?Date.parse(v):NaN;
/** @param {unknown} v */
const nonnegative=v=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0;
/** @param {unknown} v */
const day=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
/** @typedef {{expectedRequestId?:number,receipt?:{requestId?:number,timedOut?:boolean,statusCode?:number,body?:unknown}}} CollectorObservation */
/** @param {CollectorObservation} [observation] */
export function collectorReceiptHealth({expectedRequestId,receipt}={}){
 if(typeof expectedRequestId!=='number'||!Number.isSafeInteger(expectedRequestId)||expectedRequestId<1||!receipt||receipt.requestId!==expectedRequestId)return{state:'unverified',reason:'request_not_correlated'};
 if(receipt.timedOut===true)return{state:'failed',reason:'http_timeout'};
 if(receipt.timedOut!==false)return{state:'unverified',reason:'response_unavailable'};
 if(typeof receipt.statusCode!=='number'||!Number.isSafeInteger(receipt.statusCode)||receipt.statusCode<100||receipt.statusCode>599)return{state:'unverified',reason:'response_unavailable'};
 if(receipt.statusCode<200||receipt.statusCode>=300)return{state:'failed',reason:'http_failure'};
 const value=receipt.body;
 if(!value||typeof value!=='object'||Array.isArray(value))return{state:'unverified',reason:'response_contract'};
 const b=/** @type {Record<string,unknown>} */(value);
 if(typeof b.fn!=='string'||!['af-47','af-48'].includes(b.fn)||typeof b.ok!=='boolean')return{state:'unverified',reason:'response_contract'};
 if(!b.ok)return{state:'failed',reason:'collector_rejected'};
 // A successful probe, history request, or SQL enqueue is not a completed normal collector run.
 const window=b.window&&typeof b.window==='object'?/** @type {Record<string,unknown>} */(b.window):null;
 if(b.provider!=='api-football'||!nonnegative(b.fixtures)||!nonnegative(b.ms)||!window||!day(window.from)||!day(window.to)||String(window.from)>String(window.to))return{state:'unverified',reason:'normal_run_not_verified'};
 const errors=['upsertError','oddsWriteError','oddsQueryError','detailQueryError','detailStampError','byIdError'];
 if(errors.some(k=>!Object.hasOwn(b,k)))return{state:'unverified',reason:'response_contract'};
 if(errors.some(k=>b[k]!==null)||b.WARNING||!Array.isArray(b.issues)||b.issues.length)return{state:'partial',reason:'collector_warning'};
 return{state:'completed',reason:'matched_normal_response'};
}
/** @param {{observedAt?:unknown,newestAsOf?:unknown,lastPublisherSqlSuccess?:unknown,collector?:CollectorObservation,maxEditionAgeSeconds?:number}} [observation] */
export function publicationHealth({observedAt,newestAsOf,lastPublisherSqlSuccess,collector,maxEditionAgeSeconds=600}={}){
 const now=timestamp(observedAt),asOf=timestamp(newestAsOf),sql=timestamp(lastPublisherSqlSuccess);
 if(!Number.isSafeInteger(maxEditionAgeSeconds)||maxEditionAgeSeconds<1||!Number.isFinite(now))return{publisher:{state:'unknown',reason:'observation_invalid'},collector:{state:'unverified',reason:'request_not_correlated'}};
 const ageSeconds=Math.floor((now-asOf)/1000);
 const publisher=!Number.isFinite(asOf)||ageSeconds<0?{state:'unknown',reason:'edition_unavailable'}:ageSeconds>maxEditionAgeSeconds?{state:'stale',reason:'edition_age',ageSeconds}:{state:'fresh',reason:'edition_age',ageSeconds};
 // Keep enqueue/SQL evidence explicitly separate from edition and HTTP completion evidence.
 return{publisher,publisherSql:!Number.isFinite(sql)||sql>now?'unverified':'observed',collector:collectorReceiptHealth(collector)};
}
