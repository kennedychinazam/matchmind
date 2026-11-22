import {load,summ,raw} from './lib.mjs';
const D=load();
for(const c of ['1D','2D','1X','X2']){ console.log(c);
 for(const [lo,hi] of [[0.6,0.65],[0.65,0.7],[0.7,0.75],[0.75,0.8],[0.8,0.85],[0.85,0.9],[0.9,1]]){
  const line=[]; for(const [w,a,b] of [['train','2022-07-01','2025-07-01'],['test','2025-07-01','9']]){ const L=[]; for(const r of D.rows){ if(r.date<a||r.date>=b||r.unk) continue; const M=D.meta[r.lid]; if(!M||M.xr) continue; const p=raw(r,c); if(p>=lo&&p<hi) L.push({code:c,prob:p,r}); } const s=summ(L); line.push(`${w} n ${s.graded} gap ${s.gap} se ${s.se}`); }
  console.log(`  ${lo}-${hi}: `+line.join(' | ')); } }
