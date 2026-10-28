import {epochMicros} from '../lib/snapshot-contract.mjs';
// Closed, non-secret observations only. Never copy messages, stderr, headers or bodies.
const known=new Set(['accepted_shared_ledger_ancestry_missing_or_changed','unadmitted_supervised_plan','final_operator_authorization_required','immutable_final_operator_authorization_absent','explicit_supervised_execution_required','verified_recovery_and_external_copy_required','ambiguous_capacity_admission_receipts','immutable_capacity_exception_absent','independent_capacity_and_schema_readiness_receipt_absent','readiness_authorization_job_mismatch','single_study_already_attempted_never_redispatch','capacity_experiment_already_attempted_never_redispatch','supervised_dependencies_required','durable_diagnostics_and_checkpoint_verification_required','expired_authorization_or_issue_deadline','fresh_complete_history_required','expired_capacity_risk_exception','authorization_scope_mismatch','unverified_complete_capacity_or_schema_contract','fresh_account_and_fixture_observations_required','unbounded_implicit_cache_pricing','capacity_exception_endpoint_limits_changed','endpoint_prompt_limit_unverified_or_exceeded','endpoint_contract_changed','dedicated_key_changed','fixture_eligibility_changed','ledger_history_key_or_halt_guard','unreconciled_account_usage','shared_financial_headroom','request_already_attempted_never_redispatch','immutable_job_binding','authorization_expired_before_atomic_reservation','immutable_dispatch_confirmation_missing','provider_usage_exceeds_reviewed_request_contract','authorization_or_source_expired_immediately_before_http','missing_expired_or_used_dispatch_permit','real_transport_refuses_synthetic_or_unenrolled_source','insufficient_pre_http_window','checkpoint_verification_failed','execution_wrapper_not_staged_before_source_and_authorization','execution_wrapper_artifact_changed','staged_dependencies_cannot_be_overridden','transport_execution_failed','provider_http_status','provider_response_json_invalid']);
const aliases=new Map([['unverified provider response','unverified_provider_response'],['provider cost exceeds reservation; stop study','provider_cost_exceeds_reservation'],['invalid decision JSON','invalid_decision_json'],['active runtime secret/network readiness unverified','runtime_readiness_unverified'],['fresh workspace/key-bound credit-only operator evidence required','fresh_byok_evidence_required'],['key must have a verified nonresetting lifetime budget <= $5','key_lifetime_limit_unverified'],['inconsistent key budget','inconsistent_key_budget'],['account balance unverified; do not broaden secret privileges','account_balance_unverified'],['account balance unavailable','account_balance_unavailable']]);
for(const code of ['invalid_single_fixture_capacity_risk_exception','provider_usage_exceeds_capacity_exception_endpoint_limits','bounded_analysis_response_required','response_fixture_or_packet_identity','unverified_or_duplicate_evidence_reference','inconsistent_analysis_or_risk',...aliases.values()])known.add(code);
const phases=new Set(['pre_reservation_validation','reservation_and_confirmation','checkpoint_creation','checkpoint_verification','final_provider_admission','immediately_before_http','transport_execution','provider_response_handling','ai_validation','post_response_checkpoint']);
known.add('invalid_diagnostic_phase');
const failures=new WeakMap();
export function observedFailure(code,observed={}){
 const error=Error(known.has(code)?code:'unclassified_failure');
 const safe={code:error.message};
 if(Number.isInteger(observed.exit_status)&&observed.exit_status>=0&&observed.exit_status<=255)safe.transport_exit_status=observed.exit_status;
 if(Number.isInteger(observed.http_status)&&observed.http_status>=100&&observed.http_status<=599)safe.http_status=observed.http_status;
 if(['SIGTERM','SIGKILL','SIGABRT','SIGINT'].includes(observed.signal))safe.transport_signal=observed.signal;
 failures.set(error,Object.freeze(safe));return error;
}
export function safeDiagnostic(error){return failures.get(error)??Object.freeze({code:aliases.get(error?.message)??(known.has(error?.message)?error.message:'unclassified_failure')});}
export function phaseTrace(clock,sink=()=>{}){
 let phase='pre_reservation_validation',sequence=0,http_state='not_started',observations={};
 const stamp=()=>{try{const value=clock();epochMicros(value);return value;}catch{return null;}};
 const snapshot=()=>Object.freeze({version:'a3-failure-phase-v1',sequence,phase,observed_at_utc:stamp(),http_state,...observations});
 return{
  enter(next){if(!phases.has(next))throw Error('invalid_diagnostic_phase');phase=next;sequence++;const row=snapshot();sink(row);return row;},
  transport(code,observed={}){
   if(code==='execution_intent')http_state='execution_intent_only';
   if(code==='execution_failed'||code==='execution_returned')http_state='execution_entered_transmission_unknown';
   if(code==='blocked_before_execution')http_state='not_started';
   const {code:ignored,...safe}=safeDiagnostic(observedFailure('transport_execution_failed',observed));
   observations={...observations,...safe};if(observations.http_status)http_state='response_status_observed';
   sequence++;sink(snapshot());
  },
  failure(error){return Object.freeze({...snapshot(),...safeDiagnostic(error)});},
  recordFailure(error){sequence++;const row=this.failure(error);sink(row);return row;}
 };
}
// Action is the subprocess boundary. Tests use local synthetic output, never HTTP.
export function observeExecution(action,trace,admit=()=>{}){
 trace.enter('transport_execution');trace.transport('execution_intent');trace.enter('immediately_before_http');
 // All durable observation I/O precedes this final admission check. No logging
 // occurs between its success and subprocess invocation. Intent is not a send.
 try{admit();}catch(error){trace.transport('blocked_before_execution');throw error;}
 let out;
 try{out=action();}catch(error){
  const text=typeof error?.stdout==='string'?error.stdout:Buffer.isBuffer(error?.stdout)?error.stdout.toString('utf8'):'';
  const status=/\n([1-5][0-9]{2})$/u.exec(text);
  const observed={exit_status:error?.status,http_status:status?Number(status[1]):undefined,signal:error?.signal};
  trace.enter('transport_execution');trace.transport('execution_failed',observed);throw observedFailure('transport_execution_failed',observed);
 }
 const at=typeof out==='string'?out.lastIndexOf('\n'):-1,status=at>=0&&/^[1-5][0-9]{2}$/u.test(out.slice(at+1))?Number(out.slice(at+1)):null;
 trace.enter('transport_execution');trace.transport('execution_returned',{exit_status:0,http_status:status});trace.enter('provider_response_handling');
 if(status!==200)throw observedFailure('provider_http_status',{exit_status:0,http_status:status});
 try{return JSON.parse(out.slice(0,at));}catch{throw observedFailure('provider_response_json_invalid',{exit_status:0,http_status:status});}
}
