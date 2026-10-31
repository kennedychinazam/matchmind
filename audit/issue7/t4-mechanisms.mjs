/* T2c redone with a genuine league id, plus newcomer flooring, orientation, opponent
   adjustment and a realistic seeding mix. Deterministic, synthetic, read-only. */
import {openEngine, PAGE_HELPERS} from './harness.mjs';
const {page, close} = await openEngine();
await page.evaluate(PAGE_HELPERS);

const out = await page.evaluate(()=>{
  const R = {};
  const D = '2026-10-27';
  const day = (base,i) => new Date(Date.parse(base) + i*7*86400000).toISOString().slice(0,10);
  const league = (id,name,star,starGF,restGF,n,base) => {
    const ms=[];
    for(let i=0;i<n;i++){
      ms.push(mkMatch(day(base,i), star, 'F'+id+'_'+i, starGF, restGF));
      ms.push(mkMatch(day(base,i), 'G'+id+'_'+i, 'H'+id+'_'+i, restGF, restGF));
    }
    return mkLeague(id,name,ms);
  };

  R.cupIdsCannotBeSources = {CUP_COMPS:[...CUP_COMPS], XC_COMPS:[...XC_SHAPE.COMPS],
    note:'96 and 143 are cups, so an earlier probe that used 96 as a "lower league" was invalid and is redone below with 88'};

  /* ── T2c redone: division identity changed, within-division ratio held constant ─────────── */
  R.noLevelTerm = (()=>{
    const build = (lowerId) => {
      resetLeagues();
      const cup=[];
      for(let i=0;i<24;i++) cup.push(mkMatch(day('2026-08-01',i),'C'+i,'Dx'+i,1,1));
      const CUP = mkLeague(81,'Synthetic Cup',cup);
      league(78,'Top tier','TopSide',3,2,14,'2026-04-01');
      league(lowerId,'Lower tier','LowSide',3,2,14,'2026-04-01');
      const p = priceFixture(CUP,'TopSide','LowSide',D);
      return {lowerId, xh:xcAttack('TopSide',D), xa:xcAttack('LowSide',D),
              pW:p.adjusted.pW, xcShift:p.adjusted.xcShift};
    };
    const a = build(79);   // 2. Bundesliga, a real loaded league
    const b = build(88);   // Eredivisie, also a loaded league, a different "tier" by identity
    return {asSecondTier:a, asOtherLeague:b,
            levelsIdentical: a.xa === b.xa,
            priceIdentical: a.pW === b.pW,
            conclusion: 'changing only the division identity moves nothing: no absolute level term exists'};
  })();

  /* ── T4: the newcomer floor, and whether it distinguishes the two sides ─────────────────── */
  R.newcomerFloor = (()=>{
    const probe = (appsStrong, appsWeak) => {
      resetLeagues();
      const cup=[];
      // filler so the fit has a corpus
      for(let i=0;i<30;i++) cup.push(mkMatch(day('2025-09-01',i),'P'+i,'Q'+i,1,1));
      // Strong scores 3-0; Weak scores 0-3. Both get a controllable number of cup appearances.
      for(let i=0;i<appsStrong;i++) cup.push(mkMatch(day('2026-01-05',i),'Strong','SF'+i,3,0));
      for(let i=0;i<appsWeak;i++)   cup.push(mkMatch(day('2026-01-08',i),'Weak','WF'+i,0,3));
      const CUP = mkLeague(81,'Synthetic Cup',cup);
      const tmp=Object.create(footballEngine); tmp.matches=CUP.matches;
      const s=tmp.strengths();
      const fStrong = appsStrong>=NEWCOMER.FULL?1:NEWCOMER.MIN+(1-NEWCOMER.MIN)*(appsStrong/NEWCOMER.FULL);
      const fWeak   = appsWeak  >=NEWCOMER.FULL?1:NEWCOMER.MIN+(1-NEWCOMER.MIN)*(appsWeak/NEWCOMER.FULL);
      return {appsStrong, appsWeak, floorStrong:+fStrong.toFixed(4), floorWeak:+fWeak.toFixed(4),
              sameFloor: fStrong===fWeak,
              atkStrong:+(s.teams['Strong']?s.teams['Strong'].attackHome:NaN).toFixed(4),
              atkWeak:+(s.teams['Weak']?s.teams['Weak'].attackHome:NaN).toFixed(4)};
    };
    return {
      bothNewToCup: probe(4,4),
      strongEstablished: probe(20,4),
      bothEstablished: probe(20,20),
      note: 'the floor is a function of appearance COUNT only, never of division or quality'
    };
  })();

  /* ── T6: home/away orientation. Swapping the sides must mirror the probabilities ────────── */
  R.orientation = (()=>{
    resetLeagues();
    const cup=[];
    for(let i=0;i<30;i++) cup.push(mkMatch(day('2025-09-01',i),'P'+i,'Q'+i,2,1));
    for(let i=0;i<10;i++){ cup.push(mkMatch(day('2026-01-05',i),'Alpha','AF'+i,3,0));
                           cup.push(mkMatch(day('2026-01-08',i),'Beta','BF'+i,1,1)); }
    const CUP = mkLeague(81,'Synthetic Cup',cup);
    const tmp=Object.create(footballEngine); tmp.matches=CUP.matches;
    const ab=tmp.predict('Alpha','Beta'), ba=tmp.predict('Beta','Alpha');
    const s=tmp.strengths();
    return {avgH:+s.avgH.toFixed(4), avgA:+s.avgA.toFixed(4),
      alphaHome:{pW:+ab.pW.toFixed(4),pD:+ab.pD.toFixed(4),pL:+ab.pL.toFixed(4),lamH:+ab.lambdaH.toFixed(4),lamA:+ab.lambdaA.toFixed(4)},
      alphaAway:{pW:+ba.pW.toFixed(4),pD:+ba.pD.toFixed(4),pL:+ba.pL.toFixed(4),lamH:+ba.lambdaH.toFixed(4),lamA:+ba.lambdaA.toFixed(4)},
      homeFieldWorthPoints:+(100*(ab.pW-ba.pL)).toFixed(2),
      drawPreserved: Math.abs(ab.pD-ba.pD) < 0.08};
  })();

  /* ── T5: a realistic seeding mix, not the extreme case ─────────────────────────────────────
     `seededShare` of ties have the weaker club hosting and losing; the rest are balanced.
     Then price a tie between two teams the corpus rates IDENTICALLY. */
  R.seedingMix = (()=>{
    const probe = (seededShare) => {
      resetLeagues();
      const cup=[]; const n=80, seeded=Math.round(n*seededShare);
      for(let i=0;i<n;i++){
        if(i<seeded) cup.push(mkMatch(day('2025-08-01',i),'Host'+i,'Vis'+i,0,2));   // visitor wins
        else         cup.push(mkMatch(day('2025-08-01',i),'Bal'+i,'Anc'+i,1,1));    // balanced
      }
      cup.push(mkMatch('2026-02-01','Twin1','Z1',1,1));
      cup.push(mkMatch('2026-02-08','Z2','Twin1',1,1));
      cup.push(mkMatch('2026-02-01','Twin2','Z3',1,1));
      cup.push(mkMatch('2026-02-08','Z4','Twin2',1,1));
      const CUP=mkLeague(81,'Synthetic Cup',cup);
      const tmp=Object.create(footballEngine); tmp.matches=CUP.matches;
      const s=tmp.strengths(), p=tmp.predict('Twin1','Twin2');
      return {seededShare, avgH:+s.avgH.toFixed(4), avgA:+s.avgA.toFixed(4),
              pHome:+p.pW.toFixed(4), pDraw:+p.pD.toFixed(4), pAway:+p.pL.toFixed(4),
              ratingsEqual: JSON.stringify(s.teams['Twin1'])===JSON.stringify(s.teams['Twin2'])};
    };
    return [0, 0.25, 0.5, 0.6, 0.75, 1].map(probe);
  })();

  /* ── T7: opponent-quality adjustment. Does beating weak sides count the same as beating
     strong ones INSIDE one competition? Engine 2 fits attack and defence jointly, so it
     should discount a record built against weak opposition. Verified, not assumed. */
  R.opponentQuality = (()=>{
    resetLeagues();
    const cup=[];
    // Minnow beats five doormats 3-0. Giant beats five strong sides 3-0.
    for(let i=0;i<5;i++){
      cup.push(mkMatch(day('2026-01-05',i),'Minnow','Doormat'+i,3,0));
      cup.push(mkMatch(day('2026-01-05',i),'Giant','Contender'+i,3,0));
      // the doormats lose to everyone; the contenders beat everyone else
      for(let j=0;j<3;j++){
        cup.push(mkMatch(day('2026-02-01',i*3+j),'Doormat'+i,'Neutral'+j,0,3));
        cup.push(mkMatch(day('2026-03-01',i*3+j),'Contender'+i,'Neutral'+j,3,0));
      }
    }
    const CUP=mkLeague(81,'Synthetic Cup',cup);
    const tmp=Object.create(footballEngine); tmp.matches=CUP.matches;
    const s=tmp.strengths();
    return {
      minnowAttack:+(s.teams['Minnow'].attackHome).toFixed(4),
      giantAttack:+(s.teams['Giant'].attackHome).toFixed(4),
      giantRatedHigher: s.teams['Giant'].attackHome > s.teams['Minnow'].attackHome,
      ratio:+(s.teams['Giant'].attackHome/s.teams['Minnow'].attackHome).toFixed(4),
      note:'both went 3-0 five times; only the opposition differed'
    };
  })();

  return R;
});
console.log(JSON.stringify(out,null,1));
await close();
