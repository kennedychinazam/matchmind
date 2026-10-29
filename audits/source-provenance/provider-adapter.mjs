// Injected, inert SYNTHETIC responses only. No HTTP, env, credential, database or dispatch imports.
import {mkdirSync,openSync,writeFileSync,readFileSync,fsyncSync,closeSync,fstatSync,lstatSync,realpathSync,constants} from 'node:fs';
import {isAbsolute,join,dirname,resolve} from 'node:path';
import {TextDecoder} from 'node:util';
import {isUint8Array} from 'node:util/types';
import {safeClone,freeze,parseBoundedJSON,rawHash,LIMITS} from '../a4/bounds.mjs';
import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {validateFootballText} from '../a4/text-policy.mjs';
import {captureResponse,verifyCapture,reconcile,TRANSFORMATION} from './offline.mjs';

const VERSION='synthetic-provider-adapter-v1';
const IDS=Object.freeze([788036,788048,788038]);
const META=['request_id','request_started_at_utc','response_received_at_utc','collector_sha256'];
const SAFE_HEADERS=new Set(['content-type','content-length','content-encoding','date','x-ratelimit-requests-limit','x-ratelimit-requests-remaining','x-ratelimit-limit','x-ratelimit-remaining','retry-after']);
const HEX=/^[a-f0-9]{64}$/;
const plain=x=>x!==null&&Object.getPrototypeOf(x)===Object.prototype;
function closed(value,keys){
 if(!plain(value)||Reflect.ownKeys(value).length!==keys.length||keys.some(k=>!Object.hasOwn(value,k)))throw Error('closed_adapter_shape');
 for(const d of Object.values(Object.getOwnPropertyDescriptors(value)))if(!('value' in d)||!d.enumerable)throw Error('inert_data_required');
}
export function pilotPlan(){
 const request={method:'GET',endpoint:'/fixtures',query:{ids:IDS.join('-')},fixture_ids:[...IDS],max_attempts:1,redirect:'error',automatic_retries:0,additional_queries:0};
 const p={version:'synthetic-three-fixture-plan-v1',classification:'synthetic_plan_only',provider:'api-football-v3',base_url:'https://v3.football.api-sports.io',fixture_request:request,status_metadata_request:{method:'GET',endpoint:'/status',query:{},fixture_ids:[],max_attempts:1,redirect:'error',automatic_retries:0,additional_queries:0},max_body_bytes:LIMITS.rawBytes,real_transport_enabled:false};
 return freeze({...p,plan_hash:canonicalHash(p)});
}
function metadata(input){
 const m=safeClone(input);closed(m,META);
 if(typeof m.request_id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(m.request_id)||/^(?:sk-|eyJ|bearer)/i.test(m.request_id)||!HEX.test(m.collector_sha256)||typeof m.collector_sha256!=='string')throw Error('invalid_adapter_metadata');
 for(const k of ['request_started_at_utc','response_received_at_utc'])if(typeof m[k]!=='string'||!m[k].endsWith('Z'))throw Error('utc_clock_required');
 if(epochMicros(m.request_started_at_utc)>epochMicros(m.response_received_at_utc))throw Error('adapter_chronology');
 return m;
}
function copyBytes(value){
 if(!isUint8Array(value)||![Uint8Array.prototype,Buffer.prototype].includes(Object.getPrototypeOf(value)))throw Error('inert_bytes_required');
 // Built-in accessors bypass any user-added length/buffer getters on a typed array.
 const proto=Object.getPrototypeOf(Uint8Array.prototype),get=k=>Object.getOwnPropertyDescriptor(proto,k).get.call(value);
 const size=get('byteLength'),buffer=get('buffer');
 if(size>LIMITS.rawBytes||typeof SharedArrayBuffer!=='undefined'&&buffer instanceof SharedArrayBuffer)throw Error('body_size_or_shared_memory');
 return Buffer.from(new Uint8Array(buffer,get('byteOffset'),size));
}
function responseHeaders(input){
 const original=safeClone(input);if(!plain(original))throw Error('header_object_required');const out={},seen=new Set();
 for(const [key,value]of Object.entries(original)){
  const name=key.toLowerCase();if(!/^[a-z0-9-]{1,80}$/.test(name)||seen.has(name))throw Error('duplicate_or_invalid_header');seen.add(name);
  if(/authorization|api.*key|cookie|secret|token/.test(name))throw Error('credential_header_forbidden');
  if(!SAFE_HEADERS.has(name))continue;
  if(typeof value!=='string'||value.length>256||/[\x00-\x1f\x7f]/.test(value))throw Error('invalid_safe_header');
  if(/limit|length|retry-after/.test(name)&&(!/^\d{1,16}$/.test(value)||!Number.isSafeInteger(Number(value))))throw Error('invalid_header_counter');
  if(name==='date'&&!Number.isFinite(Date.parse(value)))throw Error('invalid_provider_date');
  if(name==='content-encoding'&&!['identity','gzip','br','deflate'].includes(value))throw Error('unsupported_encoding');
  if(name==='content-type'&&!/^[a-z][a-z0-9.+-]*\/[a-z][a-z0-9.+-]*(?:; charset=utf-8)?$/i.test(value))throw Error('invalid_content_type');
  out[name]=value;
 }
 return out;
}
function makeCapture(response,inputMetadata,kind){
 closed(response,['status','headers','body','body_complete','content_decoding']);
 const bytes=copyBytes(response.body); // Preserve before text decoding, parsing or projection.
 const m=metadata(inputMetadata),headers=responseHeaders(response.headers),decoding=safeClone(response.content_decoding);
 closed(decoding,['mode','encoding']);
 if(!['none','automatic','unknown'].includes(decoding.mode)||!['identity','gzip','br','deflate','unknown'].includes(decoding.encoding))throw Error('invalid_content_decoding');
 if(decoding.mode==='none'&&(decoding.encoding!=='identity'||headers['content-encoding']&&headers['content-encoding']!=='identity')||decoding.mode==='automatic'&&(decoding.encoding==='identity'||decoding.encoding==='unknown'||headers['content-encoding']!==decoding.encoding))throw Error('inconsistent_content_decoding');
 if(!Number.isInteger(response.status)||response.status<100||response.status>599||typeof response.body_complete!=='boolean')throw Error('invalid_response_metadata');
 const p=pilotPlan(),request=kind==='fixture'?p.fixture_request:p.status_metadata_request;
 const base={version:VERSION,classification:'synthetic_only',plan_hash:p.plan_hash,request,...m,response:{status:response.status,headers,body_complete:response.body_complete,content_decoding:decoding,byte_representation:'http_client_body_bytes_not_wire_octets'},raw_length:bytes.length,raw_sha256:rawHash(bytes)};
 return {manifest:freeze({...base,capture_hash:canonicalHash(base)}),bytes};
}
export function createSyntheticSession(){
 let fixtureUsed=false,statusUsed=false;
 return Object.freeze({
  captureFixture(response,meta){if(fixtureUsed)throw Error('fixture_attempt_exhausted');fixtureUsed=true;return makeCapture(response,meta,'fixture');},
  captureStatus(response,meta){if(statusUsed)throw Error('status_metadata_attempt_exhausted');statusUsed=true;return makeCapture(response,meta,'status');}
 });
}
export function executeRealTransport(){throw Error('real_provider_transport_disabled_requires_separate_implementation_and_director_approval');}
function checked(capture){
 closed(capture,['manifest','bytes']);const m=safeClone(capture.manifest),bytes=copyBytes(capture.bytes);
 closed(m,['version','classification','plan_hash','request',...META,'response','raw_length','raw_sha256','capture_hash']);
 closed(m.response,['status','headers','body_complete','content_decoding','byte_representation']);
 const p=pilotPlan(),kind=m.request?.endpoint==='/fixtures'?'fixture':m.request?.endpoint==='/status'?'status':null;
 if(!kind||canonicalHash(m.request)!==canonicalHash(kind==='fixture'?p.fixture_request:p.status_metadata_request))throw Error('request_identity_mismatch');
 const rebuilt=makeCapture({status:m.response.status,headers:m.response.headers,body:bytes,body_complete:m.response.body_complete,content_decoding:m.response.content_decoding},Object.fromEntries(META.map(k=>[k,m[k]])),kind);
 if(canonicalHash(m)!==canonicalHash(rebuilt.manifest))throw Error('adapter_capture_hash');return rebuilt;
}
function derived(c){
 const m=c.manifest;
 return captureResponse({bytes:c.bytes,metadata:{capture_id:m.request_id,provider:'api-football-v3',base_url:pilotPlan().base_url,endpoint:'/fixtures',query:{ids:IDS.join('-')},requested_ids:[...IDS],request_started_at_utc:m.request_started_at_utc,response_received_at_utc:m.response_received_at_utc,provider_date_utc:null,http_status:m.response.status,content_type:'application/json',collector_commit:m.collector_sha256,transformation_version:TRANSFORMATION}});
}
function statusProjection(s){
 const out={short:s.short};
 for(const key of ['long','elapsed','extra'])if(Object.hasOwn(s,key)){
  const v=s[key];if(key==='long'){if(v!==null){if(typeof v!=='string'||v.length>128)throw Error('status_long');validateFootballText(v,'identity_label');}}
  else if(v!==null&&(!Number.isSafeInteger(v)||v<0||v>240))throw Error('status_clock');out[key]=v;
 }
 return out;
}
export function analyzeCapture(input,normalized){
 const c=checked(input),m=c.manifest,rows=safeClone(normalized);
 if(m.request.endpoint!=='/fixtures'||!Array.isArray(rows)||rows.length!==3||new Set(rows.map(r=>r.fxid)).size!==3||rows.some(r=>!IDS.includes(r.fxid)))throw Error('pilot_required_inventory');
 const r=m.response,hasJSON=/^application\/json(?:; charset=utf-8)?$/i.test(r.headers['content-type']??'');
 let usable=r.status===200&&r.body_complete&&r.content_decoding.mode!=='unknown'&&hasJSON;
 if(r.content_decoding.mode==='none'&&r.headers['content-length']!==undefined&&Number(r.headers['content-length'])!==c.bytes.length)usable=false;
 const base=derived(c),view=verifyCapture(base);let originals=[];
 if(usable&&view.inventory_complete&&view.invalid_ids.length===0){
  try{
   const parsed=parseBoundedJSON(new TextDecoder('utf-8',{fatal:true}).decode(c.bytes)).value;
   originals=view.fixtures.map(f=>({...f,status:statusProjection(parsed.response.find(x=>x.fixture.id===f.fixture.id).fixture.status)}));
  }catch{usable=false;}
 }else usable=false;
 let result;
 if(usable){
  const comparison=reconcile({captures:[base],normalized:rows});
  result={...comparison,records:comparison.records.map(x=>({...x,observations:x.observations.map(o=>({...o,capture_hash:m.capture_hash}))}))};
 }
 else{
  const empty=reconcile({captures:[],normalized:rows});
  result={...empty,inventory:{...empty.inventory,classification_counts:{supported:0,conflicting:0,missing:0,duplicated:0,incomplete:3,'period-unverified':0}},records:empty.records.map(x=>({...x,classification:'incomplete',reasons:['response_or_inventory_incomplete'],observations:[{capture_hash:m.capture_hash,raw_sha256:m.raw_sha256,received_at_utc:m.response_received_at_utc}]}))};
  originals=[];
 }
 return freeze({version:'synthetic-provider-analysis-v1',classification:'synthetic_only',capture_hash:m.capture_hash,inventory_complete:usable,provider_authenticity:'unverified',regulation_period_semantics:'unverified',source_review_admissible:false,originals,reconciliation:result});
}

