import {load,SHIPPED} from './lib.mjs';
import {buildOOS,corr2} from './drift2.mjs';
import {report} from './evalp.mjs';
const {meta,rows}=load(); const use=rows.filter(r=>!r.unk&&!meta[r.lid].xr);
const idx=buildOOS(rows.filter(r=>!meta[r.lid].xr));
const ll=(p,y)=>-Math.log(Math.max(1e-6,y?p:1-p));
function score(fn){ const S={tr:[0,0],te:[0,0],nw:[0,0]}; for(const r of use){ const g=fn(r); const t=r.hg+r.ag; const l=ll(1-g.o35,t<3.5)+ll(g.o25,t>2.5)+ll(g.btts,r.hg>0&&r.ag>0); const k=r.date<'2025-07-01'?'tr':'te'; S[k][0]+=l;S[k][1]++; if(r.date>='2026-08-01'){S.nw[0]+=l;S.nw[1]++;} } return Object.fromEntries(Object.entries(S).map(([k,v])=>[k,+(v[0]/v[1]).toFixed(5)])); }
const b=score(r=>r); console.log('base',JSON.stringify(b));
for(const K of [100,200,300,500]) for(const k0 of [0,100,200,400]){ const s=score(r=>corr2(r,idx,{K,k0})); console.log(K,k0,'dTr',(s.tr-b.tr).toFixed(5),'dTe',(s.te-b.te).toFixed(5),'dNew',(s.nw-b.nw).toFixed(5)); }
