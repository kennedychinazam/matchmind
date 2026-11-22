import { readFileSync } from 'node:fs';
export function load(f='/tmp/claude-0/bb/dump367.json'){
  const d=JSON.parse(readFileSync(f,'utf8'));
  const ft=new Map(JSON.parse(readFileSync('/tmp/claude-0/bb/ft90.json','utf8')).map(r=>[r[0]+'|'+r[1]+'|'+r[2]+'|'+r[3],[r[4],r[5]]]));
  const od=new Map(JSON.parse(readFileSync('/tmp/claude-0/bb/odds.json','utf8')).map(r=>[r[0]+'|'+r[1]+'|'+r[2]+'|'+r[3],r]));
  // names in dump rows aren't stored; dump rows have index i -> use data.json to recover names
  const data=JSON.parse(readFileSync('/tmp/claude-0/bt/data.json','utf8'));
  let fixed=0, priced=0;
  const rows=d.rows.map(r=>{ const o={lid:r[0],date:r[1],hg:r[2],ag:r[3],lh:r[4],la:r[5],pW:r[6],pD:r[7],pL:r[8],o15:r[9],o25:r[10],o35:r[11],btts:r[12],DK:r[14],N:r[15],unk:r[16],i:r[17]}; return o; });
  // recover names: rebuild L.matches order as in dump-page (rows with date>=cut, sorted by date, stable)
  const byLid={};
  for(const lid of Object.keys(data)){ const ms=data[lid].filter(x=>x[0]>=d.cut).map(x=>x); ms.sort((a,b)=>a[0]<b[0]?-1:1); byLid[lid]=ms; }
  for(const o of rows){ const m=byLid[o.lid]&&byLid[o.lid][o.i]; if(!m||m[0]!==o.date){ o.home=null; continue; } o.home=m[2]; o.away=m[3];
    const k=o.lid+'|'+o.date+'|'+o.home+'|'+o.away; const f=ft.get(k); if(f){o.hg=f[0];o.ag=f[1];fixed++;}
    const q=od.get(k); if(q){ o.odds={'1':q[4],'X':q[5],'2':q[6],O25:q[7],U25:q[8],O35:q[9],U35:q[10],BTS:q[11],NBT:q[12],'1X':q[13],'X2':q[14],'1D':q[15],'2D':q[16]}; priced++; } }
  rows.sort((a,b)=>a.date<b.date?-1:a.date>b.date?1:0);
  return {meta:d.meta,rows,fixed,priced,build:d.build};
}
export function won(code,h,a){
  const t=h+a, act=h>a?'1':h===a?'X':'2';
  switch(code){
    case 'O25': return t>2.5?'hit':'miss'; case 'U25': return t<2.5?'hit':'miss';
    case 'U35': return t<3.5?'hit':'miss'; case 'O35': return t>3.5?'hit':'miss'; case 'O15': return t>1.5?'hit':'miss';
    case 'BTS': return (h>0&&a>0)?'hit':'miss'; case 'NBT': return !(h>0&&a>0)?'hit':'miss';
    case '1': case 'X': case '2': return act===code?'hit':'miss';
    case '1X': return act!=='2'?'hit':'miss'; case 'X2': return act!=='1'?'hit':'miss';
    case '1D': return act==='1'?'hit':act==='X'?'void':'miss';
    case '2D': return act==='2'?'hit':act==='X'?'void':'miss';
  }
}
export const raw=(r,c)=>({O25:r.o25,U25:1-r.o25,U35:1-r.o35,O35:r.o35,O15:r.o15,BTS:r.btts,NBT:1-r.btts,'1':r.pW,'X':r.pD,'2':r.pL,'1X':r.pW+r.pD,'X2':r.pD+r.pL,'1D':(r.pW+r.pL)>0?r.pW/(r.pW+r.pL):0,'2D':(r.pW+r.pL)>0?r.pL/(r.pW+r.pL):0}[c]);
export function base(N,code){ if(!N) return null; const [pW,pD,pL,o15,o25,o35,bt]=N; const nd=pW+pL;
  return {O25:o25,U25:1-o25,U35:1-o35,O35:o35,O15:o15,BTS:bt,NBT:1-bt,'1':pW,'X':pD,'2':pL,'1D':nd>0?pW/nd:0,'2D':nd>0?pL/nd:0,'1X':pW+pD,'X2':pD+pL}[code]; }
export const mkCal=S=>(c,p)=>{ const s=S[c]; return s==null?p:Math.min(0.995,Math.max(0.005,p+s)); };
export function rungs(r,cal,{noU25=false,goalsSet=null}={}){
  const R=(c)=>({code:c,prob:cal(c,raw(r,c))});
  const out=[]; const solo=[R('1'),R('X'),R('2')].sort((a,b)=>b.prob-a.prob);
  out.push(solo[0]);
  if((r.pW+r.pL)>0&&solo[0].code!=='X') out.push(r.pW>=r.pL?R('1D'):R('2D'));
  out.push(r.pW>=r.pL?R('1X'):R('X2'));
  const gs=goalsSet||(noU25?['O25','U35','BTS','NBT']:['O25','U25','U35','BTS','NBT']);
  const g=gs.map(R).sort((a,b)=>b.prob-a.prob); out.push(g[0]); return out;
}
export const MKT=c=>({'1':'Winner','2':'Winner','X':'Winner','1X':'Double chance','X2':'Double chance','1D':'Draw no bet','2D':'Draw no bet','BTS':'BTTS','NBT':'BTTS'}[c]||(c[0]==='U'?'Under goals':'Over goals'));
export function ladder(rows,meta,cal,{from='2025-07-01',to='9',leanMin=0.65,noU25=false,xr=false}={}){
  const out=[];
  for(const r of rows){
    if(r.date<from||r.date>=to||r.unk) continue; const M=meta[r.lid]; if(!M) continue; if(!xr&&M.xr) continue;
    const sb=M.strong, ef=M.ef; const rs=rungs(r,cal,{noU25});
    const edgeOk=x=>{const b=base(r.N,x.code); const e=b==null?null:x.prob-b; return !(e!=null&&e<=ef);};
    let st=rs.find(x=>x.prob>=sb); let tier='strong'; if(st&&!edgeOk(st)) st=null; let pick=st;
    if(!st){ tier='lean'; pick=null; for(const x of rs){ if(x.prob<leanMin) continue; if(x.prob>=sb) break; if(!edgeOk(x)) break; pick=x; break; } }
    out.push({r,tier:pick?tier:null,pick});
  }
  return out;
}
export function summ(list){ let n=0,h=0,v=0,sp=0,roiN=0,roi=0,fair=0; for(const x of list){ const g=won(x.code,x.r.hg,x.r.ag); n++; if(g==='void'){v++;continue;} sp+=x.prob; const hit=g==='hit'; if(hit)h++;
   fair+= (hit? 0.95/x.prob:0)-1; const px=x.r.odds&&x.r.odds[x.code]; if(px>1){roiN++; roi+=(hit?px:0)-1;} }
  const gr=n-v; const f=v=>+(v*100).toFixed(1);
  return {n,graded:gr,hit:gr?f(h/gr):null,stated:gr?f(sp/gr):null,gap:gr?f((h-sp)/gr):null,se:gr?f(Math.sqrt((sp/gr)*(1-sp/gr)/gr)):null,roiFair:gr?f(fair/gr):null,pricedN:roiN,roiReal:roiN?f(roi/roiN):null}; }
