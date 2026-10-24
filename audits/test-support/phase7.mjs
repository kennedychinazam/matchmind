// Artificial unit clocks/labels, NEVER a real receipt attestation.
import {generateKeyPairSync,createHash}from 'node:crypto';
import {canonicalHash}from '../lib/snapshot-contract.mjs';
import {snapshot as base}from './synthetic.mjs';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const rawHash=x=>createHash('sha256').update(x).digest('hex');
export const testPrivateKey=privateKey;
export const testPolicy={key_id:'synthetic-unit-key',public_key_pem:publicKey.export({type:'spki',format:'pem'}),purpose:'phase7-synthetic-poc',allowed_kind:'synthetic_verification',source_id:'synthetic-unit',clock_domain:'synthetic_unit'};
export function fixturePayload(versions,{start='2026-10-01',n=30,exported='2026-10-02T23:00:00Z',prefix=10000,historyCount=5,homeXg=1.5}={}){
 const observations={},examples=[];
 const issue=start+'T12:00:00Z',kickoff=start+'T18:00:00Z',receipt=start+'T11:00:00Z';
 const add=(fid,fields,played)=>{const ids=[];for(const[field_name,value]of Object.entries(fields)){
  const h=rawHash(`${prefix}:${fid}:${field_name}`),observation_id=`${h.slice(0,8)}-${h.slice(8,12)}-5${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
  observations[observation_id]={observation_id,fixture_id:String(fid),field_name,value,value_text:JSON.stringify(value),source_kind:'collector',source_ref:'synthetic-unit',availability:'observed',feature_schema_version:1,
   observed_at_utc:receipt,received_at_utc:receipt,effective_at_utc:null,played_at_utc:played,source_hash:'a'.repeat(64),payload_hash:canonicalHash(value)};ids.push(observation_id);
 }return ids;};
 const history=[];
 for(let j=0;j<historyCount;j++){const d=new Date(Date.parse(start+'T00:00:00Z')-(j+1)*86400000).toISOString().slice(0,10);history.push(...add(prefix-10-j,{home:'Alpha',away:'Beta',lid:39,date:d,time:'18:00',status:'FINISHED',gh:2,ga:1,xg_h:homeXg,xg_a:1,season:2026},d+'T18:00:00Z'));}
 for(let i=0;i<n;i++){
  const fid=String(prefix+i),sid=`${String(i+1).padStart(8,'0')}-1111-4111-8111-111111111111`;
  const s={...base(),snapshot_id:sid,fixture_id:fid,issue_time_utc:issue,kickoff_at_utc:kickoff,probabilities:[.4,.2,.4]};
  const ids=[...history,...add(fid,{home:'Alpha',away:'Beta',lid:39,date:start,time:'18:00',status:'NS',season:2026},null)];
  const chunks=[{ordinal:1,chunk_hash:rawHash('['+ids.map(JSON.stringify).join(', ')+']'),member_count:ids.length,members:ids.map((observation_id,k)=>({ordinal:k+1,observation_id}))}];
  const body={selection:{version:'m14-dependencies-v1',build:355,league_id:39,home:'Alpha',away:'Beta'},chunks:chunks.map(x=>x.chunk_hash),evidence_count:ids.length,hash_scheme:'pg-jsonb-v1'};
  const label={fixture_id:fid,kind:'synthetic_verification',event_finished_at_utc:kickoff,fixture:{date:start,time:'18:00',status:'FT',provider:'af',gh:i%3===2?0:1,ga:i%3===2?1:0,ft_h:i%3===2?0:1,ft_a:i%3===2?1:0}};
  examples.push({fixture_id:fid,snapshot:s,source_prediction:{fxid:fid,lid:39,home:'Alpha',away:'Beta',made_at:issue,kickoff:start,ktime:'18:00',build:355,pick:s.pick,p_home:.4,p_draw:.2,p_away:.4},
   capture:{capture_kind:'at_issue',received_at_utc:start+'T12:00:00.000001Z',payload_hash:rawHash(JSON.stringify(s)),envelope_text:JSON.stringify(s),manifest_hash:rawHash(JSON.stringify(body))},
   manifest:{payload_hash:rawHash(JSON.stringify(body)),body_text:JSON.stringify(body),chunks},
   settlements:[{revision:1,received_at_utc:start+'T20:00:00Z',envelope_text:JSON.stringify(label),payload_hash:rawHash(JSON.stringify(label))}]});
 }
 return {schema_version:1,dataset_kind:'synthetic_verification',source:{source_id:testPolicy.source_id,clock_domain:testPolicy.clock_domain},source_versions:versions,exported_at_utc:exported,observations,examples};
}
