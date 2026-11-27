// Per request, including the response body. Aborting never proves a write was rolled back.
export const COLLECTOR_REQUEST_TIMEOUT_MS=12000;
/** @param {'deadline_exceeded'|'caller_aborted'} code */
const failure=code=>Object.assign(new Error(code==='deadline_exceeded'?'Collector request deadline exceeded':'Collector request aborted'),{name:'AbortError',code:'ABORT_ERR',collectorCode:code});
/** @param {{fetchImpl?:typeof fetch,timeoutMs?:number}} [options] @returns {typeof fetch} */
export function createDeadlineFetch({fetchImpl=globalThis.fetch,timeoutMs=COLLECTOR_REQUEST_TIMEOUT_MS}={}){
 if(typeof fetchImpl!=='function'||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>COLLECTOR_REQUEST_TIMEOUT_MS)throw Error('Invalid collector deadline configuration');
 /** @type {typeof fetch} */
 const wrapped=async(input,init={})=>{
  const parent=init.signal??(typeof Request!=='undefined'&&input instanceof Request?input.signal:null);
  if(parent?.aborted)throw failure('caller_aborted');
  const controller=new AbortController();let timer;
  /** @type {(reason?:unknown)=>void} */ let rejectDeadline=()=>{};
  /** @type {'deadline_exceeded'|'caller_aborted'|undefined} */ let reason;
  /** @type {Promise<never>} */
  const deadline=new Promise((_,reject)=>{rejectDeadline=reject;});
  /** @param {'deadline_exceeded'|'caller_aborted'} code */
  const stop=code=>{if(reason)return;reason=code;controller.abort();rejectDeadline(failure(code));};
  const onAbort=()=>stop('caller_aborted');
  parent?.addEventListener('abort',onAbort,{once:true});
  timer=setTimeout(()=>stop('deadline_exceeded'),timeoutMs);
  try{
   // Race even transports that ignore AbortSignal; late settlement is observed, never retried.
   const request=(async()=>{
    const response=await fetchImpl(input,{...init,signal:controller.signal});
    const bytes=response.body===null?null:await response.arrayBuffer();
    if(reason)throw failure(reason);
    const headers=new Headers(response.headers);headers.delete('content-length');headers.delete('content-encoding');
    return new Response(bytes,{status:response.status,statusText:response.statusText,headers});
   })();
   return await Promise.race([request,deadline]);
  }finally{clearTimeout(timer);parent?.removeEventListener('abort',onAbort);}
 };
 return wrapped;
}
export const collectorFetch=createDeadlineFetch();
