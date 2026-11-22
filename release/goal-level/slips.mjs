import {load,rungs,base,won,SHIPPED} from './lib.mjs';
import {corrP} from './pooled.mjs';
const {meta,rows}=load(process.env.DUMP||undefined);
const TIERS=[{key:'safe',target:2,band:[2,2.4],minLegs:2,maxLegs:3},{key:'value',target:5,band:[5,6],minLegs:3,maxLegs:5},{key:'bold',target:10,band:[10,12.5],minLegs:3,maxLegs:8}];
const MARGIN=+(process.env.MARGIN||0.95);
const rank=c=>c.code==='BTS'?0:['O15','O25','O35'].includes(c.code)?1:['U15','U25','U35'].includes(c.code)?3:2;
const fam=c=>c.code==='BTS'?'B':['O15','O25','O35'].includes(c.code)?'O':['U15','U25','U35'].includes(c.code)?'U':'W';
const odds=c=>MARGIN/c.prob;
function search(pool,tier,preferGoals){
  const L=Math.round((tier.minLegs+tier.maxLegs)/2), ideal=Math.pow(tier.target,1/L);
  const ranked=pool.slice().sort((a,b)=>Math.abs(odds(a)-ideal)-Math.abs(odds(b)-ideal));
  const seen={},items=[]; for(const c of ranked){ if(items.length>=18)break; const n=seen[c.code]||0; if(n>=6)continue; seen[c.code]=n+1; items.push(c);} for(const c of ranked){ if(items.length>=18)break; if(!items.includes(c)) items.push(c);}
  const [lo,hi]=tier.band, cap=Math.max(1,Math.ceil(tier.maxLegs*0.5)); let best=null; const F={}, pick=[];
  const within=legs=>{ const cp=Math.max(1,Math.ceil(legs.length*0.5)),c={}; for(const l of legs){const f=fam(l); c[f]=(c[f]||0)+1; if(c[f]>cp) return false;} return true; };
  (function walk(s,prod,ng){
    if(pick.length>=tier.minLegs && prod>=lo && prod<=hi && within(pick)){ const d=Math.abs(prod-tier.target); const better=!best||(preferGoals?(ng>best.ng||(ng===best.ng&&d<best.d)):d<best.d); if(better) best={d,ng,legs:pick.slice(),reached:prod}; }
    if(pick.length>=tier.maxLegs) return;
    for(let i=s;i<items.length;i++){ const p=prod*odds(items[i]); if(p>hi+1e-9) continue; const f=fam(items[i]); if((F[f]||0)+1>cap) continue; F[f]=(F[f]||0)+1; pick.push(items[i]); walk(i+1,p,ng+(rank(items[i])<=1?1:0)); pick.pop(); F[f]--; if(!preferGoals&&best&&best.d<1e-9) return; }
  })(0,1,0);
  return best;
}
export function simulate(rs,cal,{floorLO,floorHI=0.70,preferGoals,from='2025-07-01',to='9'}){
  const FL={'1':floorHI,'X':floorHI,'2':floorHI,'1X':floorHI,'X2':floorHI,BTS:floorLO,O15:floorHI,O25:floorLO,O35:floorLO,U35:floorHI};
  const FLW={...FL,U35:floorLO};
  const byDay={};
  for(const r of rs){ if(r.date<from||r.date>=to||r.unk) continue; const M=meta[r.lid]; if(!M||M.xr) continue;
    const rr=rungs(r,cal); const g=rr.find(x=>x.prob>=M.bar); if(!g) continue; const b=base(r.N,g.code,r.bd); if(b!=null&&g.prob-b<=M.ef) continue; // published fixture
    const c=[]; const add=(code,p)=>c.push({code,prob:cal(code,p,r),r});
    add('1',r.pW);add('X',r.pD);add('2',r.pL);add('1X',r.pW+r.pD);add('X2',r.pD+r.pL);add('BTS',r.btts);add('O15',r.o15);add('O25',r.o25);add('O35',r.o35);add('U35',1-r.o35);
    (byDay[r.date]=byDay[r.date]||[]).push(c); }
  const res={}; for(const t of TIERS) res[t.key]={days:0,built:0,won:0,sp:0,legs:0,mix:{},legHit:0,legSp:0};
  for(const [day,fxs] of Object.entries(byDay)){
    const used=new Set();
    for(const t of TIERS){ const R=res[t.key]; R.days++;
      let best=null;
      for(const F of [FL,FLW]){ const pool=[]; fxs.forEach((cs,k)=>{ if(used.has(k)) return; const el=cs.filter(c=>FL[c.code]!=null&&c.prob>=F[c.code]); if(!el.length) return; el.sort((a,b)=>rank(a)-rank(b)||a.prob-b.prob); pool.push({...el[0],k}); }); best=search(pool,t,preferGoals); if(best) break; }
      if(!best) continue; R.built++; let p=1,ok=true; for(const l of best.legs){ used.add(l.k); p*=l.prob; const h=won(l.code,l.r.hg,l.r.ag)==='hit'; if(!h) ok=false; R.legs++; R.legHit+=h; R.legSp+=l.prob; R.mix[fam(l)]=(R.mix[fam(l)]||0)+1; }
      R.sp+=p; if(ok) R.won++; }
  }
  const out={}; for(const [k,R] of Object.entries(res)) out[k]={days:R.days,built:R.built,win:R.built?+(R.won/R.built*100).toFixed(1):null,stated:R.built?+(R.sp/R.built*100).toFixed(1):null,legHit:R.legs?+(R.legHit/R.legs*100).toFixed(1):null,legStated:R.legs?+(R.legSp/R.legs*100).toFixed(1):null,mix:Object.fromEntries(Object.entries(R.mix).map(([f,n])=>[f,+(n/R.legs*100).toFixed(0)]))};
  return out;
}
if(process.argv[2]==='run'){
  const NEW=rows.map(r=>(r.unk||meta[r.lid].xr)?r:corrP(r,60,500,300,300));
  const NEWCAL=(c,p)=>c==='U35'?Math.min(0.995,Math.max(0.005,p-0.025)):p;
  const V=[['before: shipped, LO 0.65, preferGoals',rows,SHIPPED,{floorLO:0.65,preferGoals:true}],
    ['new goals, LO 0.65, preferGoals',NEW,NEWCAL,{floorLO:0.65,preferGoals:true}],
    ['new goals, 0.70, no preferGoals',NEW,NEWCAL,{floorLO:0.70,preferGoals:false}],
    ['new goals, 0.72, no preferGoals',NEW,NEWCAL,{floorLO:0.72,floorHI:0.72,preferGoals:false}],
    ['new goals, 0.75, no preferGoals',NEW,NEWCAL,{floorLO:0.75,floorHI:0.75,preferGoals:false}],
    ['new goals, 0.70, preferGoals',NEW,NEWCAL,{floorLO:0.70,preferGoals:true}]];
  for(const [n,rs,cal,o] of V) for(const [w,f] of [['2025-07+','2025-07-01'],['2026-08+','2026-08-01']]){ const s=simulate(rs,cal,{...o,from:f}); console.log(n.padEnd(40),w,Object.entries(s).map(([k,v])=>`${k}: ${v.built}/${v.days} win ${v.win} st ${v.stated} leg ${v.legHit}/${v.legStated} ${JSON.stringify(v.mix)}`).join(' | ')); }
}
