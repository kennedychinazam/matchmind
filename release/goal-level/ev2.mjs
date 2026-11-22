import {load,SHIPPED,summ,rawGoal,won} from './lib.mjs';
import {report} from './evalp.mjs';
import {corrP} from './pooled.mjs';
const {meta,rows}=load();
const show=o=>{ console.log('==',o.label); for(const p of ['test','new']){ console.log(' ',p,'cov',o[p].cov,'lean',o[p].lean,'ALL',JSON.stringify(o[p].strongAll)); for(const [k,v] of Object.entries(o[p])) if(k.includes('|')) console.log('    ',k.padEnd(26),v.graded,'hit',v.hit,'st',v.stated,'gap',v.gap); } };
const V={ pooled:[60,500,300,300], leagueOnly:[60,1e12,300,300], poolOnly:[60,500,0,0] };
for(const [name,[D,k0,KL,kL]] of Object.entries(V)){
  const rs=rows.map(r=>(r.unk||meta[r.lid].xr)?r:corrP(r,D,k0,KL,kL));
  // fit per-code shift on TRAIN (<2025-07-01) above p>=0.70, as build 284 did
  const sh={}; for(const c of ['U35','O25','BTS','U25','NBT']){ let n=0,e=0; for(const r of rs){ if(r.date>='2025-07-01'||r.unk||meta[r.lid].xr) continue; const p=rawGoal(r,c); if(p<0.70) continue; n++; e+=(won(c,r.hg,r.ag)==='hit')-p; } sh[c]=n?[n,+(e/n).toFixed(4),+(Math.sqrt(0.2*0.8/n)).toFixed(4)]:null; }
  console.log(name,'train shift (n, mean err, se)',JSON.stringify(sh));
  show(report(rs,SHIPPED,name+' + shipped U35 -0.0175'));
  show(report(rs,(c,p)=>p,name+' no shift'));
}
