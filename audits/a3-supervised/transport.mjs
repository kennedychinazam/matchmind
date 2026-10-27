// No automatic execution. Requires an unforgeable single-use controller permit.
import {execFileSync} from 'node:child_process';
import {consumePermit} from './controller.mjs';
import {assertRuntime} from '../phase8-continuation/runtime.mjs';
import {epochMicros} from '../lib/snapshot-contract.mjs';
const quote=x=>'"'+String(x).replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\n','\\n').replaceAll('\r','\\r')+'"';
const genuineSenders=new WeakSet();
export function assertGenuineTransport(sender){if(!genuineSenders.has(sender))throw Error('genuine_bound_single_transport_required');return sender;}
export function singleTransport({credential=process.env.OPENROUTER_API_KEY,execute=execFileSync}={}){
 if(typeof credential!=='string'||!credential||/[\r\n\0]/u.test(credential))throw Error('bound_secret_required');
 const sender=async permit=>{
  const p=consumePermit(permit,new Date().toISOString());if(!p.genuine)throw Error('real_transport_refuses_synthetic_or_unenrolled_source');const latest=await p.beforeHttp();
  const config=['url = "https://openrouter.ai/api/v1/chat/completions"','request = "POST"','proto = "=https"','max-redirs = 0','retry = 0','connect-timeout = 10','max-time = 90','max-filesize = 5242880','silent','header = '+quote('Authorization: Bearer '+credential),'header = "Content-Type: application/json"','data-binary = '+quote(JSON.stringify(p.body)),'write-out = "\\n%{http_code}"'].join('\n')+'\n';
  const now=new Date().toISOString();if(epochMicros(now)>=latest.dispatch_deadline_micros)throw Error('authorization_or_source_expired_immediately_before_http');assertRuntime(latest.runtime,now);
  try{const out=execute('curl',['--disable','--config','-'],{input:config,encoding:'utf8',env:process.env,timeout:95000,maxBuffer:5*1024*1024,stdio:['pipe','pipe','pipe']}),at=out.lastIndexOf('\n');if(Number(out.slice(at+1))!==200)throw Error('http');return JSON.parse(out.slice(0,at));}catch{throw Error('single_provider_attempt_failed_or_ambiguous');}
 };if(execute===execFileSync&&credential===process.env.OPENROUTER_API_KEY)genuineSenders.add(sender);return sender;
}
