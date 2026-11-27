// Real desktop Chrome + current full app; every non-fixture network request aborted.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,existsSync} from 'node:fs';import {createRequire} from 'node:module';
const chromium=createRequire(import.meta.url)('playwright-core').chromium;
async function open(t){
 const executablePath=process.env.MM_TEST_CHROMIUM;assert.ok(executablePath&&existsSync(executablePath));const browser=await chromium.launch({executablePath,args:['--no-sandbox','--disable-background-networking']});t.after(()=>browser.close());
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:390,height:844}});await context.addInitScript(()=>localStorage.setItem('mm_intro','1'));
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');await context.route('**/*',r=>r.request().url()==='http://deletion-reload.test/matchmind/'?r.fulfill({status:200,contentType:'text/html',body:html}):r.abort());
 const p=await context.newPage();await p.goto('http://deletion-reload.test/matchmind/');return p;
}
async function sdk(p){await p.evaluate(()=>{
 cloudEnabled=()=>true;aiShadowGate=async()=>{};window.__testSessionOwner='A';
 const chain=()=>{let q;q=new Proxy({then:(a,b)=>Promise.resolve({data:null,error:null}).then(a,b)},{get:(target,key)=>key in target?target[key]:()=>q});return q;};
 supa={auth:{getSession:async()=>({error:null,data:{session:{user:{id:window.__testSessionOwner},access_token:'invented-'+window.__testSessionOwner}}})},from:()=>chain(),rpc:async()=>({data:null,error:{message:'synthetic offline'}})};
 });}
test('real browser reload keeps deletion owner detached and shows an actionable confirmed retry',async t=>{
 const p=await open(t);await sdk(p);await p.evaluate(()=>{localStorage.setItem(personalKey('A'),JSON.stringify({favT:['retained A']}));accountDeletionPrepare('A');onAuth({id:'A'});});
 await p.reload();await sdk(p);await p.evaluate(()=>onAuth({id:'A'}));await p.locator('.nav-btn[data-view="data"]').click();
 assert.equal(await p.evaluate(()=>authUser),null);assert.equal(await p.locator('#delAcctBtn').innerText(),'Retry deletion');assert.match(await p.locator('#acctBox').innerText(),/deletion is in progress/i);assert.equal(await p.locator('#delAcctBtn').isVisible(),true);
 await p.locator('#delAcctBtn').scrollIntoViewIfNeeded();await p.screenshot({path:new URL('../../mm07-evidence/deletion-retry-390.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')});
 await p.evaluate(()=>{window.__deleteRequests=[];window.prompt=()=> 'DELETE';window.fetch=async(url,init)=>{if(!String(url).endsWith('/functions/v1/delete-account'))throw Error('NETWORK FORBIDDEN');if(init.method==='GET')return{ok:true,json:async()=>({version:3,protocol:'matchmind-account-deletion/1',capabilities:{password_required:true,confirmation:'DELETE',mode:'immediate'}})};window.__deleteRequests.push(JSON.parse(init.body));return{ok:true,status:200,json:async()=>({ok:true,version:3,protocol:'matchmind-account-deletion/1',state:'completed'})};};});
 await p.locator('#delAcctBtn').click();await p.getByLabel('Password',{exact:true}).fill('invented-password');await p.getByLabel('Type DELETE to confirm',{exact:true}).fill('DELETE');await p.screenshot({path:new URL('../../mm07-evidence/deletion-password-dialog-390.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')});await p.getByRole('button',{name:'Delete account',exact:true}).click();await p.waitForFunction(()=>document.getElementById('delAcctNote').textContent==='Your account has been deleted.');
 assert.equal(await p.evaluate(()=>authUser),null);assert.equal(await p.evaluate(()=>window.__deleteRequests.length),1);assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem(personalKey('A'))).favT),['retained A']);
});
test('real browser marked A cannot overwrite B or import its retained favourites',async t=>{
 const p=await open(t);await sdk(p);const before=await p.evaluate(()=>{localStorage.setItem(personalKey('A'),JSON.stringify({favT:['retained A']}));accountDeletionPrepare('A');onAuth({id:'A'});return localStorage.getItem(accountDeletionKey('A'));});
 await p.evaluate(()=>{window.__testSessionOwner='B';onAuth({id:'B'});});
 assert.equal(await p.evaluate(()=>authUser.id),'B');assert.deepEqual(await p.evaluate(()=>afState.favT),[]);assert.equal(await p.evaluate(()=>localStorage.getItem(accountDeletionKey('A'))),before);assert.deepEqual(await p.evaluate(()=>JSON.parse(localStorage.getItem(personalKey('A'))).favT),['retained A']);
});


test('public dialog masks password, validates DELETE and cancels without a request',async t=>{
 const p=await open(t);await sdk(p);await p.evaluate(()=>onAuth({id:'A'}));await p.locator('.nav-btn[data-view="data"]').click();
 await p.locator('#delAcctBtn').click();assert.equal(await p.locator('#accountDeletionPassword').getAttribute('type'),'password');assert.equal(await p.getByRole('dialog',{name:'Delete your account?'}).isVisible(),true);
 await p.getByLabel('Password',{exact:true}).fill('invented-password');await p.getByLabel('Type DELETE to confirm',{exact:true}).fill('DELETE');await p.screenshot({path:new URL('../../mm07-evidence/deletion-password-dialog-clean-390.png',import.meta.url).pathname.replace(/^\/([A-Z]:)/,'$1')});await p.getByLabel('Type DELETE to confirm',{exact:true}).fill('WRONG');await p.getByRole('button',{name:'Delete account',exact:true}).click();assert.equal(await p.locator('#accountDeletionError').innerText(),'Type DELETE to confirm.');
 await p.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(await p.getByRole('dialog',{name:'Delete your account?'}).isVisible(),false);assert.equal(await p.locator('#accountDeletionPassword').inputValue(),'');assert.equal(await p.evaluate(()=>accountDeletionRead('A').state),'none');
});
