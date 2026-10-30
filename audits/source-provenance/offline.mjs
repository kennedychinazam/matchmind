// Isolated synthetic-only file prototype. No network, database or A3 authority imports.
import {mkdirSync,writeFileSync,openSync,readFileSync,closeSync,fstatSync,fsyncSync,constants} from 'node:fs';
import {isAbsolute,join} from 'node:path';
import {TextDecoder} from 'node:util';
import {safeClone,freeze,parseBoundedJSON,rawHash,LIMITS} from '../a4/bounds.mjs';
import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {validateFootballText} from '../a4/text-policy.mjs';
export const VERSION='offline-source-capture-v1';
export const TRANSFORMATION='raw-fixture-projection-v1';
const keys=['capture_id','provider','base_url','endpoint','query','requested_ids','request_started_at_utc','response_received_at_utc','provider_date_utc','http_status','content_type','collector_commit','transformation_version'];
const legacyKeys='fxid,lid,lname,lcountry,season,date,time,status,home,away,gh,ga,ht_h,ht_a,ft_h,ft_a,provider,xg_h,xg_a,inj_h,inj_a'.split(',');
const id=x=>Number.isSafeInteger(x)&&x>0;
const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function closed(x,expected){if(!plain(x)||Object.keys(x).length!==expected.length||expected.some(k=>!Object.hasOwn(x,k)))throw Error('closed_capture_shape');}
function ids(x){if(!Array.isArray(x)||!x.length||x.length>LIMITS.arrayItems||x.some(v=>!id(v))||new Set(x).size!==x.length)throw Error('capture_ids');}
function metadata(value){
 const m=safeClone(value);closed(m,keys);
 if(typeof m.capture_id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(m.capture_id)||m.provider!=='api-football-v3'||m.base_url!=='https://v3.football.api-sports.io'||m.endpoint!=='/fixtures'||!hash(m.collector_commit)||m.transformation_version!==TRANSFORMATION||!Number.isInteger(m.http_status)||m.http_status<100||m.http_status>599||m.content_type!=='application/json')throw Error('capture_metadata');
 ids(m.requested_ids);const q=m.query;
 if(plain(q)&&Object.hasOwn(q,'ids')){
  closed(q,['ids']);if(typeof q.ids!=='string'||q.ids!==m.requested_ids.join('-')||m.requested_ids.length>20)throw Error('capture_query_ids');
 }else{closed(q,['league','season']);if(typeof q.league!=='string'||typeof q.season!=='string'||!/^[1-9]\d{0,8}$/.test(q.league)||!/^(?:19|20)\d{2}$/.test(q.season))throw Error('capture_query_season');}
 const start=epochMicros(m.request_started_at_utc),receipt=epochMicros(m.response_received_at_utc);
 if(start>receipt||m.provider_date_utc!==null&&epochMicros(m.provider_date_utc)>receipt)throw Error('capture_chronology');
 return m;
}
function bytes(value){if(!(value instanceof Uint8Array)||value.byteLength>LIMITS.rawBytes)throw Error('capture_bytes_bound');return Buffer.from(value);}
export function captureResponse({bytes:input,metadata:inputMetadata}){
 const body=bytes(input),m=metadata(inputMetadata),base={version:VERSION,classification:'synthetic_only',metadata:m,raw_sha256:rawHash(body),raw_length:body.length};
 return {manifest:freeze({...base,capture_hash:canonicalHash(base)}),bytes:body};
}
function authenticated(capture){
 const body=bytes(capture.bytes),m=safeClone(capture.manifest);closed(m,['version','classification','metadata','raw_sha256','raw_length','capture_hash']);
 const {capture_hash,...base}=m;
 if(m.version!==VERSION||m.classification!=='synthetic_only'||!hash(capture_hash)||canonicalHash(base)!==capture_hash||m.raw_length!==body.length||rawHash(body)!==m.raw_sha256)throw Error('capture_hash');
 metadata(m.metadata);return{manifest:m,body};
}
function label(v){if(typeof v!=='string'||!v.trim()||v.length>128)throw Error('fixture_identity');validateFootballText(v,'identity_label');return v;}
function score(value){
 if(value===null)return null;if(!plain(value))throw Error('score_component');const out={};
 for(const k of ['home','away'])if(Object.hasOwn(value,k)){const n=value[k];if(n!==null&&(!Number.isSafeInteger(n)||n<0||n>100))throw Error('score_number');out[k]=n;}return out;
}
function project(value,received){
 const f=value?.fixture,l=value?.league,t=value?.teams;
 if(!id(f?.id)||!id(l?.id)||!id(t?.home?.id)||!id(t?.away?.id)||t.home.id===t.away.id||typeof f.status?.short!=='string'||!/^[A-Z0-9]{1,16}$/.test(f.status.short))throw Error('fixture_identity');
 const played=epochMicros(f.date);if(['FT','AET','PEN'].includes(f.status.short)&&played>=epochMicros(received))throw Error('fixture_future_result');
 const out={fixture:{id:f.id,date:f.date,status:{short:f.status.short}},league:{id:l.id,name:label(l.name),country:label(l.country),season:l.season},teams:{home:{id:t.home.id,name:label(t.home.name)},away:{id:t.away.id,name:label(t.away.name)}}};
 if(!Number.isSafeInteger(l.season)||l.season<1900||l.season>2099)throw Error('fixture_season');
 if(Object.hasOwn(value,'goals'))out.goals=score(value.goals);
 if(Object.hasOwn(value,'score')){if(value.score===null)out.score=null;else{if(!plain(value.score))throw Error('score_object');out.score={};for(const k of ['halftime','fulltime','extratime','penalty'])if(Object.hasOwn(value.score,k))out.score[k]=score(value.score[k]);}}
 return out;
}
export function verifyCapture(capture){
 const {manifest:m,body}=authenticated(capture);let parsed;
 try{parsed=parseBoundedJSON(new TextDecoder('utf-8',{fatal:true}).decode(body)).value;}catch{return freeze({parse_status:'malformed',api_errors_present:null,inventory_complete:false,returned_ids:[],fixtures:[],invalid_ids:[]});}
 const errors=parsed?.errors;const api_errors_present=!(Array.isArray(errors)&&errors.length===0||plain(errors)&&Object.keys(errors).length===0);
 const rows=parsed?.response,returned_ids=[],fixtures=[],invalid_ids=[];
 let inventory_complete=m.metadata.http_status>=200&&m.metadata.http_status<300&&!api_errors_present&&parsed?.get==='fixtures'&&plain(parsed.parameters)&&canonicalHash(parsed.parameters)===canonicalHash(m.metadata.query)&&Array.isArray(rows)&&rows.length<=LIMITS.arrayItems&&parsed.results===rows.length&&parsed.paging?.current===1&&parsed.paging?.total===1;
 if(Array.isArray(rows)&&rows.length<=LIMITS.arrayItems)for(const row of rows){
  const fid=row?.fixture?.id;if(id(fid))returned_ids.push(fid);else inventory_complete=false;
  try{fixtures.push(project(row,m.metadata.response_received_at_utc));}catch{if(id(fid))invalid_ids.push(fid);else inventory_complete=false;}
 }
 if(new Set(returned_ids).size!==returned_ids.length||returned_ids.some(n=>!m.metadata.requested_ids.includes(n))||m.metadata.requested_ids.some(n=>!returned_ids.includes(n)))inventory_complete=false;
 if(!Object.hasOwn(m.metadata.query,'ids')&&fixtures.some(f=>String(f.league.id)!==m.metadata.query.league||String(f.league.season)!==m.metadata.query.season))inventory_complete=false;
 // Duplicated IDs remain separately visible; no winner selected.
 return freeze({parse_status:'parsed',api_errors_present,inventory_complete,returned_ids,fixtures,invalid_ids});
}
function validateLegacy(input){
 const rows=safeClone(input);if(!Array.isArray(rows)||rows.length>LIMITS.arrayItems)throw Error('required_inventory');
 const seen=new Set();for(const r of rows){if(!plain(r)||Object.keys(r).some(k=>!legacyKeys.includes(k))||!id(r.fxid)||!id(r.lid))throw Error('required_record');if(seen.has(r.fxid))throw Error('duplicate_required');seen.add(r.fxid);label(r.home);label(r.away);
  for(const k of ['gh','ga','ft_h','ft_a','ht_h','ht_a'])if(Object.hasOwn(r,k)&&r[k]!==null&&(!Number.isSafeInteger(r[k])||r[k]<0||r[k]>100))throw Error('required_score');
 }return rows;
}
const pair=v=>plain(v)&&Number.isSafeInteger(v.home)&&Number.isSafeInteger(v.away);
function conflict(r,f){
 if(r.lid!==f.league.id||r.home!==f.teams.home.name||r.away!==f.teams.away.name)return true;
 if(Object.hasOwn(r,'season')&&r.season!==f.league.season)return true;
 const utc=new Date(f.fixture.date).toISOString();
 for(const [key,expected]of [['date',utc.slice(0,10)],['lname',f.league.name],['lcountry',f.league.country],['provider','af']])if(Object.hasOwn(r,key)&&r[key]!==expected)return true;
 if(Object.hasOwn(r,'time')&&r.time!==utc.slice(11,16)&&r.time!==utc.slice(11,19))return true;
 const statusMap={FT:'FINISHED',AET:'FINISHED',PEN:'FINISHED',CANC:'CANCELLED',ABD:'CANCELLED'};
 if(Object.hasOwn(r,'status')&&r.status!==(statusMap[f.fixture.status.short]??f.fixture.status.short))return true;
 for(const [a,b,v]of [['gh','ga',f.goals],['ht_h','ht_a',f.score?.halftime],['ft_h','ft_a',f.score?.fulltime]])for(const[k,s]of [[a,'home'],[b,'away']])if(Object.hasOwn(r,k)&&(!plain(v)||!Object.hasOwn(v,s)||r[k]!==v[s]))return true;
 return false;
}
export function reconcile({captures,normalized,synthetic_period_rule=null}){
 if(synthetic_period_rule!==null&&synthetic_period_rule!=='synthetic-fulltime-v1')throw Error('unapproved_synthetic_period_rule');
 if(!Array.isArray(captures)||captures.length>1024)throw Error('capture_inventory');
 const required=validateLegacy(normalized),views=captures.map(c=>({c,view:verifyCapture(c)}));let complete=true;
 const records=required.map(r=>{
  const relevant=views.filter(({c})=>c.manifest.metadata.requested_ids.includes(r.fxid));
  const found=relevant.flatMap(({c,view})=>view.fixtures.filter(f=>f.fixture.id===r.fxid).map(f=>({c,view,f})));
  const count=relevant.reduce((n,{view})=>n+view.returned_ids.filter(id=>id===r.fxid).length,0);
  let classification,reasons=[],regulation_score=null;
  if(count>1){classification='duplicated';reasons=['multiple_original_observations_no_winner'];}
  else if(relevant.some(({view})=>!view.inventory_complete||view.invalid_ids.includes(r.fxid))){classification='incomplete';reasons=['source_inventory_or_projection_invalid'];}
  else if(!found.length){classification='missing';reasons=['original_record_not_found'];}
  else{
   const f=found[0].f;
   if(conflict(r,f)){classification='conflicting';reasons=['normalized_record_differs'];}
   else if(!['FT','AET','PEN'].includes(f.fixture.status.short)||!synthetic_period_rule){classification='period-unverified';reasons=['no_verified_regulation_rule'];}
   else if(!pair(f.score?.fulltime)||!pair(f.goals)){classification='incomplete';reasons=['missing_regulation_or_final_pair'];}
   else if(f.score.fulltime.home>f.goals.home||f.score.fulltime.away>f.goals.away||f.fixture.status.short==='FT'&&(f.score.fulltime.home!==f.goals.home||f.score.fulltime.away!==f.goals.away)){classification='conflicting';reasons=['inconsistent_synthetic_period_scores'];}
   else{classification='supported';regulation_score=f.score.fulltime;reasons=['synthetic_fulltime_rule_only'];}
  }
  if(classification!=='supported')complete=false;
  return {fixture_id:r.fxid,classification,reasons,regulation_score,normalized_record_hash:canonicalHash(r),unverified_normalized_fields:Object.keys(r).filter(k=>['xg_h','xg_a','inj_h','inj_a'].includes(k)),observations:relevant.map(({c})=>({capture_hash:c.manifest.capture_hash,raw_sha256:c.manifest.raw_sha256,received_at_utc:c.manifest.metadata.response_received_at_utc}))};
 });
 return freeze({version:'offline-source-reconciliation-v1',classification:'synthetic_reconciliation_only',source_review_admissible:false,synthetic_inventory_supported:complete&&records.length>0,transformation_version:TRANSFORMATION,synthetic_period_rule,inventory:{required:required.length,accounted:records.length,classification_counts:Object.fromEntries(['supported','conflicting','missing','duplicated','incomplete','period-unverified'].map(k=>[k,records.filter(r=>r.classification===k).length]))},records});
}
export function correctionSidecar({prior,next,fixture_id,reason}){
 const a=authenticated(prior),b=authenticated(next);
 if(!id(fixture_id)||!a.manifest.metadata.requested_ids.includes(fixture_id)||!b.manifest.metadata.requested_ids.includes(fixture_id)||!['provider_revision_observed','source_conflict_observed'].includes(reason))throw Error('revision_scope');
 if(!verifyCapture(prior).fixtures.some(f=>f.fixture.id===fixture_id)||!verifyCapture(next).fixtures.some(f=>f.fixture.id===fixture_id))throw Error('revision_original_record');
 if(epochMicros(b.manifest.metadata.request_started_at_utc)<=epochMicros(a.manifest.metadata.response_received_at_utc)||a.manifest.capture_hash===b.manifest.capture_hash)throw Error('revision_chronology');
 const body={version:'offline-source-correction-v1',classification:'synthetic_only',fixture_id,reason,prior_hash:a.manifest.capture_hash,next_hash:b.manifest.capture_hash,received_at_utc:b.manifest.metadata.response_received_at_utc};return freeze({...body,sidecar_hash:canonicalHash(body)});
}
export function writeCapture(directory,capture){
 authenticated(capture);if(!isAbsolute(directory))throw Error('absolute_private_directory_required');
 mkdirSync(directory,{mode:0o700}); // Exclusive directory: existing files/symlinks never overwritten.
 writePrivate(join(directory,'response.bin'),capture.bytes);
 writePrivate(join(directory,'manifest.json'),JSON.stringify(capture.manifest,null,2)+'\n');syncDirectory(directory);
}
function readBounded(path,max){const fd=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const s=fstatSync(fd);if(!s.isFile()||s.size>max)throw Error('capture_file_bound');return readFileSync(fd);}finally{closeSync(fd);}}
export function readCapture(directory){
 const manifest=parseBoundedJSON(readBounded(join(directory,'manifest.json'),65536).toString('utf8')).value;
 const capture={manifest,bytes:readBounded(join(directory,'response.bin'),LIMITS.rawBytes)};authenticated(capture);return capture;
}

function writePrivate(path,data){const fd=openSync(path,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL,0o600);try{writeFileSync(fd,data);fsyncSync(fd);}finally{closeSync(fd);}}
function syncDirectory(path){const fd=openSync(path,constants.O_RDONLY|constants.O_DIRECTORY);try{fsyncSync(fd);}finally{closeSync(fd);}}
export function writeCorrection(directory,input){
 const s=safeClone(input);closed(s,['version','classification','fixture_id','reason','prior_hash','next_hash','received_at_utc','sidecar_hash']);const{sidecar_hash,...body}=s;
 if(s.version!=='offline-source-correction-v1'||s.classification!=='synthetic_only'||!id(s.fixture_id)||!hash(s.prior_hash)||!hash(s.next_hash)||s.prior_hash===s.next_hash||!['provider_revision_observed','source_conflict_observed'].includes(s.reason)||!hash(sidecar_hash)||canonicalHash(body)!==sidecar_hash)throw Error('sidecar_hash');epochMicros(s.received_at_utc);
 if(!isAbsolute(directory))throw Error('absolute_private_directory_required');mkdirSync(directory,{mode:0o700});writePrivate(join(directory,'correction.json'),JSON.stringify(s,null,2)+'\n');syncDirectory(directory);
}
