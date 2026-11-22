async function xrRun(DATA, OPT){
  const Y=()=>new Promise(r=>setTimeout(r,0));
  const TGT=OPT.targets, cut=cacheCutoff();
  const all=[]; const byLid={};
  for(const [lid,rows] of Object.entries(DATA)){
    const L={id:+lid,name:String(lid),sport:'football',matches:[],upcoming:[]};
    for(const r of rows){ const m={lid:+lid,date:r[0],time:r[1],home:r[2],away:r[3],hg:r[4],ag:r[5],round:r[6],season:r[7]}; all.push(m); if(r[0]>=cut||XR.isNT(+lid)) L.matches.push(m); }
    L.matches.sort((a,b)=>a.date<b.date?-1:1); byLid[lid]=L;
  }
  const S=XR.build(all); await Y();
  /* fit a,b by Poisson MLE on pre-window matches (grid then refine) */
  const fitOn=(pred)=>{ const xs=[]; for(const m of all){ if(!pred(m)) continue; const p=S.pre.get(XR.keyOf(m)); if(!p) continue; xs.push([p.d/400,m.hg,m.ag]); }
    let best=null; for(let a=0.0;a<=0.6;a+=0.01) for(let b=0.2;b<=2.0;b+=0.02){ let ll=0; for(const [x,h,g] of xs){ const lh=a+b*x, la=a-b*x; ll+=h*lh-Math.exp(lh)+g*la-Math.exp(la);} if(!best||ll>best.ll) best={a:+a.toFixed(3),b:+b.toFixed(3),ll,n:xs.length}; } return best; };
  const CLUBT=new Set([2,3,848,531,15,12,20,533]);
  const fitClub=fitOn(m=>CLUBT.has(m.lid)&&m.date<OPT.clubFrom&&m.date>='2022-07-01');
  const fitNT=fitOn(m=>XR.isNT(m.lid)&&m.date<OPT.ntFrom&&m.date>='2016-01-01');
  await Y();
  const seg={}; const S0=(k)=>seg[k]||(seg[k]={n:0,cov:0,ll:0,br:0,sN:0,sHit:0,sP:0,sVoid:0,lN:0,lHit:0,lP:0,lVoid:0});
  const act=(m)=>m.hg>m.ag?'1':m.hg===m.ag?'X':'2';
  const score=(s,P,m)=>{ s.cov++; const pa={'1':P.pW,'X':P.pD,'2':P.pL}, a=act(m);
    s.ll+=-Math.log(Math.max(1e-9,pa[a])); s.br+=['1','X','2'].reduce((t,k)=>t+Math.pow(pa[k]-(k===a?1:0),2),0);
    const rungs=rungsFor(P); const st=rungs.find(x=>x.prob>=0.75); const ln=st?null:rungs.find(x=>x.prob>=0.65);
    for(const [r,pre] of [[st,'s'],[ln,'l']]){ if(!r) continue; const g=gradePick(r.code,a,m.hg,m.ag); s[pre+'N']++; if(g==='void') s[pre+'Void']++; else { s[pre+'P']+=r.prob; if(g==='hit') s[pre+'Hit']++; } } };
  for(const lid of TGT){
    const L=byLid[lid]; if(!L) continue; const nt=XR.isNT(lid); const from=nt?OPT.ntFrom:OPT.clubFrom;
    const ms=L.matches; const tmp=Object.create(footballEngine); tmp.matches=ms; tmp._s2=null; let t0=performance.now();
    for(let i=0;i<ms.length;i++){ const m=ms[i]; if(m.date<from) continue;
      if(performance.now()-t0>50){await Y(); t0=performance.now();}
      const pre=S.pre.get(XR.keyOf(m)); const fit=nt?fitNT:fitClub;
      for(const seg0 of ['L:'+lid, nt?(lid===10?'NT friendlies':'NT competitive'):'Club continental']){
        const sx=S0('xr|'+seg0), st=S0('today|'+seg0); sx.n++; st.n++;
        if(pre){ const [lh,la]=XR.lambdas(pre.d,nt,fit); const P=footballEngine.marketsFor(lh,la,null); if(P) score(sx,P,m); }
        if(i>=15){ let p=null; try{ p=tmp.predict(m.home,m.away,i);}catch(e){} if(p&&!p.unknownTeams){ p=xcAdjust(L,m,p,tmp); score(st,p,m);} }
      }
    }
  }
  const out={}; for(const [k,s] of Object.entries(seg)){ const gs=s.sN-s.sVoid, gl=s.lN-s.lVoid;
    out[k]={n:s.n,coverage:+(s.cov/s.n).toFixed(3),logloss:s.cov?+(s.ll/s.cov).toFixed(4):null,brier:s.cov?+(s.br/s.cov).toFixed(4):null,
      strong:{n:s.sN,hit:gs?+(s.sHit/gs).toFixed(3):null,stated:gs?+(s.sP/gs).toFixed(3):null},
      lean:{n:s.lN,hit:gl?+(s.lHit/gl).toFixed(3):null,stated:gl?+(s.lP/gl).toFixed(3):null}}; }
  return {build:APP_BUILD, fitClub, fitNT, seg:out};
}
