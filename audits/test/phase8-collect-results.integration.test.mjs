import test,{before,after}from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,readdirSync,rmSync}from 'node:fs';
import {join}from 'node:path';
import {tmpdir}from 'node:os';
import {createHash}from 'node:crypto';
import {setTimeout as sleep}from 'node:timers/promises';
import {localDatabase,docker,IMAGE}from '../test-support/local-db.mjs';
import {repository}from '../phase6/repository.mjs';
import {weekendStore}from '../phase8/store.mjs';
import {parseArguments,collectResults,USAGE}from '../phase8/collect-results.mjs';
import {MODELS}from '../phase8-continuation/contracts.mjs';

const HOUR=3600000,INPUT_HASH='a'.repeat(64);
// Synthetic liability, deliberately not the retained production figure.
const SYNTHETIC_RESERVED=123456;
const iso=ms=>new Date(ms).toISOString();
const fixtureRow=(fxid,kickoffMs,extra)=>({fxid,date:iso(kickoffMs).slice(0,10),time:iso(kickoffMs).slice(11,19),provider:'af',gh:null,ga:null,ft_h:null,ft_a:null,updated_at:iso(Date.now()),...extra});

const db=localDatabase('phase8-collector-source');
let dir,store,kickoffMs,labelKickoffMs,labels,before_events;
before(async()=>{
 docker(['image','inspect',IMAGE]);await db.start();
 for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);
 repository(db).install();store=weekendStore(db);store.install();
 dir=mkdtempSync(join(tmpdir(),'mm-phase8-collector-'));

 // The journal only accepts an issued forecast while its kickoff is still
 // ahead, and the label only settles once its own kickoff has passed. Fixture
 // times are minute-precision, so utcKickoff drops the seconds: a kickoff a few
 // seconds ahead can round back to before the forecast was issued, and the
 // contextual comparison then rejects its own baseline. Anchor the kickoff on a
 // whole minute at least 60 seconds out, where truncation changes nothing, and
 // record the played kickoff two seconds out, far inside the 48-hour tolerance
 // the void rule itself defines.
 // One Saturday job for the same fixture, so the report can separate cohorts.
 kickoffMs=(Math.floor(Date.now()/60000)+2)*60000;labelKickoffMs=Date.now()+2000;
 const ko=iso(kickoffMs),past48=iso(Date.now()-60*HOUR),past30=iso(Date.now()-30*HOUR);
 const satStudy=store.append('study','weekend-2026-10-24',null,{version:'weekend-v1',windows:['2026-10-24','2026-10-25'],kind:'synthetic_verification'});
 const satPacket=store.append('packet','weekend-2026-10-24:packet',satStudy,{synthetic:true,rows:[{fxid:11}]});
 const satJob=store.append('job','sat:11:engine',satPacket,{fixture_id:'11',league:39,window:'2026-10-24',kickoff_at_utc:ko,original:null});
 store.append('forecast','sat:11:engine:E-Refreshed',satJob,{arm:'E-Refreshed',status:'forecast',generated_at_utc:store.receipt(satJob),probabilities:[.45,.3,.25],input_hash:INPUT_HASH,model_version:'Build355-private-openrouter-v1'});

 // The Sunday roster declares four fixtures; only three ever enrol, and only one
 // of those enrols all three model cohorts.
 const roster=[['11',ko],['12',past48],['13',past30],['14',ko]].map(([fixture_id,kickoff_at_utc])=>({fixture_id,league:39,kickoff_at_utc,original:null}));
 const sunStudy=store.append('study','sunday:test',null,{version:'weekend-v1',windows:['2026-10-24','2026-10-25'],experiment:'openrouter-private-v1',roster,kind:'synthetic_verification',models:MODELS});
 const sunPacket=store.append('packet','sunday:test:packet',sunStudy,{synthetic:true,rows:[{fxid:11}],odds:[]});
 const job=(id,tag,kickoff_at_utc)=>store.append('job','sunday:test:'+id+':'+tag,sunPacket,{fixture_id:id,league:39,window:'2026-10-25',cohort:tag==='engine'?'sunday-engine':'sunday-ai',provider_model:tag==='engine'?null:tag==='openai'?MODELS[0]:MODELS[1],kickoff_at_utc,original:null});
 const settled=['engine','openai','kimi'].map(tag=>job('11',tag,ko));
 const voided=job('12','engine',past48),abandoned=job('13','engine',past30);

 // Every arm the supervised runner would have written, and nothing it would not.
 for(const j of [...settled,voided,abandoned])store.append('forecast',j+':E',j,{arm:'E',status:'abstain',reason:'original_context_only'});
 const baseline=j=>store.append('forecast',j+':E-Refreshed',j,{arm:'E-Refreshed',status:'forecast',generated_at_utc:store.receipt(j),probabilities:[.5,.3,.2],input_hash:INPUT_HASH,engine_source_hash:'synthetic',model_version:'Build355-private-openrouter-v1'});
 for(const j of settled)baseline(j);
 store.append('forecast',voided+':E-Refreshed',voided,{arm:'E-Refreshed',status:'failed',reason:'low'});
 store.append('forecast',abandoned+':E-Refreshed',abandoned,{arm:'E-Refreshed',status:'failed',reason:'insufficient_history'});
 const ai=(j,arm,body)=>store.append('forecast',j+':'+arm,j,{arm,model_version:'OpenRouter-private-v1',input_hash:INPUT_HASH,...body});
 ai(settled[1],'A1',{status:'forecast',generated_at_utc:store.receipt(settled[1]),probabilities:[.6,.25,.15]});
 ai(settled[1],'A2',{status:'forecast',generated_at_utc:store.receipt(settled[1]),veto:false});
 ai(settled[1],'A3',{status:'forecast',generated_at_utc:store.receipt(settled[1]),probabilities:[.4,.35,.25]});
 ai(settled[2],'A1',{status:'failed',reason:'provider_or_response_failure'});
 ai(settled[2],'A2',{status:'abstain',reason:'unsupported'});
 // An engine publication exclusion must survive settlement as a failure.
 ai(settled[2],'A3',{status:'failed',reason:'outside_72_hour_window'});
 store.reserve('sunday:test:reservation',settled[0],SYNTHETIC_RESERVED,'b'.repeat(64));

 labels=new Map([
  // Extra time is not the regulation result: 2-1 after extra time, 1-1 at 90.
  ['11',fixtureRow(11,labelKickoffMs,{status:'AET',gh:2,ga:1,ft_h:1,ft_a:1})],
  ['12',fixtureRow(12,Date.parse(past48),{status:'PST'})],
  ['13',fixtureRow(13,Date.parse(past30),{status:'ABD'})]
 ]);
 before_events=store.events().map(e=>e.event_id+'|'+e.event_body_hash).sort();

 const dump=db.dump();
 writeFileSync(join(dir,'private-weekend-backup.sql'),dump);
 writeFileSync(join(dir,'backup.sha256'),createHash('sha256').update(dump).digest('hex')+'\n');
 writeFileSync(join(dir,'study.json'),JSON.stringify({records:[{odds:[]}]}));
 assert.ok(Date.now()<kickoffMs,'journal build exceeded its kickoff headroom');
 while(Date.now()<labelKickoffMs+1000)await sleep(250);
});
after(()=>{db.close();if(dir)rmSync(dir,{recursive:true,force:true});});

