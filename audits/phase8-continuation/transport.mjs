import {execFileSync} from 'node:child_process';
import {MODELS} from './contracts.mjs';
export {assertRuntime} from './runtime.mjs';
import {assertRuntime} from './runtime.mjs';
import {executeRequest} from './execute.mjs';
import {validateRequest} from './contracts.mjs';
const curlQuote=x=>'"'+String(x).replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\n','\\n').replaceAll('\r','\\r')+'"';
export function openrouterClient(runtimeProof,{credential=process.env.OPENROUTER_API_KEY,execute=execFileSync}={}){
 assertRuntime(runtimeProof,new Date().toISOString());
 if(typeof credential!=='string'||!credential||/[\r\n\x00]/.test(credential))throw Error('runtime HTTP secret unavailable');
 const send=async(path,body)=>{
  assertRuntime(runtimeProof,new Date().toISOString());
  const config=['url = '+curlQuote('https://openrouter.ai/api/v1/'+path),'request = '+curlQuote(body?'POST':'GET'),'proto = "=https"','max-redirs = 0','retry = 0','connect-timeout = 10','max-time = 90','max-filesize = 5242880','silent','header = '+curlQuote('Authorization: Bearer '+credential),'header = "Content-Type: application/json"','write-out = "\\n%{http_code}"'];
  if(body)config.push('data-binary = '+curlQuote(JSON.stringify(body)));
  let status=null;
  try{
   const out=execute('curl',['--disable','--config','-'],{input:config.join('\n')+'\n',encoding:'utf8',env:process.env,timeout:95000,maxBuffer:5*1024*1024,stdio:['pipe','pipe','pipe']});
   const split=out.lastIndexOf('\n');status=Number(out.slice(split+1));if(status!==200)throw Error('http');
   return JSON.parse(out.slice(0,split));
  }catch{const error=Error('OpenRouter request failed; private ledger must retain any reservation');if(Number.isInteger(status)&&status>=400&&status<=599)error.status_code=status;error.route_kind=path.startsWith('models/')?'model':path.startsWith('generation?')?'generation':path==='chat/completions'?'completion':path;throw error;}
 };
 return{
  get:async route=>{
   if(!['key','credits',...MODELS.map(m=>'models/'+m+'/endpoints')].includes(route)&&!/^generation\?id=[A-Za-z0-9_-]{1,160}$/.test(route))throw Error('unapproved OpenRouter route');return send(route);
  },
  // The real paid transport is private to this wrapper; synthetic injection cannot obtain it.
  execute:async(store,context,options)=>{
   validateRequest(context.request,context.profile,new Date().toISOString());
   if(options.kind!=='football')throw Error('real client refuses synthetic execution');
   if(new Date().toISOString().slice(0,10)!=='2026-10-25')throw Error('real paid execution requires actual Sunday');
   return executeRequest(store,context,{...options,runtime:runtimeProof,transport:async()=>{
    validateRequest(context.request,context.profile,new Date().toISOString());
    return send('chat/completions',context.request.body);
   }});
  }
 };
}
