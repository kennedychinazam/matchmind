import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {localDatabase,literal} from '../test-support/local-db.mjs';
import {randomUUID} from 'node:crypto';
import {publishedVerdict} from '../lib/independent-grade.mjs';
import {buildAsOfInputs,existingMatchFeatures} from '../lib/asof-features.mjs';
import {shadowForecast} from '../lib/shadow-forecast.mjs';
const contract=await import('../lib/snapshot-contract.mjs');
const db=localDatabase('replay');
before(async()=>{await db.start();for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-hooks.sql'])db.apply(f);});after(()=>db.close());
test('captured database envelope can be replayed without mutable fixture reads or timestamp precision loss',()=>{
 const run=randomUUID(),batch=[];
 for(const [id,fields] of [[456,{lid:39,home:'Alpha',away:'Beta',date:'2099-10-21',time:'18:00',status:'NS',season:2099}],[123,{lid:39,home:'Alpha',away:'Beta',date:'2026-10-18',time:'18:00',status:'FINISHED',gh:2,ga:1}]]) for(const [field,value] of Object.entries(fields)) batch.push({observation_id:randomUUID(),fixture_id:String(id),source_kind:'collector',source_ref:'synthetic',collector_run_id:run,field_name:field,value,availability:'observed',feature_schema_version:1,source_hash:'a'.repeat(64),effective_at_utc:null,played_at_utc:id===123?'2026-10-18T18:00:00Z':null});
 db.sql(`set role research_collector;select research.append_observations(${literal(batch)})`);
 db.sql("set role research_publisher;insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)values(456,39,'2099-10-21','18:00','Alpha','Beta',.5,.3,.2,1.5,1,'1X',.8,355,clock_timestamp(),'Double Chance')");
 const envelope=JSON.parse(db.sql('select envelope from research.prediction_snapshots'));
 const snapshot=contract.snapshotFromCapture(envelope);
 const rows=JSON.parse(db.sql('select json_agg(o) from research.read_snapshot_evidence((select snapshot_id from research.prediction_snapshots)) o'));
 const inputs=buildAsOfInputs({snapshot,observations:rows});
 assert.equal(inputs.league.matches[0].hg,2);
 const candidate=shadowForecast({snapshot,inputs:{...inputs,features:existingMatchFeatures(inputs)},enabled:true});
 assert.deepEqual(candidate.probabilities,[.5,.3,.2]);assert.equal(candidate.pick,'1X');assert.equal(candidate.visibility,'shadow');
 assert.equal(db.sql("select (envelope->>'source_hash')=encode(digest((envelope->'source_prediction')::text,'sha256'),'hex') from research.prediction_snapshots"),'t');
 const before=db.sql('select payload_hash from research.prediction_snapshots');
 db.sql("insert into public.fixtures values(123,'{\"xg_h\":99,\"lineup_h\":{\"xi\":[{\"id\":7}]}}')");
 assert.equal(buildAsOfInputs({snapshot,observations:rows}).league.matches[0]._x.xg_h,undefined);
 assert.equal(db.sql('select payload_hash from research.prediction_snapshots'),before);
});
test('47h59m, 48h and later reschedules preserve original kickoff and current grading behavior',()=>{
 const p={build:355,kickoff:'2026-10-20',ktime:'18:00',pick:'1X'};
 const now=Date.parse('2026-10-24T00:00:00Z');
 for(const [time,voidLate] of [['17:59',false],['18:00',true],['19:00',true]]) {
  const v=publishedVerdict(p,{date:'2026-10-22',time,status:'FINISHED',provider:'af',gh:2,ga:1,ft_h:2,ft_a:1},now,'2026-10-24');
  assert.equal(v.voidLate,voidLate);assert.equal(v.grade,voidLate?null:'hit');
 }
 const unplayed=publishedVerdict(p,{date:'2026-10-22',time:'18:00',status:'NS',provider:'af'},now,'2026-10-24');
 const laterLive=publishedVerdict(p,{date:'2026-10-22',time:'18:00',status:'LIVE',provider:'af'},now,'2026-10-24');
 assert.equal(unplayed.voidLate,true);assert.equal(laterLive.voidLate,false); // Characterize non-monotonic derivation; do not "fix" production.
 assert.equal(p.kickoff,'2026-10-20');assert.equal(p.ktime,'18:00');
});
