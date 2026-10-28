import {epochMicros} from '../lib/snapshot-contract.mjs';
// Operational admission margin, not a promise that a future operation will finish.
// 2 remaining refresh cycles * 4 bounded 30s GETs + 60s checkpoint/verification
// allowance + 60s local gates/commit/scheduling allowance. Recheck every hard gate.
export const PRE_HTTP_POLICY=Object.freeze({version:'a3-pre-http-margin-v1',minimum_remaining_seconds:360});
export function assertPreHttpWindow(now,hardDeadline){
 if(hardDeadline-epochMicros(now)<=360000000n)throw Error('insufficient_pre_http_window');
}
