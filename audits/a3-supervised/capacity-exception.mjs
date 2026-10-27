// Narrow offline-prepared risk policy. No tokenizer, inference or numerical mapping.
import {canonicalHash,epochMicros} from '../lib/snapshot-contract.mjs';
import {PROMPT_HASH,SCHEMA_HASH} from '../a3-workflow/workflow.mjs';
export const CAPACITY_EXPERIMENT='santos-palmeiras-1492438-20261028-a3-capacity-risk-v1';
const fields=['version','experiment_id','director_approved','director_approval_sha256','study_id','job_id','fixture_id','kickoff_at_utc','issuance_date_utc','expires_at_utc','request_hash','request_body_hash','packet_hash','prompt_hash','schema_hash','profile_hash','endpoint_contract_hash','model','provider','backend','input_bytes','complete_input_upper_tokens','capacity_status','provider_input_cap_tokens','context_tokens','physical_output_tokens','output_tokens','schema_contract_reviewed','output_contract_reviewed','review_artifact_sha256'];
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/u.test(x),id=x=>typeof x==='string'&&/^[A-Za-z0-9:._-]{1,128}$/u.test(x),t=epochMicros;
export function assertCapacityException(plan,receipt,authorization,now,{receipt_id,study_id}={}){
 const r=receipt?.body,a=authorization.body,f=plan.fixture;
 const fail=()=>{throw Error('invalid_single_fixture_capacity_risk_exception');};
 if(!r||Object.getPrototypeOf(r)!==Object.prototype||Object.keys(r).length!==fields.length||fields.some(k=>!Object.hasOwn(r,k))||Buffer.byteLength(JSON.stringify(r))>8192)fail();
 if(receipt.kind!=='capacity_exception'||receipt.receipt_id!==receipt_id||!id(receipt_id)||!hash(receipt.body_hash)||!id(r.study_id)||!id(r.job_id)||r.study_id!==study_id||receipt.study_id!==study_id||receipt.job_id!==authorization.job_id||r.job_id!==authorization.job_id)fail();
 if(r.version!=='a3-capacity-risk-exception-v1'||r.experiment_id!==CAPACITY_EXPERIMENT||r.director_approved!==true||!hash(r.director_approval_sha256)||!hash(r.review_artifact_sha256)||r.complete_input_upper_tokens!==null||r.capacity_status!=='unverified'||r.schema_contract_reviewed!==true||r.output_contract_reviewed!==true)fail();
 if(f.fixture_id!=='1492438'||f.home!=='Santos'||f.away!=='Palmeiras'||f.competition_id!=='71'||f.country!=='Brazil'||f.kickoff_at_utc!=='2026-10-28T22:30:00Z'||r.fixture_id!==f.fixture_id||r.kickoff_at_utc!==f.kickoff_at_utc)fail();
 if(!/^2026-10-(?:27|28)$/u.test(r.issuance_date_utc)||r.issuance_date_utc!==now.slice(0,10)||r.issuance_date_utc!==a.issuance_date_utc||t(now)<t(receipt.received_at)||t(now)>=t(r.expires_at_utc)||t(r.expires_at_utc)-t(receipt.received_at)>600000000n||t(r.expires_at_utc)>t(f.kickoff_at_utc)-450000000n)fail();
 for(const [k,v] of Object.entries({request_hash:plan.request_hash,request_body_hash:canonicalHash(plan.body),packet_hash:plan.packet.packet_hash,prompt_hash:PROMPT_HASH,schema_hash:SCHEMA_HASH,profile_hash:plan.profile.profile_hash,endpoint_contract_hash:plan.endpoint_contract_hash}))if(!hash(r[k])||r[k]!==v)fail();
 if(r.model!=='openai/gpt-6-luna'||r.model!==plan.model||r.provider!=='OpenAI'||r.backend!=='openai'||plan.profile.tag!=='openai'||r.input_bytes!==Buffer.byteLength(JSON.stringify(plan.body))||r.provider_input_cap_tokens!==922000||r.context_tokens!==1050000||r.context_tokens!==plan.profile.context_length||r.physical_output_tokens!==128000||r.physical_output_tokens!==plan.profile.physical_completion_max||r.output_tokens!==4096||plan.body.max_tokens!==4096||plan.maximum_new_micros!==306000)fail();
 if(a.capacity_exception_id!==receipt_id||a.capacity_exception_body_hash!==receipt.body_hash||a.capacity_status!=='unverified')fail();
 return r;
}
export function assertExceptionUsage(usage){
 if(!usage||!Number.isSafeInteger(usage.prompt_tokens)||usage.prompt_tokens<0||usage.prompt_tokens>922000||!Number.isSafeInteger(usage.completion_tokens)||usage.completion_tokens<0||usage.completion_tokens>4096||usage.prompt_tokens+usage.completion_tokens>1050000)throw Error('provider_usage_exceeds_capacity_exception_endpoint_limits');
}
