import {load,won,summ} from './lib.mjs';
import {corrP} from './pooled.mjs';
const {meta,rows}=load();
const NEW=rows.map(r=>(r.unk||meta[r.lid].xr)?r:corrP(r,60,500,300,300));
const get=(r,c)=>({O15:r.o15,O25:r.o25,BTS:r.btts,U35:1-r.o35-0.025,'1X':r.pW+r.pD,'X2':r.pD+r.pL,'1':r.pW,'2':r.pL}[c]);
const getOld=(r,c)=>c==='U35'?1-r.o35-0.0175:get(r,c);
for(const [nm,rs,g] of [['before',rows,getOld],['after',NEW,get]]) for(const [w,f] of [['2025-07+','2025-07-01'],['2026-08+','2026-08-01']]){
  const out=[]; for(const [lo,hi] of [[0.65,0.70],[0.70,0.72],[0.72,0.75],[0.75,0.80]]) for(const c of ['O15','O25','BTS','U35']){ const L=[]; for(const r of rs){ if(r.date<f||r.unk||meta[r.lid].xr) continue; const p=g(r,c); if(p>=lo&&p<hi) L.push({code:c,prob:p,r}); } const s=summ(L); if(s.graded>=40) out.push(`${c}[${lo}-${hi}) n${s.graded} ${s.hit}/${s.stated}`); }
  console.log(nm,w,out.join(' | ')); }
