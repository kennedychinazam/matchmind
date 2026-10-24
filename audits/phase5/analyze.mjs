// Offline aggregate-only analysis. No network clients, credentials, writes or provider calls.
// Run with a private JSON export from 011_readonly_cohort.sql; stdout contains aggregates.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { probabilityScore, fairMarket } from '../lib/bookmaker-metrics.mjs';
import { paired, calibration, fitCandidates, transform, blend, wilson } from './validation.mjs';
import { loadSavedLambdaGrid } from './saved-lambda.mjs';

const sha = s=>createHash('sha256').update(s).digest('hex');
const bytes = readFileSync(process.argv[2]);
const input = JSON.parse(bytes);
if (input.metadata?.transaction_read_only !== 'on' || !Array.isArray(input.rows) || !input.rows.length) throw new Error('require non-empty read-only cohort export');
const rows = input.rows.map(r=>{
  const market = r.legacy_market_eligible ? fairMarket(Object.fromEntries(['h','d','a'].map((k,i)=>[k,r.legacy_snapshot.prices[i]])))?.probabilities : null;
  if (r.legacy_market_eligible && !market) throw new Error('invalid legacy market');
  return {...r,market};
});
// Validate all saved probabilities/outcomes, uniqueness, and clustering columns.
paired(rows,r=>r.model,r=>r.model,{draws:10});
const pairedRows = rows.filter(r=>r.market);
const avg = xs=>xs.length ? xs.reduce((a,b)=>a+b,0)/xs.length : null;
const cls = ['1','X','2'];
const top = p=>cls[p.indexOf(Math.max(...p))];
function summary(rs, predict=r=>r.model) {
  const scores=rs.map(r=>probabilityScore(predict(r),r.actual));
  if (scores.some(s=>!s)) throw new Error('invalid score');
  const hits=rs.filter(r=>top(predict(r))===r.actual).length;
  return { n:rs.length, brier:avg(scores.map(s=>s.brier)), log_loss:avg(scores.map(s=>s.logLoss)),
    top1:rs.length ? hits/rs.length : null, top1_wilson:wilson(hits,rs.length),
    confidence:avg(rs.map(r=>Math.max(...predict(r)))) };
}
function compare(rs,predict) {
  return { versus_original:paired(rs,r=>r.model,predict),
    versus_original_on_market_pairs:paired(rs.filter(r=>r.market),r=>r.model,predict),
    versus_legacy_market:paired(rs.filter(r=>r.market),r=>r.market,predict) };
}
function strata(rs,key) {
  const groups=new Map();
  for (const r of rs) { const k=String(key(r)); if(!groups.has(k))groups.set(k,[]); groups.get(k).push(r); }
  return [...groups].sort(([a],[b])=>a.localeCompare(b)).map(([group,g])=>({group,...summary(g),
    market_pairs:g.filter(r=>r.market).length,
    market_comparison:paired(g.filter(r=>r.market),r=>r.market,r=>r.model) }));
}
const confidence = r=>{const p=Math.max(...r.model); return p<.4?'<.4':p<.5?'.4-.5':p<.6?'.5-.6':p<.7?'.6-.7':p<.8?'.7-.8':'>=.8';};
const marketGroups = strata(pairedRows,r=>top(r.model)===top(r.market)?'agree':'disagree');
const splits=[
  {fit:'2026-09-15T00:00:00Z',end:'2026-10-01T00:00:00Z'},
  {fit:'2026-10-01T00:00:00Z',end:'2026-10-15T00:00:00Z'},
  {fit:'2026-10-01T00:00:00Z',start:'2026-10-15T00:00:00Z',end:'2026-10-25T00:00:00Z'}
];
const experiments=splits.map(s=>{
  const fitted=fitCandidates(rows,s.fit);
  const evaluation=rows.filter(r=>Date.parse(r.issued_at)>=Date.parse(s.start||s.fit)&&Date.parse(r.issued_at)<Date.parse(s.end));
  const results={};
  for(const name of ['calibration','shrinkage']) {
    const fit=fitted[name];
    if(!fit) { results[name]={status:'insufficient training rows (minimum 100)'}; continue; }
    const rs=evaluation;
    const predict=r=>transform(r.model,fit.parameters);
    results[name]={...compare(rs,predict),summary:summary(rs,predict)};
  }
  return {...s,training:fitted,evaluation_n:evaluation.length,paired_n:evaluation.filter(r=>r.market).length,
    note:'Retrospective, already inspected dates; last-update label proxy is not authoritative receipt evidence.',results};
});

