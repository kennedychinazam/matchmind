/* MatchMind — THE PUBLISHER ROBOT (2026-09-14, Ken's ruling "go with A").

   WHY IT EXISTS. A pick reaches the public record (`predictions`) only when a SIGNED-IN device opens
   the app: INSERT is `authenticated` only, on purpose (SQL ledger row 25), because anonymous inserts
   would let anyone forge the audit record M15 rests on. So the CLV sample grew with Ken's app opens,
   not with time: 129 picks archived on 2026-09-08, three on 2026-09-14.

   WHAT IT DOES, AND WHAT IT NEVER DOES. It opens the LIVE app in a headless browser, signed in as the
   publisher account. From build 324 that account is the ONLY writer of the shared bars
   (`competition_measures`): the app measures every competition and writes the result, and the robot waits
   for that pass, then reopens the app so a fresh boot publishes from the bars just written — the same bars
   every device reads. It then opens the Smart Bet tab so the app issues the day's shared slips (from build
   325 only the publisher may), and asks the app to write the one engine record every device shows. It NEVER
   computes, writes or edits a pick or a bar itself: the engine that publishes is the engine users run,
   so there is no second copy to drift (the signature defect: one correction, two surfaces).

   CREDENTIALS come only from the environment (GitHub Actions secrets) and are never printed.

   EXIT CODE: 0 when the app loaded, the shared bars were written and read back, and it published without
   an archive error (zero new picks can be a correct answer). Non-zero when it could not sign in, was not
   the publisher, a shared write failed, the bars did not load, it could not load, found duplicates, or the
   app reported an archive failure. MM_DRY_RUN=1 runs signed out for local testing and fails only if the
   app does not load. */
import { chromium } from 'playwright-core';

const APP_URL  = process.env.MM_APP_URL || 'https://kennedychinazam.github.io/matchmind/';
const SUPA_URL = 'https://toqfdrcjzwnlydqekude.supabase.co';
const SUPA_KEY = 'sb_publishable_wrXk5NFfWkrCdLgiQsaMHg_7lRPeO4-';   // the public key the app itself ships
const EMAIL    = process.env.MM_PUBLISHER_EMAIL || '';
const PASSWORD = process.env.MM_PUBLISHER_PASSWORD || '';
const PROFILE  = process.env.MM_PROFILE_DIR || './mm-profile';
const CHANNEL  = process.env.MM_CHANNEL || 'chrome';
const DRY_RUN  = process.env.MM_DRY_RUN === '1';
const TIMEZONE = 'Africa/Lagos';               // the day the app computes is the day its readers live in
const LOAD_TIMEOUT_MS = 20 * 60 * 1000;        // a cold profile reads five seasons of history
const MEASURE_TIMEOUT_MS = 70 * 60 * 1000;     // build 324: a full measurement pass over every competition
const SLIPS_TIMEOUT_MS = 5 * 60 * 1000;        // build 325: shared history + today's rows + prices
const QUIET_MS = 60 * 1000;                   // settled = loaded, backfill idle, queues empty, for a full minute
const POLL_MS = 5 * 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (msg, extra) => console.log(new Date().toISOString() + '  ' + msg + (extra ? '  ' + JSON.stringify(extra) : ''));

