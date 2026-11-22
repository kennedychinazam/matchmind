import {load,summ,won} from './lib.mjs';
const D=load(); const ok=r=>!r.unk&&D.meta[r.lid]&&!D.meta[r.lid].xr;
const W=[['test 2025-07 on','2025-07-01','9'],['2026-08 on (real prices)','2026-08-01','9']];
const M={ 'Straight win (1 / 2)': r=>r.pW>=r.pL?{code:'1',prob:r.pW}:{code:'2',prob:r.pL}, 'BTTS Yes': r=>({code:'BTS',prob:r.btts}) };
for(const [w,a,b] of W){ console.log('\n==',w);
 for(const fl of [0.60,0.65,0.70]) for(const [nm,f] of Object.entries(M)){
  const days={}; const legs=[];
  for(const r of D.rows){ if(r.date<a||r.date>=b||!ok(r)) continue; const s=f(r); if(s.prob<fl) continue; if(nm.startsWith('Straight')&&s.code==='2'&&s.prob<0.75) continue; const x={...s,r}; legs.push(x); (days[r.date]=days[r.date]||[]).push(x); }
  const L=summ(legs);
  // 2-leg double: the two highest-probability legs of the day
  let nd=0,wonD=0,sp=0,fair=0,realN=0,real=0;
  for(const d of Object.values(days)){ if(d.length<2) continue; d.sort((p,q)=>q.prob-p.prob); const [x,y]=d; nd++; const h=won(x.code,x.r.hg,x.r.ag)==='hit'&&won(y.code,y.r.hg,y.r.ag)==='hit'; if(h) wonD++; const p=x.prob*y.prob; sp+=p; fair+=(h?0.95*0.95/p:0)-1; const px=x.r.odds&&x.r.odds[x.code], py=y.r.odds&&y.r.odds[y.code]; if(px>1&&py>1){realN++; real+=(h?px*py:0)-1;} }
  console.log(`  floor ${fl.toFixed(2)} ${nm.padEnd(22)} legs n ${String(L.graded).padStart(5)} hit ${L.hit} stated ${L.stated} gap ${L.gap} (se ${L.se}) ROI0.95 ${L.roiFair}% real ${L.roiReal}%(n ${L.pricedN}) | daily double: days ${nd} won ${(100*wonD/Math.max(1,nd)).toFixed(1)}% stated ${(100*sp/Math.max(1,nd)).toFixed(1)}% ROI0.95 ${(100*fair/Math.max(1,nd)).toFixed(1)}% real ${realN?(100*real/realN).toFixed(1)+'% (n '+realN+')':'-'}`);
 }}
