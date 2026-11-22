import {readFileSync} from 'node:fs'; import {summ} from '../lib.mjs';
const d=JSON.parse(readFileSync('xrg.json','utf8'));
const ft=new Map(JSON.parse(readFileSync('/tmp/claude-0/bb/ft90.json','utf8')).map(r=>[r[0]+'|'+r[1]+'|'+r[2]+'|'+r[3],[r[4],r[5]]]));
const NT=new Set([1,4,6,19,32,29,960,36,5,10,37]);
const rows=d.rows.map(x=>{ const k=x[0]+'|'+x[1]+'|'+x[2]+'|'+x[3]; const f=ft.get(k); return {lid:x[0],date:x[1],hg:f?f[0]:x[4],ag:f?f[1]:x[5],pW:x[6],pD:x[7],pL:x[8],o15:x[9],o25:x[10],o35:x[11],btts:x[12],unk:x[13],nt:NT.has(x[0])}; }).filter(r=>!r.unk&&r.hg!=null);
const R={O25:r=>r.o25,U35:r=>1-r.o35,BTS:r=>r.btts,'1':r=>r.pW,'2':r=>r.pL,'X':r=>r.pD,'1X':r=>r.pW+r.pD,'X2':r=>r.pD+r.pL,'1D':r=>r.pW/(r.pW+r.pL),'2D':r=>r.pL/(r.pW+r.pL)};
function lad(r,S){ const cal=(c)=>{const p=R[c](r); const s=S[c]; return s==null?p:Math.min(.995,Math.max(.005,p+s));};
  const rs=[]; const solo=['1','X','2'].map(c=>({code:c,prob:cal(c)})).sort((a,b)=>b.prob-a.prob); rs.push(solo[0]);
  if(solo[0].code!=='X') rs.push(r.pW>=r.pL?{code:'1D',prob:cal('1D')}:{code:'2D',prob:cal('2D')}); rs.push(r.pW>=r.pL?{code:'1X',prob:cal('1X')}:{code:'X2',prob:cal('X2')});
  const g=['O25','U35','BTS'].map(c=>({code:c,prob:cal(c)})).sort((a,b)=>b.prob-a.prob); rs.push(g[0]);
  const st=rs.find(x=>x.prob>=0.75); if(st) return {tier:'S',...st}; const ln=rs.find(x=>x.prob>=0.65); return ln?{tier:'L',...ln}:null; }
const seg=[['Club',r=>!r.nt],['NT comp',r=>r.nt&&r.lid!==10],['Friendlies',r=>r.lid===10]];
for(const [nm,S] of [['app today (U35 -0.03 everywhere)',{U35:-0.03,X2:-0.015,'1D':-0.015}],['+ XR goals shift U35 -0.06 club, O25 -0.05 NT',null]]){
 console.log('\n==',nm);
 for(const [sn,sf] of seg) for(const [w,a,b] of [['<2025-07','2000','2025-07-01'],['2025-07+','2025-07-01','9']]){
  const by={}; for(const r of rows){ if(!sf(r)||r.date<a||r.date>=b) continue; const SS=S||(r.nt?{U35:-0.03,X2:-0.015,'1D':-0.015,O25:-0.05}:{U35:-0.06,X2:-0.015,'1D':-0.015}); const p=lad(r,SS); if(!p) continue; const k=p.tier+'|'+(['O25','U35','BTS'].includes(p.code)?p.code:'result'); (by[k]=by[k]||[]).push({code:p.code,prob:p.prob,r}); }
  console.log(`  ${sn} ${w}: `+Object.keys(by).sort().map(k=>{const s=summ(by[k]); return `${k} n ${s.graded} gap ${s.gap}(se ${s.se})`}).join(' | '));
 }}
// sweep shift for goals codes on all fixtures >= threshold
for(const [sn,sf] of seg) for(const c of ['U35','O25']){ const line=[]; for(const sh of [0,-0.03,-0.05,-0.07]){ const parts=[]; for(const [w,a,b] of [['<2025-07','2000','2025-07-01'],['2025-07+','2025-07-01','9']]){ const L=[]; for(const r of rows){ if(!sf(r)||r.date<a||r.date>=b) continue; const p=R[c](r)+sh; if(p>=0.75) L.push({code:c,prob:p,r}); } const s=summ(L); parts.push(`${w} n ${s.graded} gap ${s.gap}`);} line.push(`sh ${sh}: ${parts.join(', ')}`);} console.log(`${sn} ${c} >=0.75: `+line.join(' | ')); }