async function restCount(table, query) {
  try {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?select=*&${query}&limit=1`, {
      method: 'HEAD',
      headers: { apikey: SUPA_KEY, Authorization: `Bearer ${SUPA_KEY}`, Prefer: 'count=exact' },
    });
    const cr = r.headers.get('content-range');
    return cr ? Number(cr.split('/')[1]) : null;
  } catch (e) {
    return null;
  }
}

async function openApp(page) {
  await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForFunction(() => typeof APP_BUILD !== 'undefined' && typeof supa !== 'undefined' && !!supa,
    null, { timeout: 120000, polling: 1000 });
}

/* The app's own globals, read, never written. */
function readState() {
  let matches = 0, duplicates = 0;
  for (const L of Object.values(afState.leagues || {})) {
    const seen = new Set();
    for (const m of (L.matches || [])) {
      matches++;
      const k = m.date + '|' + m.home + '|' + m.away;
      if (seen.has(k)) duplicates++; else seen.add(k);
    }
  }
  const shared = typeof _measuresState !== 'undefined';
  return {
    build: APP_BUILD,
    competitions: Object.keys(afState.leagues || {}).length,
    expected: COMP_IDS.length,
    matches, duplicates,
    backfillRunning: !!_histBackfillRunning,
    loadedAt: typeof _leaguesLoadedAt !== 'undefined' ? _leaguesLoadedAt : 0,
    queued: archiveQueue.size, drift: driftQueue.size,
    signedIn: !!authUser,
    archiveFailed: archiveFailed || null,
    archiveDenied: !!archiveDenied,
    archiveRows: afState.archive ? Object.keys(afState.archive).length : null,
    // build 324 — the shared bars
    sharedBars: shared,
    publisher: shared ? isPublisher() : false,
    measuresState: shared ? _measuresState : null,
    sharedRows: shared ? Object.keys(SHARED_MEASURES).length : null,
    engineComps: Object.values(afState.leagues || {})
      .filter(L => L && (L.sport || 'football') === 'football' && (L.matches || []).length >= 15).length,
    skillRunning: !!_skillTimer,
    measuresPassDone: shared ? _measuresPassDone : 0,
    measuresWritten: shared ? _measuresWritten : 0,
    measuresWriteFailed: shared ? _measuresWriteFailed : 0,
    // build 325 — the shared records
    sharedRecords: typeof sharedRecordsPublish === 'function',
    slipsReady: typeof _slipHist !== 'undefined'
      ? (!!_slipHist.loaded && !!_sharedSlips.loaded && !!_dailyOdds.loaded) : false,
    issuedRowsToday: (typeof _sharedSlips !== 'undefined' && _sharedSlips.loaded) ? (_sharedSlips.rows || []).length : null,
  };
}

/* BUILD 325 — the Smart Bet tab issues a card only once the shared history, today's rows and today's prices
   are in hand; until then it paints a waiting state and seeds nothing. */
async function waitSlips(page) {
  const t0 = Date.now();
  while (Date.now() - t0 < SLIPS_TIMEOUT_MS) {
    const s = await page.evaluate(readState);
    if (s.slipsReady) { log('slips: ready', { secs: Math.round((Date.now() - t0) / 1000), issuedRowsToday: s.issuedRowsToday }); return s; }
    await sleep(POLL_MS);
  }
  throw new Error(`the Smart Bet tab did not finish loading within ${SLIPS_TIMEOUT_MS / 60000} minutes`);
}

async function waitSettled(page, label) {
  const t0 = Date.now();
  let quietSince = null, s = null;
  while (Date.now() - t0 < LOAD_TIMEOUT_MS) {
    s = await page.evaluate(readState);
    /* A REFUSED ARCHIVE ENDS THE WAIT. Once the database refuses a write, the app stops flushing for the
       session (`archiveWritable()` is false) and its queue never drains, so waiting for an empty queue
       would sit out the whole timeout and then fail with the wrong reason. Found by the signed-out dry
       run, 2026-09-14. The caller reports `archiveDenied` as the failure. */
    if (s.archiveDenied) {
      log(`${label}: the database refused the archive write; not waiting for the queue`, { queued: s.queued });
      return s;
    }
    const settled = s.loadedAt > 0 && !s.backfillRunning && s.queued === 0 && s.drift === 0
      && s.competitions >= Math.floor(s.expected * 0.9);
    if (settled) {
      if (quietSince == null) quietSince = Date.now();
      if (Date.now() - quietSince >= QUIET_MS) {
        log(`${label}: settled`, { secs: Math.round((Date.now() - t0) / 1000), competitions: s.competitions, matches: s.matches,
                                   measuresState: s.measuresState, sharedRows: s.sharedRows });
        return s;
      }
    } else {
      quietSince = null;
    }
    await sleep(POLL_MS);
  }
  throw new Error(`${label}: the app did not settle within ${LOAD_TIMEOUT_MS / 60000} minutes: ` + JSON.stringify(s));
}

/* BUILD 324 — the publisher's measurement pass writes every competition's bar to the shared record.
   Done = the app stamped the pass complete AND nothing has been measured for a full minute. */
async function waitMeasured(page) {
  const t0 = Date.now();
  let quietSince = null, s = null, lastLog = 0;
  while (Date.now() - t0 < MEASURE_TIMEOUT_MS) {
    s = await page.evaluate(readState);
    if (Date.now() - lastLog > 60000) {
      log('measures: in progress', { written: s.measuresWritten, failed: s.measuresWriteFailed, running: s.skillRunning });
      lastLog = Date.now();
    }
    const done = s.measuresPassDone > 0 && !s.skillRunning;
    if (done) {
      if (quietSince == null) quietSince = Date.now();
      if (Date.now() - quietSince >= QUIET_MS) {
        log('measures: pass complete', { secs: Math.round((Date.now() - t0) / 1000), written: s.measuresWritten,
                                         failed: s.measuresWriteFailed, sharedRows: s.sharedRows, engineComps: s.engineComps });
        return s;
      }
    } else {
      quietSince = null;
    }
    await sleep(POLL_MS);
  }
  throw new Error(`the shared measurement pass did not finish within ${MEASURE_TIMEOUT_MS / 60000} minutes: ` + JSON.stringify(s));
}

async function main() {
  if (!DRY_RUN && (!EMAIL || !PASSWORD)) throw new Error('MM_PUBLISHER_EMAIL and MM_PUBLISHER_PASSWORD must be set');
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const before = { predictions: await restCount('predictions', 'fxid=not.is.null'),
                   slipsToday: await restCount('daily_slips', `day=eq.${today}`),
                   sharedBars: await restCount('competition_measures', 'lid=not.is.null') };
  log('start', { app: APP_URL, dryRun: DRY_RUN, channel: CHANNEL, today, before });

  const ctx = await chromium.launchPersistentContext(PROFILE, {
    channel: CHANNEL, headless: true, timezoneId: TIMEZONE, viewport: { width: 412, height: 915 },
  });
  let code = 0;
  try {
    const page = ctx.pages()[0] || await ctx.newPage();
    page.on('pageerror', (e) => log('page error: ' + String((e && e.message) || e).slice(0, 300)));
    await openApp(page);

    if (!DRY_RUN) {
      const hasSession = await page.evaluate(async () => {
        const { data } = await supa.auth.getSession();
        return !!(data && data.session);
      });
      if (!hasSession) {
        const err = await page.evaluate(async ([e, p]) => {
          const { error } = await supa.auth.signInWithPassword({ email: e, password: p });
          return error ? String(error.message) : null;
        }, [EMAIL, PASSWORD]);
        if (err) throw new Error('sign-in refused: ' + err);
        log('signed in; reopening so the whole boot runs as the publisher');
        await openApp(page);
      }
      await page.waitForFunction(() => !!authUser, null, { timeout: 60000, polling: 1000 });
    }

    const boot = await waitSettled(page, 'boot');

    if (!DRY_RUN) {
      if (!boot.sharedBars) throw new Error('the live app is older than build 324: it has no shared bars to write');
      if (!boot.publisher) throw new Error('signed in, but not as the publisher account, so the shared bars cannot be written');
      if (!boot.sharedRecords) throw new Error('the live app is older than build 325: it has no shared record to write');
      /* Build 324 — measure and write every competition's bar, then publish from what was written. */
      const measured = await waitMeasured(page);
      if (measured.measuresWriteFailed) throw new Error(measured.measuresWriteFailed + ' shared measurement write(s) failed');
      log('reopening so a fresh boot publishes from the shared bars just written', { written: measured.measuresWritten });
      await openApp(page);
      await page.waitForFunction(() => !!authUser, null, { timeout: 60000, polling: 1000 });
      const republish = await waitSettled(page, 'republish');
      if (republish.measuresState !== 'loaded') throw new Error('the shared bars did not load on the republish boot: ' + republish.measuresState);
      if (republish.sharedRows < republish.engineComps) {
        throw new Error(`only ${republish.sharedRows} shared bars for ${republish.engineComps} competitions with an engine`);
      }
      /* The Smart Bet tab is where the app seeds the day's shared slips (build 297/300). Opened through
         the app's own state and render call, exactly as a tap on the tab does. */
      await page.evaluate(() => { tipState.tab = 'smart'; renderTips(); });
      await waitSlips(page);
      await sleep(15000);
    }
    const end = await waitSettled(page, 'after slips');

    /* BUILD 325 — the engine record every device shows: graded by the app's own function, written by the
       publisher, read back by the app before this returns. */
    let record = null;
    if (!DRY_RUN) {
      record = await page.evaluate(() => sharedRecordsPublish());
      log('shared engine record', record);
      if (!record || !record.ok) throw new Error('the shared engine record was not written: ' + (record && record.error));
    }

    const after = { predictions: await restCount('predictions', 'fxid=not.is.null'),
                    slipsToday: await restCount('daily_slips', `day=eq.${today}`),
                    sharedBars: await restCount('competition_measures', 'lid=not.is.null') };
    const summary = {
      build: end.build, competitions: end.competitions, expected: end.expected, matches: end.matches,
      duplicates: end.duplicates, signedIn: end.signedIn, publisher: end.publisher, archiveFailed: end.archiveFailed,
      archiveDenied: end.archiveDenied, archiveRows: end.archiveRows,
      measuresState: end.measuresState, sharedRows: end.sharedRows, engineComps: end.engineComps,
      newPredictions: (before.predictions != null && after.predictions != null) ? after.predictions - before.predictions : null,
      slipsToday: after.slipsToday, sharedBarsInTable: after.sharedBars, bootMatches: boot.matches,
      issuedRowsToday: end.issuedRowsToday, engineRecord: record,
    };
    log('summary', summary);

    if (!DRY_RUN) {
      const problems = [];
      if (!end.signedIn) problems.push('not signed in at the end');
      if (!end.publisher) problems.push('not the publisher account at the end');
      if (end.measuresState !== 'loaded') problems.push('the shared bars were not loaded at the end');
      if (end.archiveFailed) problems.push('the app reported an archive failure');
      if (end.archiveDenied) problems.push('the database refused the archive write');
      if (end.duplicates) problems.push(end.duplicates + ' duplicate matches in memory');
      if (problems.length) { log('FAILED: ' + problems.join('; ')); code = 1; }
      else log('OK');
    } else {
      log('DRY RUN complete (signed out: nothing is expected to publish)');
    }
  } finally {
    await ctx.close();
  }
  return code;
}

main().then((code) => process.exit(code)).catch((e) => {
  log('FAILED: ' + String((e && e.message) || e).slice(0, 500));
  process.exit(1);
});
