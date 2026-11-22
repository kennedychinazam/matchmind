import {load,picks,summ,MKT} from './lib.mjs';
import {corrP} from './pooled.mjs';
const {meta,rows}=load();
const rs=rows.map(r=>(r.unk||meta[r.lid].xr)?r:corrP(r,60,500,300,300,process.env.SB!=='0'));
const W=[['train','2022-07-01','2025-07-01'],['test','2025-07-01','9'],['new','2026-08-01','9']];
for(const sh of [0,-0.01,-0.0175,-0.025,-0.03,-0.04]){
  const cal=(c,p)=>c==='U35'?Math.min(0.995,Math.max(0.005,p+sh)):p;
  const line=[sh];
  for(const [w,a,b] of W){ const P=picks(rs,meta,cal,{from:a}).filter(x=>x.r.date<b); const u=P.filter(x=>x.tier==='strong'&&x.pick.code==='U35').map(x=>({code:'U35',prob:x.pick.prob,r:x.r})); const all=P.filter(x=>x.tier==='strong').map(x=>({code:x.pick.code,prob:x.pick.prob,r:x.r})); const s=summ(u), A=summ(all); line.push(`${w}: U35 n${s.graded} gap ${s.gap} | all n${A.graded} hit ${A.hit} gap ${A.gap} cov ${(P.filter(x=>x.tier==='strong').length/P.length).toFixed(3)}`); }
  console.log(line.join('  ||  '));
}
