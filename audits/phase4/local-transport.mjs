// Test-only HTTP boundary. Never accepts hosted URLs, redirects or arbitrary fetch options.
export async function localRequest(origin,path,{method='GET',headers={},body}={}) {
 if(typeof origin!=='string'||!/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(origin)) throw Error('explicit local origin required');
 const base=new URL(origin);
 if(Number(base.port)>65535) throw Error('invalid local origin');
 if(typeof path!=='string'||!/^\/[a-zA-Z0-9_/-]*$/.test(path)||path.startsWith('//')) throw Error('invalid local path');
 if(!['GET','POST','PATCH','DELETE'].includes(method)) throw Error('invalid method');
 return fetch(new URL(path,base),{method,headers,body,redirect:'error',signal:AbortSignal.timeout(10000)});
}
