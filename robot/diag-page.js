/* MatchMind - the pick-coverage diagnostic, evaluated INSIDE the app page by robot/diagnose.mjs.
   It reads the app's own globals and calls the app's own engine functions (footballEngine, xcAdjust,
   ladderPick, gateReason, rungsFor, gradePick). It writes nothing: the runner fakes every write.

   Two outputs:
     census  - for every fixture from 14 days back to 7 days ahead, the first reason it has no pick
     bt      - a walk-forward backtest from BT_FROM: hit rate and calibration of the picks the
               current rule would publish, by stage (regular, split, knockout) and familiarity
               (established, thin, debutant), plus what the debutant picks would have done. */
async function mmDiag(opts) {
  opts = opts || {};
  const BT_FROM = opts.btFrom || '2024-07-01';
  const Y = () => new Promise((r) => setTimeout(r, 0));
  const iso = (d) => d.toISOString().slice(0, 10);
  const now = Date.now();
  const W0 = iso(new Date(now - 14 * 864e5)), W1 = iso(new Date(now + 7 * 864e5));
  const TODAY = iso(new Date(now));
  const ids = COMP_IDS.slice();

  /* stage from the provider's round label */
  const stageOf = (lid, r) => {
    const s = String(r || '');
    if (/(championship|relegation|promotion|title|europe|conference)[^-]*\b(group|round|play-?offs?|series)\b/i.test(s)) return 'split';
    if (/play-?off|knock|final|semi|quarter|round of|qualif|preliminary|leg\b|elimination|wild ?card/i.test(s)) return 'knockout';
    if (_CUP_COMPS.has(String(lid)) && !/league stage|league phase|group/i.test(s)) return 'knockout';
    if (!s) return 'unknown';
    return 'regular';
  };

  /* rounds and fixture rows straight from the table the app reads */
  const rows = [];
  for (const lid of ids) {
    for (let from = 0; ; from += 1000) {
      const q = await supa.from('fixtures').select('fxid,lid,date,time,status,home,away,round,gh,ga')
        .eq('lid', lid).gte('date', BT_FROM).order('date', { ascending: true }).order('fxid', { ascending: true })
        .range(from, from + 999);
      if (q.error) return { error: 'fixtures read: ' + q.error.message };
      rows.push(...(q.data || []));
      if (!q.data || q.data.length < 1000) break;
    }
  }
  const roundOf = new Map();
  for (const r of rows) roundOf.set(r.lid + '|' + r.date + '|' + r.home + '|' + r.away, r.round || '');
  const pq = await supa.from('predictions').select('fxid,lid,kickoff,ktime,made_at,pick,pick_prob,build').gte('kickoff', W0);
  if (pq.error) return { error: 'predictions read: ' + pq.error.message };
  const pred = new Map((pq.data || []).map((p) => [p.fxid, p]));

  const before = (ms, date) => { let lo = 0, hi = ms.length; while (lo < hi) { const m = (lo + hi) >> 1; if (ms[m].date < date) lo = m + 1; else hi = m; } return lo; };
  const appsOf = (ms, n, team) => { let k = 0; for (let i = 0; i < n; i++) if (ms[i].home === team || ms[i].away === team) k++; return k; };

  /* ── CENSUS ───────────────────────────────────────────────────────────────── */
  const census = {}, fixtures = [];
  const add = (lid, cause) => { const c = census[lid] || (census[lid] = { name: (afState.leagues[lid] || {}).name || String(lid) }); c[cause] = (c[cause] || 0) + 1; };
  for (const r of rows) {
    if (r.date < W0 || r.date > W1) continue;
    if (/CANC|POSTP|ABAND|SUSP/i.test(r.status || '')) continue;
    const L = afState.leagues[r.lid];
    const stage = stageOf(r.lid, r.round);
    const rec = { f: r.fxid, l: r.lid, d: r.date, t: r.time, h: r.home, a: r.away, r: r.round, st: stage, s: r.status };
    let cause;
    const p = pred.get(r.fxid);
    if (p) { cause = 'published'; rec.pick = p.pick; rec.q = p.pick_prob; rec.madeAt = p.made_at; }
    else if (!L) cause = 'notloaded';
    else if (!predictsComp(L)) cause = 'outofscope';
    else if ((L.matches || []).length < 15) cause = 'noengine';
    else {
      const ms = L.matches, n = before(ms, r.date);
      const eng = Object.create(footballEngine); eng.matches = ms;
      const P = n < ms.length ? eng.predict(r.home, r.away, n) : eng.predict(r.home, r.away);
      rec.appsH = appsOf(ms, n, r.home); rec.appsA = appsOf(ms, n, r.away);
      rec.bar = gateBarFor(L);
      if (!P) cause = 'nomodel';
      else {
        const f = { fxid: r.fxid, date: r.date, time: r.time, home: r.home, away: r.away };
        const P2 = xcAdjust(L, f, P, eng);
        rec.pw = +P2.pW.toFixed(3); rec.pd = +P2.pD.toFixed(3); rec.pl = +P2.pL.toFixed(3);
        const hp = headlinePick(P2, r.home, r.away), lp = ladderPick(P2, r.home, r.away, L);
        rec.pick = lp ? lp.code : hp.code; rec.q = lp ? lp.prob : +hp.prob.toFixed(3);
        const rungs = rungsFor(P2); rec.top = rungs.length ? +Math.max(...rungs.map((x) => x.prob)).toFixed(3) : null;
        if (P.unknownTeams) {
          cause = 'newteam';
          rec.unk = P.unknownNames;
          rec.xc = (P.unknownNames || []).map((t) => !!xcSource(t, r.date));
        } else {
          const g = gateReason(L, f, rec.pick, rec.q);
          if (g) cause = g;
          else if (r.date >= TODAY && tooFarAheadToPublish(f)) cause = 'far';
          else cause = r.date >= TODAY && !kickoffPassed(f) ? 'pending' : 'passed_unpublished';
        }
      }
    }
    rec.c = cause;
    add(r.lid, cause);
    if ([253, 292, 2].includes(+r.lid) || cause === 'passed_unpublished' || cause === 'notloaded' || cause === 'newteam') fixtures.push(rec);
  }
  await Y();

  /* ── WALK-FORWARD BACKTEST ───────────────────────────────────────────────── */
  const seg = {};
  const S = (k) => seg[k] || (seg[k] = { n: 0, ll: 0, pub: 0, hit: 0, void: 0, sp: 0, ifn: 0, ifhit: 0, ifvoid: 0, ifsp: 0 });
  const bins = {};
  const B = (k, p, hit) => { const b = Math.min(9, Math.floor(p * 10)); const o = bins[k] || (bins[k] = {}); const c = o[b] || (o[b] = { n: 0, hit: 0, sp: 0 }); c.n++; c.hit += hit; c.sp += p; };
  for (const lid of ids) {
    const L = afState.leagues[lid];
    if (!L || !predictsComp(L) || !sharedBarKnown(L) || !L.matches || L.matches.length < 200) continue;
    const ms = L.matches, tmp = Object.create(footballEngine); tmp.matches = ms; tmp._s2 = null;
    const bar = gateBarFor(L), ef = gateEdgeFor(L);
    let start = before(ms, BT_FROM); if (start < 60) start = 60;
    const teamApps = new Map();
    for (let i = 0; i < start; i++) { const m = ms[i]; teamApps.set(m.home, (teamApps.get(m.home) || 0) + 1); teamApps.set(m.away, (teamApps.get(m.away) || 0) + 1); }
    let nAsAt = null, nAt = -1e9, t0 = performance.now();
    for (let i = start; i < ms.length; i++) {
      if (performance.now() - t0 > 20) { await Y(); t0 = performance.now(); }
      const m = ms[i];
      const aH = teamApps.get(m.home) || 0, aA = teamApps.get(m.away) || 0;
      teamApps.set(m.home, aH + 1); teamApps.set(m.away, aA + 1);
      if (m.hg == null || m.ag == null) continue;
      const p = tmp.predict(m.home, m.away, i); if (!p) continue;
      if (i - nAt >= 25) { try { nAsAt = tmp.neutral(i); } catch (e) { nAsAt = null; } nAt = i; }
      const P2 = xcAdjust(L, m, p, tmp);
      const act = m.hg > m.ag ? '1' : m.hg === m.ag ? 'X' : '2';
      const pa = act === '1' ? P2.pW : act === 'X' ? P2.pD : P2.pL;
      const stage = stageOf(lid, roundOf.get(lid + '|' + m.date + '|' + m.home + '|' + m.away));
      const fam = p.unknownTeams ? 'debut' : Math.min(aH, aA) < NEWCOMER.FULL ? 'thin' : 'est';
      const keys = ['ALL', 'st:' + stage, 'fam:' + fam, 'st:' + stage + '|fam:' + fam, 'L:' + lid, 'L:' + lid + '|st:' + stage];
      if (fam === 'debut') {
        const xcAll = (p.unknownNames || []).every((t) => !!xcSource(t, m.date));
        keys.push('debut:' + (xcAll ? 'xc' : 'noxc'), 'debut:' + (xcAll ? 'xc' : 'noxc') + '|L:' + lid);
      }
      /* the current rule: first rung over the bar, then the edge test on that rung, never a debutant */
      const rungs = rungsFor(P2);
      let r = null;
      for (const x of rungs) { if (x.prob >= Math.max(bar, RUNG_MIN[x.code] || 0)) { r = x; break; } }
      let would = null;
      if (r) {
        const b = baselineFrom(nAsAt, r.code), e = (b == null) ? null : r.prob - b;
        if (!(e != null && e <= ef)) would = r;
      }
      const g = would ? gradePick(would.code, act, m.hg, m.ag) : null;
      for (const k of keys) {
        const s = S(k); s.n++; s.ll += -Math.log(Math.max(1e-9, pa));
        if (would) {
          if (!p.unknownTeams) { s.pub++; if (g === 'void') s.void++; else { s.sp += would.prob; if (g === 'hit') s.hit++; } }
          s.ifn++; if (g === 'void') s.ifvoid++; else { s.ifsp += would.prob; if (g === 'hit') s.ifhit++; }
        }
      }
      /* reliability of the strongest rung, bar ignored, for calibration by segment */
      const top = rungs.slice().sort((x, y) => y.prob - x.prob)[0];
      if (top) { const gt = gradePick(top.code, act, m.hg, m.ag); if (gt !== 'void') { B('st:' + stage, top.prob, gt === 'hit' ? 1 : 0); B('fam:' + fam, top.prob, gt === 'hit' ? 1 : 0); B('ALL', top.prob, gt === 'hit' ? 1 : 0); } }
    }
  }
  const fmt = {};
  for (const [k, s] of Object.entries(seg)) {
    const graded = s.pub - s.void, ig = s.ifn - s.ifvoid;
    fmt[k] = { n: s.n, ll: +(s.ll / s.n).toFixed(4), pub: s.pub, pubRate: +(s.pub / s.n).toFixed(3),
      hit: graded ? +(s.hit / graded).toFixed(3) : null, meanP: graded ? +(s.sp / graded).toFixed(3) : null,
      ifn: s.ifn, ifHit: ig ? +(s.ifhit / ig).toFixed(3) : null, ifMeanP: ig ? +(s.ifsp / ig).toFixed(3) : null };
  }
  const bars = {};
  for (const lid of ids) { const L = afState.leagues[lid]; if (L) bars[lid] = { name: L.name, bar: gateBarFor(L), ef: gateEdgeFor(L), shared: sharedBarKnown(L), n: (L.matches || []).length, predicts: predictsComp(L) }; }
  return { build: APP_BUILD, W0, W1, btFrom: BT_FROM, rows: rows.length, census, fixtures, seg: fmt, bins, bars };
}
