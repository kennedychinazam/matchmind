// MatchMind independent 1X2 bookmaker benchmark helpers.
// Audit-only: never imported by index.html or the production publisher.
// Timestamp selection MUST precede issue time; closing odds cannot be a pre-issue benchmark.
export function fairMarket(prices, minOverround=1, maxOverround=1.30) {
  const h=Number(prices?.h),d=Number(prices?.d),a=Number(prices?.a);
  if (![h,d,a].every(Number.isFinite)||[h,d,a].some(x=>x<=1)) return null;
  const implied=[1/h,1/d,1/a];
  const overround=implied.reduce((sum,v)=>sum+v,0);
  if (!(overround>=minOverround&&overround<=maxOverround)) return null;
  return { probabilities:implied.map(p=>p/overround),overround };
}
export function selectPreIssueSnapshot(snapshots, fxid, madeAt, maxAgeHours=24) {
  const issued=Date.parse(madeAt);
  if (!Number.isFinite(issued) || !Number.isFinite(maxAgeHours)||maxAgeHours<0) return null;
  let best=null, bestAt=-Infinity;
  for (const s of snapshots??[]) {
    if (String(s.fxid)!==String(fxid)||!(Number(s.mins_to_kick)>0))continue;
    const at=Date.parse(s.captured_at);
    if (!Number.isFinite(at)||at>issued||(issued-at)>maxAgeHours*3600000)continue;
    const fair=fairMarket(s);
    if (!fair)continue;
    if (at>bestAt||(at===bestAt&&Number(s.id)>Number(best?.snapshot.id??-1))) {
      best={snapshot:s,probabilities:fair.probabilities,overround:fair.overround,
        ageHours:(issued-at)/3600000};
      bestAt=at;
    }
  }
  return best;
}
const outcomes=['1','X','2'];
export function probabilityScore(p, actual) {
  if (!Array.isArray(p)||p.length!==3||!outcomes.includes(actual)
      ||p.some(x=>typeof x!=='number'||!Number.isFinite(x)||x<0||x>1)
      ||Math.abs(p.reduce((a,b)=>a+b,0)-1)>0.005) return null;
  const y=outcomes.indexOf(actual);
  return {brier:p.reduce((z,x,i)=>z+(x-(i===y?1:0))**2,0),
    logLoss:-Math.log(Math.max(p[y],1e-12))};
}
export function comparePair(engine,market,actual) {
  const e=probabilityScore(engine,actual),m=probabilityScore(market,actual);
  if (!e||!m)return null;
  return {engine:e,market:m,brierDifference:e.brier-m.brier,
    logLossDifference:e.logLoss-m.logLoss};
}
