import {load,picks,SHIPPED,summ,MKT,rawGoal,won} from './lib.mjs';
const {meta,rows}=load();
const P=picks(rows,meta,SHIPPED,{from:'2023-07-01'});
const by={};
for(const x of P) if(x.tier==='strong'){ const k=x.r.date.slice(0,7)>='2026-08'?'2026-08+':x.r.date.slice(0,4)+(x.r.date.slice(5,7)>='07'?'H2':'H1'); const m=MKT(x.pick.code); (by[k+'|'+m]=by[k+'|'+m]||[]).push({code:x.pick.code,prob:x.pick.prob,r:x.r}); }
for(const k of Object.keys(by).sort()) console.log(k, JSON.stringify(summ(by[k])));
// unconditional U35 by period for p>=0.75
const U={}; for(const r of rows){ if(r.unk||meta[r.lid].xr) continue; const p=SHIPPED('U35',1-r.o35); if(p<0.75) continue; const k=r.date.slice(0,7)>='2026-08'?'2026-08+':r.date.slice(0,4); (U[k]=U[k]||[]).push({code:'U35',prob:p,r}); }
for(const k of Object.keys(U).sort()) console.log('uncond U35>=.75',k,JSON.stringify(summ(U[k])));
