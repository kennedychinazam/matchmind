// New local review directory only. Not a journal, ledger, research checkpoint,
// dispatch authorization or historical forecast writer.
import {mkdirSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {canonicalHash,canonicalJSON} from '../lib/snapshot-contract.mjs';
export function writeReview(directory,comparison){
 const {comparison_hash,...body}=comparison;
 if(comparison.mode!=='offline_comparison_not_new_issuance'||comparison.new_prediction_issued!==false||comparison.live_dispatch_enabled!==false||comparison.actionable!==false||canonicalHash(body)!==comparison_hash)throw Error('frozen_review_hash');
 mkdirSync(directory,{recursive:false,mode:0o700});
 const path=join(directory,'comparison.json');writeFileSync(path,canonicalJSON(comparison)+'\n',{flag:'wx',mode:0o600});
 writeFileSync(join(directory,'manifest.json'),JSON.stringify({kind:'offline_review_not_research_checkpoint',comparison_hash,created_at_utc:comparison.created_at_utc,written_at_utc:new Date().toISOString(),historical_records_written:0,new_reservations:0,paid_requests:0},null,2)+'\n',{flag:'wx',mode:0o600});
 return{comparison:path,manifest:join(directory,'manifest.json')};
}
