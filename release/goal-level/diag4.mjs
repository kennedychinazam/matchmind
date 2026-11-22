import {load} from './lib.mjs';
const {meta,rows}=load();
const A={};
for(const r of rows){ if(r.unk||meta[r.lid].xr) continue; const k=r.date>='2026-08-01'?'new':r.date>='2025-08-01'?'prev':null; if(!k) continue; const a=(A[r.lid]=A[r.lid]||{new:[0,0,0],prev:[0,0,0]}); a[k][0]++; a[k][1]+=r.hg+r.ag; a[k][2]+=r.lh+r.la; }
let up=0,dn=0; for(const [l,a] of Object.entries(A)){ if(a.new[0]<30) continue; const dn_=a.new[1]/a.new[0]-a.new[2]/a.new[0]; if(dn_>0)up++; else dn++; console.log(meta[l].name.padEnd(28), a.new[0], (a.new[1]/a.new[0]).toFixed(2), (a.new[2]/a.new[0]).toFixed(2), 'prev', (a.prev[1]/a.prev[0]).toFixed(2), (a.prev[2]/a.prev[0]).toFixed(2)); }
console.log('under-predicted',up,'over',dn);
