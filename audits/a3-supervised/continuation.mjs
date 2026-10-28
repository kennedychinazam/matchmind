// Inactive without immutable operator-owned receipts. No enrollment or transport.
import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {PROMPT_HASH,SCHEMA_HASH} from '../a3-workflow/workflow.mjs';
const t=epochMicros,hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/u.test(x),id=x=>typeof x==='string'&&/^[A-Za-z0-9:._-]{1,128}$/u.test(x);
export const CONTINUATION_VERSION='a3-study-continuation-v1';
const bindingKeys=['study_id','job_id','fixture_id','kickoff_at_utc','issuance_date_utc','model','provider','backend','request_hash','request_body_hash','packet_hash','source_hash','prompt_hash','schema_hash','profile_hash','endpoint_contract_hash'];
const extra={continuation:['source_review_id','source_review_body_hash','halt_anchors','one_attempt','max_new_micros','capacity_mode','director_approval_sha256','expires_at_utc'],source_review:['source_received_at_utc','availability_basis','settlement_basis','review_artifact_sha256'],capacity_risk:['continuation_id','continuation_body_hash','director_approval_sha256','review_artifact_sha256','capacity_status','complete_input_upper_tokens','input_bytes','provider_input_cap_tokens','context_tokens','physical_output_tokens','output_tokens','schema_contract_reviewed','output_contract_reviewed','expires_at_utc']};
const versions={continuation:CONTINUATION_VERSION,source_review:'a3-continuation-source-review-v1',capacity_risk:'a3-scoped-capacity-risk-v1'};
function fail(){throw Error('invalid_scoped_continuation');}
function binding(plan,authorization,study){return{study_id:study,job_id:authorization.job_id,fixture_id:plan.fixture.fixture_id,kickoff_at_utc:plan.fixture.kickoff_at_utc,issuance_date_utc:authorization.body.issuance_date_utc,model:plan.model,provider:plan.profile.provider,backend:plan.profile.tag,request_hash:plan.request_hash,request_body_hash:canonicalHash(plan.body),packet_hash:plan.packet.packet_hash,source_hash:plan.packet.source.source_hash,prompt_hash:PROMPT_HASH,schema_hash:SCHEMA_HASH,profile_hash:plan.profile.profile_hash,endpoint_contract_hash:plan.endpoint_contract_hash};}
function receipt(plan,row,kind,authorization,now,study){
 const b=row?.body,keys=['version',...bindingKeys,...extra[kind]];
 if(!b||Object.getPrototypeOf(b)!==Object.prototype||Object.keys(b).length!==keys.length||keys.some(k=>!Object.hasOwn(b,k))||Buffer.byteLength(JSON.stringify(b))>16384||row.kind!==kind||!id(row.receipt_id)||!hash(row.body_hash)||row.study_id!==study||row.job_id!==authorization.job_id||b.version!==versions[kind]||t(row.received_at)>t(now)||t(row.received_at)<t(plan.packet.source.received_at_utc))fail();
 const expected=binding(plan,authorization,study);for(const[k,v]of Object.entries(expected))if(b[k]!==v)fail();
 if(!id(study)||!id(b.job_id)||bindingKeys.filter(k=>k.endsWith('_hash')).some(k=>!hash(b[k])))fail();
 // This policy is deliberately scoped to the provisional distinct experiment.
 // Identity binding is a policy restriction, not a canonical team registry.
 const f=plan.fixture;
 if(f.fixture_id!=='1550169'||f.home!=='Fiorentina'||f.away!=='Atalanta'||f.competition_id!=='135'||f.country!=='Italy'||f.kickoff_at_utc!=='2026-10-29T19:45:00Z'||!['2026-10-28','2026-10-29'].includes(b.issuance_date_utc)||b.issuance_date_utc!==now.slice(0,10)||b.model!=='openai/gpt-6-luna'||b.provider!=='OpenAI'||b.backend!=='openai')fail();
 if(kind!=='source_review'&&(!hash(b.director_approval_sha256)||t(now)>=t(b.expires_at_utc)||t(b.expires_at_utc)-t(row.received_at)>600000000n||t(b.expires_at_utc)>t(f.kickoff_at_utc)-450000000n))fail();
 return b;
}
export function assertContinuation(plan,approval,review,authorization,events,now,{study_id,receipt_id}={}){
 const a=receipt(plan,approval,'continuation',authorization,now,study_id),r=receipt(plan,review,'source_review',authorization,now,study_id);
 if(t(review.received_at)>t(approval.received_at)||t(approval.received_at)>t(authorization.received_at)||approval.receipt_id!==receipt_id||authorization.body.continuation_id!==receipt_id||authorization.body.continuation_body_hash!==approval.body_hash||a.one_attempt!==true||a.max_new_micros!==plan.maximum_new_micros||a.max_new_micros!==306000||!['verified_bound','capacity_risk'].includes(a.capacity_mode)||a.source_review_id!==review.receipt_id||a.source_review_body_hash!==review.body_hash||r.source_received_at_utc!==plan.packet.source.received_at_utc||r.availability_basis!=='current_pre_match_receipts'||r.settlement_basis!=='verified_regulation_90_plus_stoppage'||!hash(r.review_artifact_sha256))fail();
 const byId=new Map(events.map(e=>[e.event_id,e])),job=byId.get(authorization.job_id),packet=byId.get(job?.parent_id),study=byId.get(packet?.parent_id);
 if(study?.event_id!==study_id||study.kind!=='study'||study.body.version!=='a3-supervised-single-v1'||study.body.one_request!==true||study.body.fixture_id!==plan.fixture.fixture_id)fail();
 const halts=events.filter(e=>e.kind==='usage'&&e.body.halt===true),anchors=a.halt_anchors;
 if(!Array.isArray(anchors)||anchors.length<1||anchors.length>16||halts.length!==anchors.length||new Set(anchors.map(x=>x.event_id)).size!==anchors.length)fail();
 for(const anchor of anchors){
  if(!anchor||Object.keys(anchor).sort().join()!=='event_body_hash,event_id'||!id(anchor.event_id)||!hash(anchor.event_body_hash))fail();
  const halt=halts.find(e=>e.event_id===anchor.event_id);if(!halt||halt.event_body_hash!==anchor.event_body_hash)fail();
  const hold=byId.get(halt.parent_id),oldJob=byId.get(hold?.parent_id),oldPacket=byId.get(oldJob?.parent_id),oldStudy=byId.get(oldPacket?.parent_id);
  if(hold?.kind!=='reservation'||oldJob?.kind!=='job'||oldPacket?.kind!=='packet'||oldStudy?.kind!=='study'||oldStudy.event_id===study_id)fail();
 }
 return a;
}
export function assertScopedCapacity(plan,row,approval,authorization,now,{study_id,receipt_id}={}){
 const b=receipt(plan,row,'capacity_risk',authorization,now,study_id),a=authorization.body;
 if(t(row.received_at)<t(approval.received_at)||t(row.received_at)>t(authorization.received_at)||row.receipt_id!==receipt_id||approval.body.capacity_mode!=='capacity_risk'||b.continuation_id!==approval.receipt_id||b.continuation_body_hash!==approval.body_hash||a.scoped_capacity_id!==receipt_id||a.scoped_capacity_body_hash!==row.body_hash||a.capacity_status!=='unverified'||b.capacity_status!=='unverified'||b.complete_input_upper_tokens!==null||b.input_bytes!==Buffer.byteLength(JSON.stringify(plan.body))||b.provider_input_cap_tokens!==922000||b.context_tokens!==1050000||b.context_tokens!==plan.profile.context_length||b.physical_output_tokens!==128000||b.physical_output_tokens!==plan.profile.physical_completion_max||b.output_tokens!==4096||plan.body.max_tokens!==4096||b.schema_contract_reviewed!==true||b.output_contract_reviewed!==true||!hash(b.review_artifact_sha256))throw Error('invalid_scoped_capacity_risk');
 return b;
}
