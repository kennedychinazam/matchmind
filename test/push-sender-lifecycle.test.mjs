// Actual captured sender + lifecycle patch, synthetic SDK/webpush only.
import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFileSync} from 'node:fs';import {stripTypeScriptTypes} from 'node:module';
import {applyPatch} from '../backend/ai-generation/build-candidate.mjs';import {sendBoundPush,recordBoundPush} from '../backend/push-lifecycle/sender-guard.mjs';
const raw=readFileSync(new URL('../../mm07-evidence/dependency-review/send-push-index.ts',import.meta.url),'utf8').replaceAll('\r\n','\n');
const patched=applyPatch(raw,readFileSync(new URL('../backend/push-lifecycle/send-push-v9-lifecycle.patch',import.meta.url),'utf8').replaceAll('\r\n','\n'));
function fixture(baseline=false){
 const calls=[],problems=[],options={allow:true,record:true,failRpc:false,deliveryError:null,deleteError:null};let handler;
 const sub={endpoint:'https://synthetic.invalid/endpoint',user_id:'11111111-2222-4333-8444-555555555555',updated_at:'2026-11-27T00:00:00Z',p256dh:'invented',auth:'invented'};
 const admin={rpc:async(name,args)=>{calls.push({kind:'rpc',name,args});if(options.failRpc)throw Error('RAW PRIVATE SDK');return{error:null,data:name.endsWith('record_v1')?options.record:options.allow};},from:table=>({delete(){const filters=[];return{eq(k,v){filters.push([k,v]);return this;},then(a,b){calls.push({kind:'delete',table,filters});return Promise.resolve({error:options.deleteError}).then(a,b);}};},upsert:async body=>{calls.push({kind:'blind_ledger',body});return{error:null};}})};
 const webpush={setVapidDetails(){},sendNotification:async(...args)=>{calls.push({kind:'send',args});if(options.deliveryError)throw options.deliveryError;}};
 const ctx=vm.createContext({createClient:()=>admin,sendBoundPush,recordBoundPush,webpush,Deno:{env:{get:k=>k==='MM_CRON_SECRET'?'invented-cron':''},serve:f=>handler=f},Response,TextEncoder,console:{log(){},warn(){},error(){}},fetch(){throw Error('NETWORK FORBIDDEN');}});
 vm.runInContext(stripTypeScriptTypes((baseline?raw:patched).replace(/^import .*;\r?\n/gm,'')),ctx);
 return{calls,problems,options,sub,ctx,send:()=>ctx.push(sub,{mm:'synthetic'},problems),record:()=>ctx.markSent(sub,'synthetic-key',problems),request:()=>handler(new Request('https://synthetic.invalid/send-push',{method:'POST',body:'{}'}))};
}
test('before proof: original sender sends captured subscription without deletion eligibility check',async()=>{const h=fixture(true);h.options.allow=false;assert.equal(await h.send(),true);assert.equal(h.calls.filter(c=>c.kind==='send').length,1);assert.equal(h.calls.filter(c=>c.kind==='rpc').length,0);});
test('matched sender refuses pending or absent registration before external delivery',async()=>{const h=fixture();h.options.allow=false;assert.equal(await h.send(),false);assert.equal(h.calls.filter(c=>c.kind==='send').length,0);});
test('unknown eligibility response fails closed without leaking SDK details',async()=>{const h=fixture();h.options.failRpc=true;assert.equal(await h.send(),false);assert.equal(h.calls.filter(c=>c.kind==='send').length,0);assert.doesNotMatch(h.problems.join(' '),/RAW|PRIVATE/);});
for(const field of ['user_id','updated_at','endpoint'])test('missing '+field+' cannot send',async()=>{const h=fixture();delete h.sub[field];assert.equal(await h.send(),false);assert.equal(h.calls.length,0);});
test('valid registration sends once with original delivery TTL and bounded identity RPC',async()=>{const h=fixture();assert.equal(await h.send(),true);const r=h.calls.find(c=>c.kind==='rpc');assert.equal(r.args.owner_id,h.sub.user_id);assert.equal(r.args.subscription_version,h.sub.updated_at);assert.equal(h.calls.find(c=>c.kind==='send').args[2].TTL,1800);});
test('ledger uses atomic owner/generation SQL routine instead of blind endpoint upsert',async()=>{const h=fixture();assert.equal(await h.record(),true);assert.equal(h.calls[0].name,'mm_deletion_push_record_v1');assert.deepEqual(h.calls[0].args,{endpoint:h.sub.endpoint,owner_id:h.sub.user_id,subscription_version:h.sub.updated_at,dedupe_key:'synthetic-key'});assert.equal(h.calls.filter(c=>c.kind==='blind_ledger').length,0);});
test('changed registration cannot receive an old captured receipt',async()=>{const h=fixture();h.options.record=false;assert.equal(await h.record(),false);assert.match(h.problems.join(' '),/not confirmed/);});
for(const statusCode of [404,410])test(statusCode+' removal binds exact endpoint owner and generation',async()=>{const h=fixture();h.options.deliveryError={statusCode};assert.equal(await h.send(),false);assert.deepEqual(h.calls.find(c=>c.kind==='delete').filters,[['endpoint',h.sub.endpoint],['user_id',h.sub.user_id],['updated_at',h.sub.updated_at]]);});
test('uncertain delivery does not delete a registration or expose raw transport details',async()=>{const h=fixture();h.options.deliveryError=Error('RAW PRIVATE transport');assert.equal(await h.send(),false);assert.equal(h.calls.filter(c=>c.kind==='delete').length,0);assert.doesNotMatch(h.problems.join(' '),/RAW|PRIVATE/);});
test('scheduler authentication gate remains intact before SDK work',async()=>{const h=fixture();assert.equal((await h.request()).status,401);assert.equal(h.calls.length,0);});
test('all three production send paths pass the bound subscription to receipt recording',()=>{assert.equal(patched.match(/await markSent\(s, key, problems\)/g).length,3);assert.doesNotMatch(patched,/await markSent\(s\.endpoint/);});


test('explicit Date timestamp validation preserves original sender kickoff rules',()=>{
 const old=fixture(true),current=fixture();for(const [date,time] of [['2026-11-27','12:34'],['2026-11-27','9:05'],['2026-11-27','2026-11-28T12:34Z'],['2026-11-27','12:34:56'],['bad','12:00'],['2026-11-27','25:00'],['2026-11-27',''],[null,'12:00']]){
  const a=old.ctx.kickoffUTC(date,time),b=current.ctx.kickoffUTC(date,time);assert.equal(b?.getTime()??null,a?.getTime()??null);
 }
 assert.equal(current.ctx.kickoffUTC('2026-11-27','12:34').getTime(),Date.UTC(2026,10,27,12,34));
});
