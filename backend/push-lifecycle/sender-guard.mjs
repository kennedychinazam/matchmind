// Matched lifecycle SQL is required. Missing/uncertain authorization fails closed.
const valid=sub=>sub&&typeof sub.endpoint==='string'&&sub.endpoint.length>0&&sub.endpoint.length<=4096&&typeof sub.user_id==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(sub.user_id)&&typeof sub.updated_at==='string'&&Number.isFinite(Date.parse(sub.updated_at));
const identity=sub=>({endpoint:sub.endpoint,owner_id:sub.user_id,subscription_version:sub.updated_at});
export async function maySend(admin,sub){
 if(!valid(sub))return false;
 try{const r=await admin.rpc('mm_deletion_push_allowed_v1',identity(sub));return r?.error===null&&r.data===true;}catch{return false;}
}
export async function recordBoundPush({admin,sub,key,problems}){
 if(!valid(sub)||typeof key!=='string'||!key.trim()||key.length>200){problems.push('Push receipt was not recorded.');return false;}
 try{const r=await admin.rpc('mm_deletion_push_record_v1',{...identity(sub),dedupe_key:key});if(r?.error===null&&r.data===true)return true;}catch{}
 problems.push('Push receipt was not confirmed for this registration.');return false;
}
export async function sendBoundPush({admin,webpush,sub,payload,problems}){
 if(!await maySend(admin,sub)){problems.push('Push skipped because registration eligibility was not confirmed.');return false;}
 try{await webpush.sendNotification({endpoint:sub.endpoint,keys:{p256dh:sub.p256dh,auth:sub.auth}},JSON.stringify(payload),{TTL:1800});return true;}
 catch(e){
  if(e?.statusCode===404||e?.statusCode===410){
   try{const r=await admin.from('push_subscriptions').delete().eq('endpoint',sub.endpoint).eq('user_id',sub.user_id).eq('updated_at',sub.updated_at);if(r?.error!==null)problems.push('Expired registration removal was not confirmed.');}catch{problems.push('Expired registration removal was not confirmed.');}
  }else problems.push('Push delivery was not confirmed.');
  return false;
 }
}
