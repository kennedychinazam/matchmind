import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
const {localRequest}=await import('../phase4/local-transport.mjs').catch(()=>({}));
test('local transport rejects remote targets, credentials and redirects before any external request',async()=>{
 assert.equal(typeof localRequest,'function');
 for(const origin of ['https://production.supabase.co','http://localhost.evil.test:54321','http://127.0.0.2:54321','http://user:pass@127.0.0.1:54321','http://[::1]:54321','http://127.0.0.1:54321/path']) {
  await assert.rejects(()=>localRequest(origin,'/health'),/local origin/);
 }
 const server=createServer((req,res)=>{if(req.url==='/redirect'){res.writeHead(302,{Location:'https://production.supabase.co'});res.end();}else{res.end('synthetic');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try {
  const origin=`http://127.0.0.1:${server.address().port}`;
  assert.equal(await (await localRequest(origin,'/health')).text(),'synthetic');
  for(const path of ['//production.supabase.co','https://production.supabase.co','/../outside','/health?url=https://production.supabase.co']) await assert.rejects(()=>localRequest(origin,path),/local path/);
  await assert.rejects(()=>localRequest(origin,'/redirect'));
 } finally {await new Promise(resolve=>server.close(resolve));}
});