function privateDirectory(directory){
 if(process.platform==='win32')throw Error('posix_private_persistence_required');
 if(!isAbsolute(directory)||resolve(directory)!==directory||realpathSync(dirname(directory))!==dirname(directory))throw Error('absolute_real_private_parent_required');
 const parent=lstatSync(dirname(directory));if(!parent.isDirectory()||parent.mode&0o077||parent.uid!==process.getuid())throw Error('private_owned_parent_required');
}
function writePrivate(path,data){const fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);try{writeFileSync(fd,data);fsyncSync(fd);}finally{closeSync(fd);}}
function readPrivate(path,max){
 const before=lstatSync(path);if(before.isSymbolicLink()||!before.isFile())throw Error('nonregular_file_forbidden');
 const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);try{const s=fstatSync(fd);if(!s.isFile()||s.size>max||s.mode&0o077||s.uid!==process.getuid())throw Error('private_regular_file_required');return readFileSync(fd);}finally{closeSync(fd);}
}
export function writeAdapterCapture(directory,input){
 const c=checked(input);privateDirectory(directory);mkdirSync(directory,{mode:0o700});
 writePrivate(join(directory,'response.bin'),c.bytes);writePrivate(join(directory,'manifest.json'),JSON.stringify(c.manifest,null,2)+'\n');
 const fd=openSync(directory,constants.O_RDONLY|constants.O_DIRECTORY|constants.O_NOFOLLOW);try{fsyncSync(fd);}finally{closeSync(fd);}
 const readback=readAdapterCapture(directory);if(readback.manifest.capture_hash!==c.manifest.capture_hash||!readback.bytes.equals(c.bytes))throw Error('readback_mismatch');return readback;
}
export function readAdapterCapture(directory){
 privateDirectory(directory);const s=lstatSync(directory);if(s.isSymbolicLink()||!s.isDirectory()||s.mode&0o077||s.uid!==process.getuid())throw Error('private_directory_required');
 const manifest=parseBoundedJSON(new TextDecoder('utf-8',{fatal:true}).decode(readPrivate(join(directory,'manifest.json'),65536))).value;
 return checked({manifest,bytes:readPrivate(join(directory,'response.bin'),LIMITS.rawBytes)});
}
