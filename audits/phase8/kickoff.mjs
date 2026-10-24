// Fixture event times may be minute-precision ISO. Only the comparison view is
// canonicalized; receipt/issuance clocks retain the strict wire contract.
import {utcInstant}from '../lib/snapshot-contract.mjs';
export function canonicalKickoff(value){
 if(typeof value!=='string')throw Error('fixture kickoff required');
 return utcInstant(value.replace(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(Z|[+-]\d{2}:\d{2})$/,'$1:00$2'));
}
