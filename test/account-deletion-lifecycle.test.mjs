// Actual deletion handler in an offline VM. All identities, tokens and storage are invented;
// fetch/auth/DOM/storage are inert doubles. No account, provider or network is contacted.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
function span(start,end){
  const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
  assert.ok(a>=0&&b>a,'actual source boundary is present');
  return source.slice(a,b);
}
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
const ok=()=>({ok:true,status:200,json:async()=>({ok:true})});

function harness(){
  let handler,signouts=0,reloads=0,alerts=0;
  const storage=new Map([
    ['mm_personal_v1:owner:A',JSON.stringify({favT:['A private']})],
    ['mm_personal_v1:owner:B',JSON.stringify({favT:['B private']})],
    ['mm_personal_v1:UNASSIGNED',JSON.stringify({favT:['guest private']})],
    ['mm_state','{"afKey":"invented-old-af","af":{"record":[]}}'],
    ['mm_state_UNASSIGNED','{"afKey":"invented-old-af","af":{"record":[]}}'],
    ['mm_ai','{"keys":{"claude":"invented-old-ai"}}'],
    ['mm_credentials_v1:owner:A','invented-A-credential-bytes'],
    ['mm_credentials_v1:owner:B','invented-B-credential-bytes'],
    ['mm_ai_backup_unknown','unknown invented backup bytes'],
    ['future-quarantine-copy','unknown invented quarantine bytes']
  ]);
  const nodes=new Map(),requests=[];
  const $=id=>{if(!nodes.has(id))nodes.set(id,{textContent:'',value:'',addEventListener:(_event,fn)=>{if(id==='delAcctBtn')handler=fn;}});return nodes.get(id);};
  let session={user:{id:'A'},access_token:'invented-session-A'},getSession=async()=>({data:{session},error:null});
  const client={auth:{getSession:()=>getSession(),signOut:async()=>{signouts++;return{error:null};}}};
  const no=()=>{};
  const context=vm.createContext({$,supa:client,authUser:null,_cloudAccountEpoch:0,_cloudPushVersion:0,_cloudPushT:null,
    _cloudSync:{},_leaguesLoadedAt:0,prefs:{},notif:{},themeMode:'dark',aiProvider:'gemini',aiCompare:'',
    afState:{record:[],favL:[],favT:[],favM:[],favAt:{},favDel:{}},favStamps:x=>x||{},
    applyTheme:no,credentialSelect:no,fixtureDeliveryReset:no,renderAISettings:no,renderNotif:no,renderAccount:no,renderFavs:no,renderFixtures:no,
    renderScores:no,renderTips:no,renderMoreRecord:no,renderTzSetting:no,applyStaticI18n:no,
    LANGUAGES_ON:false,curFavHome:null,curFavAway:null,clearSearchForIdentity:no,isPublisher:()=>false,cloudPullMerge:no,toast:no,clearTimeout:no,
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k),clear:()=>storage.clear()},
    prompt:()=> 'DELETE',alert:()=>{alerts++;},location:{reload:()=>{reloads++;}},
    SUPA_URL:'https://synthetic-delete.invalid',SUPA_KEY:'invented-public-identifier',
    fetch:async(url,init)=>{requests.push({url,init});return context.response();}
  });
  const authStart=source.includes('const _deletedAccountOwners = new WeakMap();')
    ?'const _deletedAccountOwners = new WeakMap();':'function onAuth(user){';
  vm.runInContext(span('// Personal data is never assigned','function saveState(){')+'\n'
    +span(authStart,'async function authSignup(){')+'\n'
    +span('async function proxySession(){','// Calls the proxy.')+'\n'
    +span("$('delAcctBtn').addEventListener('click', async ()=>{",'/* ================================================================\r\n   BUILD 104'),context);
  const run=code=>vm.runInContext(code,context);
  run("personalSelect(null);onAuth({id:'A'})");
  context.response=async()=>ok();
  return {context,storage,requests,run,$,click:()=>handler(),
    setSession:x=>{session=x;},setGetSession:fn=>{getSession=fn;},
    counters:()=>({signouts,reloads,alerts}),snapshot:()=>[...storage],
    switchTo:id=>{session=id?{user:{id},access_token:'invented-session-'+id}:null;run('onAuth('+JSON.stringify(id?{id}:null)+')');}
  };
}

