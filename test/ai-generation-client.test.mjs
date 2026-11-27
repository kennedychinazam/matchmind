// Actual proxy functions, synthetic sessions/responses only. No browser, account or provider calls.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const source=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const start=source.indexOf('async function callProxy('),end=source.indexOf('// Ask the server which providers',start);
const code=source.slice(start,end),day=new Date().toISOString().slice(0,10);
function setup(options={}){
 const calls=[],credential={owner:options.owner??'ownerA',epoch:options.epoch??1};let releaseSession,releaseQueue,releaseReply;
 const session=new Promise(r=>releaseSession=r),queue=new Promise(r=>releaseQueue=r),reply=new Promise(r=>releaseReply=r);
 const c={AI_PROMPT:'Fixed client brief: ',SUPA_URL:'https://synthetic.invalid',SUPA_KEY:'synthetic-public',pendingMetaFxid:901,aiQuota:options.quota??null,Date,JSON,Object,Number,Error,
 credentialContext:()=>credential,credentialCheck:who=>{if(who.owner!==c.owner||who.epoch!==c.epoch)throw Error('Credential context changed');},owner:credential.owner,epoch:credential.epoch,
 proxySession:()=>options.waitSession?session:Promise.resolve({user:{id:credential.owner},access_token:'synthetic-only'}),aiQueued:async fn=>{if(options.waitQueue)await queue;return fn();},
 fetch:async(url,init)=>{assert.equal(url,'https://synthetic.invalid/functions/v1/ai-analyze');calls.push(JSON.parse(init.body));if(options.waitReply)await reply;const value=options.response??{ok:true,text:'Synthetic report',fxid:901,used:1,limit:5,quota_day:day};return{ok:options.ok!==false,status:options.status??200,json:async()=>value};}};
 runInNewContext(code,c);
 return{c,calls,credential,releaseSession:()=>releaseSession({user:{id:'ownerA'},access_token:'synthetic-only'}),releaseQueue,releaseReply};
}
test('queued proxy captures the original fixture before the first await and sends immutable body',async()=>{const s=setup({waitSession:true,waitQueue:true}),pending=s.c.callProxy('original model output','gemini',s.credential);s.c.pendingMetaFxid=902;s.releaseSession();await Promise.resolve();s.c.pendingMetaFxid=903;s.releaseQueue();await pending;assert.equal(s.calls[0].fxid,901);assert.equal(s.calls[0].prompt,'Fixed client brief: original model output');});
test('credential switch before dispatch sends no request and cannot merge another owner quota',async()=>{const s=setup({waitSession:true}),pending=s.c.callProxy('x','gemini',s.credential);s.c.owner='ownerB';s.c.epoch=2;s.c.aiQuota={used:2,limit:5,day};s.releaseSession();await assert.rejects(pending,/Credential/);assert.equal(s.calls.length,0);assert.equal(s.c.aiQuota.used,2);});
test('credential switch while reply is pending cannot overwrite the new owner quota',async()=>{const s=setup({waitReply:true}),pending=s.c.callProxy('x','gemini',s.credential);for(let i=0;!s.calls.length&&i<20;i++)await Promise.resolve();assert.equal(s.calls.length,1);s.c.owner='ownerB';s.c.epoch=2;s.c.aiQuota={used:3,limit:5,day};s.releaseReply();await assert.rejects(pending,/Credential/);assert.equal(s.c.aiQuota.used,3);});
test('retained allocation error updates current owner usage before reporting failure',async()=>{const s=setup({ok:false,status:502,response:{ok:false,allocationRetained:true,used:5,limit:5,quota_day:day}});await assert.rejects(s.c.callProxy('x','gemini',s.credential),/still counts toward the daily allowance/);assert.equal(s.c.aiQuota.used,5);assert.equal(s.c.aiQuota.day,day);});
test('discovery replaces stale-day counters and failed verification clears the scoped counter',async()=>{const s=setup({quota:{used:9,limit:10,day:'2000-01-01'},response:{ok:true,providers:[],used:0,limit:5,quota_day:day}});await s.c.callProxy(null,null,s.credential);assert.deepEqual(s.calls[0],{});assert.equal(s.c.aiQuota.used,0);s.c.mergeQuota({used:8,limit:10,quota_day:'2000-01-01'});assert.equal(s.c.aiQuota.used,0);s.c.mergeQuota({clearQuota:true});assert.equal(s.c.aiQuota,null);});
test('malformed quota fields cannot inject NaN or text, and returned fixture identity is checked',async()=>{const s=setup({quota:{used:2,limit:5,day},response:{ok:true,fxid:902,used:'NaN',limit:-1,quota_day:day}});await assert.rejects(s.c.callProxy('x','gemini',s.credential),/different fixture/);assert.equal(s.c.aiQuota.used,2);assert.equal(s.c.aiQuota.limit,5);});
test('caption distinguishes authoritative shared facts from private/legacy engine input',()=>{const begin=source.indexOf('function aiWriterBasis('),end=source.indexOf('\nfunction renderAISettings',begin),c={};runInNewContext(source.slice(begin,end),c);assert.equal(c.aiWriterBasis({sourceScope:'shared'}),'verified fixture data');assert.equal(c.aiWriterBasis({sourceScope:'private'}),'the engine output above');assert.equal(c.aiWriterBasis({}),'the engine output above');});


