import{createClient}from'https://esm.sh/@supabase/supabase-js@2.119.2';
import{createDeadlineFetch}from'../backend/collector-observability/request-deadline.mjs';
// Real pinned SDK; transport is an inert invented double. No network permission is required.
for(const method of['read','write'])Deno.test('pinned SDK '+method+' timeout is bounded without automatic replay',async()=>{
 let calls=0;const bounded=createDeadlineFetch({timeoutMs:5,fetchImpl:()=>{calls++;return new Promise(()=>{});}});
 const client=createClient('https://synthetic.invalid','invented',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:bounded}});
 const r=await(method==='read'?client.from('fixtures').select('fxid'):client.from('fixtures').upsert({fxid:123}));
 if(!r.error||calls!==1||!r.error.message.includes('deadline'))throw Error('SDK did not preserve bounded single-dispatch failure');
});
