import {readFileSync} from 'node:fs';
import {goalsRaw,damp} from './mk.mjs';
const data=JSON.parse(readFileSync('/tmp/claude-0/bt/data.json','utf8'));
export function leagueArrays(cut='2021-11-21'){
  const A={};
  for(const [lid,rs] of Object.entries(data)){ const ms=[]; for(const r of rs){ if(r[0]<cut) continue; ms.push({date:r[0],hg:r[4],ag:r[5]}); } ms.sort((a,b)=>a.date<b.date?-1:1);
    // prefix sums
    const n=ms.length, G=new Float64Array(n+1), C15=new Float64Array(n+1),C25=new Float64Array(n+1),C35=new Float64Array(n+1),CB=new Float64Array(n+1);
    for(let i=0;i<n;i++){ const m=ms[i], t=(m.hg??0)+(m.ag??0), ok=m.hg!=null; G[i+1]=G[i]+(ok?t:0); C15[i+1]=C15[i]+(ok&&t>1.5); C25[i+1]=C25[i]+(ok&&t>2.5); C35[i+1]=C35[i]+(ok&&t>3.5); CB[i+1]=CB[i]+(ok&&m.hg>0&&m.ag>0); }
    A[lid]={ms,G,C15,C25,C35,CB}; }
  return A;
}
// corrected goals for row r with params {K,k0}
export function corrected(r,A,{K,k0,full=true}){
  const L=A[r.lid], i=r.i; if(!L||i<K+30) return {o15:r.o15,o25:r.o25,o35:r.o35,btts:r.btts,s:1};
  const j=i-K; const n=K;
  const mu=L.G[i]/i, Gr=L.G[i]-L.G[j];
  const recent=(Gr+k0*mu)/(n+k0); const s=recent/mu;
  const g=goalsRaw(r.lh*s,r.la*s);
  let rates=r.rates;
  if(rates && full){ const sh=(cnt,long)=>(cnt+k0*long)/(n+k0);
    rates=[sh(L.C15[i]-L.C15[j],rates[0]),sh(L.C25[i]-L.C25[j],rates[1]),sh(L.C35[i]-L.C35[j],rates[2]),sh(L.CB[i]-L.CB[j],rates[3])]; }
  const d=damp(g,rates,r.DK); d.s=s; return d;
}
