// New derived baseline only: no publication, historical forecast mutation or IO writes.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {ENGINE_SOURCE_SHA256,ENGINE_COMP_IDS} from '../phase8/engine.mjs';
import {epochMicros} from '../lib/snapshot-contract.mjs';
import {scorelineDistribution,deepFreeze} from './scoreline.mjs';
import {marketProbabilities} from './markets.mjs';
const pinnedSource=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
if(createHash('sha256').update(pinnedSource).digest('hex')!==ENGINE_SOURCE_SHA256)throw Error('Build 355 source identity changed');
// This configuration is tied to the exact source hash above. It is not a newly
// fitted rho or a tunable A4 parameter. Build 355's separate dampening is NOT copied.
const BUILD355_RHO=-.08;
const probability=x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1;
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
export function eMarketFromBuild355(engineResult,fixtureId,options={}){
 const r=engineResult,id=String(fixtureId);
 if(!['string','number'].includes(typeof fixtureId)||!/^\d+$/.test(id)||BigInt(id)<=0n||r?.schema_version!==1||r.build!==355||r.source_sha256!==ENGINE_SOURCE_SHA256||typeof r.input_hash!=='string'||!/^[a-f0-9]{64}$/.test(r.input_hash)||typeof r.synthetic_clock!=='boolean'||!Array.isArray(r.predictions))throw Error('pinned Build 355 offline artifact required');
 const matches=r.predictions.filter(p=>p.fixture_id===id);if(matches.length!==1)throw Error('one unambiguous engine fixture required');
 const row=matches[0],p=row.prediction;
 if(row.status!=='forecast'||row.eligible!==true||row.exclusion_reason!==null||!ENGINE_COMP_IDS.includes(row.lid)||!nonempty(row.home)||!nonempty(row.away)||row.home===row.away||!p||!Array.isArray(row.probabilities)||row.probabilities.length!==3||!row.probabilities.every(probability)||Math.abs(row.probabilities.reduce((a,b)=>a+b,0)-1)>1e-8||![p.pW,p.pD,p.pL].every((x,i)=>x===row.probabilities[i])||![p.btts,p.over?.['1.5'],p.over?.['2.5'],p.over?.['3.5']].every(probability))throw Error('eligible complete engine forecast required');
 const generated=epochMicros(r.generated_at_utc),rowGenerated=epochMicros(row.generated_at_utc),kickoff=epochMicros(row.kickoff_at_utc);
 if(generated!==rowGenerated||generated>=kickoff)throw Error('original engine issuance must precede kickoff');
 const distribution=scorelineDistribution({lambdaHome:p.lambdaH,lambdaAway:p.lambdaA,rho:BUILD355_RHO},options);
 return deepFreeze({version:'e-market-v1',arm:'E-MARKET',mode:'offline_derived_comparison_not_new_issuance',fixture_id:id,home:row.home,away:row.away,kickoff_at_utc:row.kickoff_at_utc,synthetic_clock:r.synthetic_clock,
  source:{engine_source_sha256:r.source_sha256,engine_input_hash:r.input_hash,engine_generated_at_utc:r.generated_at_utc,authentication:'caller_must_verify_artifact_lineage',
   distinction:'frozen engine rates and rho; adaptive coherent grid; no separate legacy market dampening or tau clamp'},
  original:{probabilities:[...row.probabilities],btts:p.btts,over:{'1.5':p.over['1.5'],'2.5':p.over['2.5'],'3.5':p.over['3.5']}},
  distribution,probabilities:marketProbabilities(distribution),actionable:false,calibration:'not_validated'});
}
