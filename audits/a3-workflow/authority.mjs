// Offline source authority only. No caller JSON flag certifies a real source.
import {createHash} from 'node:crypto';
import {canonicalHash,utcInstant,epochMicros} from '../lib/snapshot-contract.mjs';
import {safeClone,freeze} from '../a4/bounds.mjs';
export const RETAINED=Object.freeze({journal_sha256:'5bccfcde2ac4cfbab59049a81b6c4c8b0a6b83f7d6e0cbbf068c3dd1e7a143d4',packet_id:'prospective:20261025212552888493:packet',source_hash:'7d4b72b32c4c8c353edc69befe8b66b7ca0e84be0c971bf960dafe703252eb53',receipt:'2026-10-25T21:25:55.974159Z',event_body_hash:'a306d8d9ed3f7db6ce1aa336c9e1edc0a6d84db381bbeeafcd7d4ab5387b2b16'});
const sources=new WeakMap(),journals=new WeakMap();
function mint(source,receipt,classification){
 const received=utcInstant(receipt);
 if(epochMicros(source.source_read_at_utc)>epochMicros(received))throw Error('source_receipt_chronology');
 const cap=Object.freeze({kind:'a3-source-capability',classification});
 sources.set(cap,freeze({source,receipt:received,classification,source_hash:canonicalHash(source)}));return cap;
}
export function syntheticSource(source,receipt){const s=safeClone(source);if(s.synthetic!==true)throw Error('synthetic source required');return mint(s,receipt,'synthetic_only');}
export function loadRetainedJournal(raw){
 if(typeof raw!=='string'||Buffer.byteLength(raw)>64*1024*1024||createHash('sha256').update(raw).digest('hex')!==RETAINED.journal_sha256)throw Error('retained_journal_hash_required');
 // Parse only after the exact previously accepted byte hash matches. This is
 // not a generic journal importer, recovery verifier or new receipt authority.
 const events=JSON.parse(raw),matches=events.filter(e=>e.kind==='packet'&&e.event_id===RETAINED.packet_id);
 if(matches.length!==1)throw Error('retained_packet_identity');const event=matches[0];
 if(canonicalHash(event.body)!==RETAINED.source_hash||utcInstant(event.received_at)!==RETAINED.receipt||event.event_body_hash!==RETAINED.event_body_hash)throw Error('retained_packet_binding');
 const handle=Object.freeze({kind:'a3-retained-journal',journal_sha256:RETAINED.journal_sha256});journals.set(handle,freeze({events,packet:event}));return handle;
}
export function readRetained(handle){const value=journals.get(handle);if(!value)throw Error('untrusted_retained_journal');return value;}
export function retainedSource(handle){const {packet}=readRetained(handle);return mint(packet.body,packet.received_at,'accepted_historical_receipt_replay');}
export function readSource(cap){const value=sources.get(cap);if(!value)throw Error('untrusted_source_capability');return value;}
// Additive genuine A3 source adapter. No caller-supplied verified/status flag.
// Repository factory enforces the existing pinned isolated database boundary.
export async function enrolledSource(db,packetId){
 const {singleStore}=await import('../a3-supervised/local.mjs'),store=singleStore(db);
 const packet=store.read(packetId),study=packet&&store.read(packet.parent_id);
 if(packet?.kind!=='packet'||study?.kind!=='study'||study.body.version!=='a3-supervised-single-v1'||packet.body.synthetic===true||packet.body.collection?.kind!=='a3_single_readonly_v1'||packet.body.targets.length!==1||String(packet.body.targets[0])!==study.body.fixture_id||canonicalHash(packet.body)!==study.body.source_hash)throw Error('genuine_enrolled_source_binding');
 return mint(packet.body,packet.received_at,'a3_isolated_database_receipt');
}
