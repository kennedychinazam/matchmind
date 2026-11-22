# MatchMind handover — 22 November 2026

This document is the full handover for the MatchMind production work carried out in this session. It covers what was done, what is left, a suggested path for each open item, and what each repository is for. Production is live and healthy at the time of writing.

---

## 1. Repositories and what each one is for

| Repository | Purpose | Key branches |
|---|---|---|
| **kennedychinazam/matchmind** | The main application. Contains the client (`index.html`), the Supabase edge functions (`backend/`, deployed separately), the picks robot (`robot/publish.mjs`), the test suite (`test/`), and every release SQL file (`release/`). This is what the public app at the GitHub Pages URL is built from. | `main` — production, auto-published to GitHub Pages. `ccr-5da6e9b3-3ms4v5` — this session's working branch; mirrors `main` plus the full test suite. `backup/build355-20261023` — a frozen copy of the pre-this-session production build, kept for rollback. Many `claude/...` and `codex/...` branches are historical work from earlier sessions; most are stale and can be archived or deleted once someone confirms nothing in them is still needed. |
| **kennedychinazam/matchmind-preview** | A separate, smaller repository that runs a public preview of the app against a staging Supabase project (`rdcbnvfnxenrpnnwxszs`), refreshed on a GitHub Actions schedule. It exists so changes can be checked on real-looking data before touching production. It was not touched in this session; it is mentioned here only so you know it exists and what it is for. | `main`, `ccr-5da6e9b3-3ms4v5` |

**Supabase projects**
- **Production: `toqfdrcjzwnlydqekude`.** This is the live database. It holds the real fixtures, picks, odds, and the bounded display functions the public app calls. All changes in this session happened here, each one tested first.
- **Staging: `rdcbnvfnxenrpnnwxszs`.** Used only by `matchmind-preview`. Not touched this session.

**External data provider**
- **API-Football (api-sports.io).** The source of fixtures, scores, odds, and league data. Collected by the `refresh-af` Supabase edge function. The app has a daily allowance of roughly 75,000 calls; current usage is about 8,000 a day, so there is headroom for the newly added competitions.

---

## 2. What has been done

### 2.1 Security and exposure (Builds 358–359)
- Anonymous visitors could previously download the entire `fixtures` table directly through the public database key. That is now closed: visitors read only small, bounded "editions" through a set of narrow server functions (listed in section 3).
- The public page text no longer mentions an "API key" anywhere.
- Fixed a bug that emptied the whole app for any visitor whose history included a small number of reconstructed picks.

### 2.2 Match detail parity with Build 355 (Build 361)
Build 355 computed everything — league table, head-to-head, form, goals, scorers — by downloading all raw data to the phone. The new design cannot do that, so a dedicated per-match function (`matchmind_match_context_v1`) now delivers just what one match's detail page needs. All panels are restored: Form, Head to Head, League Table, Goals Markets, Half-time/Full-time, Likely Scorers, and the written analysis (including the AI write-up for signed-in users).

### 2.3 Honest confidence tiers (Builds 360, 362, 364)
Previously a match either got a published pick or showed nothing. Now every match that the engine has analysed shows something:
- **Strong** — clears the competition's measured bar (at least 75%). This is the only tier counted in the official accuracy record.
- **Lean** — between 65% and the Strong bar. Shown with its own separate, honestly tracked record.
- **Too close to call** — shown with the raw home/draw/away percentages, not graded at all.

