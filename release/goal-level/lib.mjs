import { readFileSync } from 'node:fs';
export function load(f='/tmp/claude-0/calbt/dumpL.json'){
  const d=JSON.parse(readFileSync(f,'utf8'));
  const rows=d.rows.map(r=>({lid:r[0],date:r[1],hg:r[2],ag:r[3],lh:r[4],la:r[5],pW:r[6],pD:r[7],pL:r[8],o15:r[9],o25:r[10],o35:r[11],btts:r[12],rates:r[13],DK:r[14],N:r[15],unk:r[16],i:r[17]}));
  rows.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  return {meta:d.meta,rows};
}
export const GOALS=['O25','U25','U35','BTS','NBT'];
export function won(code,h,a){
  const t=h+a, act=h>a?'1':h===a?'X':'2';
  switch(code){
    case 'O25': return t>2.5?'hit':'miss'; case 'U25': return t<2.5?'hit':'miss';
    case 'U35': return t<3.5?'hit':'miss'; case 'O15': return t>1.5?'hit':'miss';
    case 'BTS': return (h>0&&a>0)?'hit':'miss'; case 'NBT': return !(h>0&&a>0)?'hit':'miss';
    case '1': case 'X': case '2': return act===code?'hit':'miss';
    case '1X': return act!=='2'?'hit':'miss'; case 'X2': return act!=='1'?'hit':'miss';
    case '1D': return act==='1'?'hit':act==='X'?'void':'miss';
    case '2D': return act==='2'?'hit':act==='X'?'void':'miss';
  }
}
export function rawGoal(r,code){ return code==='O25'?r.o25:code==='U25'?1-r.o25:code==='U35'?1-r.o35:code==='BTS'?r.btts:code==='NBT'?1-r.btts:code==='O15'?r.o15:null; }
export function base(N,code,bd){ if(!N) return null; let [pW,pD,pL,o15,o25,o35,bt]=N; if(bd){o15+=bd.o15;o25+=bd.o25;o35+=bd.o35;bt+=bd.btts;} const nd=pW+pL;
  return {O25:o25,U25:1-o25,U35:1-o35,O15:o15,BTS:bt,NBT:1-bt,'1':pW,'X':pD,'2':pL,'1D':nd>0?pW/nd:0,'2D':nd>0?pL/nd:0,'1X':pW+pD,'X2':pD+pL}[code]; }
// rungsFor replica; cal(code, prob, r) returns calibrated prob
export function rungs(r,cal){
  const R=(c,p)=>({code:c,prob:cal(c,p,r)});
  const out=[]; const solo=[[cal('1',r.pW,r),'1'],[cal('X',r.pD,r),'X'],[cal('2',r.pL,r),'2']].sort((a,b)=>b[0]-a[0]);
  out.push({code:solo[0][1],prob:solo[0][0]});
  const dnb=r.pW+r.pL;
  if(dnb>0&&solo[0][1]!=='X') out.push(r.pW>=r.pL?R('1D',r.pW/dnb):R('2D',r.pL/dnb));
  out.push(r.pW>=r.pL?R('1X',r.pW+r.pD):R('X2',r.pD+r.pL));
  const g=[R('O25',r.o25),R('U25',1-r.o25),R('U35',1-r.o35),R('BTS',r.btts),R('NBT',1-r.btts)].sort((a,b)=>b.prob-a.prob);
  out.push(g[0]); return out;
}
export const SHIPPED=(c,p)=>c==='U35'?Math.min(0.995,Math.max(0.005,p-0.0175)):p;
export const MKT=c=>({'1':'Winner','2':'Winner','X':'Winner','1X':'Double chance','X2':'Double chance','1D':'Draw no bet','2D':'Draw no bet'}[c]||(c[0]==='U'?'Under goals':c[0]==='O'?'Over goals':'BTTS'));
// official (Strong) and Lean pick per row
export function picks(rows,meta,cal,{from='2025-07-01',strongMin=null,leanMin=0.65}={}){
  const out=[];
  for(const r of rows){
    if(r.date<from||r.unk) continue; const M=meta[r.lid]; if(!M||M.xr) continue;
    const sb=strongMin!=null?Math.max(strongMin,M.bar):M.strong, ef=M.ef;
    const rs=rungs(r,cal);
    const edgeOk=x=>{const b=base(r.N,x.code,r.bd); const e=b==null?null:x.prob-b; return !(e!=null&&e<=ef);};
    let st=rs.find(x=>x.prob>=sb); let tier='strong';
    if(st && !edgeOk(st)) st=null;
    let pick=st;
    if(!st){ // lean: first rung >= leanMin; if any rung >= sb exists (failed edge) -> none
      tier='lean'; pick=null;
      for(const x of rs){ if(x.prob<leanMin) continue; if(x.prob>=sb) break; if(!edgeOk(x)) break; pick=x; break; }
    }
    out.push({r,tier:pick?tier:null,pick});
  }
  return out;
}
export function summ(list){ let n=0,h=0,v=0,sp=0; for(const x of list){ const g=won(x.code,x.r.hg,x.r.ag); n++; if(g==='void'){v++;continue;} sp+=x.prob; if(g==='hit')h++; } const gr=n-v; return {n,graded:gr,hit:gr?+(h/gr*100).toFixed(1):null,stated:gr?+(sp/gr*100).toFixed(1):null,gap:gr?+((h-sp)/gr*100).toFixed(1):null,se:gr?+(Math.sqrt((sp/gr)*(1-sp/gr)/gr)*100).toFixed(1):null}; }
