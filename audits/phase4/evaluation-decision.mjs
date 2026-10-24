// Offline evaluation policy, fixed before the final limited comparison. No app imports.
export function distribution(values){
 if(!values.length||values.some(x=>!Number.isFinite(x)||x<0))throw Error('invalid measurements');
 const x=[...values].sort((a,b)=>a-b),n=x.length;
 return {n,median:n%2?x[(n-1)/2]:(x[n/2-1]+x[n/2])/2,p95:x[Math.ceil(n*.95)-1],max:x.at(-1)};
}
export function evaluateSelector(cells){
 const expected=['repeat','diverse'].flatMap(w=>['fresh','reused'].flatMap(m=>[1,2,5,10].map(n=>`${w}/${m}/${n}`)));
 if(cells.length!==16||new Set(cells.map(c=>`${c.workload}/${c.mode}/${c.workers}`)).size!==16||expected.some(k=>!cells.some(c=>`${c.workload}/${c.mode}/${c.workers}`===k)))throw Error('complete workload matrix required');
 const regressions=[],rows=[];let improved=0;const pooled={current:[],narrow:[]};
 for(const c of cells){
  if(c.pairs.length!==4)throw Error('four complete paired rounds required');
  const stats={};for(const v of ['current','narrow']){
   stats[v]={};for(const clock of ['server_ms','client_ms']){
    const a=c.pairs.flatMap(p=>{const x=p[v][clock];if(x.length!==c.workers)throw Error('incomplete worker measurements');return x;});stats[v][clock]=distribution(a);
    if(clock==='server_ms')pooled[v].push(...a);
   }
  }
  for(const clock of ['server_ms','client_ms'])for(const q of ['median','p95']){
   const a=stats.current[clock][q],b=stats.narrow[clock][q];if(b>a*1.05&&b-a>10)regressions.push({cell:`${c.workload}/${c.mode}/${c.workers}`,clock,metric:q,current:a,narrow:b});
  }
  if(stats.narrow.server_ms.median<stats.current.server_ms.median&&stats.narrow.server_ms.p95<stats.current.server_ms.p95)improved++;
  rows.push({workload:c.workload,mode:c.mode,workers:c.workers,stats});
 }
 const aggregate={current:distribution(pooled.current),narrow:distribution(pooled.narrow)};
 return {adopt:cells.every(c=>c.parity&&c.success)&&regressions.length===0&&improved>=12&&aggregate.narrow.median<=aggregate.current.median*.95&&aggregate.narrow.p95<=aggregate.current.p95*.95,policy:'all integrity/success; no cell median/p95 regression exceeding both 5% and 10ms; >=12/16 server median-and-p95 wins; pooled server median and p95 >=5% better',improved_cells:improved,regressions,aggregate,rows};
}
