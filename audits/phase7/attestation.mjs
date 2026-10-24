import {createHash,sign,verify,createPublicKey}from 'node:crypto';
import {readFileSync}from 'node:fs';
import {canonicalHash,canonicalJSON,epochMicros}from '../lib/snapshot-contract.mjs';
import {ASOF_IMPLEMENTATION_HASH}from '../lib/asof-features.mjs';
export const rawHash=text=>createHash('sha256').update(text).digest('hex');
export function sourceVersions(){
 const paths=['./attestation.mjs','./samples.mjs','../lib/asof-features.mjs','../lib/snapshot-contract.mjs','../phase6/adapters.mjs'];
 const h=createHash('sha256');for(const p of paths)h.update(p).update(readFileSync(new URL(p,import.meta.url)));
 return{contract:'phase7-v1',feature_source_hash:ASOF_IMPLEMENTATION_HASH,phase6_adapter_hash:rawHash(readFileSync(new URL('../phase6/adapters.mjs',import.meta.url))),input_source_hash:h.digest('hex')};
}
function seal(payload,privateKey,keyId,purpose){
 const dataset_hash=canonicalHash({purpose,payload});
 const value=sign(null,Buffer.from(canonicalJSON({purpose,payload})),privateKey).toString('base64');
 return{purpose,payload:structuredClone(payload),dataset_hash,signature:{algorithm:'Ed25519',key_id:keyId,value}};
}
export const sealDataset=(p,key,id)=>seal(p,key,id,'dataset_export');
export const sealFreeze=(p,key,id)=>seal(p,key,id,'artifact_freeze');
function verified(packet,policy,purpose){
 if(!policy||policy.purpose!=='phase7-synthetic-poc'||policy.allowed_kind!=='synthetic_verification')throw Error('real source authority unconfigured; synthetic only');
 if(packet?.purpose!==purpose||packet?.signature?.key_id!==policy.key_id||packet.signature.algorithm!=='Ed25519')throw Error('untrusted signing key or purpose');
 if(packet.payload?.dataset_kind!=='synthetic_verification'||packet.payload?.source?.source_id!==policy.source_id||packet.payload?.source?.clock_domain!==policy.clock_domain)throw Error('dataset source/kind not trusted');
 const text=canonicalJSON({purpose,payload:packet.payload});
 if(rawHash(text)!==packet.dataset_hash)throw Error('dataset hash invalid');
 let valid=false;try{const key=createPublicKey(policy.public_key_pem);valid=key.asymmetricKeyType==='ed25519'&&verify(null,Buffer.from(text),key,Buffer.from(packet.signature.value,'base64'));}catch{}
 if(!valid)throw Error('dataset signature invalid');
 return structuredClone(packet);
}
export function verifyDataset(packet,policy){
 const r=verified(packet,policy,'dataset_export');
 if(r.payload.schema_version!==1||canonicalJSON(r.payload.source_versions)!==canonicalJSON(sourceVersions()))throw Error('dataset source version mismatch');
 epochMicros(r.payload.exported_at_utc);
 if(!Array.isArray(r.payload.examples)||!r.payload.observations||Array.isArray(r.payload.observations))throw Error('invalid dataset shape');
 return r;
}
export const verifyFreeze=(packet,policy)=>verified(packet,policy,'artifact_freeze');
