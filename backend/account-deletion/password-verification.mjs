// The only successful result is fresh password authentication for the verified caller.
// Never share this short-lived SDK client with admin, browser or another request.
export function createPasswordVerifier({createClient,url,anonKey}){
 return async({userId,email,password})=>{
  if(typeof createClient!=='function'||typeof url!=='string'||!url.trim()||typeof anonKey!=='string'||!anonKey.trim()||typeof email!=='string'||!email.trim()||email.length>320||typeof password!=='string'||!password.length||password.length>1024)return{verified:false,reason:'unavailable'};
  let isolated;
  try{
   isolated=createClient(url,anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
   const result=await isolated.auth.signInWithPassword({email,password});
   if(result?.error?.code==='invalid_credentials')return{verified:false,reason:'invalid_credentials'};
   if(result?.error!==null||result?.data?.user?.id!==userId)return{verified:false,reason:'unavailable'};
   return{verified:true,user_id:userId};
  }catch{return{verified:false,reason:'unavailable'};}
  finally{try{if(isolated?.auth?.signOut)await isolated.auth.signOut({scope:'local'});}catch{}}
 };
}
