import {load,summ,mkCal,ladder} from './lib.mjs';
const D=load();
const W=[['train 22-07..25-06','2022-07-01','2025-07-01'],['test 25-07 on','2025-07-01','9'],['26-08 on','2026-08-01','9']];
for(const codes of [['1X'],['X2'],['1D'],['2D'],['1X','X2'],['1D','2D']]){
  console.log('\n== Strong picks code',codes.join('+'));
  for(const sh of [0,-0.005,-0.01,-0.015,-0.02,-0.025]){
    const S={U35:-0.03}; for(const c of codes) S[c]=sh; const cal=mkCal(S);
    const line=[]; for(const [w,a,b] of W){ const P=ladder(D.rows,D.meta,cal,{from:a,to:b}); const L=P.filter(x=>x.tier==='strong'&&codes.includes(x.pick.code)).map(x=>({code:x.pick.code,prob:x.pick.prob,r:x.r}));
      const LL=P.filter(x=>x.tier==='lean'&&codes.includes(x.pick.code)).map(x=>({code:x.pick.code,prob:x.pick.prob,r:x.r}));
      const s=summ(L), l=summ(LL); line.push(`${w}: S n ${s.graded} gap ${s.gap} (se ${s.se}) | L n ${l.graded} gap ${l.gap}`); }
    console.log(`  shift ${sh}: `+line.join(' || '));
  }
}
