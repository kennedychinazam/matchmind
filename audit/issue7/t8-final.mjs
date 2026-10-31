/* T7 control (cup vs league shrink), T8 the 90-minute fallback, T9 what the archive would need.
   Deterministic, synthetic, read-only. */
import {openEngine, PAGE_HELPERS} from './harness.mjs';
const {page, close} = await openEngine();
await page.evaluate(PAGE_HELPERS);

const out = await page.evaluate(()=>{
  const R = {};
  const day = (base,i) => new Date(Date.parse(base) + i*7*86400000).toISOString().slice(0,10);

  /* ── T7 control: the SAME corpus fitted as a cup (shrink 32) and as a league (shrink 8). ── */
  R.shrinkControl = (()=>{
    const build = (id) => {
      resetLeagues();
      const ms=[];
      for(let i=0;i<5;i++){
        ms.push(mkMatch(day('2026-01-05',i),'Minnow','Doormat'+i,3,0));
        ms.push(mkMatch(day('2026-01-05',i),'Giant','Contender'+i,3,0));
        for(let j=0;j<3;j++){
          ms.push(mkMatch(day('2026-02-01',i*3+j),'Doormat'+i,'Neutral'+j,0,3));
          ms.push(mkMatch(day('2026-03-01',i*3+j),'Contender'+i,'Neutral'+j,3,0));
        }
      }
      const L = mkLeague(id, 'Synthetic', ms);
      const tmp=Object.create(footballEngine); tmp.matches=L.matches;
      const s=tmp.strengths();
      return {shrinkK: shrinkKFor(L),
              minnow:+s.teams['Minnow'].attackHome.toFixed(4),
              giant:+s.teams['Giant'].attackHome.toFixed(4),
              ratio:+(s.teams['Giant'].attackHome/s.teams['Minnow'].attackHome).toFixed(4)};
    };
    const asCup = build(81), asLeague = build(78);
    return {asCup, asLeague,
      discriminationLostToCupShrink: +(100*(1 - (asCup.ratio-1)/(asLeague.ratio-1))).toFixed(1),
      note:'identical corpus; only the shrink differs because 81 is in CUP_COMPS'};
  })();

  /* ── T8: the 90-minute settlement rule and its fallback, exercised directly. ───────────── */
  R.ninetyMinute = (()=>{
    const cases = [
      {label:'clean AET: 2-2 at 90, 3-2 after extra time', row:{status:'AET', gh:3, ga:2, ft_h:2, ft_a:2}},
      {label:'clean PEN: 1-1 at 90, 4-3 on penalties recorded in goals', row:{status:'PEN', gh:1, ga:1, ft_h:1, ft_a:1}},
      {label:'normal FT', row:{status:'FT', gh:2, ga:0, ft_h:2, ft_a:0}},
      {label:'ft pair MISSING (league history not backfilled)', row:{status:'AET', gh:3, ga:2, ft_h:null, ft_a:null}},
      {label:'ft pair HALF missing', row:{status:'AET', gh:3, ga:2, ft_h:2, ft_a:null}},
      {label:'ft EXCEEDS the final score (impossible)', row:{status:'AET', gh:2, ga:1, ft_h:3, ft_a:1}},
      {label:'ft non-integer', row:{status:'AET', gh:3, ga:2, ft_h:2.5, ft_a:2}},
      {label:'ft negative', row:{status:'AET', gh:3, ga:2, ft_h:-1, ft_a:2}},
      {label:'not finished yet', row:{status:'NS', gh:null, ga:null, ft_h:null, ft_a:null}}
    ];
    return cases.map(c=>{
      const s = settledScore(c.row), r = settledRow(c.row);
      const graded = (r.gh!=null && r.ga!=null) ? gradePick('1D', actualCode(r.gh,r.ga), r.gh, r.ga) : null;
      return {label:c.label, via:s.via,
              settledAs: r.gh+'-'+r.ga,
              aetShown: aetText(r) || null,
              dnbGradeIfHomePicked: graded,
              contaminated: s.via === 'final' && ['AET','PEN'].includes(c.row.status)};
    });
  })();

  /* ── T9: exactly what an archived snapshot carries, so the evidence gap is precise. ─────── */
  R.archiveShape = (()=>{
    const keys = new Set();
    // afState.archive is written by the publisher; read its declared shape from the code paths
    // that consume it rather than inventing one.
    return {
      archivePresentInThisSession: !!(afState.archive && Object.keys(afState.archive).length),
      archiveKeyCount: afState.archive ? Object.keys(afState.archive).length : 0,
      consumedFields: ['kickoff','ktime','xgH','xgA'],
      note:'an empty archive here is expected: this container has no backend and no provider access'
    };
  })();

  /* ── T10: is the headline rung itself affected, or only the 1X2 split? ─────────────────── */
  R.rungPassThrough = (()=>{
    const P = {pW:0.125, pD:0.175, pL:0.70, over:{2.5:0.55,3.5:0.30}, btts:0.52};
    const rungs = rungsFor(P).map(r=>({code:r.code, prob:+r.prob.toFixed(4)}));
    // and the same fixture with the home/away confound removed (a symmetric 1X2)
    const Q = {pW:0.35, pD:0.30, pL:0.35, over:{2.5:0.55,3.5:0.30}, btts:0.52};
    return {skewed: rungs, symmetric: rungsFor(Q).map(r=>({code:r.code, prob:+r.prob.toFixed(4)})),
            note:'the ladder faithfully reports whatever 1X2 it is handed; the defect is upstream'};
  })();

  return R;
});
console.log(JSON.stringify(out,null,1));
await close();