const read=(table,parameters)=>{
 assert.equal(table,'fixtures');assert.match(String(parameters.fxid),/^in\./);
 return{rows:[...labels.values()],total:labels.size,received_at_utc:new Date().toISOString()};
};
const round6=x=>Math.round(x*1e6)/1e6;

test('the command line contract keeps its arguments, defaults and refusals',()=>{
 assert.deepEqual(parseArguments(['node','collect-results.mjs','/private/run']),{dir:'/private/run',backup:'private-weekend-backup.sql',checksum:'backup.sha256'});
 assert.deepEqual(parseArguments(['node','collect-results.mjs','/private/run','prior.sql','prior.sha256']),{dir:'/private/run',backup:'prior.sql',checksum:'prior.sha256'});
 for(const argv of [['node','c'],['node','c','relative/path'],['node','c','/private/run','only-one-extra']])assert.throws(()=>parseArguments(argv),{message:USAGE});
});

test('collection settles the real workflow on regulation time and keeps the declared roster whole',async()=>{
 const out=await collectResults({dir,backup:'private-weekend-backup.sql',checksum:'backup.sha256'},{read,label:'phase8-collector-run'});
 assert.equal(out.mode,'continuation');assert.equal(out.accuracy_claim,false);
 assert.deepEqual(out.roster,{saturday:1,sunday:4});

 const written=readdirSync(dir).sort(),cycle=out.cycle;
 for(const name of ['study-'+cycle+'.json','report-'+cycle+'.json','private-weekend-backup-'+cycle+'.sql','backup-'+cycle+'.sha256'])assert.equal(written.includes(name),true,name+' absent');
 const study=JSON.parse(readFileSync(join(dir,'study-'+cycle+'.json'),'utf8')),report=JSON.parse(readFileSync(join(dir,'report-'+cycle+'.json'),'utf8'));
 const nextDump=readFileSync(join(dir,'private-weekend-backup-'+cycle+'.sql'),'utf8');
 assert.equal(readFileSync(join(dir,'backup-'+cycle+'.sha256'),'utf8').trim(),createHash('sha256').update(nextDump).digest('hex'));

 // Assert in dependency order: the fixture must settle before anything scored
 // from it means anything, so a broken link names itself.
 const settledRow=study.records.find(r=>r.job_id==='sunday:test:11:engine');
 assert.equal(settledRow.labels.length,1);
 assert.equal(settledRow.labels[0].fixture.status,'AET');
 const issued=settledRow.forecasts.find(f=>f.arm==='E-Refreshed');
 assert.equal(issued.status,'forecast',issued.reason??'baseline was downgraded');

 // Regulation time decides it: Brier 0.78 is [.5,.3,.2] against a draw. The
 // extra-time home win would have scored 0.38.
 assert.equal(report.sunday.arms['E-Refreshed'].n,1);
 assert.equal(round6(report.sunday.arms['E-Refreshed'].brier),0.78);
 assert.equal(report.sunday.arms.E.n,0);
 assert.equal(report.sunday.arms.E.abstained,3);

 // Postponed beyond 48 hours voids; abandoned inside 48 hours stays pending,
 // and the fixture that never enrolled stays pending too.
 assert.equal(report.sunday.coverage.void,1);
 assert.equal(report.sunday.coverage.pending,2);

 // Saturday and Sunday stay separate cohorts over the same fixture.
 assert.equal(report.saturday.coverage.roster,1);
 assert.equal(report.sunday.coverage.roster,4);
 const satIssued=study.records.find(r=>r.job_id==='sat:11:engine').forecasts.find(f=>f.arm==='E-Refreshed');
 assert.equal(satIssued.status,'forecast',satIssued.reason??'Saturday baseline was downgraded');
 assert.equal(report.saturday_vs_sunday.n,1);

 // Each AI arm is attributed to its own model and scored on its own numbers.
 const openai=report.models[MODELS[0]],kimi=report.models[MODELS[1]];
 assert.equal(openai.coverage.roster,4);assert.equal(kimi.coverage.roster,4);
 assert.equal(openai.arms.A1.n,1);assert.equal(round6(openai.arms.A1.brier),0.945);
 assert.equal(openai.arms.A3.n,1);assert.equal(round6(openai.arms.A3.brier),0.645);
 assert.equal(openai.arms.A2.n,1);assert.equal(round6(openai.arms.A2.brier),0.78);
 assert.equal(openai.arms.A2.vetoed,0);assert.equal(openai.arms.A1.failed,3);
 // Three of the four kimi slots never enrolled; the enrolled one failed or abstained.
 assert.equal(kimi.arms.A1.failed,4);assert.equal(kimi.arms.A3.failed,4);
 assert.equal(kimi.arms.A2.abstained,1);assert.equal(kimi.arms.A2.failed,3);
 assert.equal(kimi.arms.A1.n,0);assert.equal(kimi.arms.A3.n,0);

 // The engine's own publication exclusion survives as a failure reason.
 const reasons=study.records.flatMap(r=>r.forecasts.map(f=>f.reason));
 assert.equal(reasons.includes('outside_72_hour_window'),true);

 // Seven declared cohort slots never enrolled and carry no invented time.
 const missing=study.records.filter(r=>r.missing_enrollment);
 assert.equal(missing.length,7);
 assert.equal(missing.some(r=>r.forecasts.some(f=>f.generated_at_utc||f.probabilities)),false);
 assert.equal(missing.every(r=>r.forecasts.every(f=>f.status==='failed')),true);
 assert.equal(study.records.length,13);

 // No arm invents a result, a probability or a receipt for an unissued forecast.
 for(const row of study.records)for(const f of row.forecasts){
  if(f.status==='forecast')assert.equal(typeof f.generated_at_utc,'string',row.job_id+':'+f.arm);
  else assert.equal(f.probabilities,undefined,row.job_id+':'+f.arm);
 }

 // The ledger is reported, never altered, and no spending is claimed.
 assert.equal(report.reserved_liability_usd,SYNTHETIC_RESERVED/1000000);
 assert.equal(report.actual_ai_spend_usd,null);
 assert.equal(report.accuracy_claim,false);

 // The next checkpoint adds labels only: every prior event keeps its hash.
 db.sql('create database matchmind_verify');db.sql(nextDump,'matchmind_verify');
 const verified=weekendStore({name:db.name,sql:s=>db.sql(s,'matchmind_verify')});
 const after_events=verified.events();
 assert.deepEqual(after_events.filter(e=>e.kind!=='label').map(e=>e.event_id+'|'+e.event_body_hash).sort(),before_events);
 assert.equal(after_events.filter(e=>e.kind==='label').length,6);
 assert.equal(verified.reservedMicros(),SYNTHETIC_RESERVED);
});

