import {load,rawGoal,won,picks,SHIPPED,summ,MKT} from './lib.mjs';
const {meta,rows}=load();
const ev=rows.filter(r=>r.date>='2025-07-01'&&!r.unk&&!meta[r.lid].xr);
console.log('eval rows',ev.length);
for(const code of ['U35','U25','O25','BTS','NBT']){
  const B={}; for(const r of ev){ const p=SHIPPED(code,rawGoal(r,code)); const b=Math.floor(p*20)/20; const g=won(code,r.hg,r.ag)==='hit'; (B[b]=B[b]||[0,0,0]); B[b][0]++; B[b][1]+=p; B[b][2]+=g; }
  console.log(code, Object.entries(B).sort((a,b)=>a[0]-b[0]).filter(([k,v])=>v[0]>=50).map(([k,v])=>`${k}:${v[0]} ${(v[1]/v[0]*100).toFixed(1)}/${(v[2]/v[0]*100).toFixed(1)}`).join(' | '));
}
const P=picks(rows,meta,SHIPPED);
for(const t of ['strong','lean']){ const by={}; for(const x of P) if(x.tier===t){ const m=MKT(x.pick.code); (by[m]=by[m]||[]).push({code:x.pick.code,prob:x.pick.prob,r:x.r}); }
  console.log(t, JSON.stringify(Object.fromEntries(Object.entries(by).map(([k,v])=>[k,summ(v)])))); }
console.log('coverage strong', (P.filter(x=>x.tier==='strong').length/P.length).toFixed(3));
