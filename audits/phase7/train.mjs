import {readFileSync}from 'node:fs';
import {createHash}from 'node:crypto';
import {canonicalHash,canonicalJSON,epochMicros}from '../lib/snapshot-contract.mjs';
import {ADAPTERS}from '../phase6/adapters.mjs';
import {prepareSamples}from './samples.mjs';
import {sourceVersions}from './attestation.mjs';
export function trainerSourceHash(){const h=createHash('sha256');for(const p of ['./train.mjs','./evaluate.mjs','./samples.mjs','./attestation.mjs','../phase6/adapters.mjs','../phase5/validation.mjs'])h.update(p).update(readFileSync(new URL(p,import.meta.url)));return h.digest('hex');}
export function candidateProbabilities(baseline,xgEdge,beta){return ADAPTERS['m14-xgedge-v1'].execute({baseline:[...baseline],features:{xgEdge},configuration:{artifact_kind:'synthetic',beta}});}
function freeze(x){if(x&&typeof x==='object'){Object.values(x).forEach(freeze);Object.freeze(x);}return x;}
export function fitCoefficient(packet,policy,configuration){
 if(!configuration||Object.keys(configuration).sort().join(',')!=='fit_cutoff_utc,minimum_examples,train_start_utc,version'||typeof configuration.version!=='string'||!/^[a-zA-Z0-9_.-]{1,100}$/.test(configuration.version)||!Number.isInteger(configuration.minimum_examples)||configuration.minimum_examples<20)throw Error('invalid fit configuration');
 const start=epochMicros(configuration.train_start_utc),cutoff=epochMicros(configuration.fit_cutoff_utc);
 if(start>=cutoff)throw Error('training period chronology');
 const prepared=prepareSamples(packet,policy,configuration.fit_cutoff_utc);
 if(epochMicros(prepared.exported_at_utc)>=cutoff)throw Error('training export must precede fit cutoff');
 const rows=prepared.eligible.filter(r=>epochMicros(r.issued_at)>=start&&epochMicros(r.issued_at)<cutoff).sort((a,b)=>a.id.localeCompare(b.id));
 const nonDraw=rows.filter(r=>r.actual!=='X'),information=nonDraw.reduce((s,r)=>s+r.xgEdge*r.xgEdge,0);
 let beta=0,reason=rows.length<configuration.minimum_examples?'insufficient_examples':nonDraw.length<10||information<=1e-12?'unidentifiable_feature':null,at_boundary=false;
 const gradient=b=>nonDraw.reduce((sum,r)=>{const p=candidateProbabilities(r.baseline,r.xgEdge,b),q=p[0]/(r.baseline[0]+r.baseline[2]);return sum+r.xgEdge*(q-Number(r.actual==='1'));},0)/Math.max(1,rows.length);
 if(!reason){
  if(Math.abs(gradient(0))<=1e-12)beta=0;
  else if(gradient(-1)>=0){beta=-1;at_boundary=true;}
  else if(gradient(1)<=0){beta=1;at_boundary=true;}
  else{let lo=-1,hi=1;for(let i=0;i<80;i++){const mid=(lo+hi)/2;if(gradient(mid)>0)hi=mid;else lo=mid;}beta=(lo+hi)/2;}
 }
 const body={schema_version:1,artifact_kind:'synthetic_training',production_ready:false,confirmatory_eligible:false,hypothesis:'m14-xgedge-v1',version:configuration.version,
  status:reason?'abstain':'fitted',reason,beta,at_boundary,configuration:structuredClone(configuration),configuration_hash:canonicalHash(configuration),
  training_dataset_hash:prepared.dataset_hash,source_versions:sourceVersions(),trainer_source_hash:trainerSourceHash(),
  algorithm:{version:'bounded-logloss-bisection-v1',bounds:[-1,1],iterations:80,zero_gradient_tolerance:1e-12,minimum_non_draw:10,minimum_information:1e-12,regularization:0,intercept:false},
  training:{roster:prepared.roster,n:rows.length,non_draw_n:nonDraw.length,rejected:prepared.rejected,outside_period:prepared.eligible.length-rows.length,
   fixture_ids:rows.map(r=>r.fixture_id),sample_hashes:rows.map(r=>r.sample_hash),sample_root:canonicalHash(rows.map(r=>r.sample_hash)),
   label_root:canonicalHash(rows.map(r=>({id:r.id,hash:r.label_hash,revision:r.label_revision,received_at_utc:r.label_received_at_utc})))}};
 return freeze({...body,artifact_hash:canonicalHash(body)});
}
export function verifyArtifact(a){const body=structuredClone(a);delete body.artifact_hash;
 if(canonicalHash(body)!==a.artifact_hash||a.artifact_kind!=='synthetic_training'||a.production_ready!==false||a.trainer_source_hash!==trainerSourceHash()||canonicalJSON(a.source_versions)!==canonicalJSON(sourceVersions()))throw Error('artifact identity/source invalid');
 return a;
}
