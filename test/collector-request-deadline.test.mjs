import test from'node:test';import assert from'node:assert/strict';import vm from'node:vm';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';
import{createDeadlineFetch,COLLECTOR_REQUEST_TIMEOUT_MS}from'../backend/collector-observability/request-deadline.mjs';
import{candidateSource,AF47_SHA256}from'../backend/collector-observability/build-candidate.mjs';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('successful response preserves status, API quota headers and JSON without leaking timer or changing request',async()=>{
 let signal,calls=0;const body='invented write';const f=createDeadlineFetch({timeoutMs:30,fetchImpl:async(url,init)=>{calls++;signal=init.signal;assert.equal(url,'https://synthetic.invalid');assert.equal(init.method,'POST');assert.equal(init.body,body);assert.equal(init.headers.authorization,'invented');return new Response('{"ok":true}',{status:201,headers:{'x-ratelimit-requests-remaining':'99','content-length':'11'}});}});
 const r=await f('https://synthetic.invalid',{method:'POST',body,headers:{authorization:'invented'}});assert.equal(r.status,201);assert.equal(r.headers.get('x-ratelimit-requests-remaining'),'99');assert.deepEqual(await r.json(),{ok:true});await delay(40);assert.equal(signal.aborted,false);assert.equal(calls,1);
});
test('stalled headers are aborted once with a bounded sanitized failure, without retry',async()=>{
 let signal,calls=0;const f=createDeadlineFetch({timeoutMs:5,fetchImpl:(_url,init)=>{calls++;signal=init.signal;return new Promise(()=>{});}});
 await assert.rejects(f('https://synthetic.invalid/private',{headers:{authorization:'invented-private'}}),e=>e.name==='AbortError'&&e.code==='ABORT_ERR'&&e.collectorCode==='deadline_exceeded'&&!/private|synthetic/.test(e.message));assert.equal(signal.aborted,true);assert.equal(calls,1);
});
test('stalled response body is covered by the same request deadline',async()=>{
 let signal;const f=createDeadlineFetch({timeoutMs:5,fetchImpl:async(_url,init)=>{signal=init.signal;return new Response(new ReadableStream({start(c){c.enqueue(new TextEncoder().encode('{'));}}));}});
 await assert.rejects(f('https://synthetic.invalid'),e=>e.collectorCode==='deadline_exceeded');assert.equal(signal.aborted,true);
});
test('late transport completion after timeout cannot become a successful replay',async()=>{
 let resolve,calls=0;const f=createDeadlineFetch({timeoutMs:5,fetchImpl:()=>{calls++;return new Promise(r=>{resolve=r;});}});await assert.rejects(f('https://synthetic.invalid'),/deadline/);resolve(new Response('{"committed":true}'));await delay(5);assert.equal(calls,1);
});
test('parent abort before dispatch performs no transport work',async()=>{
 const parent=new AbortController();parent.abort();let calls=0;const f=createDeadlineFetch({fetchImpl:()=>{calls++;}});await assert.rejects(f(new Request('https://synthetic.invalid',{signal:parent.signal})),e=>e.collectorCode==='caller_aborted');assert.equal(calls,0);
});
test('parent abort during a body read propagates and does not wait for deadline',async()=>{
 const parent=new AbortController();let signal;const f=createDeadlineFetch({fetchImpl:async(_url,init)=>{signal=init.signal;return new Response(new ReadableStream({start(){}}));}});const p=f('https://synthetic.invalid',{signal:parent.signal});parent.abort();await assert.rejects(p,e=>e.collectorCode==='caller_aborted');assert.equal(signal.aborted,true);
});
test('HTTP failure and empty-body success are returned once, never silently retried',async()=>{
 for(const status of[204,429,500]){let calls=0;const f=createDeadlineFetch({fetchImpl:async()=>{calls++;return new Response(null,{status});}});const r=await f('https://synthetic.invalid',{method:'POST'});assert.equal(r.status,status);assert.equal(calls,1);}
});
test('invalid or expanded deadline configurations are rejected',()=>{
 assert.equal(COLLECTOR_REQUEST_TIMEOUT_MS,12000);for(const timeoutMs of[0,-1,1.5,12001,Infinity,'12000'])assert.throws(()=>createDeadlineFetch({timeoutMs}));
});
const repo=new URL('../',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1');
const baseline=execFileSync('git',['-c','safe.directory='+repo.replace(/\/$/,''),'show','2b42b1a8c24b58305cc263e6b293ab7931c8661f:release/collector-budget/refresh-af-v58-af47.ts'],{cwd:repo});
test('exact deployed collector integration changes only version, SDK pin and the two transport hooks',()=>{
 assert.equal(createHash('sha256').update(baseline).digest('hex'),AF47_SHA256);const code=candidateSource(baseline);assert.match(code,/await collectorFetch\(\$t\+a,/);assert.match(code,/qt\(P,H,\{global:\{fetch:collectorFetch\}\}\)/);assert.match(code,/supabase-js@2\.119\.2/);assert.throws(()=>candidateSource(Buffer.concat([baseline,Buffer.from(' ')])),/Exact deployed/);
 const restored=code.replace(/^import[^\n]+\n/,'').replace('supabase-js@2.119.2"','supabase-js@2"').replace('const Ue="af-48"','const Ue="af-47"').replace('await collectorFetch($t+a,','await fetch($t+a,').replace('const S=qt(P,H,{global:{fetch:collectorFetch}});','const S=qt(P,H);');assert.equal(restored,baseline.toString());
});
function handlerFixture({databaseStalls=false,original=false}={}){
 let handler,calls=0,configs=[];const collectorFetch=createDeadlineFetch({timeoutMs:5,fetchImpl:async()=>{calls++;return new Promise(()=>{});}});
 const qt=(_url,_key,config)=>{configs.push(config);return{from:()=>({select:()=>({limit:async()=>{if(databaseStalls)await config.global.fetch('https://database.invalid');return{error:null};}})})};};
 const context=vm.createContext({qt,collectorFetch,console:{warn:()=>{}},Deno:{env:{get:k=>({AF_KEY:'invented',SUPABASE_URL:'https://database.invalid',SUPABASE_SERVICE_ROLE_KEY:'invented',MM_CRON_SECRET:'invented'})[k]},serve:f=>handler=f},Request,Response,Headers,URL,TextEncoder,TextDecoder,setTimeout,clearTimeout,fetch:async()=>{calls++;return new Promise(()=>{});}});
 const code=(original?baseline.toString():candidateSource(baseline).replace(/^import[^\n]+\n/,'')).replace(/^import\{createClient as qt\}from"[^"]+";/,'');vm.runInContext(code,context);return{get handler(){return handler;},get calls(){return calls;},configs};
}
test('actual collector preserves scheduler authorization before client/network construction',async()=>{
 const h=handlerFixture();const r=await h.handler(new Request('https://collector.invalid',{method:'POST',body:'{}'}));assert.equal(r.status,401);assert.equal(h.calls,0);assert.equal(h.configs.length,0);
});
test('actual collector bounds its provider fetch and reports no success on stalled transport',async()=>{
 const h=handlerFixture();const r=await h.handler(new Request('https://collector.invalid',{method:'POST',headers:{'x-mm-secret':'invented'},body:JSON.stringify({probe:true,seasons:[2026],leagues:[39]})}));assert.equal(r.status,500);const d=await r.json();assert.equal(d.ok,false);assert.match(d.error,/deadline/);assert.equal(h.calls,1);assert.equal(h.configs[0].global.fetch instanceof Function,true);
});
test('actual collector bounds its database client transport before provider work',async()=>{
 const h=handlerFixture({databaseStalls:true});const r=await h.handler(new Request('https://collector.invalid',{method:'POST',headers:{'x-mm-secret':'invented'},body:'{}'}));assert.equal(r.status,500);assert.equal((await r.json()).ok,false);assert.equal(h.calls,1);
});

test('before proof: actual deployed collector remains stalled without a transport deadline',async()=>{
 const h=handlerFixture({original:true});let settled=false;void h.handler(new Request('https://collector.invalid',{method:'POST',headers:{'x-mm-secret':'invented'},body:JSON.stringify({probe:true,seasons:[2026],leagues:[39]})})).then(()=>{settled=true;});await delay(20);assert.equal(h.calls,1);assert.equal(settled,false);
});
