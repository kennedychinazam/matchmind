import {load,summ,mkCal,rungs,base,MKT} from './lib.mjs';
const D=load();
const W=[['train','2022-07-01','2025-07-01'],['test','2025-07-01','9'],['26-08','2026-08-01','9']];
function lad(cal,g,from,to){ const out=[]; for(const r of D.rows){ if(r.date<from||r.date>=to||r.unk) continue; const M=D.meta[r.lid]; if(!M||M.xr) continue;
 const sb=M.strong, ef=M.ef; const rs=rungs(r,cal,{goalsSet:g}); const edgeOk=x=>{const b=base(r.N,x.code); const e=b==null?null:x.prob-b; return !(e!=null&&e<=ef);};
 let st=rs.find(x=>x.prob>=sb); let tier='strong'; if(st&&!edgeOk(st)) st=null; let pick=st;
 if(!st){ tier='lean'; pick=null; for(const x of rs){ if(x.prob<0.65) continue; if(x.prob>=sb) break; if(!edgeOk(x)) break; pick=x; break; } } out.push({r,tier:pick?tier:null,pick}); } return out; }
for(const [nm,S] of [['X2 only',{U35:-0.03,X2:-0.015}],['X2,1D-0.01',{U35:-0.03,X2:-0.015,'1D':-0.01}],['X2,1D-0.015',{U35:-0.03,X2:-0.015,'1D':-0.015}],['X2,1D,2D -0.015/-0.01',{U35:-0.03,X2:-0.015,'1D':-0.01,'2D':-0.01}],['X2,1X-0.005,1D-0.01',{U35:-0.03,X2:-0.015,'1X':-0.005,'1D':-0.01}]]){
  const cal=mkCal(S); const line=[];
  for(const [w,a,b] of W){ const P=lad(cal,['O25','U35','BTS'],a,b); const g=(t,cs)=>summ(P.filter(x=>x.tier===t&&cs.includes(x.pick.code)).map(x=>({code:x.pick.code,prob:x.pick.prob,r:x.r})));
    const sd=g('strong',['1D','2D']), sc=g('strong',['1X','X2']), ld=g('lean',['1D','2D']), lc=g('lean',['1X','X2']), sa=g('strong',['1','2','X','1D','2D','1X','X2','O25','U35','BTS']), la=g('lean',['1','2','X','1D','2D','1X','X2','O25','U35','BTS']);
    line.push(`${w}: S-DNB ${sd.gap} S-DC ${sc.gap} L-DNB ${ld.gap} L-DC ${lc.gap} | S all ${sa.gap} cov ${(100*sa.n/P.length).toFixed(1)} L all ${la.gap}`); }
  console.log(nm.padEnd(24), line.join(' || '));
}
