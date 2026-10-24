// Retained-artifact assessment only. Never contacts a hosted database.
import {execFileSync}from 'node:child_process';
import {readFileSync}from 'node:fs';
import {rawHash}from './attestation.mjs';
export function assessAvailability(){
 const legacyText=execFileSync('git',['show','f56caab20a5dfabc237646909058d57dac7f9a65:audits/phase5/results/2026-10-24-analysis.json'],{encoding:'utf8',maxBuffer:1024*1024});
 const localText=readFileSync(new URL('../phase6/results/2026-10-24-feasibility.json',import.meta.url),'utf8');
 const l=JSON.parse(legacyText),s=JSON.parse(localText);
 return{scope:'Retained Phase 5/6 evidence and local contracts; neither hosted project queried in Phase 7.',
  legacy:{reference:'f56caab',sha256:rawHash(legacyText),read_at:l.provenance.metadata.read_at,eligible_predictions:l.baseline.n,legacy_market_pairs:l.market.engine.n,
   research_schema_present_at_that_read:l.provenance.metadata.research_schema_present,
   issuance:'Saved made_at and original kickoff; historical immutability/receipt is not independently established.',
   server_receipt:'Legacy captured_at/default now() is not an authoritative first-receipt chain.',
   fixture_event:'Calendar kickoff/result fields are event data, not availability clocks.',
   feature_observation:'Per-field first receipt and exact immutable pre-issue inputs unavailable in this archive.',
   settlement_correction:'Mutable results/updated_at do not establish first settlement or correction receipt.',
   certified_training_examples:0},
  phase6:{reference:'0c3819c',sha256:rawHash(localText),dataset_kind:s.kind,observations:s.database.observations,snapshots:s.database.snapshots,
   receipt_status:'Actual isolated PostgreSQL receipts for explicitly synthetic inputs, labels and coefficients.',football_training_examples:0},
  conclusion:'No football training dataset can be certified from the available artifacts. This does not assert that uninspected external records do not exist.',
  missing_real_evidence:['Independently approved collection/signing authority and durable source inventory.',
   'Complete immutable feature observations received before each original issue; receipt times distinct from fixture/provider event times.',
   'Original publication identity and input lineage captured at issuance.',
   'Final 90-minute outcomes and every correction with trustworthy event/receipt timestamps and label revision history.',
   'Candidate dataset export and artifact registration before an untouched validation period.']};
}
if(process.argv[1]?.endsWith('/availability.mjs'))process.stdout.write(JSON.stringify(assessAvailability(),null,2)+'\n');
