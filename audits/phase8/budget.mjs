// Integer USD microdollars; one global weekend ceiling, never a daily reset.
import {canonicalHash}from '../lib/snapshot-contract.mjs';
export const WEEKEND_CEILING_MICROS=5000000;
export const PRICE_SNAPSHOT=Object.freeze({model:'gemini-2.5-flash',checked_on:'2026-10-24',input_limit:1048576,output_limit:65536,input_usd_per_million:.30,output_usd_per_million:2.50,source:'https://ai.google.dev/gemini-api/docs/pricing'});
export function worstCaseMicros({model,maxOutputTokens,grounding}){
 if(model!==PRICE_SNAPSHOT.model)throw Error('unverified model price');
 if(grounding!==false)throw Error('grounding expense is not enabled or bounded');
 if(!Number.isSafeInteger(maxOutputTokens)||maxOutputTokens<1||maxOutputTokens>65536)throw Error('invalid output bound');
 // Reserve the entire provider input context, including any protocol overhead;
 // do not assume a tokenizer estimate, free tier, caching discount or refund.
 return Math.ceil((1048576*30+maxOutputTokens*250)/100);
}
export async function executeSyntheticRequest(store,request,{kind,transport}={}){
 if(kind!=='synthetic_verification'||typeof transport!=='function')throw Error('live provider billing/permissions unverified; synthetic transport only');
 const amount=worstCaseMicros(request);
 store.reserve(request.request_id,request.job_id,amount,canonicalHash(request));
 store.append('usage',request.request_id+':dispatch',request.request_id,{status:'dispatched'});
 // A crash, timeout, failed response, or missing usage retains full liability.
 try{const response=await transport(request);store.append('usage',request.request_id+':usage',request.request_id,{status:'completed',usage:response.usage??null});return response;}
 catch{store.append('usage',request.request_id+':usage',request.request_id,{status:'failed',actual_micros:null});throw Error('synthetic provider request failed; reservation retained');}
}
