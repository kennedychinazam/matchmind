import {load,picks,summ,MKT} from './lib.mjs';
import {simulate} from './slips.mjs';
const OLD=load('/tmp/claude-0/calbt/dumpOld.json'), NEW=load('/tmp/claude-0/calbt/dumpNew.json');
const sh=v=>(c,p)=>c==='U35'?Math.min(0.995,Math.max(0.005,p+v)):p;
const W=[['2022-07..2025-06','2022-07-01','2025-07-01'],['2025-07 on','2025-07-01','9'],['2026-08 on','2026-08-01','9']];
for(const [nm,D,cal] of [['BEFORE (build 365)',OLD,sh(-0.0175)],['AFTER (build 366)',NEW,sh(-0.03)]]){
  console.log('=====',nm);
  for(const [w,a,b] of W){
    const P=picks(D.rows,D.meta,cal,{from:a}).filter(x=>x.r.date<b);
    const by={},mix={}; let nS=0,nL=0; const all=[];
    for(const x of P){ if(!x.tier) continue; if(x.tier==='strong'){nS++; all.push({code:x.pick.code,prob:x.pick.prob,r:x.r});} else nL++; const m=MKT(x.pick.code); const k=x.tier+'|'+m; (by[k]=by[k]||[]).push({code:x.pick.code,prob:x.pick.prob,r:x.r}); }
    const A=summ(all); console.log(`  ${w}: fixtures ${P.length}, Strong coverage ${(nS/P.length*100).toFixed(1)}%, Lean ${(nL/P.length*100).toFixed(1)}%, Strong all: n ${A.graded} hit ${A.hit} stated ${A.stated} gap ${A.gap}`);
    for(const k of Object.keys(by).sort()){ const s=summ(by[k]); const share=k.startsWith('strong')?(by[k].length/nS*100).toFixed(1)+'% of Strong':(by[k].length/nL*100).toFixed(1)+'% of Lean'; console.log(`     ${k.padEnd(24)} n ${String(s.graded).padStart(5)} hit ${s.hit} stated ${s.stated} gap ${s.gap} (se ${s.se})  ${share}`); }
  }
}
