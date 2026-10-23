// Isolated orchestration only. It cannot launch the live robot or issue HTTP calls.
const TRANSIENT=new Set(['40001','40P01','08006','57014']);
export async function publishWithSnapshot({publish,capture,timeoutMs=10000}) {
 if(typeof publish!=='function'||typeof capture!=='function') throw Error('local publisher dependencies required');
 const publication=await publish(); // Never repeated when research capture fails.
 const deadline=Date.now()+timeoutMs;
 for(let attempt=1;attempt<=3;attempt++) {
  const controller=new AbortController();let timer;
  try {
   const remaining=deadline-Date.now();if(remaining<=0) throw Object.assign(Error('capture timed out'),{code:'57014'});
   const receipt=await Promise.race([capture(publication,{signal:controller.signal}),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(Error('capture timed out'),{code:'57014'}));},remaining);})]);
   if(receipt?.error) throw Object.assign(Error('snapshot writer refused'),{code:receipt.error.code??'XX000'});
   if(!receipt?.snapshot_id) throw Object.assign(Error('snapshot receipt missing'),{code:'XX000'});
   return {published:true,publication,capture:{ok:true,snapshot_id:receipt.snapshot_id,attempts:attempt}};
  }catch(error) {
   if(attempt===3 || !TRANSIENT.has(error.code) || Date.now()>=deadline) return {published:true,publication,capture:{ok:false,code:error.code??'XX000',attempts:attempt,requires_repair:true}};
  }finally{clearTimeout(timer);}
 }
}
