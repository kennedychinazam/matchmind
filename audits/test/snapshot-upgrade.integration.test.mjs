import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {localDatabase} from '../test-support/local-db.mjs';
test('additive review migrations preserve legacy snapshots, source records and hashes',async()=>{
 const db=localDatabase('upgrade');try{
  await db.start();db.apply('bootstrap.sql');
  for(const f of ['snapshot-schema.sql','permissions.sql','capture-hooks.sql']) db.sql(execFileSync('git',['show',`33ee6710af7b74d093f768ed4a0bc83fb3644975:audits/staging/${f}`],{encoding:'utf8'}));
  function publish(id){db.sql(`set role research_publisher;insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)values(${id},39,(now()at time zone 'UTC')::date+1,'18:00','Alpha','Beta',.5,.3,.2,1.5,1,'1X',.8,355,clock_timestamp(),'Double Chance')`);}
  publish(601);
  const original=db.sql('select row_to_json(p)from public.predictions p where fxid=601');
  const hash=db.sql('select payload_hash from research.prediction_snapshots');
  const envelope=db.sql('select envelope from research.prediction_snapshots');
  for(const f of ['evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);
  assert.equal(db.sql('select payload_hash from research.prediction_snapshots'),hash);
  assert.equal(db.sql('select envelope from research.prediction_snapshots'),envelope);
  assert.equal(db.sql('select row_to_json(p)from public.predictions p where fxid=601'),original);
  assert.equal(db.sql('select evidence_manifest_id is null from research.prediction_snapshots'),'t');
  assert.equal(db.sql('select count(*)from research.read_snapshot_evidence((select snapshot_id from research.prediction_snapshots))'),'0');
  publish(602);
  assert.equal(db.sql('select evidence_manifest_id is not null from research.prediction_snapshots where fixture_id=602'),'t');
  const repaired=JSON.parse(db.sql('set role research_operator;select research.try_capture_prediction(601)').split('\n').at(-1));
  assert.ok(repaired.snapshot_id);assert.equal(repaired.error,null);
  assert.equal(db.sql('select count(*)from research.prediction_snapshots'),'2');
  assert.throws(()=>db.sql('set role research_publisher;select research.capture_prediction(601)'),/permission/);
 }finally{db.close();}
});
