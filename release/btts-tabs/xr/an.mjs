import {readFileSync} from 'node:fs'; import {summ} from '../lib.mjs';
const d=JSON.parse(readFileSync('xrg.json','utf8'));
const ft=new Map(JSON.parse(readFileSync('/tmp/claude-0/bb/ft90.json','utf8')).map(r=>[r[0]+'|'+r[1]+'|'+r[2]+'|'+r[3],[r[4],r[5]]]));
const NT=new Set([1,4,6,19,32,29,960,36,5,10,37]);
const rows=d.rows.map(x=>{ const k=x[0]+'|'+x[1]+'|'+x[2]+'|'+x[3]; const f=ft.get(k); return {lid:x[0],date:x[1],hg:f?f[0]:x[4],ag:f?f[1]:x[5],pW:x[6],pD:x[7],pL:x[8],o15:x[9],o25:x[10],o35:x[11],btts:x[12],unk:x[13],nt:NT.has(x[0])}; }).filter(r=>!r.unk&&r.hg!=null);
const P={O25:r=>r.o25,U25:r=>1-r.o25,U35:r=>1-r.o35,O15:r=>r.o15,BTS:r=>r.btts,NBT:r=>1-r.btts};
for(const seg of [['Club continental',r=>!r.nt],['National teams (no friendlies)',r=>r.nt&&r.lid!==10],['Friendlies',r=>r.lid===10]]){
  const S=rows.filter(seg[1]); const tg=S.reduce((a,r)=>a+r.hg+r.ag,0)/S.length; const lam=null;
  console.log(`\n${seg[0]}: n ${S.length}, mean goals ${tg.toFixed(2)}`);
  for(const [c,f] of Object.entries(P)){ const all=S.map(r=>({code:c,prob:f(r),r})); const a=summ(all);
    const hi=summ(all.filter(x=>x.prob>=0.60)), st=summ(all.filter(x=>x.prob>=0.75));
    console.log(`  ${c.padEnd(4)} all n ${a.graded} hit ${a.hit} stated ${a.stated} gap ${a.gap} | >=0.60 n ${hi.graded} gap ${hi.gap} (se ${hi.se}) | >=0.75 n ${st.graded} hit ${st.hit} stated ${st.stated} gap ${st.gap} (se ${st.se})`); }
}
