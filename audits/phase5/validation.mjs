// Offline research only. Never imported by the live engine or publisher.
import { probabilityScore } from '../lib/bookmaker-metrics.mjs';
const classes = ['1', 'X', '2'];
const sum = xs => xs.reduce((a, b) => a + b, 0);
const mean = xs => xs.length ? sum(xs) / xs.length : null;
export function validProbability(p) {
  if (!probabilityScore(p, '1')) throw new Error('invalid probability triple');
  return p;
}
export function transform(p, { alpha = 1, offsets = [0, 0, 0], shrink = 0, prior = [1/3, 1/3, 1/3] } = {}) {
  validProbability(p); validProbability(prior);
  if (!(Number.isFinite(alpha) && alpha > 0) || !Array.isArray(offsets) || offsets.length !== 3 ||
      offsets.some(x => !Number.isFinite(x)) || !Number.isFinite(shrink) || shrink < 0 || shrink > 1) throw new Error('invalid transform');
  if (alpha === 1 && offsets.every(x => x === 0) && shrink === 0) return [...p];
  const logits = p.map((v, i) => alpha * Math.log(Math.max(v, 1e-12)) + offsets[i]);
  const z = logits.map(v => Math.exp(v - Math.max(...logits))), total = sum(z), pt = sum(prior);
  return z.map((v, i) => (1-shrink) * v / total + shrink * prior[i] / pt);
}
export function blend(p, market, weight) {
  validProbability(p); validProbability(market);
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) throw new Error('invalid weight');
  if (weight === 0) return [...p];
  if (weight === 1) return [...market];
  const q = p.map((v, i) => (1-weight)*v + weight*market[i]);
  return q.map(v => v / sum(q));
}
// Exact to PostgreSQL microseconds; invalid calendars and absent zones fail closed.
export function timestampUs(value) {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!m) return null;
  const [y, mo, d, h, mi, s] = m.slice(1, 7).map(Number);
  if (y < 100 || mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || s > 59) return null;
  const t = new Date(Date.UTC(y, mo-1, d, h, mi, s));
  if (t.getUTCMonth() !== mo-1 || t.getUTCDate() !== d) return null;
  let offset = 0;
  if (m[8] !== 'Z') {
    const oh = Number(m[8].slice(1,3)), om = Number(m[8].slice(4));
    if (oh > 23 || om > 59) return null;
    offset = (oh*60 + om) * (m[8][0] === '+' ? 1 : -1);
  }
  return BigInt(t.getTime() - offset*60000)*1000n + BigInt((m[7] || '').padEnd(6, '0'));
}
// Timing prerequisite ONLY: does not authenticate a receipt or confer provenance.
export function shadowTimingEligible({ issuedAt, frozenAt, startAt, receivedAt }) {
  const [i, f, s, r] = [issuedAt, frozenAt, startAt, receivedAt].map(timestampUs);
  return [i, f, s, r].every(x => x !== null) && f < s && s <= i && r < i;
}
// Retrospective last-update proxy, NOT proof of historical first-settlement receipt.
export function legacyTrainingProxy(rows, fitAt) {
  const fit = timestampUs(fitAt);
  if (fit === null) throw new Error('invalid fit cutoff');
  return rows.filter(r => {
    const [i, k, u] = [r.issued_at, r.current_kickoff_at, r.label_updated_at].map(timestampUs);
    return [i, k, u].every(x => x !== null) && i < fit && k + 72n*3600000000n < fit && u < fit;
  });
}
export function wilson(events, n) {
  if (!n) return null;
  const z = 1.959963984540054, p = events/n, den = 1+z*z/n;
  const center = (p+z*z/(2*n))/den, half = z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/den;
  return [Math.max(0, center-half), Math.min(1, center+half)];
}
function auc(values) {
  const sorted = [...values].sort((a,b) => a.p-b.p), pos = sum(values.map(x=>x.y)), neg = values.length-pos;
  if (!pos || !neg) return null;
  let wins = 0, below = 0;
  for (let i=0; i<sorted.length;) {
    let j=i, a=0, b=0;
    while (j<sorted.length && sorted[j].p === sorted[i].p) { if (sorted[j].y) a++; else b++; j++; }
    wins += a*(below+b/2); below += b; i=j;
  }
  return wins/(pos*neg);
}
export function calibration(rows, predictor) {
  const scored = rows.map(r => ({ p: validProbability(predictor(r)), y: classes.indexOf(r.actual) }));
  if (scored.some(x=>x.y < 0)) throw new Error('invalid outcome');
  return classes.map((outcome, j) => {
    const values = scored.map(x=>({p:x.p[j], y:Number(x.y===j)}));
    const bins = Array.from({length:10}, (_,i) => {
      const b = values.filter(x=>Math.min(9,Math.floor(x.p*10))===i);
      return b.length ? { range:[i/10,(i+1)/10], n:b.length, predicted:mean(b.map(x=>x.p)), observed:mean(b.map(x=>x.y)), event_ci:wilson(sum(b.map(x=>x.y)),b.length) } : null;
    }).filter(Boolean);
    return { outcome, n:values.length, predicted:mean(values.map(x=>x.p)), observed:mean(values.map(x=>x.y)),
      binary_brier:mean(values.map(x=>(x.p-x.y)**2)), auc:auc(values),
      ece:values.length ? sum(bins.map(b=>b.n*Math.abs(b.predicted-b.observed)))/values.length : null, bins };
  });
}
const quantile = (sorted, q) => {
  const at = (sorted.length-1)*q, lo = Math.floor(at);
  return sorted[lo] + (sorted[Math.ceil(at)]-sorted[lo])*(at-lo);
};
function clustered(values, key, draws, seed) {
  const groups = new Map();
  for (const v of values) {
    const k = key(v.row);
    if (!groups.has(k)) groups.set(k, { n:0, b:0, l:0 });
    const g = groups.get(k); g.n++; g.b+=v.b; g.l+=v.l;
  }
  const gs = [...groups.values()], b=[], l=[];
  if (gs.length < 2) return { clusters:gs.length, brier:null, log_loss:null };
  let state = seed >>> 0;
  const rand = () => { state = (Math.imul(1664525,state)+1013904223)>>>0; return state/4294967296; };
  for (let d=0; d<draws; d++) {
    let n=0, sb=0, sl=0;
    for (let i=0; i<gs.length; i++) { const g=gs[Math.floor(rand()*gs.length)]; n+=g.n; sb+=g.b; sl+=g.l; }
    b.push(sb/n); l.push(sl/n);
  }
  b.sort((a,b)=>a-b); l.sort((a,b)=>a-b);
  return { clusters:gs.length, brier:[quantile(b,.025),quantile(b,.975)], log_loss:[quantile(l,.025),quantile(l,.975)] };
}
export function paired(rows, reference, candidate, { draws=2000, seed=355 } = {}) {
  if (!Number.isInteger(draws) || draws < 1) throw new Error('invalid bootstrap draws');
  const ids = new Set();
  const values = rows.map(row => {
    if (row.id == null || ids.has(String(row.id))) throw new Error('missing or duplicate fixture id');
    ids.add(String(row.id));
    if (timestampUs(row.issued_at) === null || row.league == null) throw new Error('missing cluster');
    const r=probabilityScore(reference(row),row.actual), c=probabilityScore(candidate(row),row.actual);
    if (!r || !c) throw new Error('invalid probability or outcome');
    return {row,r,c,b:c.brier-r.brier,l:c.logLoss-r.logLoss};
  });
  const n=values.length, bs=values.map(v=>v.b), ls=values.map(v=>v.l);
  const iid = xs => {
    if (n<2) return null;
    const m=mean(xs), se=Math.sqrt(sum(xs.map(x=>(x-m)**2))/(n-1)/n);
    return [m-1.96*se,m+1.96*se];
  };
  // Fixed UTC seven-day blocks anchored on Unix epoch, not overlapping rolling windows.
  const week = r=>Math.floor(Date.parse(r.issued_at)/(7*86400000));
  return { n, reference_brier:mean(values.map(v=>v.r.brier)), candidate_brier:mean(values.map(v=>v.c.brier)),
    reference_log_loss:mean(values.map(v=>v.r.logLoss)), candidate_log_loss:mean(values.map(v=>v.c.logLoss)),
    brier_difference:mean(bs), log_loss_difference:mean(ls), iid_brier_ci:iid(bs), iid_log_loss_ci:iid(ls),
    paired_brier_sd:n>1 ? Math.sqrt(sum(bs.map(x=>(x-mean(bs))**2))/(n-1)) : null,
    week_bootstrap:clustered(values,week,draws,seed), league_bootstrap:clustered(values,r=>r.league,draws,seed+1) };
}
// Fixed exploratory grid. No evaluation outcomes enter selection. Identity wins ties.
export function fitCandidates(rows, fitAt) {
  const train = legacyTrainingProxy(rows, fitAt);
  const loss = (rs, predict) => mean(rs.map(r => {
    const s = probabilityScore(predict(r), r.actual);
    if (!s) throw new Error('invalid training outcome');
    return s.logLoss;
  }));
  const select = (rs, options, predict) => {
    if (rs.length < 100) return null;
    let best = null;
    for (const parameters of options) {
      const log_loss = loss(rs, r=>predict(r, parameters));
      if (!best || log_loss < best.log_loss - 1e-12) best = { parameters, log_loss };
    }
    return best;
  };
  const prior = train.length ? classes.map(c=>train.filter(r=>r.actual===c).length/train.length) : [1/3,1/3,1/3];
  const calibrationOptions = [{}];
  for (const alpha of [.6,.8,1,1.2]) for (const h of [-.15,0,.15]) for (const d of [-.15,0,.15])
    calibrationOptions.push({alpha, offsets:[h,d,0]});
  return { fit_at:fitAt, n:train.length, market_n:train.filter(r=>r.market).length,
    calibration:select(train, calibrationOptions, (r,p)=>transform(r.model,p)),
    shrinkage:select(train, [0,.05,.1,.2].map(shrink=>({shrink,prior})), (r,p)=>transform(r.model,p)),
    market_blend_status:'Not fitted: legacy timestamps do not establish verified pre-issue receipt.' };
}
