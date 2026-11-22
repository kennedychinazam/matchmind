import {load,summ,mkCal,rungs,base,MKT} from './lib.mjs';
const D=load();
const W=[['train 2022-07..2025-06','2022-07-01','2025-07-01'],['test 2025-07 on','2025-07-01','9'],['2026-08 on','2026-08-01','9']];
function lad(rows,meta,cal,goals,{from,to}){ const out=[];
  for(const r of rows){ if(r.date<from||r.date>=to||r.unk) continue; const M=meta[r.lid]; if(!M||M.xr) continue;
    const sb=M.strong, ef=M.ef; const rs=rungs(r,cal,{goalsSet:goals});
    const edgeOk=x=>{const b=base(r.N,x.code); const e=b==null?null:x.prob-b; return !(e!=null&&e<=ef);};
    let st=rs.find(x=>x.prob>=sb); let tier='strong'; if(st&&!edgeOk(st)) st=null; let pick=st;
    if(!st){ tier='lean'; pick=null; for(const x of rs){ if(x.prob<0.65) continue; if(x.prob>=sb) break; if(!edgeOk(x)) break; pick=x; break; } }
    out.push({r,tier:pick?tier:null,pick}); } return out; }
const V={
 'BEFORE (build 367: U35 -0.03, goals O25 U25 U35 BTS NBT)': [mkCal({U35:-0.03}),['O25','U25','U35','BTS','NBT']],
 'no U25 only': [mkCal({U35:-0.03}),['O25','U35','BTS','NBT']],
 'AFTER (no U25, no NBT, X2 -0.015, 1D -0.015)': [mkCal({U35:-0.03,X2:-0.015,'1D':-0.015}),['O25','U35','BTS']],
};
const keys=Object.keys(V); const res={};
for(const [nm,[cal,g]] of Object.entries(V)){ console.log('\n=====',nm);
  for(const [w,a,b] of W){ const P=lad(D.rows,D.meta,cal,g,{from:a,to:b}); res[nm+w]=P;
    const by={}; let nS=0,nL=0; const all=[],allL=[];
    for(const x of P){ if(!x.tier) continue; const o={code:x.pick.code,prob:x.pick.prob,r:x.r}; if(x.tier==='strong'){nS++;all.push(o);} else {nL++;allL.push(o);} const k=x.tier+'|'+MKT(x.pick.code)+(x.pick.code==='BTS'||x.pick.code==='NBT'||x.pick.code[0]==='U'?' '+x.pick.code:''); (by[k]=by[k]||[]).push(o); }
    const A=summ(all), B=summ(allL); console.log(`  ${w}: fixtures ${P.length} | Strong cov ${(nS/P.length*100).toFixed(1)}% n ${A.graded} hit ${A.hit} stated ${A.stated} gap ${A.gap} | Lean cov ${(nL/P.length*100).toFixed(1)}% n ${B.graded} hit ${B.hit} stated ${B.stated} gap ${B.gap}`);
    for(const k of Object.keys(by).sort()){ const s=summ(by[k]); console.log(`     ${k.padEnd(26)} n ${String(s.graded).padStart(5)} hit ${s.hit} stated ${s.stated} gap ${s.gap} (se ${s.se})`); }
  }
}
// change count before vs after on test window
for(const w of W.map(x=>x[0])){ const A=res[keys[0]+w], B=res[keys[1]+w], C=res[keys[2]+w]; let ch1=0,ch2=0;
  for(let i=0;i<A.length;i++){ const a=A[i].pick?A[i].tier+A[i].pick.code:'-', b=B[i].pick?B[i].tier+B[i].pick.code:'-', c=C[i].pick?C[i].tier+C[i].pick.code:'-'; if(a!==b) ch1++; if(a!==c) ch2++; }
  console.log(`${w}: picks changed by removing U25 alone: ${ch1} of ${A.length}; by the full AFTER set: ${ch2}`); }
