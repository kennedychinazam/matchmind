// LOCAL MATCHED CANDIDATE ONLY: requires account-lifecycle SQL and sender cutover.
const MAX_BODY_BYTES=4096;
async function confirmation(req){
 const reader=req.body?.getReader();if(!reader)return false;let length=0,text='';const decoder=new TextDecoder();
 try{for(;;){const part=await reader.read();if(part.done)break;length+=part.value.byteLength;if(length>MAX_BODY_BYTES){void reader.cancel().catch(()=>{});return false;}text+=decoder.decode(part.value,{stream:true});}text+=decoder.decode();const body=JSON.parse(text);return body?.confirmation==='DELETE'&&typeof body.password==='string'&&body.password.length>0&&body.password.length<=1024?{password:body.password}:false;}
 catch{return false;}finally{reader.releaseLock();}
}
const uuid=x=>typeof x==='string'&&/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(x);
const reply=(status,state,stage,authDelete,jobId)=>({status,body:{ok:state==='completed',protocol:'matchmind-account-deletion/1',state,stage,auth_delete:authDelete,...(jobId?{job_id:jobId}:{}),retained:{local_device_copies:true,shared_football_records:true,private_recovery_record:true}}});
export async function deleteAccountRequest({admin,req,verifyPassword}){
 if(req.method==='GET')return{status:200,body:{ok:true,protocol:'matchmind-account-deletion/1',capabilities:{password_required:true,confirmation:'DELETE',mode:'immediate'}}};
 if(req.method!=='POST')return reply(405,'rejected','method','not_attempted');
 const jwt=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');
 if(!jwt)return reply(401,'rejected','identity','not_attempted');
 let identity;try{identity=await admin.auth.getUser(jwt);}catch{return reply(503,'verification_unavailable','identity','not_attempted');}
 const user=identity?.data?.user;
 if(identity?.error!==null||!uuid(user?.id))return reply(401,'rejected','identity','not_attempted');
 const userId=user.id,email=user.email;
 const credentials=await confirmation(req);
 if(!credentials)return reply(400,'rejected','confirmation','not_attempted');
 if(typeof verifyPassword!=='function')return reply(503,'verification_unavailable','password','not_attempted');
 let checked;
 try{checked=await verifyPassword({userId,email,password:credentials.password});}
 catch{return reply(503,'verification_unavailable','password','not_attempted');}
 finally{credentials.password='';}
 if(checked?.verified!==true||checked.user_id!==userId)return reply(checked?.reason==='invalid_credentials'?403:503,checked?.reason==='invalid_credentials'?'verification_failed':'verification_unavailable','password','not_attempted');
 const rpc=async(name,args)=>{const r=await admin.rpc(name,args);if(r?.error!==null||!r.data||typeof r.data!=='object')throw Error('Lifecycle persistence unconfirmed');return r.data;};
 let job;
 try{job=await rpc('mm_deletion_prepare_v1',{user_id:userId});}catch{return reply(503,'recovery_required','admission','not_attempted');}
 const id=uuid(job.job_id)?job.job_id:undefined;
 if(job.status!=='reserved'||!id||!uuid(job.lease_token))return reply(409,job.status==='busy'?'pending':'recovery_required','admission','not_attempted',id);
 const key={job_id:id,lease_token:job.lease_token};
 try{const r=await rpc('mm_deletion_cleanup_v1',key);if(r.ok!==true||r.status!=='cleaned')return reply(409,'cleanup_unconfirmed','cleanup','not_attempted',id);}
 catch{return reply(503,'cleanup_unconfirmed','cleanup','not_attempted',id);}
 try{const r=await rpc('mm_deletion_mark_auth_v1',key);if(r.ok!==true||r.status!=='auth_dispatched')return reply(409,'recovery_required','auth_admission','not_attempted',id);}
 catch{return reply(503,'recovery_required','auth_admission','not_attempted',id);}
 const uncertain=async()=>{try{await rpc('mm_deletion_finish_v1',{...key,outcome:'auth_unconfirmed'});}catch{}return reply(503,'auth_unconfirmed','auth_delete','unconfirmed',id);};
 let removed;try{removed=await admin.auth.admin.deleteUser(userId);}catch{return uncertain();}
 if(removed?.error!==null||removed.data?.user?.id!==userId)return uncertain();
 try{const finished=await rpc('mm_deletion_finish_v1',{...key,outcome:'complete'});if(finished.ok===true&&finished.status==='completed')return reply(200,'completed','verification','acknowledged',id);}
 catch{}
 return reply(503,'recovery_required','verification','acknowledged',id);
}
