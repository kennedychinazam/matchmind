/* T1 — H1: what grain is XC_SHAPE.MIN_SRC = 10 evaluated against?
   Deterministic, synthetic, read-only. */
import {openEngine, PAGE_HELPERS} from './harness.mjs';
const {page, close} = await openEngine();
await page.evaluate(PAGE_HELPERS);

const out = await page.evaluate(()=>{
  const R = {};
  R.config = {MIN_SRC: XC_SHAPE.MIN_SRC, RECENT_DAYS: XC_SHAPE.RECENT_DAYS,
              A: XC_SHAPE.A, B: XC_SHAPE.B, W: XC_SHAPE.W, K: {...XC_SHAPE.K},
              COMPS: [...XC_SHAPE.COMPS], NEWCOMER: {...NEWCOMER},
              SHRINK_K_LEAGUE: ENGINE2.SHRINK_K_LEAGUE, SHRINK_K_CUP: ENGINE2.SHRINK_K_CUP,
              CUP_COMPS: [...CUP_COMPS]};

  /* (a) Appearance count: is it season-bounded, or cumulative over the whole loaded corpus?
     Give "Target" n appearances in league 78, spread so that SOME fall in a prior season.
     The cup date is 2026-10-27. */
  const CUP_DATE = '2026-10-27';
  const probe = (n, lastGapDays) => {
    resetLeagues();
    const ms = [];
    // n appearances for Target, the last one `lastGapDays` before the cup date.
    for(let i=0;i<n;i++){
      const d = new Date(Date.parse(CUP_DATE) - (lastGapDays + (n-1-i)*30)*86400000)
                  .toISOString().slice(0,10);
      ms.push(mkMatch(d, 'Target', 'Filler'+i, 1, 1));
    }
    // padding so the league has its own goals history and is not degenerate
    for(let i=0;i<10;i++){
      const d = new Date(Date.parse(CUP_DATE) - (400 + i*5)*86400000).toISOString().slice(0,10);
      ms.push(mkMatch(d, 'PadA'+i, 'PadB'+i, 1, 1));
    }
    mkLeague(78, 'Synthetic Bundesliga', ms);
    const src = xcSource('Target', CUP_DATE);
    return {n, lastGapDays, source: src ? {cid: src.cid, k: src.k} : null,
            attack: xcAttack('Target', CUP_DATE)};
  };
  R.threshold = [8,9,10,11,12].map(n=>probe(n, 5));

  /* (b) Does the count cross season boundaries? 6 appearances ~13 months ago plus 4 recent ones
     is 10 in total but only 4 in the current season. */
  R.crossSeason = (()=>{
    resetLeagues();
    const ms = [];
    for(let i=0;i<6;i++)  ms.push(mkMatch(new Date(Date.parse('2025-09-01')+i*7*86400000).toISOString().slice(0,10),'Target','OldFoe'+i,1,1));
    for(let i=0;i<4;i++)  ms.push(mkMatch(new Date(Date.parse('2026-09-01')+i*7*86400000).toISOString().slice(0,10),'Target','NewFoe'+i,1,1));
    for(let i=0;i<10;i++) ms.push(mkMatch(new Date(Date.parse('2025-08-01')+i*5*86400000).toISOString().slice(0,10),'PadA'+i,'PadB'+i,1,1));
    mkLeague(78,'Synthetic Bundesliga',ms);
    const src = xcSource('Target','2026-10-27');
    return {totalAppearances:10, inCurrentSeason:4, source: src?{cid:src.cid,k:src.k}:null};
  })();

  /* (c) The RECENT_DAYS gate: 12 appearances but the last one long ago. */
  R.recency = [5, 90, 179, 181, 400].map(gap=>{
    const r = probe(12, gap);
    return {lastAppearanceDaysBefore: gap, source: r.source};
  });

  /* (d) Can a CUP be the source? Register the same record under a cup id instead. */
  R.cupAsSource = (()=>{
    resetLeagues();
    const ms = [];
    for(let i=0;i<15;i++) ms.push(mkMatch(new Date(Date.parse('2026-05-01')+i*10*86400000).toISOString().slice(0,10),'Target','Foe'+i,2,0));
    mkLeague(81,'Synthetic Cup',ms);           // 81 is in CUP_COMPS
    const viaCup = xcSource('Target','2026-10-27');
    mkLeague(78,'Synthetic League',ms.map(m=>({...m})));
    const viaBoth = xcSource('Target','2026-10-27');
    return {cupOnly: viaCup, cupPlusLeague: viaBoth ? {cid: viaBoth.cid, k: viaBoth.k} : null};
  })();

  /* (e) What happens downstream when a side fails the threshold: does the adjustment abort? */
  R.failPath = (()=>{
    resetLeagues();
    // Cup corpus: 20 ties, both sides new to the cup.
    const cup = [];
    for(let i=0;i<20;i++) cup.push(mkMatch(new Date(Date.parse('2026-08-01')+i*4*86400000).toISOString().slice(0,10),'CupH'+i,'CupA'+i,1,1));
    cup.push(mkMatch('2026-09-10','Alpha','Beta',1,1));
    const CUP = mkLeague(81,'Synthetic Cup',cup);
    // Alpha gets 12 league appearances; Beta gets only 8, so Beta fails MIN_SRC.
    const lg = [];
    for(let i=0;i<12;i++) lg.push(mkMatch(new Date(Date.parse('2026-06-01')+i*10*86400000).toISOString().slice(0,10),'Alpha','LF'+i,3,0));
    for(let i=0;i<8;i++)  lg.push(mkMatch(new Date(Date.parse('2026-06-05')+i*10*86400000).toISOString().slice(0,10),'Beta','LG'+i,1,1));
    mkLeague(78,'Synthetic League',lg);
    return {
      alphaSource: xcSource('Alpha','2026-10-27') ? xcSource('Alpha','2026-10-27').k : null,
      betaSource:  xcSource('Beta','2026-10-27')  ? xcSource('Beta','2026-10-27').k  : null,
      alphaAttack: xcAttack('Alpha','2026-10-27'),
      betaAttack:  xcAttack('Beta','2026-10-27'),
      priced: priceFixture(CUP,'Alpha','Beta','2026-10-27')
    };
  })();
  return R;
});
console.log(JSON.stringify(out,null,1));
await close();
