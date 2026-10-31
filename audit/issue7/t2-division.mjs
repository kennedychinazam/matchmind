/* T2 — is there any common cross-division strength scale?
   T3 — does a cup's own home/away average encode its seeding rule?
   Deterministic, synthetic, read-only. Nothing here is a claim about a real fixture. */
import {openEngine, PAGE_HELPERS} from './harness.mjs';
const {page, close} = await openEngine();
await page.evaluate(PAGE_HELPERS);

const out = await page.evaluate(()=>{
  const R = {};
  const D = '2026-10-27';
  const day = (base, i) => new Date(Date.parse(base) + i*7*86400000).toISOString().slice(0,10);

  /* Build a league where `star` scores `starGF` per game and everyone else scores `restGF`,
     over `n` matchdays, so the division's own goals-per-team-per-game is controllable. */
  const league = (id, name, star, starGF, restGF, n, base) => {
    const ms = [];
    for(let i=0;i<n;i++){
      ms.push(mkMatch(day(base,i), star, 'F'+id+'_'+i, starGF, restGF));
      ms.push(mkMatch(day(base,i), 'G'+id+'_'+i, 'H'+id+'_'+i, restGF, restGF));
    }
    return mkLeague(id, name, ms);
  };

  /* ── T2a: xcAttack is invariant to the division's absolute level ───────────────────────────
     Two divisions with WILDLY different scoring rates. In each, the star scores exactly 1.5x
     its own division's per-team rate. If the function carried any level information the two
     would differ. */
  R.invariance = (()=>{
    resetLeagues();
    league(78, 'High-scoring top tier', 'TopStar', 6, 4, 14, '2026-04-01');   // division ~4.0/team/game
    league(79, 'Low-scoring lower tier', 'LowStar', 3, 2, 14, '2026-04-01');  // division ~2.0/team/game
    return {
      topTierStar: xcAttack('TopStar', D),
      lowerTierStar: xcAttack('LowStar', D),
      identical: xcAttack('TopStar', D) === xcAttack('LowStar', D),
      note: 'each scores 1.5x its own division rate'
    };
  })();

  /* ── T2b: a WEAK top-tier side against a STRONG lower-tier side ────────────────────────────
     The tier gap is real and the engine has no field for it. */
  R.tierInversion = (()=>{
    resetLeagues();
    // Top tier: TopWeak scores BELOW its division rate.
    league(78, 'Top tier', 'TopWeak', 1, 3, 14, '2026-04-01');
    // Lower tier: LowStrong scores WELL ABOVE its division rate.
    league(79, 'Lower tier', 'LowStrong', 5, 2, 14, '2026-04-01');
    const xh = xcAttack('TopWeak', D), xa = xcAttack('LowStrong', D);
    const srcH = xcSource('TopWeak', D), srcA = xcSource('LowStrong', D);
    const yh = XC_SHAPE.A + XC_SHAPE.B*xh, ya = XC_SHAPE.A + XC_SHAPE.B*xa;
    const kx = (srcH && srcA) ? (String(srcH.cid)===String(srcA.cid) ? XC_SHAPE.K.SAME : XC_SHAPE.K.CROSS)
             : (srcH||srcA) ? XC_SHAPE.K.ONE : 1;
    return {
      topTierLevel: xh, lowerTierLevel: xa,
      lowerTierRatedHigher: xa > xh,
      convertedH: yh, convertedA: ya, z: yh - ya,
      kxApplied: kx, kxName: kx === XC_SHAPE.K.CROSS ? 'CROSS' : kx === XC_SHAPE.K.SAME ? 'SAME' : 'ONE',
      logOddsShift: XC_SHAPE.W * kx * (yh - ya)
    };
  })();

  /* ── T2c: is there ANY absolute league-strength term in the published path? ────────────────
     Price the same cup tie twice, changing only the lower side's DIVISION IDENTITY while
     keeping its within-division ratio identical. If a level term existed the price would move. */
  R.noLevelTerm = (()=>{
    const build = (lowerId, lowerName, lowerGF, lowerRest) => {
      resetLeagues();
      const cup = [];
      for(let i=0;i<24;i++) cup.push(mkMatch(day('2026-08-01',i), 'C'+i, 'D'+i, 1, 1));
      cup.push(mkMatch('2026-09-20','Pad1','Pad2',1,1));
      const CUP = mkLeague(81,'Synthetic Cup',cup);
      league(78,'Top tier','TopSide',3,2,14,'2026-04-01');
      league(lowerId, lowerName, 'LowSide', lowerGF, lowerRest, 14, '2026-04-01');
      return {price: priceFixture(CUP,'TopSide','LowSide',D),
              xh: xcAttack('TopSide',D), xa: xcAttack('LowSide',D)};
    };
    // Same ratio (1.5x own division) in a second tier vs in a notional fourth tier.
    const second = build(79,'Second tier', 3, 2);
    const fourth = build(96,'Fourth tier', 3, 2);   // 96 is another loaded comp id
    return {
      secondTierOpponent: {xa: second.xa, pW: second.price.adjusted.pW, xcShift: second.price.adjusted.xcShift},
      fourthTierOpponent: {xa: fourth.xa, pW: fourth.price.adjusted.pW, xcShift: fourth.price.adjusted.xcShift},
      priceIdentical: second.price.adjusted.pW === fourth.price.adjusted.pW
    };
  })();

  /* ── T3: does a cup's own avgH/avgA absorb a seeding rule? ─────────────────────────────────
     DFB Pokal rounds 1-2 give home advantage to the LOWER-ranked club by rule, so in the cup's
     own corpus "away" correlates with "stronger". Build that corpus and price a tie between two
     teams that are IDENTICAL inside it. */
  R.cupSeedingConfound = (()=>{
    const corpus = (awayGoals, homeGoals) => {
      resetLeagues();
      const cup = [];
      // 40 ties: the host is the weaker club and loses, as the seeding rule arranges.
      for(let i=0;i<40;i++) cup.push(mkMatch(day('2025-08-01',i), 'Host'+i, 'Visitor'+i, homeGoals, awayGoals));
      // Two teams with identical records inside the cup, one home one away each.
      cup.push(mkMatch('2026-02-01','Twin1','Other1', homeGoals, awayGoals));
      cup.push(mkMatch('2026-02-08','Other2','Twin1', homeGoals, awayGoals));
      cup.push(mkMatch('2026-02-01','Twin2','Other3', homeGoals, awayGoals));
      cup.push(mkMatch('2026-02-08','Other4','Twin2', homeGoals, awayGoals));
      const CUP = mkLeague(81,'Synthetic Cup',cup);
      const tmp = Object.create(footballEngine); tmp.matches = CUP.matches;
      const s = tmp.strengths();
      const p = tmp.predict('Twin1','Twin2');
      return {avgH: s.avgH, avgA: s.avgA, awayAdvantage: s.avgA > s.avgH,
              pHome: p.pW, pDraw: p.pD, pAway: p.pL,
              lambdaH: p.lambdaH, lambdaA: p.lambdaA,
              ratingsEqual: JSON.stringify(s.teams['Twin1']) === JSON.stringify(s.teams['Twin2'])};
    };
    return {
      balancedCup: corpus(1,1),          // control: hosts and visitors score alike
      seededCup_2_0: corpus(2,0),        // visitors win 2-0 throughout
      seededCup_3_1: corpus(3,1)
    };
  })();

  /* ── T3b: how far can the cup's own home/away term alone move a tie between equals? ────── */
  R.homeAwayOnly = (()=>{
    const probe = (hg, ag) => {
      resetLeagues();
      const cup = [];
      for(let i=0;i<40;i++) cup.push(mkMatch(day('2025-08-01',i), 'H'+i, 'A'+i, hg, ag));
      const CUP = mkLeague(81,'Synthetic Cup',cup);
      const tmp = Object.create(footballEngine); tmp.matches = CUP.matches;
      const s = tmp.strengths();
      const p = tmp.predict('H0','A0');
      return {homeGoals:hg, awayGoals:ag, avgH:+s.avgH.toFixed(3), avgA:+s.avgA.toFixed(3),
              pHome:+p.pW.toFixed(4), pDraw:+p.pD.toFixed(4), pAway:+p.pL.toFixed(4)};
    };
    return [[1,1],[1,2],[0,2],[1,3],[0,3]].map(([h,a])=>probe(h,a));
  })();

  return R;
});
console.log(JSON.stringify(out,null,1));
await close();
