import {load} from './lib.mjs';
const {meta,rows}=load();
const B={};
for(const r of rows){ if(r.unk||meta[r.lid].xr) continue; const k=r.date.slice(0,7); const b=(B[k]=B[k]||[0,0,0,0,0]); b[0]++; b[1]+=r.hg+r.ag; b[2]+=r.lh+r.la; b[3]+=(r.hg+r.ag>3.5); b[4]+=r.o35; }
for(const k of Object.keys(B).sort()){ const b=B[k]; if(b[0]<200) continue; console.log(k,b[0],'goals',(b[1]/b[0]).toFixed(2),'lam',(b[2]/b[0]).toFixed(2),'O35 act',(b[3]/b[0]*100).toFixed(1),'pred',(b[4]/b[0]*100).toFixed(1)); }
