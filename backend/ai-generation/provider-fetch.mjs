// Existing v17 adapters/models and grounded parser are supplied by the actual handler.
// Unknown transport outcomes never result in an automatic retry here.
import {failure} from './generation-contract.mjs';
export function prepareProvider({id,P,key,prompt,wantContext,outputRule,contextBrief,readContext,fetcher=fetch,sleep=ms=>new Promise(r=>setTimeout(r,ms))}){
 const candidates=P.models?.length?P.models:[null];
 const requests=candidates.map(model=>({model,url:P.url(key,model),headers:P.headers(key),body:JSON.stringify(wantContext&&P.groundedBody?P.groundedBody(contextBrief+prompt):P.body(outputRule+prompt))}));
 return async()=>{
  let response,raw='',usedModel=null,retriedRateLimit=false;
  const send=async r=>{
   let out;try{out=await fetcher(r.url,{method:'POST',headers:r.headers,body:r.body,signal:AbortSignal.timeout(45000)});}catch{throw Object.assign(failure('provider_uncertain',502),{uncertain:true});}
   let text;try{text=await out.text();}catch{throw Object.assign(failure('provider_uncertain',502),{uncertain:true});}
   if(text.length>262144)throw failure('provider_output_invalid',502);
   return{response:out,raw:text};
  };
  for(const r of requests){
   ({response,raw}=await send(r));usedModel=r.model;if(response.ok)break;
   if(response.status===404&&requests.length>1)continue;
   if(response.status===429&&!retriedRateLimit){retriedRateLimit=true;for(const delay of [6000,12000]){await sleep(delay);({response,raw}=await send(r));if(response.ok||response.status!==429)break;}if(response.ok)break;}
   break;
  }
  if(!response?.ok)throw failure('provider_http_failure',502);
  let parsed,text='';try{parsed=JSON.parse(raw);text=P.parse(parsed);}catch{throw failure('provider_output_invalid',502);}
  if(typeof text!=='string'||!text.trim())throw failure('provider_output_invalid',502);
  let sources=[],context=null;if(wantContext){try{sources=P.sources?P.sources(parsed):[];context=readContext(text,sources.length>0);}catch{throw failure('provider_output_invalid',502);}}
  return{text,model:usedModel||id,provider:id,providerLabel:P.label,sources,context};
 };
}
