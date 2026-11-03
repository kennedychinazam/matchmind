// Existing scheduler collector's post-write hook. One database RPC only; never a provider call.
// A presentation error is explicit and cannot roll back or retry an already committed source write.
export async function refreshBoundedDisplay(client){
 try{
  const r=await client.rpc('matchmind_publish_display_v1',{}),d=r?.data;
  const keys=['version','edition_id','cards','predictions','as_of'];
  if(r?.error||!d||Object.keys(d).length!==keys.length||keys.some(k=>!Object.hasOwn(d,k))||d.version!=='matchmind-display/1'||typeof d.edition_id!=='string'||!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(d.edition_id)||!Number.isSafeInteger(d.cards)||d.cards<0||d.cards>1000||!Number.isSafeInteger(d.predictions)||d.predictions<0||d.predictions>d.cards||typeof d.as_of!=='string'||!Number.isFinite(Date.parse(d.as_of)))return{status:'unavailable'};
  return{status:'refreshed',version:d.version,edition_id:d.edition_id,cards:d.cards,predictions:d.predictions,as_of:d.as_of};
 }catch{return{status:'unavailable'};}
}
