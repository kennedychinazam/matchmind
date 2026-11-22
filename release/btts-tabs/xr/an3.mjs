import {readFileSync} from 'node:fs'; import {summ} from '../lib.mjs';
const d=JSON.parse(readFileSync('xrg.json','utf8'));
const NT=new Set([1,4,6,19,32,29,960,36,5,10,37]);
const rows=d.rows.map(x=>({lid:x[0],date:x[1],hg:x[4],ag:x[5],o35:x[11],o25:x[10],unk:x[13]})).filter(r=>!r.unk);
for(const [sn,sf] of [['Club',r=>!NT.has(r.lid)],['NT comp',r=>NT.has(r.lid)&&r.lid!==10],['Friendlies',r=>r.lid===10]]){
 for(const extra of [0,-0.02,-0.04]){ const parts=[];
  for(const [lo,hi] of [[0.65,0.75],[0.75,1]]) for(const [w,a,b] of [['<25-07','2000','2025-07-01'],['25-07+','2025-07-01','9']]){ const L=[]; for(const r of rows){ if(!sf(r)||r.date<a||r.date>=b) continue; const p=1-r.o35-0.03+extra; if(p>=lo&&p<hi) L.push({code:'U35',prob:p,r}); } const s=summ(L); parts.push(`[${lo},${hi}) ${w} n ${s.graded} gap ${s.gap}`); }
  console.log(`${sn} U35 extra ${extra}: ${parts.join(' | ')}`); } }
