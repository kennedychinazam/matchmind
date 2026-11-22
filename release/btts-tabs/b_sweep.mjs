import {load,summ,mkCal,raw} from './lib.mjs';
const D=load(); const cal=mkCal({U35:-0.03});
const W=[['train','2022-07-01','2025-07-01'],['test','2025-07-01','9'],['2026-08+','2026-08-01','9']];
const codes=['BTS','NBT','O25','O35','U35','U25','1','2','1X','X2','1D','2D'];
for(const c of codes){
  console.log(`\n${c}`);
  for(let t=0.55;t<=0.851;t+=0.01){
    const line=[];
    for(const [w,a,b] of W){ const L=[]; let N=0; for(const r of D.rows){ if(r.date<a||r.date>=b||r.unk) continue; const M=D.meta[r.lid]; if(!M||M.xr) continue; N++; const p=cal(c,raw(r,c)); if(p>=t) L.push({code:c,prob:p,r}); }
      const s=summ(L); line.push(`${w} n ${String(s.graded).padStart(5)} cov ${(100*L.length/N).toFixed(1).padStart(4)} gap ${s.gap==null?'  -':(s.gap>=0?'+':'')+s.gap}`); }
    console.log(`  >=${t.toFixed(2)}  `+line.join(' | '));
  }
}
