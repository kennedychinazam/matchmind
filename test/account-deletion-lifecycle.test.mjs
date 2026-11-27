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

function harness(options={}){
  let handler,signouts=0,reloads=0,alerts=0;
  const storage=options.storage||new Map([
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
  const context=vm.createContext({URL,$,supa:client,authUser:null,_cloudAccountEpoch:0,_cloudPushVersion:0,_cloudPushT:null,
    _cloudSync:{},_leaguesLoadedAt:0,_fixtureInputSource:'sample',fixtureRawCurrent:()=>false,_presentationAsOf:null,_dataSourceExplicit:false,prefs:{},notif:{},themeMode:'dark',aiProvider:'gemini',aiCompare:'',
    afState:{record:[],favL:[],favT:[],favM:[],favAt:{},favDel:{}},favStamps:x=>x||{},
    applyTheme:no,credentialSelect:no,fixtureDeliveryReset:no,renderAISettings:no,renderNotif:no,renderAccount:no,renderFavs:no,renderFixtures:no,
    renderScores:no,renderTips:no,renderMoreRecord:no,renderTzSetting:no,applyStaticI18n:no,
    LANGUAGES_ON:false,curFavHome:null,curFavAway:null,clearSearchForIdentity:no,isPublisher:()=>false,cloudPullMerge:no,toast:no,clearTimeout:no,
    localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,String(v)),removeItem:k=>storage.delete(k),clear:()=>storage.clear()},
    accountDeletionDecision:async()=>({password:'invented-password',typed:'DELETE'}),prompt:()=> 'DELETE',alert:()=>{alerts++;},location:{href:options.href||'https://synthetic-delete.invalid/',reload:()=>{reloads++;}},
    SUPA_URL:options.backend||'https://synthetic-delete.invalid',SUPA_KEY:'invented-public-identifier',
    fetch:async(url,init)=>{if(init.method==='GET')return context.capabilities();requests.push({url,init});return context.response();}
  });
  const authStart=source.includes('const _deletedAccountOwners = new WeakMap();')
    ?'const _deletedAccountOwners = new WeakMap();':'function onAuth(user){';
  vm.runInContext(span('// Personal data is never assigned','function saveState(){')+'\n'
    +span(authStart,'async function authSignup(){')+'\n'
    +span('async function proxySession(){','// Calls the proxy.')+'\n'
    +span("$('delAcctBtn').addEventListener('click', async ()=>{",'/* ================================================================\r\n   BUILD 104'),context);
  const run=code=>vm.runInContext(code,context);
  run('personalSelect(null);onAuth('+JSON.stringify({id:options.owner||'A'})+')');
  context.capabilities=async()=>({ok:true,json:async()=>({version:3,protocol:'matchmind-account-deletion/1',capabilities:{password_required:true,confirmation:'DELETE',mode:'immediate'}})});
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
test('pending A cannot reattach over B or consume an obsolete completion',async()=>{
  const h=harness(),pending=deferred();h.context.response=()=>pending.promise;
  const work=h.click();await flush();h.switchTo('B');h.switchTo('A');
  h.$('delAcctNote').textContent='new A context';const before=h.snapshot();pending.resolve(ok());await work;
  assert.equal(h.context.authUser.id,'B');assert.equal(h.$('delAcctNote').textContent,'new A context');
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
  assert.deepEqual(JSON.parse(init.body),{confirmation:'DELETE',password:'invented-password'});assert.equal(init.headers.authorization,'Bearer invented-session-A');
  assert.equal(init.headers.apikey,'invented-public-identifier');assert.equal(init.headers['content-type'],'application/json');
  assert.equal(h.context.authUser,null);assert.deepEqual(h.counters(),{signouts:0,reloads:0,alerts:0});
  for(const [key,raw] of before){
    if(key==='mm_personal_v1:owner:A')assert.deepEqual(JSON.parse(h.storage.get(key)).favT,['A private']);
    else assert.equal(h.storage.get(key),raw,`retains ${key}`);
  }
  assert.equal(h.$('delAcctNote').textContent,'Deletion request received.');
  assert.doesNotMatch(h.$('delAcctNote').textContent,/all.*data.*deleted|all.*data.*erased/i);
});
test('a future SDK event for the deleted owner cannot reattach A while B remains usable',async()=>{
  const h=harness();await h.click();h.run("onAuth({id:'A'})");assert.equal(h.context.authUser,null);
  h.switchTo('B');h.run("onAuth({id:'A'})");assert.equal(h.context.authUser.id,'B');
});
test('current deletion error retains data and does not echo untrusted server details',async()=>{
  const h=harness();h.context.response=async()=>({ok:false,status:500,json:async()=>({error:'invented-sensitive-upstream-echo'})});
  const before=h.snapshot();await h.click();assert.equal(h.context.authUser.id,'A');
  assert.deepEqual(h.snapshot().filter(([k])=>!k.startsWith('mm_account_deletion_v1:')),before);
  assert.equal([...h.storage.values()].filter(v=>{try{return JSON.parse(v).state==='pending';}catch{return false;}}).length,1);
  assert.doesNotMatch(h.$('delAcctNote').textContent,/invented-sensitive-upstream-echo/);
  assert.match(h.$('delAcctNote').textContent,/could not|not confirm/i);
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
    assert.equal(h.$('delAcctNote').textContent,'Deletion request received.');
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


// Acknowledgements/intents must survive a fresh VM, not just the WeakMap/client instance.
test('reload cannot restore an acknowledged deletion owner, while another owner remains usable',async()=>{
 const h=harness();await h.click();const reloaded=harness({storage:h.storage});assert.equal(reloaded.context.authUser,null);
 reloaded.switchTo('B');assert.equal(reloaded.context.authUser.id,'B');
});
test('uncertain dispatched deletion remains paused after reload and has explicit confirmed retry',async()=>{
 const h=harness();h.context.response=async()=>{throw Error('unknown transport');};await h.click();
 const reloaded=harness({storage:h.storage});assert.equal(reloaded.context.authUser,null);await reloaded.click();
 assert.equal(reloaded.requests.length,1);assert.equal(JSON.parse(reloaded.requests[0].init.body).confirmation,'DELETE');assert.equal(reloaded.context.authUser,null);
});
test('marker write failure prevents request and preserves all existing data',async()=>{
 const h=harness(),before=h.snapshot();h.context.localStorage.setItem=()=>{throw Error('quota');};await h.click();assert.equal(h.requests.length,0);assert.deepEqual(h.snapshot(),before);assert.match(h.$('delAcctNote').textContent,/Unable to start deletion/i);
});
test('marker readback mismatch prevents request without deleting conflicting bytes',async()=>{
 const h=harness(),get=h.context.localStorage.getItem;h.context.localStorage.getItem=k=>k.startsWith('mm_account_deletion_v1:')&&h.storage.has(k)?'conflicting marker':get(k);
 await h.click();assert.equal(h.requests.length,0);assert.ok([...h.storage.keys()].some(k=>k.startsWith('mm_account_deletion_v1:')));
});
test('deletion marker scope separates app paths and backends without storing tokens',async()=>{
 const h=harness({href:'https://synthetic-delete.invalid/matchmind/'});await h.click();const marker=[...h.storage].filter(([k])=>k.startsWith('mm_account_deletion_v1:'));assert.equal(marker.length,1);assert.doesNotMatch(marker[0][1],/invented-session|access_token|refresh_token/);
 assert.equal(harness({storage:h.storage,href:'https://synthetic-delete.invalid/matchmind-preview/'}).context.authUser.id,'A');
 assert.equal(harness({storage:h.storage,href:'https://synthetic-delete.invalid/matchmind/',backend:'https://other-backend.invalid'}).context.authUser.id,'A');
});
test('malformed owner marker is preserved and pauses only its own restoration',async()=>{
 const h=harness();await h.click();const key=[...h.storage.keys()].find(k=>k.startsWith('mm_account_deletion_v1:'));assert.ok(key);h.storage.set(key,'{invalid');
 const reloaded=harness({storage:h.storage});assert.equal(reloaded.context.authUser,null);assert.equal(h.storage.get(key),'{invalid');reloaded.switchTo('B');assert.equal(reloaded.context.authUser.id,'B');await reloaded.click();assert.ok(!reloaded.requests.some(r=>r.init.headers.authorization==='Bearer invented-session-A'));
});


test('mutating the initiating user object cannot redirect a pending deletion',async()=>{
 const h=harness(),pending=deferred();h.setGetSession(()=>pending.promise);const work=h.click();
 h.context.authUser.id='B';pending.resolve({data:{session:{user:{id:'A'},access_token:'invented-session-A'}},error:null});await work;
 assert.equal(h.requests.length,0);assert.equal(h.context.authUser.id,'B');
});


test('pre-click SDK user mutation cannot retarget the selected personal owner',async()=>{
 const h=harness();h.context.authUser.id='B';h.setSession({user:{id:'B'},access_token:'invented-session-B'});await h.click();assert.equal(h.requests.length,0);
});
test('paused deletion owner is immutable before retry click',async()=>{
 const first=harness();await first.click();const h=harness({storage:first.storage});h.run("_deletionPausedAccount.user.id='B'");h.setSession({user:{id:'B'},access_token:'invented-session-B'});await h.click();assert.equal(h.requests.length,0);
});
test('paused deletion retry rejects owner mutation during SDK lookup',async()=>{
 const first=harness();await first.click();const h=harness({storage:first.storage}),pending=deferred();h.setGetSession(()=>pending.promise);const work=h.click();h.run("_deletionPausedAccount.user.id='B'");pending.resolve({data:{session:{user:{id:'B'},access_token:'invented-session-B'}},error:null});await work;assert.equal(h.requests.length,0);
});


test('a corrupt personal partition does not prevent correctly bound deletion or get erased locally',async()=>{
 const first=harness();first.storage.set('mm_personal_v1:owner:A','{corrupt');const h=harness({storage:first.storage});assert.equal(h.run('_personalReady'),false);await h.click();assert.equal(h.requests.length,1);assert.equal(h.storage.get('mm_personal_v1:owner:A'),'{corrupt');
});


test('older backend cannot receive a destructive POST from the password flow',async()=>{
 const h=harness();h.context.capabilities=async()=>({ok:true,json:async()=>({version:1})});const before=h.snapshot();await h.click();assert.equal(h.requests.length,0);assert.deepEqual(h.snapshot(),before);assert.match(h.$('delAcctNote').textContent,/temporarily unavailable/);
});
test('wrong password unblocks only its fresh intent using a durable receipt and stores no password',async()=>{
 const h=harness();h.context.response=async()=>({ok:false,status:403,json:async()=>({version:3,protocol:'matchmind-account-deletion/1',state:'verification_failed',auth_delete:'not_attempted'})});await h.click();assert.match(h.$('delAcctNote').textContent,/Incorrect password/);assert.equal(h.run("accountDeletionRead('A').state"),'none');assert.equal(harness({storage:h.storage}).context.authUser.id,'A');assert.equal([...h.storage.keys()].filter(k=>k.startsWith('mm_account_deletion_verification_v1:')).length,1);assert.doesNotMatch(JSON.stringify(h.snapshot()),/invented-password/);assert.equal(h.context.authUser.id,'A');
});
test('wrong-password response cannot clear an existing uncertain deletion intent',async()=>{
 const first=harness();first.context.response=async()=>{throw Error('lost response');};await first.click();const h=harness({storage:first.storage});h.context.response=async()=>({ok:false,status:403,json:async()=>({version:3,protocol:'matchmind-account-deletion/1',state:'verification_failed',auth_delete:'not_attempted'})});await h.click();assert.equal(h.context.authUser,null);assert.ok([...h.storage.keys()].some(k=>k.startsWith('mm_account_deletion_v1:')));
});
test('an older wrong-password result cannot remove a newer attempt marker',async()=>{
 const h=harness();h.context.response=async()=>{h.run("accountDeletionPrepare('A')");return{ok:false,status:403,json:async()=>({version:3,protocol:'matchmind-account-deletion/1',state:'verification_failed',auth_delete:'not_attempted'})};};await h.click();assert.ok([...h.storage.keys()].some(k=>k.startsWith('mm_account_deletion_v1:')));
});
test('matched completed response uses a short success message and durable completed state',async()=>{
 const h=harness();h.context.response=async()=>({ok:true,status:200,json:async()=>({ok:true,version:3,protocol:'matchmind-account-deletion/1',state:'completed'})});await h.click();assert.equal(h.$('delAcctNote').textContent,'Your account has been deleted.');const marker=[...h.storage].find(([k])=>k.startsWith('mm_account_deletion_v1:'));assert.equal(JSON.parse(marker[1]).state,'completed');assert.doesNotMatch(JSON.stringify(h.snapshot()),/invented-password/);
});


test('confirmed completion supersedes a newer valid intent for the same account only',async()=>{
 const h=harness();h.context.response=async()=>{h.run("accountDeletionPrepare('A')");return{ok:true,status:200,json:async()=>({ok:true,version:3,protocol:'matchmind-account-deletion/1',state:'completed'})};};await h.click();const marker=[...h.storage].find(([k])=>k.startsWith('mm_account_deletion_v1:'));assert.equal(JSON.parse(marker[1]).state,'completed');assert.deepEqual(JSON.parse(h.storage.get('mm_personal_v1:owner:B')).favT,['B private']);
});


test('verification failure cannot delete a newer intent written between main-marker read and cleanup',()=>{
 const h=harness(),old=h.run("accountDeletionPrepare('A')"),key=[...h.storage.keys()].find(k=>k.startsWith('mm_account_deletion_v1:'));
 const newer=JSON.stringify({...JSON.parse(old),intent:'newer-concurrent-tab-intent'}),read=h.context.localStorage.getItem;let armed=true;
 h.context.localStorage.getItem=k=>{const value=read(k);if(k===key&&armed){armed=false;h.storage.set(k,newer);}return value;};
 const cleared=h.run('accountDeletionUndoVerificationIntent(\'A\','+JSON.stringify(old)+')');assert.equal(cleared,false);assert.equal(h.storage.get(key),newer);assert.equal(h.run("accountDeletionBlocked('A')"),true);
 assert.equal(harness({storage:h.storage}).context.authUser,null);
});
test('verification receipt write failure keeps the original intent blocking and leaves data intact',()=>{
 const h=harness(),old=h.run("accountDeletionPrepare('A')"),before=h.snapshot();h.context.localStorage.setItem=(key,value)=>{if(key.startsWith('mm_account_deletion_verification_v1:'))throw Error('quota');h.storage.set(key,String(value));};
 assert.equal(h.run('accountDeletionUndoVerificationIntent(\'A\','+JSON.stringify(old)+')'),false);assert.deepEqual(h.snapshot(),before);assert.equal(h.run("accountDeletionBlocked('A')"),true);
});
test('a receipt read failure fails closed without affecting a different owner',()=>{
 const h=harness(),old=h.run("accountDeletionPrepare('A')");assert.equal(h.run('accountDeletionUndoVerificationIntent(\'A\','+JSON.stringify(old)+')'),true);const read=h.context.localStorage.getItem;
 h.context.localStorage.getItem=key=>{if(key.startsWith('mm_account_deletion_verification_v1:'))throw Error('denied');return read(key);};assert.equal(h.run("accountDeletionRead('A').state"),'blocked');assert.equal(h.run("accountDeletionBlocked('B')"),false);
});
test('older verification receipts never unblock a fresh nonce or another owner',()=>{
 const h=harness(),old=h.run("accountDeletionPrepare('A')");assert.equal(h.run('accountDeletionUndoVerificationIntent(\'A\','+JSON.stringify(old)+')'),true);assert.equal(h.run("accountDeletionBlocked('A')"),false);
 const newer=h.run("accountDeletionPrepare('A')");assert.notEqual(JSON.parse(newer).intent,JSON.parse(old).intent);assert.equal(h.run("accountDeletionBlocked('A')"),true);assert.equal(h.run("accountDeletionBlocked('B')"),false);
});
test('a newer intent during receipt persistence cannot restore cloud readiness in the current UI',async()=>{
 const h=harness();h.run('_personalCloudReady=true');const set=h.context.localStorage.setItem;let injected=false;
 h.context.localStorage.setItem=(key,value)=>{set(key,value);if(key.startsWith('mm_account_deletion_verification_v1:')){const main=[...h.storage.keys()].find(k=>k.startsWith('mm_account_deletion_v1:'));h.storage.set(main,JSON.stringify({...JSON.parse(h.storage.get(main)),intent:'newer-after-verification'}));injected=true;}};
 h.context.response=async()=>({ok:false,status:403,json:async()=>({version:3,protocol:'matchmind-account-deletion/1',state:'verification_failed',auth_delete:'not_attempted'})});await h.click();assert.equal(injected,true);assert.equal(h.run('_personalCloudReady'),false);assert.equal(h.run("accountDeletionBlocked('A')"),true);
});
test('completed acknowledgement reconstructs a fully valid owner marker when the main marker disappeared',()=>{
 const h=harness(),old=h.run("accountDeletionPrepare('A')"),key=[...h.storage.keys()].find(k=>k.startsWith('mm_account_deletion_v1:'));h.storage.delete(key);
 assert.equal(h.run('accountDeletionAcknowledge(\'A\','+JSON.stringify(old)+',\'completed\')'),true);assert.equal(h.run("accountDeletionRead('A').state"),'completed');const v=JSON.parse(h.storage.get(key));assert.equal(v.version,1);assert.equal(v.owner,'A');assert.equal(v.app,'/');assert.equal(v.backend,'https://synthetic-delete.invalid');assert.equal(harness({storage:h.storage}).context.authUser,null);
});

// Primary review: reject receipt corruption/foreign scope and invalid completion reconstruction.
test('a malformed or foreign verification receipt never unblocks the owner intent',()=>{
 for(const change of ['malformed','foreign']){
  const h=harness(),old=h.run("accountDeletionPrepare('A')");assert.equal(h.run('accountDeletionUndoVerificationIntent(\'A\','+JSON.stringify(old)+')'),true);
  const key=[...h.storage.keys()].find(k=>k.startsWith('mm_account_deletion_verification_v1:'));
  h.storage.set(key,change==='malformed'?'{':JSON.stringify({...JSON.parse(h.storage.get(key)),backend:'https://foreign.invalid'}));
  assert.equal(h.run("accountDeletionRead('A').state"),'blocked');assert.equal(harness({storage:h.storage}).context.authUser,null);
 }
});
test('a password failure receipt cannot override acknowledged or completed deletion',()=>{
 for(const state of ['acknowledged','completed']){
  const h=harness(),old=h.run("accountDeletionPrepare('A')");assert.equal(h.run('accountDeletionUndoVerificationIntent(\'A\','+JSON.stringify(old)+')'),true);
  assert.equal(h.run('accountDeletionAcknowledge(\'A\','+JSON.stringify(old)+','+JSON.stringify(state)+')'),true);
  assert.equal(h.run("accountDeletionRead('A').state"),state);assert.equal(harness({storage:h.storage}).context.authUser,null);
 }
});
test('completion cannot reconstruct from a missing marker and foreign expected owner',()=>{
 const h=harness(),old=h.run("accountDeletionPrepare('B')"),bad=JSON.stringify({...JSON.parse(old),owner:'B'});
 assert.equal(h.run('accountDeletionAcknowledge(\'A\','+JSON.stringify(bad)+',\'completed\')'),false);assert.equal(h.run("accountDeletionRead('A').state"),'none');
});
