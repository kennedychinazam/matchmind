const LF=[1];for(let i=1;i<20;i++)LF[i]=LF[i-1]*i;
export function pmf(l,k){return Math.exp(-l)*Math.pow(l,k)/LF[k];}
// raw (undamped) goals markets with DC rho, as marketsFor
export function goalsRaw(lH,lA,RHO=-0.08){
  const MAX=13; let tot=0,o15=0,o25=0,o35=0,bt=0;
  const ph=[],pa=[]; for(let i=0;i<MAX;i++){ph[i]=pmf(lH,i);pa[i]=pmf(lA,i);}
  for(let i=0;i<MAX;i++)for(let j=0;j<MAX;j++){
    let t=1; if(i===0&&j===0)t=1-lH*lA*RHO; else if(i===0&&j===1)t=1+lH*RHO; else if(i===1&&j===0)t=1+lA*RHO; else if(i===1&&j===1)t=1-RHO; if(t<0.0001)t=0.0001;
    const p=ph[i]*pa[j]*t; tot+=p; const s=i+j; if(s>1.5)o15+=p; if(s>2.5)o25+=p; if(s>3.5)o35+=p; if(i>0&&j>0)bt+=p; }
  return {o15:o15/tot,o25:o25/tot,o35:o35/tot,btts:bt/tot};
}
export function damp(g,rates,DK){ if(!rates) return g; const [r15,r25,r35,rb]=rates; const d=(p,b)=>b==null?p:b+DK*(p-b); return {o15:d(g.o15,r15),o25:d(g.o25,r25),o35:d(g.o35,r35),btts:d(g.btts,rb)}; }
