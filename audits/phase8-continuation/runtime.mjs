import {epochMicros} from '../lib/snapshot-contract.mjs';
export function assertRuntime(proof,now){
 const r=proof?.runtime,net=r?.network_policy;
 if(!proof?.checked_at_utc||epochMicros(now)<epochMicros(proof.checked_at_utc)||epochMicros(now)-epochMicros(proof.checked_at_utc)>600000000n||r?.observations_current!==true||r.spec_revision!==r.observed_spec_revision||net?.mode!=='restricted'||net.state!=='enforced'||!(net.effective_allowed_hosts??net.allowed_hosts??[]).includes('openrouter.ai')||!r.secrets?.some(s=>s.name==='OPENROUTER_API_KEY'&&s.state==='ready'))throw Error('active runtime secret/network readiness unverified');
}
