// New versioned private concepts; never calls the legacy production AI function.
import {canonicalHash}from '../lib/snapshot-contract.mjs';
import {validProbability}from '../phase5/validation.mjs';
import {providerConfiguration}from './providers.mjs';
export function buildRequest(arm,evidence,selection={}){
 if(!['scout','A3'].includes(arm))throw Error('unknown AI arm');
 const {fixture_id,home,away,source_refs,features}=evidence;
 const data={fixture_id,home,away,source_refs,features};
 const instruction=arm==='scout'?'Return JSON hm/am in [0.85,1.15], boolean veto and evidence_refs. Cite only supplied source_refs; abstain if unsupported. Do not invent current news.':'Independently return JSON probabilities [home,draw,away], evidence_refs, or abstain:true. No engine forecast or bookmaker probabilities are supplied. Cite only supplied source_refs. Do not invent current news.';
 const config=providerConfiguration(selection);
 const descriptor={prompt_version:'weekend-v1',arm,input_hash:canonicalHash(data),provider:config.provider,model:config.model,paid_transport_enabled:false,maxOutputTokens:1024,grounding:false,
  body:{contents:[{role:'user',parts:[{text:instruction+'\n'+JSON.stringify(data)}]}],generationConfig:{maxOutputTokens:1024,responseMimeType:'application/json',thinkingConfig:{thinkingBudget:0}}}};
 if(config.provider!=='gemini')descriptor.body={model:config.model,messages:[{role:'user',content:instruction+'\n'+JSON.stringify(data)}],max_tokens:1024,response_format:{type:'json_object'}};
 return{...descriptor,compatibility:'prepared request shape only; model-specific API acceptance unverified',request_hash:canonicalHash(descriptor)};
}
export function parseDecision(arm,value,allowedRefs){
 if(value?.abstain===true)return{abstain:true,reason:'provider_abstention'};
 if(!value||!Array.isArray(value.evidence_refs)||!value.evidence_refs.length||value.evidence_refs.some(r=>!allowedRefs.includes(r)))throw Error('unverified AI source reference');
 if(arm==='scout'){
  if(![value.hm,value.am].every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=.85&&v<=1.15))throw Error('invalid context multiplier');
  if(typeof value.veto!=='boolean')throw Error('invalid veto');
  return{hm:value.hm,am:value.am,veto:value.veto,evidence_refs:[...value.evidence_refs]};
 }
 if(arm!=='A3')throw Error('unknown AI arm');
 return{probabilities:[...validProbability(value.probabilities)],evidence_refs:[...value.evidence_refs]};
}
