// Audit-only pure output. Never writes to predictions or a public API.
import {randomUUID} from 'node:crypto';
import {validatePredictionSnapshot,probabilities,canonicalHash} from './snapshot-contract.mjs';
import {fixedResearchCohort} from './research-contract.mjs';
export function shadowForecast({snapshot,inputs,enabled=false,adjust,candidateVersion='identity-v1',configuration={}}) {
 const baseline=validatePredictionSnapshot(snapshot);
 const missing=inputs?.missing?.length || !inputs;
 const reason=!enabled?'adjustment_disabled':missing?'missing_evidence':typeof adjust!=='function'?'model_unavailable':null;
 const p=reason?[...baseline.probabilities]:probabilities(adjust([...baseline.probabilities],structuredClone(inputs.features)));
 return {shadow_id:randomUUID(),snapshot_id:baseline.snapshot_id,candidate_version:candidateVersion,configuration_hash:canonicalHash(configuration),
  visibility:'shadow',probabilities:p,pick:baseline.pick,issued_pick_is_baseline:true,
  feature_manifest_hash:canonicalHash(inputs?.manifest??{}),fallback_reason:reason,
  cohort:fixedResearchCohort(baseline.issue_time_utc),confirmatory_eligible:false};
}
