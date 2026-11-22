import {load,SHIPPED,summ} from './lib.mjs';
import {leagueArrays} from './drift.mjs';
import {goalsRaw,damp} from './mk.mjs';
import {report} from './evalp.mjs';
const {meta,rows}=load(); const A=leagueArrays();
const lids=Object.keys(meta).filter(l=>!meta[l].xr);
// day-indexed list of (date, lid, goals, mu_at_that_time)
const ev=[]; for(const l of lids){ const L=A[l]; for(let i=30;i<L.ms.length;i++){ const m=L.ms[i]; if(m.hg==null) continue; ev.push([m.date,m.hg+m.ag,L.G[i]/i]); } }
ev.sort((a,b)=>a[0]<b[0]?-1:1);
const dates=ev.map(e=>e[0]); const PG=[0],PM=[0]; for(const e of ev){PG.push(PG.at(-1)+e[1]);PM.push(PM.at(-1)+e[2]);}
const lb=d=>{let lo=0,hi=dates.length;while(lo<hi){const m=(lo+hi)>>1;if(dates[m]<d)lo=m+1;else hi=m;}return lo;};
const addDays=(d,n)=>new Date(Date.parse(d)+n*864e5).toISOString().slice(0,10);
function sPool(date,D,k0){ const j=lb(date), i0=lb(addDays(date,-D)); const G=PG[j]-PG[i0], M=PM[j]-PM[i0], n=j-i0; return (G+k0*(M/Math.max(n,1)))/(M+k0*(M/Math.max(n,1))); }
function corrP(r,D,k0,KL,kL,shiftBase=true){
  const L=A[r.lid], i=r.i; const mu=L.G[i]/i;
  const sp=sPool(r.date,D,k0);
  let sl=1; if(KL&&i>KL+30){ const Gr=L.G[i]-L.G[i-KL]; sl=((Gr/KL)/(mu*sp)*KL + kL)/(KL+kL); }
  const s=sp*sl;
  const g=goalsRaw(r.lh*s,r.la*s); let rates=r.rates;
  if(rates&&shiftBase){ const m=mu/2, a=goalsRaw(m,m), b=goalsRaw(m*s,m*s); rates=[rates[0]+b.o15-a.o15,rates[1]+b.o25-a.o25,rates[2]+b.o35-a.o35,rates[3]+b.btts-a.btts]; }
  const d=damp(g,rates,r.DK); const m2=mu/2,a2=goalsRaw(m2,m2),b2=goalsRaw(m2*s,m2*s); const w=shiftBase?1:r.DK; return {...r,o15:d.o15,o25:d.o25,o35:d.o35,btts:d.btts,s,bd:{o15:w*(b2.o15-a2.o15),o25:w*(b2.o25-a2.o25),o35:w*(b2.o35-a2.o35),btts:w*(b2.btts-a2.btts)}};
}
const ll=(p,y)=>-Math.log(Math.max(1e-6,y?p:1-p));
const use=rows.filter(r=>!r.unk&&!meta[r.lid].xr);
function score(fn){ const S={tr:[0,0],te:[0,0],nw:[0,0]}; for(const r of use){ const g=fn(r); const t=r.hg+r.ag; const l=ll(1-g.o35,t<3.5)+ll(g.o25,t>2.5)+ll(g.btts,r.hg>0&&r.ag>0); const k=r.date<'2025-07-01'?'tr':'te'; S[k][0]+=l;S[k][1]++; if(r.date>='2026-08-01'){S.nw[0]+=l;S.nw[1]++;} } return Object.fromEntries(Object.entries(S).map(([k,v])=>[k,+(v[0]/v[1]).toFixed(5)])); }
const b=score(r=>r);
if(process.argv[2]==='sweep') for(const D of [30,60,90,180]) for(const k0 of [0,500,2000]) for(const [KL,kL] of [[0,0],[300,300]]){ const s=score(r=>corrP(r,D,k0,KL,kL)); console.log('D',D,'k0',k0,'KL',KL,'dTr',(s.tr-b.tr).toFixed(5),'dTe',(s.te-b.te).toFixed(5),'dNew',(s.nw-b.nw).toFixed(5)); }
export {corrP};
