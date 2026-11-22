import {load,won,picks,summ,MKT,SHIPPED,rawGoal} from './lib.mjs';
import {leagueArrays,corrected} from './drift.mjs';
const {meta,rows}=load(); const A=leagueArrays();
export function withGoals(fn){ return rows.map(r=>{ if(r.unk||meta[r.lid].xr) return r; const g=fn(r); return {...r,o15:g.o15,o25:g.o25,o35:g.o35,btts:g.btts}; }); }
export function report(rs,cal,label,from='2025-07-01'){
  const out={label};
  for(const [pn,fr,to] of [['test',from,'9999'],['new','2026-08-01','9999']]){
    const P=picks(rs,meta,cal,{from:fr});
    const by={}; let nS=0,nL=0; for(const x of P){ if(x.tier==='strong')nS++; if(x.tier==='lean')nL++; if(!x.tier) continue; const k=x.tier+'|'+MKT(x.pick.code); (by[k]=by[k]||[]).push({code:x.pick.code,prob:x.pick.prob,r:x.r}); }
    const all=[]; for(const [k,v] of Object.entries(by)) if(k.startsWith('strong')) all.push(...v);
    out[pn]={cov:+(nS/P.length).toFixed(3),lean:+(nL/P.length).toFixed(3),strongAll:summ(all),...Object.fromEntries(Object.entries(by).sort().map(([k,v])=>[k,summ(v)]))};
  }
  return out;
}
export {meta,rows,A};
if(process.argv[2]==='run'){
  const show=o=>{ console.log('==',o.label); for(const p of ['test','new']){ console.log(' ',p,'cov',o[p].cov,'lean',o[p].lean,'ALL',JSON.stringify(o[p].strongAll)); for(const [k,v] of Object.entries(o[p])) if(k.includes('|')) console.log('    ',k.padEnd(26),v.graded,'hit',v.hit,'st',v.stated,'gap',v.gap); } };
  show(report(rows,SHIPPED,'shipped'));
  for(const [K,k0] of [[300,200],[100,400],[200,200]]) show(report(withGoals(r=>corrected(r,A,{K,k0})),SHIPPED,`drift K${K} k0 ${k0} + shipped U35 shift`));
  const NOSH=(c,p)=>p; for(const [K,k0] of [[300,200]]) show(report(withGoals(r=>corrected(r,A,{K,k0})),NOSH,`drift K${K} k0 ${k0}, no shift`));
}
