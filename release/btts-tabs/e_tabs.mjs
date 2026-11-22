import {load,summ,mkCal,rungs,base,raw} from './lib.mjs';
const D=load();
const W=[['train 2022-07..2025-06','2022-07-01','2025-07-01'],['test 2025-07 on','2025-07-01','9'],['2026-08 on','2026-08-01','9']];
const OLD=mkCal({U35:-0.03}), NEW=mkCal({U35:-0.03,X2:-0.015,'1D':-0.015});
const ok=r=>!r.unk&&D.meta[r.lid]&&!D.meta[r.lid].xr;
// bar search
function barFor(c,cal,lo=0.60){ for(let t=lo;t<=0.90;t=+(t+0.01).toFixed(2)){ let good=true, any=false; for(const [w,a,b] of W){ const L=[]; for(const r of D.rows){ if(r.date<a||r.date>=b||!ok(r)) continue; const p=cal(c,raw(r,c)); if(p>=t) L.push({code:c,prob:p,r}); } const s=summ(L); if(s.graded<100){ continue; } any=true; if(Math.abs(s.gap)>2) good=false; } if(good&&any) return t; } return null; }
const BARS={}; for(const c of ['BTS','NBT','O25','O35','U35']) BARS[c]=barFor(c,NEW); BARS.O35=BARS.O35||BARS.O25; console.log('measured bars',JSON.stringify(BARS));
function strongOf(r,cal,goals){ const M=D.meta[r.lid]; const rs=rungs(r,cal,{goalsSet:goals}); const st=rs.find(x=>x.prob>=M.strong); if(!st) return null; const b=base(r.N,st.code); if(b!=null&&st.prob-b<=M.ef) return null; return st; }
function resultOf(r,cal){ const M=D.meta[r.lid]; const rs=rungs(r,cal).slice(0,-1); const st=rs.find(x=>x.prob>=M.strong); if(!st) return null; const b=base(r.N,st.code); if(b!=null&&st.prob-b<=M.ef) return null; return st; }
function headline(r){ const s=[[r.pW,'1'],[r.pD,'X'],[r.pL,'2']].sort((a,b)=>b[0]-a[0]); if(s[0][0]>=0.55||s[0][1]==='X') return {code:s[0][1],prob:s[0][0]}; const dc=s[0][1]==='1'?{code:'1X',prob:r.pW+r.pD}:{code:'X2',prob:r.pD+r.pL}; return dc.prob<0.62?{code:s[0][1],prob:s[0][0]}:dc; }
const TABS={
 'Winner BEFORE (official-pick fixtures, headline 1X2/DC)': r=>strongOf(r,OLD,['O25','U25','U35','BTS','NBT'])?headline(r):null,
 'Winner AFTER (result rung at the Strong bar)': r=>resultOf(r,NEW),
 'O/U 2.5 BEFORE (official-pick fixtures, O2.5 or U2.5)': r=>strongOf(r,OLD,['O25','U25','U35','BTS','NBT'])?(r.o25>=0.5?{code:'O25',prob:r.o25}:{code:'U25',prob:1-r.o25}):null,
 'Goals AFTER (O2.5/O3.5/U3.5 at own bars)': r=>{ const c=[]; for(const k of ['O25','O35','U35']){ const p=NEW(k,raw(r,k)); if(p>=BARS[k]) c.push({code:k,prob:p,m:p-BARS[k]}); } c.sort((a,b)=>b.m-a.m); return c[0]||null; },
 'BTTS BEFORE (official-pick fixtures, Yes or No)': r=>strongOf(r,OLD,['O25','U25','U35','BTS','NBT'])?(r.btts>=0.5?{code:'BTS',prob:r.btts}:{code:'NBT',prob:1-r.btts}):null,
 'BTTS AFTER (BTTS Yes at its bar)': r=>{ const p=raw(r,'BTS'); return p>=BARS.BTS?{code:'BTS',prob:p,m:p-BARS.BTS}:null; },
};
for(const [nm,f] of Object.entries(TABS)){ console.log('\n'+nm);
 for(const [w,a,b] of W){ const all=[], days={}; let N=0, noWin=0;
  for(const r of D.rows){ if(r.date<a||r.date>=b||!ok(r)) continue; N++; const s=f(r); if(!s) continue; const x={...s,r}; all.push(x); (days[r.date]=days[r.date]||[]).push(x); if(!resultOf(r,NEW)) noWin++; }
  const top=[]; for(const d of Object.values(days)){ d.sort((p,q)=>(q.m!=null?q.m-p.m:q.prob-p.prob)); top.push(...d.slice(0,30)); }
  const s=summ(all), t=summ(top); const codes={}; for(const x of all) codes[x.code]=(codes[x.code]||0)+1;
  console.log(`  ${w}: listed ${all.length} of ${N} (${(100*all.length/N).toFixed(1)}%), no-winner-pick fixtures among them ${(100*noWin/Math.max(1,all.length)).toFixed(0)}% | all: hit ${s.hit} stated ${s.stated} gap ${s.gap} (se ${s.se}) ROI0.95 ${s.roiFair} real ${s.roiReal}(n ${s.pricedN}) | top30/day: n ${t.graded} hit ${t.hit} stated ${t.stated} gap ${t.gap} | mix ${JSON.stringify(codes)}`); }
}