test('new account provider discovery cannot inherit another account counter when used is omitted',async()=>{
 const s=setup({owner:'ownerB',epoch:2,quota:{used:4,limit:5,day,owner:'ownerA',epoch:1},response:{ok:true,providers:[],limit:5}});
 await s.c.callProxy(null,null,s.credential);assert.equal(s.c.aiQuota.used,null);assert.equal(s.c.aiQuota.owner,'ownerB');assert.equal(s.c.aiQuota.epoch,2);
});

test('a successful response for another fixture cannot mutate quota before identity rejection',async()=>{
 const s=setup({quota:{used:2,limit:5,day,owner:'ownerA',epoch:1},response:{ok:true,fxid:902,used:5,limit:5,quota_day:day}});
 await assert.rejects(s.c.callProxy('x','gemini',s.credential),/different fixture/);assert.equal(s.c.aiQuota.used,2);
});


test('quota note suppresses another account and unknown usage instead of inventing zero',()=>{
 const begin=source.indexOf('function quotaNote('),end=source.indexOf('function aiWriterBasis(',begin),c={Date,aiQuota:{used:4,limit:5,day,owner:'ownerA',epoch:1},credentialContext:()=>({owner:'ownerB',epoch:2})};
 runInNewContext(source.slice(begin,end),c);assert.equal(c.quotaNote('server'),'');c.aiQuota={used:null,limit:5,day,owner:'ownerB',epoch:2};assert.equal(c.quotaNote('server'),'');c.aiQuota.used=0;assert.match(c.quotaNote('server'),/0 of 5/);
});

for(const flag of ['inProgress','allocationRetained'])test('known '+flag+' cannot silently trigger a personal-key second generation',async()=>{
 let ownCalls=0;const cred={owner:'ownerA',epoch:1},c={PERSONAL_PROVIDER_INPUTS_ENABLED:true,aiKeys:{gemini:'synthetic-only'},supa:{},credentialContext:()=>cred,credentialCheck:()=>{},aiProviderById:()=>({name:'Synthetic',run:async()=>{ownCalls++;return'Synthetic private output';}}),callProxy:async()=>{throw Object.assign(Error('Known server state'),{[flag]:true});},$:()=>({checked:true})};
 const begin=source.indexOf('async function runAIWriter('),end=source.indexOf('function syncAIKeyField(',begin);runInNewContext(source.slice(begin,end),c);await assert.rejects(c.runAIWriter('gemini','synthetic',cred),/Known server state/);assert.equal(ownCalls,0);
});

test('known quota refusal can still use explicitly enabled personal-key fallback',async()=>{
 let ownCalls=0;const cred={owner:'ownerA',epoch:1},c={PERSONAL_PROVIDER_INPUTS_ENABLED:true,aiKeys:{gemini:'synthetic-only'},supa:{},credentialContext:()=>cred,credentialCheck:()=>{},aiProviderById:()=>({name:'Synthetic',run:async()=>{ownCalls++;return'Synthetic private output';}}),callProxy:async()=>{throw Object.assign(Error('Known quota refusal'),{quotaExceeded:true});},$:()=>({checked:true})};
 const begin=source.indexOf('async function runAIWriter('),end=source.indexOf('function syncAIKeyField(',begin);runInNewContext(source.slice(begin,end),c);assert.equal((await c.runAIWriter('gemini','synthetic',cred)).via,'own');assert.equal(ownCalls,1);
});


test('proxy preserves known pending and retained flags without exposing raw server errors',async()=>{
 for(const flag of ['inProgress','allocationRetained']){const s=setup({ok:false,status:409,response:{ok:false,[flag]:true,error:'RAW internal detail',used:1,limit:5,quota_day:day}});await assert.rejects(s.c.callProxy('x','gemini',s.credential),e=>e[flag]===true&&!e.message.includes('RAW'));}
});


test('deleting owner cannot start proxy work or a personal-key fallback',async()=>{
 const s=setup();s.c.accountDeletionBlocked=()=>true;await assert.rejects(s.c.callProxy('x','gemini',s.credential),e=>e.inProgress===true);assert.equal(s.calls.length,0);
});
test('deletion intent added while proxy is queued prevents later dispatch',async()=>{
 const s=setup({waitQueue:true});s.c.accountDeletionBlocked=()=>false;const work=s.c.callProxy('x','gemini',s.credential);await Promise.resolve();s.c.accountDeletionBlocked=()=>true;s.releaseQueue();await assert.rejects(work,e=>e.inProgress===true);assert.equal(s.calls.length,0);
});
test('another owner deletion intent cannot block current owner proxy',async()=>{
 const s=setup();s.c.accountDeletionBlocked=owner=>owner==='ownerB';await s.c.callProxy('x','gemini',s.credential);assert.equal(s.calls.length,1);
});
