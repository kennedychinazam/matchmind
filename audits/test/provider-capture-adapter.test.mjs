import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,mkdtempSync,readFileSync,writeFileSync,rmSync,statSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
const api=existsSync(new URL('../source-provenance/provider-adapter.mjs',import.meta.url))?await import('../source-provenance/provider-adapter.mjs'):{};
const ids=[788036,788048,788038];
const meta=()=>({request_id:'synthetic-pilot-001',request_started_at_utc:'2026-10-29T01:00:00Z',response_received_at_utc:'2026-10-29T01:00:01Z',collector_sha256:'a'.repeat(64)});
const normalized=()=>ids.map((id,i)=>({fxid:id,lid:81,season:2021,date:'2021-10-26',time:'18:45',lname:'Synthetic Cup',lcountry:'Synthetic Country',home:'Home '+i,away:'Away '+i,status:'FINISHED',gh:i+1,ga:i,ht_h:0,ht_a:0,ft_h:i+1,ft_a:i,provider:'af'}));
const fixture=(id,i)=>({fixture:{id,date:'2021-10-26T18:45:00Z',status:{short:['FT','AET','PEN'][i],long:'Synthetic finished status',elapsed:120,extra:null}},league:{id:81,name:'Synthetic Cup',country:'Synthetic Country',season:2021},teams:{home:{id:10+i*2,name:'Home '+i},away:{id:11+i*2,name:'Away '+i}},goals:{home:i+1,away:i},score:{halftime:{home:0,away:0},fulltime:{home:i+1,away:i},extratime:{home:null,away:null},penalty:{home:null,away:null}}});
const body=(rows=ids.map(fixture))=>Buffer.from(' \n'+JSON.stringify({get:'fixtures',parameters:{ids:'788036-788048-788038'},errors:[],results:rows.length,paging:{current:1,total:1},response:rows})+'\n');
const response=(bytes=body())=>({status:200,headers:{'content-type':'application/json; charset=utf-8','x-ratelimit-requests-limit':'75000','x-ratelimit-requests-remaining':'70000','x-ratelimit-limit':'450','x-ratelimit-remaining':'449'},body:bytes,body_complete:true,content_decoding:{mode:'none',encoding:'identity'}});
const capture=(r=response(),m=meta())=>api.createSyntheticSession().captureFixture(r,m);
test('isolated simulated capture API exists',()=>{
 for(const name of ['pilotPlan','createSyntheticSession','analyzeCapture','writeAdapterCapture','readAdapterCapture','executeRealTransport'])assert.equal(typeof api[name],'function');
});
test('copies exact received bytes before decoding; metadata and receipt hashes bind replay',()=>{
 const bytes=body(),copy=Buffer.from(bytes),c=capture(response(bytes)); bytes[0]=0x78;
 assert.deepEqual(c.bytes,copy);assert.equal(c.manifest.raw_length,copy.length);assert.equal(c.manifest.raw_sha256,createHash('sha256').update(copy).digest('hex'));
 assert.equal(c.manifest.response.headers['content-type'],'application/json; charset=utf-8');
 assert.equal(c.manifest.classification,'synthetic_only');assert.equal(c.manifest.request.query.ids,'788036-788048-788038');
 const a=api.analyzeCapture(c,normalized());assert.equal(a.inventory_complete,true);assert.deepEqual(a.originals.map(x=>x.status.short),['FT','AET','PEN']);
 assert.deepEqual(a.originals[1].status,{short:'AET',long:'Synthetic finished status',elapsed:120,extra:null});
 assert.equal(a.reconciliation.records.every(x=>x.classification==='period-unverified'),true);assert.equal(a.source_review_admissible,false);
 assert.deepEqual(a,api.analyzeCapture(c,normalized()));assert.equal(JSON.stringify(a).includes('75000'),false);
});
test('null, absent fields and every score component remain distinct in raw and projection',()=>{
 const rows=ids.map(fixture);delete rows[1].score.extratime.home;delete rows[2].score.penalty;delete rows[0].fixture.status.extra;rows[0].score.halftime=null;
 const c=capture(response(body(rows))),a=api.analyzeCapture(c,normalized());
 assert.equal(a.originals[0].score.halftime,null);assert.equal(Object.hasOwn(a.originals[0].status,'extra'),false);
 assert.equal(Object.hasOwn(a.originals[1].score.extratime,'home'),false);assert.equal(a.originals[1].score.extratime.away,null);assert.equal(Object.hasOwn(a.originals[2].score,'penalty'),false);
 assert.deepEqual(c.bytes,body(rows));assert.equal(a.reconciliation.records[0].classification,'conflicting');
});
test('failed, partial, redirected, malformed and binary bodies preserved without a success claim',()=>{
 for(const r of [Object.assign(response(),{status:429}),Object.assign(response(),{status:302}),Object.assign(response(),{body_complete:false}),response(Buffer.from([255,254])),response(Buffer.from('{')),Object.assign(response(Buffer.from('denied')),{status:403,headers:{'content-type':'text/plain'}})]){
  const c=capture(r),a=api.analyzeCapture(c,normalized());assert.deepEqual(c.bytes,r.body);assert.equal(a.inventory_complete,false);assert.equal(a.reconciliation.records.every(x=>x.classification==='incomplete'),true);assert.equal(a.originals.length,0);
 }
 const r=response();r.headers['content-length']='1';assert.equal(api.analyzeCapture(capture(r),normalized()).inventory_complete,false);
});
test('automatic decoding is recorded, not falsely compared with compressed content length',()=>{
 const r=response();r.headers['content-encoding']='gzip';r.headers['content-length']='99';r.content_decoding={mode:'automatic',encoding:'gzip'};
 const c=capture(r);assert.deepEqual(c.manifest.response.content_decoding,{mode:'automatic',encoding:'gzip'});assert.equal(api.analyzeCapture(c,normalized()).inventory_complete,true);
 r.content_decoding={mode:'unknown',encoding:'gzip'};assert.equal(api.analyzeCapture(capture(r),normalized()).inventory_complete,false);
});
test('missing, duplicate, unexpected IDs, API errors, query mismatch and pages cannot complete inventory',()=>{
 for(const change of [b=>b.response.pop(),b=>b.response.push(b.response[0]),b=>b.response[0].fixture.id=123,b=>b.errors={key:'synthetic-private-sentinel'},b=>b.parameters.ids='788036',b=>b.paging.total=2,b=>b.response[0].fixture.status.elapsed='120']){
  const b=JSON.parse(body());change(b);const c=capture(response(Buffer.from(JSON.stringify(b)))),a=api.analyzeCapture(c,normalized());assert.equal(a.inventory_complete,false);assert.equal(a.reconciliation.records.every(r=>r.classification==='incomplete'),true);assert.equal(JSON.stringify(a).includes('synthetic-private-sentinel'),false);
 }
});
test('closed metadata rejects credentials, wrong clocks and fake authority without executing getters',()=>{
 for(const change of [m=>m.api_key='synthetic-secret',m=>m.director_approved=true,m=>m.collector_sha256='abc',m=>m.request_id='Bearer secret',m=>m.response_received_at_utc='2026-10-28T01:00:00Z',m=>m.request_started_at_utc='2026-10-29T01:00:00+01:00']){const m=meta();change(m);assert.throws(()=>capture(response(),m));}
 let reads=0;const r=response();Object.defineProperty(r,'status',{get(){reads++;return 200;},enumerable:true});assert.throws(()=>capture(r));assert.equal(reads,0);
 for(const header of ['authorization','x-apisports-key','set-cookie','x-api-token']){const r=response();r.headers[header]='synthetic-secret';assert.throws(()=>capture(r));}
 for(const change of [r=>r.redirected=true,r=>r.content_decoding.mode='automatic',r=>r.headers['x-ratelimit-limit']='Bearer secret',r=>r.headers['content-length']='-1',r=>r.status=99,r=>r.body_complete='true',r=>r.content_decoding={mode:'none',encoding:'gzip'}]){const r=response();change(r);assert.throws(()=>capture(r));}
});
test('one fixture attempt is consumed even for invalid or failed response; metadata cap separate',()=>{
 const s=api.createSyntheticSession();assert.throws(()=>s.captureFixture({...response(),body:null},meta()));assert.throws(()=>s.captureFixture(response(),meta()),/attempt_exhausted/);
 const m=s.captureStatus(response(Buffer.from('{"response":[]}')),meta());assert.equal(m.manifest.request.endpoint,'/status');assert.throws(()=>s.captureStatus(response(),meta()),/attempt_exhausted/);
 const failed=api.createSyntheticSession();failed.captureFixture({...response(),status:429},meta());assert.throws(()=>failed.captureFixture(response(),meta()),/attempt_exhausted/);
 assert.throws(()=>api.executeRealTransport({director_approved:true,fetch:()=>assert.fail('no callback')}),/disabled/);
 const p=api.pilotPlan();assert.equal(p.real_transport_enabled,false);assert.equal(p.fixture_request.max_attempts,1);assert.equal(p.status_metadata_request.max_attempts,1);assert.equal(p.fixture_request.redirect,'error');
});
test('tampering and incomplete required inventory cannot be reconciled as valid',()=>{
 const c=capture();assert.throws(()=>api.analyzeCapture({...c,bytes:Buffer.from('changed')},normalized()));
 const m=structuredClone(c.manifest);m.response.status=201;assert.throws(()=>api.analyzeCapture({...c,manifest:m},normalized()));
 assert.throws(()=>api.analyzeCapture(c,normalized().slice(1)));assert.throws(()=>api.analyzeCapture(c,[normalized()[0],normalized()[0],normalized()[2]]));
 const old=normalized(),before=JSON.stringify(old);api.analyzeCapture(c,old);assert.equal(JSON.stringify(old),before);
});
test('HTTP Partial Content cannot certify inventory even when the injected complete flag is true',()=>{
 const c=capture({...response(),status:206}),a=api.analyzeCapture(c,normalized());
 assert.equal(c.manifest.response.status,206);assert.equal(a.inventory_complete,false);assert.equal(a.reconciliation.records.every(r=>r.classification==='incomplete'),true);
});
test('every reconciliation observation resolves to the retained adapter receipt, including success',()=>{
 const c=capture(),a=api.analyzeCapture(c,normalized());
 for(const r of a.reconciliation.records)for(const o of r.observations)assert.equal(o.capture_hash,c.manifest.capture_hash);
});
test('persistence is exclusive, private, readback verified and refuses file/directory symlinks',()=>{
 const root=mkdtempSync(join(tmpdir(),'mm-capture-adapter-'));try{
  const dir=join(root,'capture'),c=capture();
  if(process.platform==='win32'){assert.throws(()=>api.writeAdapterCapture(dir,c),/posix_private_persistence_required/);assert.equal(existsSync(dir),false);return;}
  api.writeAdapterCapture(dir,c);assert.deepEqual(api.readAdapterCapture(dir).manifest,c.manifest);assert.deepEqual(readFileSync(join(dir,'response.bin')),c.bytes);
  assert.equal(statSync(dir).mode&0o777,0o700);for(const f of ['response.bin','manifest.json'])assert.equal(statSync(join(dir,f)).mode&0o777,0o600);
  assert.throws(()=>api.writeAdapterCapture(dir,c));const link=join(root,'link');symlinkSync(dir,link,'dir');assert.throws(()=>api.readAdapterCapture(link));
  writeFileSync(join(dir,'response.bin'),'changed');assert.throws(()=>api.readAdapterCapture(dir));
  const d2=join(root,'capture2');api.writeAdapterCapture(d2,c);rmSync(join(d2,'response.bin'));symlinkSync(join(dir,'response.bin'),join(d2,'response.bin'));assert.throws(()=>api.readAdapterCapture(d2));
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('nonregular stored files fail promptly rather than waiting for a FIFO writer',()=>{
 if(process.platform==='win32'){assert.throws(()=>api.writeAdapterCapture(join(tmpdir(),'not-created'),capture()),/posix_private_persistence_required/);return;}
 const root=mkdtempSync(join(tmpdir(),'mm-capture-fifo-'));try{
  const dir=join(root,'capture');api.writeAdapterCapture(dir,capture());rmSync(join(dir,'response.bin'));execFileSync('mkfifo',[join(dir,'response.bin')]);
  const script=`import {readAdapterCapture} from ${JSON.stringify(new URL('../source-provenance/provider-adapter.mjs',import.meta.url).href)};try{readAdapterCapture(${JSON.stringify(dir)});process.exit(9);}catch{process.exit(0);}`;
  const child=spawnSync(process.execPath,['--input-type=module','-e',script],{timeout:1500});assert.equal(child.status,0);assert.equal(child.error,undefined);
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('an unrecognized provider status code quarantines the response and keeps its bytes',()=>{
 // The inherited prototype validates only the character pattern of status.short,
 // so a syntactically safe but unknown code reached the review projection and
 // still reported complete inventory, while PROVIDER-ADAPTER.md says invalid
 // status quarantines the response. The two disagreed.
 assert.equal(typeof api.STATUS_VOCABULARY,'object');
 assert.equal(api.STATUS_VOCABULARY.version,'matchmind-build355-status-v1');
 assert.equal(api.STATUS_VOCABULARY.codes.includes('ZZZ'),false);
 for(const codes of [['ZZZ','ZZZ','ZZZ'],['FT','ZZZ','PEN'],['FT','AET','ZZ9']]){
  const rows=ids.map(fixture);rows.forEach((r,i)=>{r.fixture.status.short=codes[i];});
  const bytes=body(rows),c=capture(response(bytes)),a=api.analyzeCapture(c,normalized());
  const unknown=codes.find(x=>!api.STATUS_VOCABULARY.codes.includes(x));
  assert.deepEqual(c.bytes,bytes,'exact received bytes are preserved');
  assert.equal(c.bytes.includes(Buffer.from(unknown)),true,'the raw unknown code stays in the bytes');
  assert.equal(c.manifest.raw_sha256,createHash('sha256').update(bytes).digest('hex'),'the hash still binds the original bytes');
  assert.equal(a.inventory_complete,false,codes.join('/')+' must not complete inventory');
  assert.equal(a.source_review_admissible,false);
  assert.equal(a.originals.length,0,'no unknown status reaches the review projection');
  assert.equal(a.reconciliation.records.every(r=>r.classification==='incomplete'),true);
  assert.equal(a.reconciliation.records.every(r=>r.reasons.includes('unrecognized_provider_status')),true);
 }
 // The accepted codes are unchanged, including non-final ones, so the correction
 // narrows nothing beyond the unknown case.
 for(const codes of [['FT','AET','PEN'],['FT','PST','ABD'],['NS','TBD','WO']]){
  const rows=ids.map(fixture);rows.forEach((r,i)=>{r.fixture.status.short=codes[i];});
  const a=api.analyzeCapture(capture(response(body(rows))),normalized());
  assert.equal(a.inventory_complete,true,codes.join('/')+' are recognized provider codes');
  assert.deepEqual(a.originals.map(x=>x.status.short),codes);
  assert.equal(a.source_review_admissible,false,'admission stays false regardless');
 }
});
test('oversize bodies and native response callbacks are rejected without decoding or reading',()=>{
 assert.throws(()=>capture(response(Buffer.alloc(16777217))),/body_size/);
 let reads=0;const r=response();r.body={arrayBuffer(){reads++;throw Error('must not read');}};assert.throws(()=>capture(r),/inert_bytes/);assert.equal(reads,0);
});
