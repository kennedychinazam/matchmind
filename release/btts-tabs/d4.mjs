import {load,summ,mkCal,rungs,base,MKT} from './lib.mjs';
const D=load(); const cal=mkCal({U35:-0.03,X2:-0.015,'1D':-0.015});
for(const skip2D of [false,true]) for(const [w,a,b] of [['train','2022-07-01','2025-07-01'],['test','2025-07-01','9'],['26-08','2026-08-01','9']]){
 const by={}; let n=0,nl=0;
 for(const r of D.rows){ if(r.date<a||r.date>=b||r.unk) continue; const M=D.meta[r.lid]; if(!M||M.xr) continue; n++;
  const sb=M.strong, ef=M.ef; const rs=rungs(r,cal,{goalsSet:['O25','U35','BTS']}); const edgeOk=x=>{const bb=base(r.N,x.code); const e=bb==null?null:x.prob-bb; return !(e!=null&&e<=ef);};
  let st=rs.find(x=>x.prob>=sb); if(st&&!edgeOk(st)) st=null; if(st) continue; let pick=null;
  for(const x of rs){ if(x.prob<0.65) continue; if(x.prob>=sb) break; if(skip2D&&x.code==='2D') continue; if(!edgeOk(x)) break; pick=x; break; }
  if(!pick) continue; nl++; const k=MKT(pick.code); (by[k]=by[k]||[]).push({code:pick.code,prob:pick.prob,r}); (by.ALL=by.ALL||[]).push({code:pick.code,prob:pick.prob,r}); }
 console.log(`skip2D ${skip2D} ${w} lean cov ${(100*nl/n).toFixed(1)}%`, Object.entries(by).map(([k,v])=>{const s=summ(v); return `${k} n ${s.graded} gap ${s.gap}`}).join(' | '));
}
