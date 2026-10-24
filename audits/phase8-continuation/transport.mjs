import {execFileSync} from 'node:child_process';
import {epochMicros,canonicalHash} from '../lib/snapshot-contract.mjs';
import {MODELS} from './contracts.mjs';
export function assertRuntime(proof,now){
 const r=proof?.runtime,net=r?.network_policy;
 if(!proof?.checked_at_utc||epochMicros(now)<epochMicros(proof.checked_at_utc)||epochMicros(now)-epochMicros(proof.checked_at_utc)>600000000n||r?.observations_current!==true||r.spec_revision!==r.observed_spec_revision||net?.mode!=='restricted'||net.state!=='enforced'||!(net.effective_allowed_hosts??net.allowed_hosts??[]).includes('openrouter.ai')||!r.secrets?.some(s=>s.name==='OPENROUTER_API_KEY'&&s.state==='ready'))throw Error('active runtime secret/network readiness unverified');
}
const curlQuote=x=>'"'+String(x).replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\n','\\n').replaceAll('\r','\\r')+'"';
export function openrouterClient(runtimeProof,{credential=process.env.OPENROUTER_API_KEY,execute=execFileSync}={}){
 assertRuntime(runtimeProof,new Date().toISOString());
 if(typeof credential!=='string'||!credential||/[\r\n\x00]/.test(credential))throw Error('runtime HTTP secret unavailable');
 const send=async(path,body)=>{
  assertRuntime(runtimeProof,new Date().toISOString());
  const config=['url = '+curlQuote('https://openrouter.ai/api/v1/'+path),'request = '+curlQuote(body?'POST':'GET'),'proto = "=https"','max-redirs = 0','retry = 0','connect-timeout = 10','max-time = 90','max-filesize = 5242880','silent','header = '+curlQuote('Authorization: Bearer '+credential),'header = "Content-Type: application/json"','write-out = "\\n%{http_code}"'];
  if(body)config.push('data-binary = '+curlQuote(JSON.stringify(body)));
  try{
   const out=execute('curl',['--disable','--config','-'],{input:config.join('\n')+'\n',encoding:'utf8',env:process.env,timeout:95000,maxBuffer:5*1024*1024,stdio:['pipe','pipe','pipe']});
   const split=out.lastIndexOf('\n');if(out.slice(split+1)!=='200')throw Error('http');
   return JSON.parse(out.slice(0,split));
  }catch{throw Error('OpenRouter request failed; private ledger must retain any reservation');}
 };
 return{
  get:async route=>{
   if(!['key','credits',...MODELS.map(m=>'models/'+m+'/endpoints')].includes(route)&&!/^generation\?id=[A-Za-z0-9_-]{1,160}$/.test(route))throw Error('unapproved OpenRouter route');return send(route);
  },
  // Called only by executeRequest after a committed reservation and private checkpoint.
  completion:async request=>{
   const{request_hash,...rest}=request;
   if(canonicalHash(rest)!==request_hash||!MODELS.includes(request.body?.model)||request.body.max_tokens!==1024||request.body.stream!==false||request.body.provider?.allow_fallbacks!==false||request.body.provider?.require_parameters!==true||request.body.tools?.length!==0||request.body.plugins?.length!==0||request.body.tool_choice!=='none'||request.body.response_format?.json_schema?.strict!==true)throw Error('unbounded paid request');
   return send('chat/completions',request.body);
  }
 };
}
