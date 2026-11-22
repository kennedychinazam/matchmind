import {load,picks,summ} from './lib.mjs';
const D=load('/tmp/claude-0/calbt/dumpNew.json');
// the dump holds o35 AFTER goal level; shift applied here
for(const v of [-0.0175,-0.025,-0.03,-0.035,-0.04]){
  const cal=(c,p)=>c==='U35'?Math.min(0.995,Math.max(0.005,p+v)):p; const line=[v];
  for(const [w,a,b] of [['train','2022-07-01','2025-07-01'],['test','2025-07-01','9'],['new','2026-08-01','9']]){ const P=picks(D.rows,D.meta,cal,{from:a}).filter(x=>x.r.date<b); const u=P.filter(x=>x.tier==='strong'&&x.pick.code==='U35').map(x=>({code:'U35',prob:x.pick.prob,r:x.r})); const all=P.filter(x=>x.tier==='strong').map(x=>({code:x.pick.code,prob:x.pick.prob,r:x.r})); const s=summ(u),A=summ(all); line.push(`${w} U35 n${s.graded} ${s.hit}/${s.stated} gap ${s.gap} | all hit ${A.hit} gap ${A.gap} cov ${(all.length/P.length*100).toFixed(1)}`); }
  console.log(line.join(' || ')); }
