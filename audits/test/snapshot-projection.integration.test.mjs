import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {localDatabase} from '../test-support/local-db.mjs';
import {realisticHistory,seedHistory} from '../test-support/history.mjs';
const db=localDatabase('projection');let wideDDL;
before(async()=>{
 await db.start();for(const f of ['bootstrap.sql','snapshot-schema.sql','evidence-manifests.sql','permissions.sql','capture-monitoring.sql','capture-hooks.sql'])db.apply(f);
 const source=execFileSync('git',['show','d4cb3379a3f1d6d0b7252ab134969b33397a5820:audits/staging/evidence-manifests.sql'],{encoding:'utf8'});
 wideDDL=source.slice(source.indexOf('CREATE FUNCTION research.select_m14_evidence('),source.indexOf('CREATE FUNCTION research.read_snapshot_evidence('));
 db.sql(wideDDL.replace('research.select_m14_evidence(','research.wide_reference('));
 seedHistory(db,realisticHistory());db.sql("analyze research.observations;insert into public.predictions(fxid,lid,kickoff,ktime,home,away,p_home,p_draw,p_away,xg_home,xg_away,pick,pick_prob,build,made_at,market)values(999999,39,current_date+1,'18:00','Arsenal','Liverpool',.5,.3,.2,1.5,1,'1X',.8,355,clock_timestamp(),'Double Chance')");
});after(()=>db.close());
function plan(name){const ddl=db.sql(`select pg_get_functiondef('research.${name}(bigint)'::regprocedure)`);const body=ddl.slice(ddl.indexOf('$function$')+10,ddl.lastIndexOf('$function$')).replaceAll('fid','999999');return JSON.parse(db.sql(`set work_mem='4MB';explain(analyze,buffers,format json)${body}`).split('\n').filter(x=>x!=='SET').join('\n'))[0];}
test('materialized selector preserves all IDs while reducing temporary disk writes',()=>{
 assert.equal(db.sql('select research.select_m14_evidence(999999)=research.wide_reference(999999)'),'t');
 const wide=plan('wide_reference'),current=plan('select_m14_evidence');
 assert.ok(wide.Plan['Temp Written Blocks']>0,'reference corpus must exercise the spill');
 assert.ok(current.Plan['Temp Written Blocks']<wide.Plan['Temp Written Blocks'],'current selector must reduce measured temp writes versus the wide reference');
});
test('projection upgrade is repeatable and preserves old snapshot hashes and private permissions',()=>{
 db.sql(wideDDL.replace('CREATE FUNCTION','CREATE OR REPLACE FUNCTION'));
 const before=db.sql('select envelope::text||payload_hash from research.prediction_snapshots');
 db.apply('narrow-selector-upgrade.sql');db.apply('narrow-selector-upgrade.sql');
 assert.equal(db.sql('select envelope::text||payload_hash from research.prediction_snapshots'),before);
 assert.equal(db.sql('select research.select_m14_evidence(999999)=research.wide_reference(999999)'),'t');
 db.apply('narrow-selector-rollback.sql');assert.equal(db.sql('select research.select_m14_evidence(999999)=research.wide_reference(999999)'),'t');assert.equal(db.sql('select envelope::text||payload_hash from research.prediction_snapshots'),before);db.apply('narrow-selector-upgrade.sql');
 for(const role of ['anon','authenticated','research_publisher','research_operator'])assert.throws(()=>db.sql(`set role ${role};select research.select_m14_evidence(999999)`),/permission/);
});
