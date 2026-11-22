async function calDump(DATA, GATES, FROM, NAMES){
  const Y=()=>new Promise(r=>setTimeout(r,0));
  const cut=cacheCutoff();
  afState.leagues={}; afState.leagueOrder=[];
  for(const lid of COMP_IDS){
    const rows=DATA[lid]||[]; const L={id:lid,name:NAMES[lid]||String(lid),sport:'football',matches:[],upcoming:[]};
    for(const r of rows){ if(r[0]<cut) continue; L.matches.push({date:r[0],time:r[1],home:r[2],away:r[3],hg:r[4],ag:r[5],round:r[6]}); }
    L.matches.sort((a,b)=>a.date<b.date?-1:1);
    registerLeagueDampen(L); afState.leagues[lid]=L; afState.leagueOrder.push(lid);
  }
  for(const k of Object.keys(SHARED_MEASURES)) delete SHARED_MEASURES[k];
  const gate={}; for(const [k,g] of Object.entries(GATES)){ SHARED_MEASURES[k]={lid:+k,gate:g}; if(g.ready) gate[k]=g; }
  afState.gate=gate; _measuresState='loaded';
  const rows=[], meta={};
  const r4=x=>x==null?null:Math.round(x*1e4)/1e4;
  for(const lid of COMP_IDS){
    const L=afState.leagues[lid];
    if(!L||!predictsComp(L)||!sharedBarKnown(L)||L.matches.length<200) continue;
    meta[lid]={name:L.name,strong:strongBarFor(L),bar:gateBarFor(L),ef:gateEdgeFor(L),xr:(typeof xrComp==='function'&&xrComp(L))?1:0,n:L.matches.length};
    const ms=L.matches, tmp=Object.create(footballEngine); tmp.matches=ms; tmp._s2=null;
    const DK=tmp.dampenFor();
    let lo=0,hi=ms.length; while(lo<hi){const m=(lo+hi)>>1; if(ms[m].date<FROM) lo=m+1; else hi=m;}
    let start=Math.max(60,lo); let N=null,nAt=-1e9,t0=performance.now();
    for(let i=start;i<ms.length;i++){
      if(performance.now()-t0>50){await Y(); t0=performance.now();}
      const m=ms[i]; if(m.hg==null||m.ag==null) continue;
      const p=tmp.predict(m.home,m.away,i); if(!p) continue;
      if(i-nAt>=25){ try{N=tmp.neutral(i);}catch(e){N=null;} nAt=i; }
      const P=xcAdjust(L,m,p,tmp);
      const rt=P.raw&&P.raw.rates;
      rows.push([lid,m.date,m.hg,m.ag,r4(P.lambdaH),r4(P.lambdaA),r4(P.pW),r4(P.pD),r4(P.pL),r4(P.over[1.5]),r4(P.over[2.5]),r4(P.over[3.5]),r4(P.btts),
        rt?[r4(rt[1.5]),r4(rt[2.5]),r4(rt[3.5]),r4(rt.btts)]:null, DK,
        N?[r4(N.pW),r4(N.pD),r4(N.pL),r4(N.over[1.5]),r4(N.over[2.5]),r4(N.over[3.5]),r4(N.btts)]:null, p.unknownTeams?1:0, i]);
    }
  }
  return {build:APP_BUILD, cut, FROM, meta, rows, RHO:ENGINE2.RHO, calib:CALIB_SHIFT};
}
