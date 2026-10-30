import {verify,createPublicKey} from 'node:crypto';
import {canonicalJSON,hash,freeze,safeClone,text} from './bounds.mjs';
import {validate,SOURCE_SCHEMA} from './schema.mjs';
// A JSON 'verified' flag never mints this capability. Real authority remains
// unconfigured, matching the existing Phase7 synthetic-only source boundary.
const proofs=new WeakMap();
function mint(payload,classification,sourceHash){const cap=Object.freeze({kind:'a4-evidence-capability',classification});proofs.set(cap,freeze({payload:freeze(payload),classification,sourceHash}));return cap;}
export function verifyBundle(bundle,options){const o=safeClone(options),b=safeClone(bundle);if(Object.keys(o).length!==2||o.mode!=='synthetic'||!Object.hasOwn(o,'publicKeyPem'))throw Error('real_source_authority_unconfigured');if(Object.keys(b).length!==3||!['payload','sha256','signature'].every(k=>Object.hasOwn(b,k)))throw Error('source_envelope');const p=validate(b.payload,SOURCE_SCHEMA);if(p.source_kind!=='synthetic_football')throw Error('synthetic_key_cannot_certify_real_source');const sourceHash=hash(p);if(b.sha256!==sourceHash)throw Error('source_hash');text(b.signature,128);if(!/^[A-Za-z0-9+/]{86}==$/.test(b.signature))throw Error('signature_encoding');let valid=false;try{const key=createPublicKey(o.publicKeyPem);valid=key.asymmetricKeyType==='ed25519'&&verify(null,Buffer.from(canonicalJSON(p)),key,Buffer.from(b.signature,'base64'));}catch{}if(!valid)throw Error('source_signature');return mint(p,'synthetically_verified',sourceHash);}
export function inspectExploratory(input){const p=validate(input,SOURCE_SCHEMA);return mint(p,'exploratory_unverified',hash(p));}
export function readCapability(cap){const p=proofs.get(cap);if(!p)throw Error('untrusted_evidence_capability');return p;}
