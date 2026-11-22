import {load,summ,mkCal,raw} from './lib.mjs';
const D=load(); const cal=mkCal({U35:-0.03});
const W=[['train 2022-07..2025-06','2022-07-01','2025-07-01'],['test 2025-07 on','2025-07-01','9'],['2026-08 on','2026-08-01','9']];
const bands=[[0.50,0.55],[0.55,0.60],[0.60,0.65],[0.65,0.70],[0.70,0.75],[0.75,0.80],[0.80,1.01]];
const sel={
  'WIN (1 or 2)': r=>r.pW>=r.pL?{code:'1',prob:r.pW}:{code:'2',prob:r.pL},
  'BTTS (Yes or No)': r=>r.btts>=0.5?{code:'BTS',prob:r.btts}:{code:'NBT',prob:1-r.btts},
  'BTTS Yes': r=>({code:'BTS',prob:r.btts}),
  'BTTS No': r=>({code:'NBT',prob:1-r.btts}),
  'Home win 1': r=>({code:'1',prob:r.pW}),
  'Away win 2': r=>({code:'2',prob:r.pL}),
};
for(const [w,a,b] of W){
  const P=D.rows.filter(r=>r.date>=a&&r.date<b&&!r.unk&&D.meta[r.lid]&&!D.meta[r.lid].xr);
  console.log(`\n=== ${w}: ${P.length} fixtures (non-XR, both sides known) ===`);
  for(const [nm,f] of Object.entries(sel)){
    console.log(` ${nm}`);
    for(const [lo,hi] of bands){
      const L=[]; for(const r of P){ const s=f(r); if(s.prob>=lo&&s.prob<hi) L.push({...s,r}); }
      const s=summ(L); if(!s.graded) { console.log(`   ${lo.toFixed(2)}-${hi>1?'1.00':hi.toFixed(2)}  n 0`); continue; }
      console.log(`   ${lo.toFixed(2)}-${hi>1?'1.00':hi.toFixed(2)}  n ${String(s.graded).padStart(5)} cov ${(100*L.length/P.length).toFixed(1).padStart(5)}%  hit ${s.hit} stated ${s.stated} gap ${s.gap>=0?'+':''}${s.gap} (se ${s.se})  ROI@0.95/p ${s.roiFair}%  real ROI ${s.roiReal==null?'-':s.roiReal+'% (n '+s.pricedN+')'}`);
    }
    for(const t of [0.60,0.65,0.70,0.75]){ const L=[]; for(const r of P){const s=f(r); if(s.prob>=t) L.push({...s,r});} const s=summ(L);
      console.log(`   >=${t.toFixed(2)} cov ${(100*L.length/P.length).toFixed(1)}% n ${s.graded} hit ${s.hit} stated ${s.stated} gap ${s.gap} se ${s.se} ROIfair ${s.roiFair} real ${s.roiReal}(n ${s.pricedN})`); }
  }
}
