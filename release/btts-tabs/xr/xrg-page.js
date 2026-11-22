async function xrgRun(DATA, OPT){
  const Y=()=>new Promise(r=>setTimeout(r,0)); const cut=cacheCutoff(); const all=[]; const byLid={};
  for(const [lid,rows] of Object.entries(DATA)){ const L={id:+lid,matches:[]};
    for(const r of rows){ const m={lid:+lid,date:r[0],time:r[1],home:r[2],away:r[3],hg:r[4],ag:r[5],round:r[6],season:r[7]}; all.push(m); if(r[0]>=cut||XR.isNT(+lid)) L.matches.push(m); }
    L.matches.sort((a,b)=>a.date<b.date?-1:1); byLid[lid]=L; }
  const S=XR.build(all); await Y();
  const out=[]; const r4=x=>x==null?null:Math.round(x*1e4)/1e4;
  for(const lid of OPT.targets){ const L=byLid[lid]; if(!L) continue; const nt=XR.isNT(lid); const from=nt?OPT.ntFrom:OPT.clubFrom;
    for(const m of L.matches){ if(m.date<from) continue; const pre=S.pre.get(XR.keyOf(m)); if(!pre) continue;
      if(!pre.nh || !pre.na) { /* unknown side */ }
      const [lh,la]=XR.lambdas(pre.d,nt); const P=footballEngine.marketsFor(lh,la,null); if(!P) continue;
      out.push([lid,m.date,m.home,m.away,m.hg,m.ag,r4(P.pW),r4(P.pD),r4(P.pL),r4(P.over[1.5]),r4(P.over[2.5]),r4(P.over[3.5]),r4(P.btts),(!pre.nh||!pre.na)?1:0,r4(lh),r4(la)]); }
  }
  return {build:APP_BUILD,n:out.length,rows:out,keys:Object.keys(S.pre.values().next().value||{})};
}
