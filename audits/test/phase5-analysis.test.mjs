import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

test('aggregate audit reproduces known scores and groups league aliases by stable ID',()=>{
  const dir=mkdtempSync(join(tmpdir(),'matchmind-phase5-'));
  try {
    const rows=Array.from({length:40},(_,i)=>({id:String(i),league:141,league_name:i%2?'Segunda Division':'Segunda División',
      issued_at:'2026-09-01T00:00:00Z',kickoff_at:'2026-09-04T00:00:00Z',current_kickoff_at:'2026-09-04T00:00:00Z',label_updated_at:'2026-09-05T00:00:00Z',
      model:[.6,.3,.1],actual:'1',raw_result:'1',used_ft:true,build:100,xg:[1.5,1],
      history_diagnostic:{home:6,away:6,home_lastupdate_proxy:6,away_lastupdate_proxy:6,home_xg_now:3,away_xg_now:3},
      legacy_market_eligible:true,legacy_snapshot:{prices:[2,3.3333333333333335,5],age_hours:1}}));
    const file=join(dir,'synthetic.json');
    writeFileSync(file,JSON.stringify({metadata:{transaction_read_only:'on'},rows}));
    const run=spawnSync(process.execPath,['audits/phase5/analyze.mjs',file],{encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    const out=JSON.parse(run.stdout);
    assert.ok(Math.abs(out.baseline.brier-.26)<1e-12);
    assert.ok(Math.abs(out.baseline.log_loss+Math.log(.6))<1e-12);
    assert.equal(out.paired_competition.length,1);
    assert.equal(out.paired_competition[0].n,40);
    assert.equal(out.market.versus_original_on_market_pairs.n,40);
    assert.ok(out.experiments.every(e=>!('blend' in e.training)));
    assert.ok(!run.stdout.includes('"id":'));
    writeFileSync(file,JSON.stringify({metadata:{transaction_read_only:'on'},rows:[]}));
    const empty=spawnSync(process.execPath,['audits/phase5/analyze.mjs',file],{encoding:'utf8'});
    assert.notEqual(empty.status,0);
    assert.match(empty.stderr,/non-empty read-only cohort/);
  } finally { rmSync(dir,{recursive:true,force:true}); }
});