// Removing the owner/epoch guard would make delayed A completion change B's context.
for(const outcome of ['success','server error','fetch rejection','JSON rejection']){
  test(`obsolete A deletion ${outcome} leaves B, its UI and all storage unchanged`,async()=>{
    const h=harness(),pending=deferred();h.context.response=()=>pending.promise;
    const work=h.click();await flush();assert.equal(h.requests.length,1);
    h.switchTo('B');h.$('delAcctNote').textContent='B current notice';const before=h.snapshot();
    if(outcome==='success')pending.resolve(ok());
    if(outcome==='server error')pending.resolve({ok:false,status:403,json:async()=>({error:'invented upstream echo'})});
    if(outcome==='fetch rejection')pending.reject(Error('invented failed to fetch'));
    if(outcome==='JSON rejection')pending.resolve({ok:true,status:200,json:async()=>{throw Error('invented parse failure');}});
    await work;
    assert.equal(h.context.authUser.id,'B');assert.equal(h.$('delAcctNote').textContent,'B current notice');
    assert.deepEqual(h.snapshot(),before);assert.deepEqual(h.counters(),{signouts:0,reloads:0,alerts:0});
  });
}
// A -> B -> A must invalidate an old A operation even though its UID matches again.
test('epoch change invalidates an A completion after A returns',async()=>{
  const h=harness(),pending=deferred();h.context.response=()=>pending.promise;
  const work=h.click();await flush();h.switchTo('B');h.switchTo('A');
  h.$('delAcctNote').textContent='new A context';const before=h.snapshot();pending.resolve(ok());await work;
  assert.equal(h.context.authUser.id,'A');assert.equal(h.$('delAcctNote').textContent,'new A context');
  assert.deepEqual(h.snapshot(),before);assert.deepEqual(h.counters(),{signouts:0,reloads:0,alerts:0});
});
test('client replacement invalidates pending completion even for the same UID',async()=>{
  const h=harness(),pending=deferred();h.context.response=()=>pending.promise;
  const work=h.click();await flush();h.context.supa={auth:{getSession:async()=>({data:{session:{user:{id:'A'},access_token:'invented-session-A'}},error:null})}};
  h.$('delAcctNote').textContent='replacement client';const before=h.snapshot();pending.resolve(ok());await work;
  assert.equal(h.context.authUser.id,'A');assert.equal(h.$('delAcctNote').textContent,'replacement client');assert.deepEqual(h.snapshot(),before);
  assert.deepEqual(h.counters(),{signouts:0,reloads:0,alerts:0});
});
test('same-UID auth context replacement invalidates pending completion',async()=>{
  const h=harness(),pending=deferred();h.context.response=()=>pending.promise;
  const work=h.click();await flush();h.run("onAuth({id:'A'})");
  h.$('delAcctNote').textContent='new A auth context';const before=h.snapshot();pending.resolve(ok());await work;
  assert.equal(h.context.authUser?.id,'A');assert.equal(h.$('delAcctNote').textContent,'new A auth context');assert.deepEqual(h.snapshot(),before);
});
test('a switch while session lookup is pending never dispatches deletion',async()=>{
  const h=harness(),pending=deferred();h.setGetSession(()=>pending.promise);
  const work=h.click();h.switchTo('B');h.$('delAcctNote').textContent='B notice';
  pending.resolve({data:{session:{user:{id:'A'},access_token:'invented-session-A'}},error:null});await work;
  assert.equal(h.requests.length,0);assert.equal(h.$('delAcctNote').textContent,'B notice');assert.equal(h.context.authUser.id,'B');
});
for(const session of [null,{user:{id:'B'},access_token:'invented-session-B'},{access_token:'invented-unassigned-token'}]){
  test(`unverified initial session ${session?.user?.id||'missing owner'} cannot dispatch deletion`,async()=>{
    const h=harness();h.setSession(session);await h.click();assert.equal(h.requests.length,0);
    assert.equal(h.context.authUser.id,'A');assert.deepEqual(h.counters(),{signouts:0,reloads:0,alerts:0});
  });
}
test('session replacement with unchanged UID prevents local completion',async()=>{
  const h=harness(),pending=deferred();h.context.response=()=>pending.promise;
  const work=h.click();await flush();h.setSession({user:{id:'A'},access_token:'invented-replacement-session-A'});
  const before=h.snapshot();pending.resolve(ok());await work;
  assert.equal(h.context.authUser?.id,'A');assert.deepEqual(h.snapshot(),before);assert.deepEqual(h.counters(),{signouts:0,reloads:0,alerts:0});
});
test('mutating the SDK session object cannot replace the captured session identity',async()=>{
  const h=harness(),pending=deferred(),session={user:{id:'A'},access_token:'invented-session-A'};
  h.setSession(session);h.context.response=()=>pending.promise;const work=h.click();await flush();
  session.access_token='invented-mutated-session-A';const before=h.snapshot();pending.resolve(ok());await work;
  assert.equal(h.context.authUser?.id,'A');assert.deepEqual(h.snapshot(),before);assert.deepEqual(h.counters(),{signouts:0,reloads:0,alerts:0});
});
test('identity change during final session verification cannot detach the new user',async()=>{
  const h=harness(),pending=deferred();let reads=0;
  h.setGetSession(()=>++reads===1?Promise.resolve({data:{session:{user:{id:'A'},access_token:'invented-session-A'}},error:null}):pending.promise);
  const work=h.click();await flush();h.switchTo('B');h.$('delAcctNote').textContent='B final notice';const before=h.snapshot();
  pending.resolve({data:{session:{user:{id:'A'},access_token:'invented-session-A'}},error:null});await work;
  assert.equal(h.context.authUser.id,'B');assert.equal(h.$('delAcctNote').textContent,'B final notice');assert.deepEqual(h.snapshot(),before);
});
test('confirmed current deletion preserves device copies and the existing server contract',async()=>{
  const h=harness();const before=new Map(h.snapshot());await h.click();
  assert.equal(h.requests.length,1);const {url,init}=h.requests[0];
  assert.equal(url,'https://synthetic-delete.invalid/functions/v1/delete-account');assert.equal(init.method,'POST');
  assert.deepEqual(JSON.parse(init.body),{confirm:'DELETE'});assert.equal(init.headers.authorization,'Bearer invented-session-A');
  assert.equal(init.headers.apikey,'invented-public-identifier');assert.equal(init.headers['content-type'],'application/json');
  assert.equal(h.context.authUser,null);assert.deepEqual(h.counters(),{signouts:0,reloads:0,alerts:0});
  for(const [key,raw] of before){
    if(key==='mm_personal_v1:owner:A')assert.deepEqual(JSON.parse(h.storage.get(key)).favT,['A private']);
    else assert.equal(h.storage.get(key),raw,`retains ${key}`);
  }
  assert.match(h.$('delAcctNote').textContent,/server.*acknowledg/i);assert.match(h.$('delAcctNote').textContent,/local.*retain|device.*retain/i);
  assert.doesNotMatch(h.$('delAcctNote').textContent,/all.*data.*deleted|all.*data.*erased/i);
});
test('a future SDK event for the deleted owner cannot reattach A while B remains usable',async()=>{
  const h=harness();await h.click();h.run("onAuth({id:'A'})");assert.equal(h.context.authUser,null);
  h.switchTo('B');h.run("onAuth({id:'A'})");assert.equal(h.context.authUser.id,'B');
});
test('current deletion error retains data and does not echo untrusted server details',async()=>{
  const h=harness();h.context.response=async()=>({ok:false,status:500,json:async()=>({error:'invented-sensitive-upstream-echo'})});
  const before=h.snapshot();await h.click();assert.equal(h.context.authUser.id,'A');assert.deepEqual(h.snapshot(),before);
  assert.doesNotMatch(h.$('delAcctNote').textContent,/invented-sensitive-upstream-echo/);
  assert.match(h.$('delAcctNote').textContent,/could not|not confirmed/i);
});
for(const finalLookup of ['absent session','SDK error','SDK rejection','different owner','different token']){
  test(`server acknowledgement with ${finalLookup} produces a truthful terminal result`,async()=>{
    const h=harness();let reads=0;
    h.setGetSession(async()=>{
      if(++reads===1)return {data:{session:{user:{id:'A'},access_token:'invented-session-A'}},error:null};
      if(finalLookup==='absent session')return {data:{session:null},error:null};
      if(finalLookup==='SDK error')return {data:{session:null},error:{message:'invented-sensitive-SDK-error'}};
      if(finalLookup==='SDK rejection')throw Error('invented-sensitive-SDK-rejection');
      return {data:{session:{user:{id:finalLookup==='different owner'?'B':'A'},access_token:'invented-replacement-token'}},error:null};
    });
    const before=new Map(h.snapshot());await h.click();
    assert.doesNotMatch(h.$('delAcctNote').textContent,/Deleting|invented-sensitive/);
    assert.match(h.$('delAcctNote').textContent,/server.*acknowledg/i);
    assert.match(h.$('delAcctNote').textContent,/not.*verif|unverified/i);
    assert.match(h.$('delAcctNote').textContent,/local.*retain|device.*retain/i);
    if(finalLookup==='absent session'){
      assert.equal(h.context.authUser,null);h.run("onAuth({id:'A'})");assert.equal(h.context.authUser,null);
    }else assert.equal(h.context.authUser?.id,'A');
    for(const [key,raw] of before){
      if(key==='mm_personal_v1:owner:A')assert.deepEqual(JSON.parse(h.storage.get(key)).favT,['A private']);
      else assert.equal(h.storage.get(key),raw,`retains ${key}`);
    }
    assert.deepEqual(h.counters(),{signouts:0,reloads:0,alerts:0});
  });
}