const app=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
const grid=loadSavedLambdaGrid(app);
const reconstruct=rows.filter(r=>r.build>=335&&Array.isArray(r.xg)&&r.xg.every(v=>typeof v==='number'&&v>0&&v<=10)).map(r=>{
  const reconstructed=grid.predict(...r.xg,-.08), uncorrected=grid.predict(...r.xg,0);
  return {...r,reconstructed,uncorrected,error:Math.max(...r.model.map((p,i)=>Math.abs(p-reconstructed[i])))};
});
const parity=reconstruct.filter(r=>r.error<=.001);
const byMatchMonth = strata(rows,r=>r.current_kickoff_at.slice(0,7));
const legacyBlend = ['2026-08/09','2026-10'].map(period=>{
  const rs=pairedRows.filter(r=>period==='2026-10'?r.current_kickoff_at.startsWith('2026-10'):r.current_kickoff_at<'2026-10');
  return {period,n:rs.length,weights:[0,.25,.5,.75,1].map(weight=>({weight,...summary(rs,r=>blend(r.model,r.market,weight))}))};
});
const pairedSd=paired(pairedRows,r=>r.market,r=>r.model).paired_brier_sd;
const power = [.01,.005,.002].map(effect=>({effect,independent_n_80pct_power:Math.ceil(((1.959963984540054+.8416212335729143)*pairedSd/effect)**2),
  planning_n_design_effect_2:Math.ceil(2*((1.959963984540054+.8416212335729143)*pairedSd/effect)**2)}));
const result={
  provenance:{cohort_sha256:sha(bytes),metadata:input.metadata,base_commit:'68c00ded8043b7ee1a15937db1a32c01d932f4e7',
    query_sha256:sha(readFileSync(new URL('./011_readonly_cohort.sql',import.meta.url))),
    analysis_sha256:sha(readFileSync(fileURLToPath(import.meta.url))),
    validation_sha256:sha(readFileSync(new URL('./validation.mjs',import.meta.url))),
    grid_source_sha256:grid.source_sha256,
    raw_data:'Private cloud workspace only; not included in public repository.',
    evidence_status:'Legacy mutable rows. No demonstrated authoritative odds receipt cohort. All fitted results exploratory.'},
  baseline:summary(rows),by_match_month:byMatchMonth,by_issue_month:strata(rows,r=>r.issued_at.slice(0,7)),
  baseline_calibration:calibration(rows,r=>r.model),confidence_bins:strata(rows,confidence),
  market:{...compare(pairedRows,r=>r.market),engine:summary(pairedRows),market:summary(pairedRows,r=>r.market),
    coverage:pairedRows.length/rows.length,unmatched:summary(rows.filter(r=>!r.market)),
    linked_id:pairedRows.filter(r=>r.legacy_snapshot.linked).length,
    linked_timestamp:pairedRows.filter(r=>r.legacy_snapshot.linked_timestamp_equal).length,
    mean_age_hours:avg(pairedRows.map(r=>r.legacy_snapshot.age_hours)),
    model_calibration:calibration(pairedRows,r=>r.model),market_calibration:calibration(pairedRows,r=>r.market)},
  disagreement:marketGroups,
  disagreement_l1:strata(pairedRows,r=>{const d=r.model.reduce((s,p,i)=>s+Math.abs(p-r.market[i]),0);return d<.1?'<.1':d<.2?'.1-.2':d<.4?'.2-.4':'>=.4';}),
  competition:strata(rows,r=>r.league).filter(g=>g.n>=20),
  paired_competition:strata(pairedRows,r=>r.league).filter(g=>g.n>=20),
  history_diagnostic:{
    note:'Present-day 180-day same-league history, NOT a reconstruction of actual publication inputs; never used to fit candidates.',
    results:strata(rows,r=>Math.min(r.history_diagnostic.home,r.history_diagnostic.away)>=5?'both>=5':'one<5'),
    lastupdate_proxy:strata(rows,r=>Math.min(r.history_diagnostic.home_lastupdate_proxy,r.history_diagnostic.away_lastupdate_proxy)>=5?'both>=5':'one<5'),
    xg_now:strata(rows,r=>Math.min(r.history_diagnostic.home_xg_now,r.history_diagnostic.away_xg_now)>=3?'both>=3':'one<3')},
  lead_hours:strata(rows,r=>{const h=(Date.parse(r.kickoff_at)-Date.parse(r.issued_at))/3600000;return h<=6?'<=6':h<=24?'6-24':h<=72?'24-72':'>72';}),
  build_era:strata(rows,r=>r.build>=335?'>=335':r.build>=318?'318-334':'<318'),
  expected_goals:strata(rows,r=>{if(r.xg.some(v=>typeof v!=='number'))return 'missing';const x=r.xg[0]+r.xg[1];return x<2?'under2':x<3?'2-3':'>=3';}),
  settlement:{non90_label_disagreements:rows.filter(r=>r.actual!==r.raw_result).length,valid_ft_pair:rows.filter(r=>r.used_ft).length},
  legacy_blends:legacyBlend,experiments,
  saved_lambda_ablation:{note:'Conditional rho=0 sensitivity only; rounded lambdas, present method, mixed historic builds. Not an exact engine replay or causal attribution.',
    considered:reconstruct.length,parity_n:parity.length,parity_tolerance:.001,
    maximum_error:reconstruct.length?Math.max(...reconstruct.map(r=>r.error)):null,
    reconstructed:compare(parity,r=>r.reconstructed),rho_zero:compare(parity,r=>r.uncorrected)},
  sample_size_planning:{paired_brier_sd:pairedSd,assumptions:'Normal approximation, 80% power, two one-sided 97.5% primary intervals; planning design effect 2 is assumed, not estimated. Rejecting any negative difference is easier than establishing a full material-margin CI. Re-estimate before freeze from independent development data.',power}
};
process.stdout.write(JSON.stringify(result,null,2)+'\n');