test('collection refuses a corrupted, missing or unreadable private recovery input',async()=>{
 const bad=mkdtempSync(join(tmpdir(),'mm-phase8-collector-bad-'));
 try{
  const dump=readFileSync(join(dir,'private-weekend-backup.sql'),'utf8');
  writeFileSync(join(bad,'study.json'),JSON.stringify({records:[]}));
  writeFileSync(join(bad,'private-weekend-backup.sql'),dump);
  writeFileSync(join(bad,'backup.sha256'),'c'.repeat(64)+'\n');
  await assert.rejects(()=>collectResults({dir:bad,backup:'private-weekend-backup.sql',checksum:'backup.sha256'},{read}),/hash mismatch/);
  rmSync(join(bad,'study.json'));
  writeFileSync(join(bad,'backup.sha256'),createHash('sha256').update(dump).digest('hex')+'\n');
  await assert.rejects(()=>collectResults({dir:bad,backup:'private-weekend-backup.sql',checksum:'backup.sha256'},{read}),/ENOENT|study\.json/);
  writeFileSync(join(bad,'study.json'),JSON.stringify({records:[]}));
  await assert.rejects(()=>collectResults({dir:bad,backup:'../escape.sql',checksum:'backup.sha256'},{read}),/backup basename/);
  rmSync(join(bad,'private-weekend-backup.sql'));
  await assert.rejects(()=>collectResults({dir:bad,backup:'private-weekend-backup.sql',checksum:'backup.sha256'},{read}),/ENOENT/);
 }finally{rmSync(bad,{recursive:true,force:true});}
});
