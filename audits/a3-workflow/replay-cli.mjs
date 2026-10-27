// Usage: node audits/a3-workflow/replay-cli.mjs PRIVATE_JOURNAL NEW_REVIEW_DIR
// Read-only historical input. No transport, credential, DB or ledger writer.
import {readFileSync} from 'node:fs';
import {loadRetainedJournal,retainedSource} from './authority.mjs';
import {buildPacket} from './contract.mjs';
import {replayRetained} from './workflow.mjs';
import {writeReview} from './review-files.mjs';
if(process.argv.length!==4)throw Error('expected PRIVATE_JOURNAL NEW_REVIEW_DIR');
const handle=loadRetainedJournal(readFileSync(process.argv[2],'utf8'));
const packet=buildPacket(retainedSource(handle),1490570);
const comparison=replayRetained(packet,handle,{created_at_utc:new Date().toISOString()});
const files=writeReview(process.argv[3],comparison);
console.log(JSON.stringify({mode:comparison.mode,fixture:comparison.fixture,source_received_at_utc:comparison.source.received_at_utc,complete_competition_rows:packet.evidence.facts[0].data.rows.length,engine:comparison.engine.probabilities,ai:comparison.ai.map(a=>({model:a.model,status:a.status,reason:a.reason,probabilities:a.probabilities,risk:a.risk.status,original_generated_at_utc:a.original_generated_at_utc,original_received_at_utc:a.received_at_utc})),created_at_utc:comparison.created_at_utc,comparison_hash:comparison.comparison_hash,files,paid_requests:0,new_reservations:0},null,2));