This was based on a walk-forward backtest against roughly 20,000 real past fixtures before shipping, and research into how comparable products (Opta, FiveThirtyEight's SPI, ClubElo, Forebet, Sofascore, FotMob) handle the same problem. The conclusion: show a probability on every match, but only count the confident calls in the headline record.

### 2.4 League coverage expansion (Build 365)
Collection and prediction were extended, on the owner's explicit scope, to:
- **UEFA club competitions**: Champions League, Europa League, Conference League, Super Cup, Club World Cup.
- **CAF club competitions**: Champions League, Confederation Cup, Super Cup.
- **National teams**, European and African: World Cup and qualifiers, Euros and qualifiers, AFCON and qualifiers, CHAN, Nations League, friendlies.

Because the existing per-competition engine cannot price a team with no history in a given competition, a **cross-competition rating (XR)** was built: one Elo-style rating per club and a separate one per national team, built from all of a team's matches everywhere, with time decay, home advantage by country, and no home advantage at neutral/host venues. This directly answers the earlier concern that a club new to a competition was priced as a blank average — it is now priced from its rating everywhere else, not treated as unknown.

### 2.5 Goals market correction (Build 366)
The owner's observation that goals picks were the worst performers was investigated and confirmed: the engine judged goals on a five-year average, while this season is running hotter than that average, so "Under 3.5" was being overstated (claimed 79%, actually landing at 75–76%). Fixed by weighting goals expectations toward recent scoring levels (last 60 days, league-adjusted) and refitting the calibration shift. Verified afterward at 79.0% hit vs 78.8% stated — essentially exact.

### 2.6 BTTS research and Smart Bet quality (Build 368)
Requested research comparing BTTS against straight-win picks, backtested on real fixtures:
- Straight win at 65%+ confidence: 73.2% hit vs 71.7% stated, with a small negative return at real bookmaker prices (-1.4%).
- BTTS "Yes" is honestly calibrated but never reaches 70% confidence on any match, so it cannot be a Strong pick; it can only ever be a Lean.
- BTTS "No" was found to overclaim by 5–10 points and was removed entirely.
- **Verdict: straight win remains the stronger market.** BTTS Yes is now available as its own Tips tab and as a Smart Bet/Slip Generator option, but never promoted above the 70% Smart Bet floor it cannot reach.

### 2.7 Independent Tips tabs (Build 368)
Previously the Over/Under 2.5 and BTTS tabs mostly just re-displayed whichever matches already had a Winner pick. Per the owner's instruction, each tab now judges its own market independently:
- A match with no clear winner can still appear in the Goals tab (if Over/Under clears its own bar) or the BTTS tab (if BTTS Yes clears its own bar).
- Each tab has its own measured confidence bar, not inherited from the Winner market.
- Explanatory text was cut to one short line per section.
- "Under 2.5" was removed everywhere (official picks, Leans, Tips tabs, Smart Bet, match-page combos) — it never actually led anywhere in the pick ladder, so nothing in the existing record changed.

### 2.8 Odds, chips, and the Slip Generator (Build 367)
- The data collector was only fetching odds up to 4 days ahead, had an unordered 600-fixture cap that silently dropped matches, and never went back for fixtures it missed. All three were fixed; odds coverage in the active window rose from 54% to 64%, and 232 of 233 fixtures inside 24 hours of kickoff are now priced.
- Odds now reach the public app itself (previously the browser had no legal way to read them at all), which is why the Slip Generator was broken — it had nothing to build a slip from. It now works end to end.
- List chips were simplified to short wording: "No pick" (with the detailed reason moved to the match page, not a tooltip), a blue "Lean: 2DNB · 65%" style chip, and "Void" for refunded picks. Team names no longer get truncated to fit.

### 2.9 Accuracy repairs
- Double Chance and Draw No Bet, which overclaimed by 1–2 points, were recalibrated and are now within 2 points of their stated confidence in every tested window.
- A safety cap was added so the Leans list can never again grow large enough to break the 5-minute screen refresh (this caused a real outage on 21 Nov, see below).
- The data collector was given more time headroom (runs now take ~79s against a 150s limit, down from ~105s).

### 2.10 Incident during this session
On 21 Nov, adding the new competitions pushed the screen size past its limit, and the 5-minute refresh failed silently for about 4 hours (14:38–18:26 UTC). The app kept showing stale scores rather than going empty. This was caught, the size limit was raised (now 3,000 cards / 4 MiB, current usage ~1,300 cards / ~1.1–1.3 MB), and a hard rule was added going forward: every subsequent change checks the screen refresh succeeds before being considered done.

---

## 3. How the system works now (for reference)

- Visitors never read raw tables. They read small, bounded "editions" through these server functions only:
  - `matchmind_display_v1` — the main screens (Scores, Analysis, Tips, Records).
  - `matchmind_history_v1` — past picks, paged at 250 per request.
  - `matchmind_leans_v1` — Lean picks (capped at 1,500).
  - `matchmind_odds_v1` — bookmaker odds for the window.
  - `matchmind_match_context_v1` — one match's form, head-to-head, table, and scorers, fetched only when that match's detail page is opened.
- A scheduled job (`matchmind-display-refresh`, every 5 minutes) rebuilds the "edition" every visitor reads. **If this job fails, the app serves stale data rather than going empty — but it should never be allowed to fail for long.** See the health check at the end of this document.
- Only one account (the picks robot) is allowed to publish, and this is enforced by the database itself, not by the client — a public user cannot gain publishing rights no matter what they do in the browser.
- The picks robot runs three times a day (23:17, 05:17, 17:17 UTC), signs in as the publisher, and lets the app's own code do the actual publishing and grading — the robot itself never computes a probability.

---

## 4. What is left, and the suggested way to close each one

### 4.1 Verify the first picks issued under the new rules
**What it is:** Every rule change in this session (tiers, goals correction, independent tabs, no BTTS No, no Under 2.5) takes effect on *newly issued* picks, never on picks already in the record. The 17:17 UTC robot run today (22 Nov) is the first one to run under all of these rules together.
**Suggested solution:** After that run completes, check `public.predictions` and `public.lean_picks` for rows created after 17:17 UTC and confirm the market mix looks as expected (fewer Under 3.5, more Double Chance/DNB/Winner, some BTTS Yes Leans, no Under 2.5, no BTTS No). This is a 5-minute read-only check; no code change should be needed unless something looks wrong.

### 4.2 MLS Strong picks overclaim
**What it is:** MLS picks that clear the Strong bar hit roughly 74–76% of the time in backtesting while stating about 82% confidence — a 6–8 point gap, the largest of any league tested. This predates this session's goals fix and is a separate, league-specific calibration issue, likely caused by MLS's playoff format, parity-driven scheduling, and travel/rest patterns that the current model does not account for.
**Suggested solution:** Treat this the same way the U3.5 and X2/1D corrections were handled — fit a league-specific calibration shift for MLS walk-forward on its own history (not blended with other leagues), verify it lands within 2 points, and ship it the same way. This is a contained, well-understood piece of work; it does not require new data collection, only a targeted recalibration pass on data already in the database.

### 4.3 Champions League / Conference League overclaim under the new cross-competition rating
**What it is:** The new XR rating prices every UCL/UECL tie, which is the whole point of building it, but its Strong-tier calibration for these two competitions specifically still overclaims (backtested ~4–5 points high), so they are deliberately capped at Lean for now rather than risk a misleading official record.
**Suggested solution:** This is an expected, temporary state, not a bug — it is the gate doing its job. As more matches are played under the live XR ratings (rather than backtested ones), re-run the same walk-forward calibration check used for the other corrections in this session. Once it lands within 2 points, lift the cap for those two competitions specifically. No urgency; nothing is broken by leaving it at Lean in the meantime.

### 4.4 Two stale GitHub branches
**What it is:** `diag-results` and `picks/build360` are leftover working branches from diagnostic/engineering work earlier in this session. They contain only code, except that an earlier version of `diag-results`'s history briefly held internal, unpublished engine prices for withheld fixtures (since overwritten in its current state, but still recoverable from its git history by anyone who looks).
**Suggested solution:** These need **owner action on GitHub directly** — deletion was attempted from this session and blocked by GitHub for `diag-results` in particular (likely because of its history). Go to the repository's Branches page on GitHub and delete both `diag-results` and `picks/build360`. If GitHub still refuses to delete `diag-results` outright, it can be force-pushed to an empty/orphan commit first (already done once in this session) and then deleted, or GitHub support can be asked to purge its history if the data sensitivity warrants it.

### 4.5 "Next 3 / Next 7 days" in the Goals and BTTS tabs
**What it is:** These two tabs currently only show predictions for the day they are issued, with a note explaining why, because the public app no longer has the raw data needed to price future days itself (by design — that data stays server-side).
**Suggested solution:** This is a straightforward, low-risk extension of the same per-match server function approach already used for everything else (`matchmind_match_context_v1` and the edition's goals markets) — have the server pre-compute Goals/BTTS reads for the next 7 days' fixtures the same way it does for "today", and include them in the edition. It was left out of this round only to keep the release scope manageable; there is no technical blocker.

### 4.6 A handful of already-played matches still read "No pick"
**What it is:** A small number of K League and MLS matches from 21 Nov show "No pick" because there was no board snapshot recorded for them before kickoff (an infrastructure gap on that specific day, now closed), and nothing is retroactively reconstructed for picks that were never recorded — on purpose, so the record stays honest and nothing is invented after the fact.
**Suggested solution:** No action needed. This is working as intended — the alternative (backfilling a "prediction" for a match that already finished) would be inventing a result after the fact, which the project's own rules forbid. This will not recur for future matches now that the board-snapshot gap is fixed.

### 4.7 Signed-in AI write-up not verified live
**What it is:** The AI-generated match write-up for signed-in users was restored in the code and backend, but could not be checked against the live site because this session has no test login credentials.
**Suggested solution:** Sign in as any real test account on the live app, open a match, and confirm the AI write-up appears below the standard analysis. This is a one-minute manual check; if anything is wrong, it is isolated to the `ai-analyze` edge function and easy to re-open as its own task.

### 4.8 Data collector runtime vs. its time limit
**What it is:** The `refresh-af` collector run now takes about 79 seconds against a 150-second cron timeout — comfortable headroom today, but it will grow again as more competitions and odds markets are added over time (it grew from under a minute to 105 seconds once already, which is what caused the first incident).
**Suggested solution:** No action needed now. Worth a periodic glance — if it climbs past roughly 110–120 seconds again, split the collection work across two scheduled runs (e.g., odds and fixtures on one 10-minute tick, injuries/statistics on the next) rather than trying to fit everything in one call.

### 4.9 Deploy-time dependency on a pinned GitHub URL
**What it is:** The latest `refresh-af` deploy pulls one file from a GitHub raw URL pinned to a specific commit, rather than bundling it entirely inline. This only matters at the moment of deployment — the running function does not depend on GitHub afterward.
**Suggested solution:** Fine to leave as-is; it is pinned to an exact commit so it cannot change unexpectedly. If this bothers you, the fix is simply inlining that one file's contents directly into the next deploy, which is a few minutes of work next time the function is touched anyway.

### 4.10 Staging refresh token — confirmed not needed
**What it is:** Earlier in this project, a GitHub token (`mm_preview_dispatch_token`) was discussed for making the preview environment refresh itself on a tighter schedule via Supabase. It was never created or needed.
**Suggested solution:** No action. GitHub's own timer refreshes the preview adequately. Only revisit this if the preview's refresh timing becomes a real problem (it has not).

---

## 5. Suggested order of work going forward

1. **Today:** check the 17:17 UTC publish (§4.1) — this is free, read-only, and closes the loop on everything shipped today.
2. **This week:** MLS calibration (§4.2) — same recipe as work already done, contained scope.
3. **This week, low effort:** delete the two stale branches (§4.4) — owner action, two minutes.
4. **Next sprint:** Goals/BTTS 7-day lookahead (§4.5) — a visible quality-of-life improvement for users.
5. **Opportunistic / low priority:** UCL/UECL recalibration (§4.3) once more live data accumulates; AI write-up sign-in check (§4.7); the collector runtime watch (§4.8).

---

## 6. Health check

Run this against the production Supabase project at any time to confirm the app is serving fresh data:

```sql
select (select max(as_of) from mm_fixture_delivery.editions) newest_edition,
       (select count(*) filter(where status<>'succeeded') from cron.job_run_details
        where jobid=12 and start_time > now() - interval '1 hour') display_failures_1h;
```

`newest_edition` should be within the last 5–10 minutes. `display_failures_1h` should be 0.

On the live site itself, the status chip in the header must read **"● Published"**. If it ever reads "Unavailable", check the query above first — that is exactly what happened during the 21 Nov incident, and the fix was a one-line bound increase once the cause was found.
