// Phase 3 MatchMind statistical research contracts (audit-only, not used by live engine).
// Every alternative is compared to the original saved probability triple on IDENTICAL fixtures.
// As-of observations are mandatory; current contents of a mutable fixture row do not qualify.
import { probabilityScore } from './bookmaker-metrics.mjs';

const time = x => {
  if (typeof x !== 'string' || !/(?:Z|[+-]\d{2}:\d{2})$/.test(x)) return null;
  const n=Date.parse(x);
  return Number.isFinite(n)?n:null;
};
export function observationAvailableAtIssue({observedAt,issueAt,playedAt=null}={}) {
  const obs=time(observedAt),issue=time(issueAt),played=playedAt==null?null:time(playedAt);
  return obs!=null&&issue!=null&&obs<=issue &&
    (playedAt==null || (played!=null && played<obs && played<issue));
}
export function selectAsOfObservation(rows, issueAt) {
  const issue=time(issueAt);
  if (issue==null)return null;
  let best=null,at=-Infinity;
  for(const row of rows??[]) {
    if(!observationAvailableAtIssue({observedAt:row.observedAt,issueAt,
      playedAt:row.playedAt??null}))continue;
    const t=time(row.observedAt);
    if(t>at){best=row;at=t;}
  }
  return best;
}
export function fixedResearchCohort(issuedAt) {
  const issue=time(issuedAt);
  if(issue==null) return null;
  if(issue<Date.parse('2026-10-01T00:00:00Z')) return 'development';
  if(issue<Date.parse('2026-11-01T00:00:00Z')) return 'exploratory';
  return 'prospective';
}
export function evaluateMatchedForecasts(rows) {
  const seen=new Set(),results=[];
  for(const r of rows??[]){
    if(r?.fixtureId==null||seen.has(String(r.fixtureId))) {
      throw Error('duplicate or missing fixture identifier');
    }
    seen.add(String(r.fixtureId));
    const issue=time(r.issuedAt),kick=time(r.kickoffAt);
    if(issue==null||kick==null||issue>=kick) {
      throw Error('prediction must have an immutable pre-kickoff issuance timestamp');
    }
    if(r.featureEvidence && !r.featureEvidence.every(x=>
      observationAvailableAtIssue({observedAt:x.observedAt,issueAt:r.issuedAt,
        playedAt:x.playedAt??null}))) {
      throw Error('feature observation was not demonstrably known at issuance');
    }
    const baseline=probabilityScore(r.baseline,r.actual);
    const candidate=probabilityScore(r.candidate,r.actual);
    if(!baseline||!candidate)throw Error('missing or invalid probability triple or result');
    results.push({dBrier:candidate.brier-baseline.brier,
      dLog: candidate.logLoss-baseline.logLoss,
      cohort:fixedResearchCohort(r.issuedAt)});
  }
  if(!results.length)return null;
  const mean=fn=>results.reduce((s,x)=>s+fn(x),0)/results.length;
  const diffBrier=mean(x=>x.dBrier),diffLogLoss=mean(x=>x.dLog);
  const sampleVariance=fn=>{
    if(results.length<2)return null;
    const mu=mean(fn);
    return results.reduce((a,x)=>a+(fn(x)-mu)**2,0)/(results.length-1);
  };
  const sampleVar=sampleVariance(x=>x.dBrier);
  const brierSe=sampleVar==null?null:Math.sqrt(sampleVar/results.length);
  return {n:results.length,diffBrier,diffLogLoss,
    brierSe,brierCI95:brierSe==null?null:[diffBrier-1.96*brierSe,diffBrier+1.96*brierSe],
    cohortCounts:Object.fromEntries(['development','exploratory','prospective']
      .map(k=>[k,results.filter(x=>x.cohort===k).length]))};
}
