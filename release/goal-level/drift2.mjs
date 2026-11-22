import {goalsRaw,damp} from './mk.mjs';
// out-of-sample residual drift: s = (G_recent + k0*Lam_recent... ) shrink toward 1
export function buildOOS(rows){ // per league, rows in index order: prefix of actual and lambda
  const by={}; for(const r of rows){ (by[r.lid]=by[r.lid]||[]).push(r); }
  const idx=new Map();
  for(const [l,rs] of Object.entries(by)){ rs.sort((a,b)=>a.i-b.i); let G=0,Lm=0; const pre=[]; for(let k=0;k<rs.length;k++){ pre.push([G,Lm]); G+=rs[k].hg+rs[k].ag; Lm+=rs[k].lh+rs[k].la; } rs.forEach((r,k)=>idx.set(r,{rs,k,pre,G,Lm})); }
  return idx;
}
export function corr2(r,idx,{K,k0,full=true}){
  const e=idx.get(r); if(!e) return r; const {rs,k,pre}=e; if(k<K) return r;
  const [G1,L1]=pre[k], [G0,L0]=pre[k-K];
  const Gr=G1-G0, Lr=L1-L0; const s=(Gr+k0*Lr/K)/(Lr+k0*Lr/K); // shrink: k0 pseudo-matches at ratio 1
  const g=goalsRaw(r.lh*s,r.la*s);
  let rates=r.rates;
  if(rates&&full){ // shift base rates by the same scaling of a neutral pair at league-average
    const m=Lr/K/2; const a=goalsRaw(m,m), b=goalsRaw(m*s,m*s);
    rates=[rates[0]+(b.o15-a.o15),rates[1]+(b.o25-a.o25),rates[2]+(b.o35-a.o35),rates[3]+(b.btts-a.btts)]; }
  const d=damp(g,rates,r.DK); return {...r,o15:d.o15,o25:d.o25,o35:d.o35,btts:d.btts,s};
}
