/* MatchMind collector v2 — API-Football (Phase 1)
   Deploy as a NEW Edge Function named `refresh-af`. Verify JWT OFF (cron calls it).

   WHY THIS IS A NEW FILE AND NOT AN EDIT TO refresh-scores.ts
   ----------------------------------------------------------
   The Football-Data collector works. It feeds the whole app. Replacing it in place means a bad
   deploy takes the app down with no way back except a paste from chat history. This runs ALONGSIDE
   it, writing the same `fixtures` table with `provider='af'`, until it is proven — then the cron
   switches over and the old one is unscheduled. Nothing is deleted at any point.

   THE FIRST THING TO RUN IS THE PROBE, NOT THE COLLECTOR
   -----------------------------------------------------
   Build 90 shipped a function querying `fixtures.kickoff` and `fixtures.pick`. Neither column
   existed. PostgREST returns an empty result rather than an error for an unknown column in a
   filter, so it reported `"ok": true, "sent": 0` forever and looked healthy. §60's archive bug was
   the same shape: state inferred rather than read.

   So: `{"probe": true}` fetches ONE fixture with its statistics, lineups, events and odds and
   returns the RAW JSON untouched. Read it, confirm the field names, and only then trust the
   mapping below. Every field access here is optional-chained so an unexpected shape yields null
   instead of a crash — but null columns that should have data are exactly the silent failure this
   probe exists to prevent.

   RATE LIMITING IS READ, NEVER GUESSED
   ------------------------------------
   §6 records two failed attempts at pacing Football-Data with a stopwatch. API-Football returns
   `x-ratelimit-requests-remaining` and `X-RateLimit-Remaining` on every response; afFetch reads
   them and stops when the allowance is genuinely gone. No sleep-and-hope.

   THE MODES, all selected by the POST body. Cron sends none of them and gets the normal run.
     {}                      normal — fixture window, then ODDS, then statistics detail
     {"probe": true}         raw provider JSON for one finished fixture. Writes nothing.
     {"oddsprobe": true}     raw odds JSON for the next kick-off, plus the measured request cost
                             of the odds pass. Writes nothing. RUN THIS BEFORE THE FIRST REAL RUN.
     {"bulkprobe": true}     af-38 - ONE /odds call for a whole league-day, and what it covered.
                             Writes nothing. The figure that decides whether the per-fixture odds
                             loop is overpaying. Optional {"league": n}, {"date": "YYYY-MM-DD"}.
     {"injprobe": true}      does /injuries answer for a PAST fixture, or only for today?
                             Writes nothing. Settles the claim build 169 asserted and never tested.
     {"passfill": true}      fill `passes_h`/`passes_a` on rows detailed before af-19 went live.
                             RE-MEASURED 2026-08-30: the selection holds 3,461 rows, not 2,273.
                             2,273 is the SEASON-2025+ subset — the M14 holdout, and the reason
                             this mode exists. The rest: 1,176 pre-2022 rows (fxid <= 731394,
                             contiguous, OUTSIDE the M14 pool) and 12 from 2022-2024.
                             Explicitly invoked, never on cron. Optional {"budget": n},
                             {"after": fxid} and {"quotaFloor": n}.
     {"history": true}       backfill one whole season of base rows
     {"dry": true}           full fetch and map, writes nothing
     {"one": true}           the smallest possible write, with the raw Postgres result
     {"nodetail": true}      fixtures only, then stop
     {"noodds": true}        skip the odds pass (isolates it from the rest in one invocation)
*/

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* BUILD 93's LESSON, APPLIED HERE. Ken deployed send-push twice and had no way to tell which
   version was live, because the reply was identical either way. "A deployed artefact should be
   able to say what it is." FN_VERSION is returned in EVERY response, success or failure.

   Why it matters right now: the real run failed with a message byte-identical to the one from
   before the try/catch was added. A try/catch cannot return the same text as an uncaught throw —
   so either the deploy did not take, or the failure happens outside the handler entirely. One
   invocation with this constant in the reply settles which. */
const FN_VERSION = "af-46";   /* af-46 - odds 7 days ahead, two candidate pages, played-fixture backfill, honest market warning */
const FN_VERSION_PREV = "af-45";   /* af-45 - EXTRA_LEAGUES: Europe, Africa and national teams by the date pass */

/* ══ af-41 — THE 90-MINUTE SCORE, AND A GUARD SO THE COLUMNS CAN NEVER KILL THE COLLECTOR ═══════
   `gh`/`ga` are the provider's `goals`, which INCLUDE EXTRA TIME, and AET/PEN are stored as
   FINISHED. Audited 2026-09-13 from stored goal events: of 2,009 validated knockout cup rows, 106
   (5.3%) are stored as a win when the match was level at 90 minutes, and the app grades 1X2 on them.
   `score.fulltime` is the 90-minute score, and it is now stored as `ft_h` / `ft_a`.

   `gh`/`ga` ARE DELIBERATELY UNCHANGED. Every consumer of them keeps its meaning; the app decides
   in a later build, measured, which one grading and the engine should read.

   🚨 ROW 23 OF THE SQL LEDGER IS WHY THE FLAG EXISTS. af-21 wrote a column that did not exist yet,
   every upsert returned 500, and the collector was dead for 54 hours. So the fields are written
   ONLY when one cheap select proves the column is there. Deployed before the SQL, this version
   behaves exactly like af-40 and says so in every response (`ftColumns: false`). */
let FT_COLUMNS = false;

const AF_BASE = "https://v3.football.api-sports.io";

/* The competitions the app trains on, in API-Football ids.
   MUST stay in step with COMP_IDS in the HTML (renamed from FD_COMP_IDS in build 158, when the app
   moved off the free provider) — §6 records what happens when they drift: fixtures appear with a
   blank prediction panel and a misleading message. */
/* BUILD 197 — the league phase, and this list MUST equal LEAGUE_PHASE in the app. A regression
   check compares the two; see the app's own comment for how the vocabulary was enumerated. */
const LEAGUE_PHASE_ROUNDS = ["Regular Season", "League Stage"];

const AF_LEAGUES: Record<number, string> = {
  39:  "Premier League",
  140: "La Liga",
  135: "Serie A",
  78:  "Bundesliga",
  61:  "Ligue 1",
  88:  "Eredivisie",
  94:  "Primeira Liga",
  40:  "Championship",
  71:  "Brasileirao Serie A",
  2:   "UEFA Champions League",
  /* == WAVE 1 OF THE EXPANSION — 2026-09-19, Ken: "bring them foreward" =======================
     Ken asked why Europa and Conference never appeared in the Analysis tab. They were not hidden
     or filtered: they had never been added, and `fixtures` held 0 rows for either.

     BOTH IDS WERE PROBED, NOT GUESSED (af-36's rule, and af-37's Honduras lesson). leagueprobe
     against country "World", 2026-09-19:
       3    UEFA Europa League              Cup, 13 seasons 2014-2026, standings=TRUE
       848  UEFA Europa Conference League   Cup,  6 seasons 2021-2026, standings=TRUE
       531  UEFA Super Cup                  Cup, 11 seasons,           standings=FALSE  -> REFUSED

     531 is refused for the same reason Algeria Ligue 2 (187) was: no standings, and a single match
     a year is not a pool the engine can model. Recorded as checked, not overlooked.

     848 IS STORED UNDER ITS CURRENT NAME. The provider still says "UEFA Europa Conference League";
     UEFA dropped "Europa" in 2024. Stored as "UEFA Conference League" so it cannot read as a second
     Europa competition — af-27's naming rule, which exists because the provider reuses names across
     competitions and a collision lets one inherit another's fitted constant.

     Neither is in LEAGUE_FIT_NAME, and both join LEAGUE_UNFITTED in the app: a new competition is
     unfitted until it has the history to be fitted, which is a measurement and not this change. */
  3:   "UEFA Europa League",
  848: "UEFA Conference League",
  /* BUILD 158 — the last competition still arriving only on the free tier. Until this collects,
     Copa Libertadores reaches the app from refresh-scores, which is the one thing keeping the old
     collector necessary. Id confirmed against /leagues?search=Libertadores: 13 is the senior
     "CONMEBOL Libertadores" — 540 is the U20 and 949 the Femenina, neither of which is wanted.
     The app already pairs free 2152 with this id, so the duplicate heading cannot reappear. */
  13:  "CONMEBOL Libertadores",

  /* ══ af-27 — WAVE 1 OF KEN'S EXPANSION. SIXTEEN COMPETITIONS, 11 -> 27 ════════════════════════
     Every id below was READ FROM `/leagues?current=true` on 2026-09-02 and its current season
     confirmed, never typed from memory: a wrong id collects nothing, reports nothing, and looks
     exactly like a quiet league — build 165's fault in a different costume.

     🚨 AND THE NAMES ARE CHOSEN, NOT COPIED FROM THE PROVIDER. `dampenFor` falls back to
     `DAMPEN_BY_LEAGUE[L.name]` for any competition absent from `LEAGUE_FIT_NAME`, so a league
     whose name COLLIDES with a fitted one silently inherits its constant. The provider calls
     Egypt's competition "Premier League" and Algeria's "Ligue 1" — storing those verbatim would
     have priced Cairo with England's fitted 0.70 and Algiers with France's 0.45. **That is build
     183 exactly**, where Brasileirao was priced with Italy's 0.35 for twenty-four builds because
     the constant was keyed on a name two competitions share. `AF_LEAGUES[71]` has read
     "Brasileirao Serie A" ever since for this reason; these follow the same rule, and a regression
     check now enforces it rather than leaving it to whoever adds the next league.

     None of the sixteen is in LEAGUE_FIT_NAME, so all correctly fall through to the engine's
     default DAMPEN until they have enough history to be fitted. That is the honest position: an
     invented constant is §17e's habit, and ten competitions are fitted, not twenty-seven. */
  141: "Segunda Division",          // Spain,  tier 2
  136: "Serie B",                   // Italy,  tier 2
  79:  "2. Bundesliga",             // Germany, tier 2
  62:  "Ligue 2",                   // France, tier 2
  89:  "Eerste Divisie",            // Netherlands, tier 2
  95:  "Segunda Liga",              // Portugal, tier 2

  307: "Saudi Pro League",
  292: "K League 1",                // South Korea
  305: "Qatar Stars League",
  169: "Chinese Super League",      // provider name is the ambiguous "Super League"

  253: "Major League Soccer",       // USA
  188: "A-League",                  // Australia

  233: "Egyptian Premier League",   // provider name is "Premier League" — MUST NOT be stored as that
  288: "South African PSL",
  200: "Botola Pro",                // Morocco
  186: "Algerian Ligue 1",          // provider name is "Ligue 1" — MUST NOT be stored as that

  /* ══ af-29 — WAVE 2a: JAPAN, AND THE DOMESTIC CUPS KEN ASKED FOR ═══════════════════════════════
     Ken, 2026-09-02: "we need to have japan in because they play a lot mid-week, also remember the
     cup matches from the top european countries, netherland for example, played lots of kvnb beker
     matches today." Both are the same blocker: **three of these eight are not on the calendar year**
     — Japan 2027, Copa del Rey 2025, Coupe de France 2025 — which is why `seasonFor` had to exist
     before any of them could be added. Ids and current seasons read from `/leagues?current=true`.

     ⚠ A CUP IS NOT A LEAGUE, AND THE ENGINE DOES NOT YET KNOW THAT. Team strength is built from
     `L.matches` — the competition's OWN history. A cup gives each team a handful of matches a season
     against opponents from other tiers, so the model behind a cup pick is thin and poorly connected.
     Pricing a KNVB Beker tie from Eredivisie form is the cross-competition problem M14b explored and
     did not solve. **The expectation is therefore that `gateReason` withholds most cup fixtures** —
     which is Milestone 8 working, not a fault. They are added for the midweek FIXTURE SUPPLY Ken
     wants; whether they produce publishable picks is a measurement to take in a week, not a promise
     made here. If the publish rate is ~0 they cost API budget and load time for nothing and should
     come back out. */
  98:  "J1 League",                 // Japan — season 2027, the reason seasonFor exists
  45:  "FA Cup",                    // England
  143: "Copa del Rey",              // Spain — season 2025
  137: "Coppa Italia",              // Italy
  81:  "DFB Pokal",                 // Germany
  66:  "Coupe de France",           // France — season 2025
  90:  "KNVB Beker",                // Netherlands
  96:  "Taca de Portugal",          // Portugal

  /* == af-37 - WAVE 2 OF KEN'S EXPANSION. EIGHTEEN COMPETITIONS, 35 -> 53 =====================
     Ken: "i need the app to pull up predictions even from the those tier 2 leagues. i want that
     much options" - then, after the enumeration: "all, please start."

     EVERY ID BELOW WAS ENUMERATED BY af-36's leagueprobe, NOT GUESSED. That tool exists because on
     this same day I guessed four ids sequentially from the tier above, three were right, and the
     fourth - offered as the Egyptian second tier - was HONDURAS Liga Nacional. Egypt's real id is
     887 and no amount of staring at 233 would have produced it.

     EVERY ONE HAS standings=true. Algeria Ligue 2 (187) was in the original shortlist and is NOT
     here: 16 seasons, a current 2026 season, 479 finished fixtures, and standings=FALSE, because it
     runs as two non-interacting groups. The engine models a competition as ONE pool, so a split
     league would compare teams that never meet. The fixture probe alone said "looks healthy"; the
     league probe is what caught it.

     THE NAMES ARE CHOSEN, NOT COPIED - af-27's rule, and this wave needed it twice. The provider
     calls BOTH England's tier 3 and China's tier 2 "League One", so storing either verbatim would
     let one inherit the other's fitted constant the moment either is fitted. That is build 183's
     Brasileirao fault waiting to happen, so they are "EFL League One" and "Chinese League One".
     "Second League" and "Liga 3" are likewise country-qualified.

     None is in LEAGUE_FIT_NAME. All eighteen keep TUNE.DAMPEN until they have the history to be
     fitted, which is a measurement and not this build. */
  41:   "EFL League One",            // England tier 3  - provider 'League One' COLLIDES with China 170
  42:   "EFL League Two",            // England tier 4
  43:   "National League",           // England tier 5
  50:   "National League North",     // England tier 6
  51:   "National League South",     // England tier 6
  58:   "Isthmian Premier",          // England tier 7
  59:   "Northern Premier",          // England tier 7
  60:   "Southern Premier South",    // England tier 7
  931:  "Southern Premier Central",  // England tier 7
  80:   "3. Liga",                   // Germany tier 3
  170:  "Chinese League One",        // China tier 2   - provider 'League One' COLLIDES with England 41
  887:  "Egyptian Second League",    // Egypt tier 2   - provider 'Second League'
  138:  "Serie C Girone A",          // Italy tier 3
  942:  "Serie C Girone B",          // Italy tier 3
  943:  "Serie C Girone C",          // Italy tier 3
  435:  "Primera Federacion G1",     // Spain tier 3
  436:  "Primera Federacion G2",     // Spain tier 3
  865:  "Liga 3 Portugal",           // Portugal tier 3 - provider 'Liga 3'

};

/* == af-45 - EXPANSION: UEFA SUPER CUP, CLUB WORLD CUP, CAF CLUB COMPETITIONS, NATIONAL TEAMS =====
   Scope set by the owner on 2026-11-21: European club football means UCL, UEL, UECL (already here),
   the UEFA Super Cup and the Club World Cup; Africa means the three CAF club competitions; plus the
   European and African national-team competitions. No further domestic leagues or cups.
   Every id below was READ from the provider's /leagues endpoint through leagueprobe on 2026-11-21
   (country "World"), never typed from memory. Names are country-qualified so none
   collides with a fitted competition (af-27's rule).

   THESE ARE NOT FETCHED ONE CALL PER LEAGUE. The per-league base pass costs 24 to 144 calls a day
   per competition; for sixteen competitions that are mostly idle it would buy nothing. Instead the DATE PASS below asks
   `/fixtures?date=` once per date, which returns every competition the provider has on that date,
   and keeps the rows whose league is listed here: today and tomorrow every run, plus one other date
   of the window per run on a rota. About 432 calls a day for all of them together, whatever the
   number of competitions, and off-season competitions cost nothing at all.

   531 UEFA SUPER CUP, REFUSED IN WAVE 1 because it has no standings and one match a year is not a
   pool the per-competition engine can model. That reason is handled in the app, not here: super
   cups, cups and continental ties are priced from a GLOBAL per-team rating built across every
   competition the team plays in, so a one-match competition no longer needs a pool of its own.
   The collector only has to bring the fixture, which is what this list does. */
const EXTRA_LEAGUES: Record<number, string> = {
  531: "UEFA Super Cup",
  12: "CAF Champions League",
  20: "CAF Confederation Cup",
  533: "CAF Super Cup",
  1: "World Cup",
  4: "Euro Championship",
  6: "Africa Cup of Nations",
  19: "African Nations Championship",
  32: "WC Qualification Europe",
  29: "WC Qualification Africa",
  960: "Euro Qualification",
  36: "AFCON Qualification",
  5: "UEFA Nations League",
  10: "International Friendlies",
  15: "FIFA Club World Cup",
  37: "WC Qualification Playoffs",
};
const AF_ALL: Record<number, string> = { ...AF_LEAGUES, ...EXTRA_LEAGUES };
for (const k of Object.keys(EXTRA_LEAGUES)) if (AF_LEAGUES[Number(k)] != null) throw new Error("EXTRA_LEAGUES overlaps AF_LEAGUES at " + k);

const WINDOW_PAST = 10;
const WINDOW_AHEAD = 7;

/* How many per-fixture detail calls one run may spend. Statistics, lineups, events and odds are
   ONE REQUEST PER FIXTURE EACH — four calls for one match. Left unbounded, a busy Saturday would
   drain a day's quota in a single run. The cap is a budget, not a guess: whatever is left over is
   picked up on the next run, because fixtures are processed oldest-missing-first. */
/* WAS 120, AND THAT IS ALMOST CERTAINLY WHAT KILLED THE RUN.
   The dry run — ten league fetches and nothing else — took 20.5 seconds. Each fixture then costs
   THREE more calls (statistics, lineups, events), so 120 fixtures is ~360 requests on top. At even
   a fifth of a second each that is over a minute, before the 20-second rate-limit sleeps. An Edge
   Function killed mid-flight reports whatever the platform feels like, which is how a resource
   limit arrived looking like a code error and cost three rounds.

   Two guards, because either alone is insufficient:
     · a much smaller budget per run, and
     · a WALL CLOCK. Fixtures are processed oldest-first and the detail pass is resumable by
       design, so stopping early loses nothing — the next cron run continues from where it
       stopped. A collector that finishes 15 fixtures every ten minutes catches up within hours
       and never dies. */
const DETAIL_BUDGET = 15;

/* ══ af-34 — THE DETAIL PASS MAY NOT SPEND THE ODDS PASS'S DAY ═══════════════════════════════════
   MEASURED 2026-09-04, 00:00-06:23 UTC, 38 runs, 2,816 calls of a 7,500 daily allowance:

       /fixtures/statistics        1,080   38.3%
       /fixtures (base, per league) ~1,053  37.4%
       /fixtures/lineups             ~268    9.5%
       /fixtures/events              ~268    9.5%
       /injuries                      ~76    2.7%
       /leagues?current=true           38    1.3%
       /odds?fixture=                  33    1.2%   <-- the only one that expires

   **Sixty per cent of the allowance went to statistics, lineups, events and injuries — which feed
   M13's feature layer (shipped wired to nothing) and M14's fitted model (holdout R² +0.0019, ships
   OFF). One per cent went to odds, the only data in this project that expires.** On 2026-09-03 the
   day's quota ran out at ~22:15 and the detail pass had stopped at 18:01 — the first time on record.

   THE ORDERING WAS ALREADY RIGHT AND THE MARGIN WAS MEANINGLESS. Detail stopped at `remaining <= 10`
   and odds at `remaining <= 5`: a FIVE-REQUEST head start, applied at the bottom of the day, long
   after detail had spent the quota. The priority was expressed and not enforced.

   THE FLOOR IS DERIVED, NOT CHOSEN. Once detail stops, a run costs base (~28) + `/leagues` (1) +
   odds (clock-limited to ~2 batches = ~16) = **≤45 calls, so ≤270 an hour at a ten-minute cron.**
   2,000 therefore buys **~7.4 hours of full base-and-odds operation** after the floor bites — on
   2026-09-05, with 195 fixtures and kick-offs from 10:00 to 23:30, that covers the 14:00 block
   (117 fixtures) and the 19:00-20:00 fixtures.

   ⚠ IT BOUNDS THE DAMAGE; IT DOES NOT BALANCE THE BUDGET. At 35 competitions the essential passes
   alone want ~5,900/day (base 4,032 + odds ~1,700 + leagues 144), leaving ~1,600 for detail against
   the ~6,000 it currently wants. **The floor is the right minimal intervention only because the
   spike is temporary** — the cup backfill added 6,353 rows on 09-03 and 2,876 remain never-tried,
   which clears in under a day. If detail is still saturating the quota once that queue drains, the
   answer is DETAIL_BUDGET or the competition count, not a bigger floor.

   ⚠ AND IT IS NOT A NEW IDEA — `passfill` has carried `PF_QUOTA_FLOOR` since it was written, and
   its break message already reads "api quota floor — odds pass protected". This applies that
   existing rule to the pass where 60% of the spend actually happens. */
const DETAIL_QUOTA_FLOOR = 2_000;
/* ══ af-28 — 45s BECAME 90s, AND WAVE 1 IS WHY ════════════════════════════════════════════════
   MEASURED IMMEDIATELY AFTER `af-27` WENT LIVE, on two consecutive real runs at 27 competitions:

       run 1   baseHot 26   oddsCaptured  8 of 71 due   oddsStoppedBy "run time budget"
       run 2   baseHot 26   oddsCaptured 12 of 71 due   oddsStoppedBy "run time budget"

   **Neither run was stopped by the odds budget or the odds clock. Both were stopped by the RUN's
   wall clock**, which the base pass had already spent fetching twenty-six competitions. af-26 gave
   the odds pass a budget of 100 and batches of 8; it never got to use them.

   🚨 THIS IS BUILD 166's DEFECT RETURNING THROUGH A DIFFERENT CONSTANT. That build found
   `ODDS_TIME_MS` measured from `t0` instead of the start of the odds pass, so the fixture fetch was
   spending the odds allowance — and fixed it by measuring from `tOdds`. The fix was right and
   incomplete: `TIME_BUDGET_MS` is STILL measured from `t0` and still bounds the odds loop, so a
   base pass that grows simply starves odds through the other guard. Eleven competitions hid it;
   twenty-seven did not.

   ⚠ AND THE ORDERING ARGUMENT IS UNCHANGED — it is the reason this constant moves rather than the
   odds budget. Everything else this function collects can be fetched again in ten minutes: a
   fixture list, a score, a statistic. **Odds exist around match time and are then gone.** Build 162
   put odds ahead of statistics on exactly that reasoning; the base pass now sits in front of both
   and has to be paid for out of the run, not out of the one pass that cannot be repeated.

   90 seconds is inside Supabase's per-request wall clock and leaves ~35s base + 25s odds + the
   remainder for the resumable detail pass. **The detail pass and the base pass are both resumable;
   the odds pass is the only one where a missed second is a permanent loss.** */
const TIME_BUDGET_MS = 90_000;

/* af-26 — how often a competition with no match in the next day and a half is refreshed. See the
   tiering block in the base pass. 60 against a ten-minute cron is six slots. */
const BASE_COLD_EVERY_MIN = 60;

/* ══ MILESTONE 12 — ODDS ══════════════════════════════════════════════════════════════════════
   ODDS TAKE THE CLOCK BEFORE STATISTICS DO, AND THAT ORDERING IS THE WHOLE POINT.

   Everything else this function collects can be fetched again tomorrow. A finished match keeps its
   xG forever; the detail pass is deliberately resumable for exactly that reason. Odds are the one
   thing on the list that EXPIRE. They exist around match time and then they are gone, so a run that
   spends its 45 seconds on statistics and runs out before the odds pass has thrown away data that
   no future run can recover, in order to fetch data that every future run could.

   So the odds pass runs FIRST and takes its budget off the top. The detail pass keeps whatever is
   left. On a busy Saturday that means statistics fall behind by a few hours. They catch up. The
   3 p.m. kick-off prices do not.

   WHY FIVE MARKETS AND NOT JUST 1X2. Phase-1 SQL reserved odds_open_h/d/a and odds_close_h/d/a —
   home/draw/away from one bookmaker. But the ladder (build 119) publishes Double Chance, Draw No
   Bet, Over/Under and BTTS as well, and Milestone 15 has to compare the model against the price of
   THE PICK THE APP ACTUALLY MADE. Collecting only 1X2 today would mean that in ten weeks, every
   ladder pick — which is most of the picks that clear the gate — has a model probability and no
   price to test it against. They all arrive in the SAME response for the same one request, so the
   only cost of taking them is storage, and the cost of not taking them is unrecoverable. */
/* ══ af-26 — 25 BECOMES 100, AND THE PASS BECOMES PARALLEL, IN THAT ORDER OF IMPORTANCE ════════
   MEASURED 2026-09-02 over 475 fixtures: the busiest 30-minute window holds **20 simultaneous
   kick-offs at eleven competitions**, and would hold **~90 at the ~50 Ken has asked for**. In the
   final half hour `oddsGapMin` is 8 minutes against a ten-minute cron, so every one of them wants
   a capture on every tick. At a budget of 25 that is **~72% of closing prices lost on the busiest
   days** — silently, permanently, and precisely on the fixtures worth the most.

   ⚠ RAISING THE NUMBER ALONE WOULD NOT HAVE WORKED, and this is why the two changes ship together.
   The pass was a SEQUENTIAL `for` loop with an `await` per fixture, bounded by ODDS_TIME_MS = 25 s.
   Ninety sequential round trips do not fit in twenty-five seconds, so a budget of 100 would simply
   have hit the time guard at roughly the same place and reported a different reason for the same
   loss. Batched, the wall clock stops being the binding constraint.

   ⚠ AND THE BUDGET IS A CEILING, NOT A TARGET. It only spends where fixtures are actually due, so
   raising it costs nothing on a quiet day — measured peak is 400 captures/day against a ceiling of
   3,600. The quota floor below still stops the pass on a tight plan, which is what makes this safe
   to raise BEFORE any upgrade rather than after. */
const ODDS_BUDGET = 300;         // fixtures per run — a ceiling, reached only when that many are due
const ODDS_PARALLEL = 12;        // requests in flight at once; the base pass already runs eleven
const ODDS_TIME_MS = 25_000;     // measured from the START OF THE ODDS PASS — see build 166
/* af-46 - THE APP SHOWS FIXTURES SEVEN DAYS AHEAD, SO PRICES ARE ASKED FOR SEVEN DAYS AHEAD. At 96 h,
   measured 2026-11-21, 389 of the 394 upcoming fixtures beyond four days carried no price at all and the
   slip generator could not reach a target on them. Past 24 h the cadence is one try a day, and league-day
   requests share one call between every fixture of that league and date, so this costs little. */
const ODDS_LOOKAHEAD_H = 168;
const ODDS_CLOSE_MIN = 30;       // a capture inside this counts as the CLOSING line

/* HOW OFTEN ONE FIXTURE IS RE-PRICED, as minutes-since-last-attempt required at each distance
   from kick-off. Tight near the whistle because that is the number Milestone 15 measures against
   (closing-line value), loose days out because the line barely moves and the budget is finite.

   THE 8 IS NOT A ROUND NUMBER AND MUST NOT BECOME ONE. The cron fires every 10 minutes. A gap of
   10 would mean that whenever a run lands 9.8 minutes after the last one — which is most of them,
   because the cron does not fire on a perfect grid — the fixture reads as "not due yet" and waits
   for the run after. Every other run silently skipped, in the final half hour, on the only
   snapshots that cannot be retaken. A required gap must be comfortably SHORTER than the interval
   of the thing that applies it. */
/* == af-40 - ONE REQUEST PER LEAGUE-DAY, NOT PER FIXTURE =======================================
   MEASURED 2026-09-06, and the measurement is af-38's, taken before anything switched on it:

       Premier League   2 of 2      Serie A   4 of 4      J1 League  9 of 9
       Ligue 1          3 of 3      La Liga   4 of 4      MLS        8 of 9
       Championship     6 of 8      paging.total 1 in EVERY case, 58-365 ms

   `pickOdds` read all of them unchanged, so this changes WHAT IS ASKED and not what is stored.
   70 league-days cover the 238 fixtures in the window - the same throttled request budget buys
   roughly 3.4x the coverage.

   WHY IT MATTERS, from the same session: of 960 played fixtures over ten days, **597 were NEVER
   ASKED FOR A PRICE AT ALL**. EFL League One, League Two, Taca de Portugal and the KNVB Beker sat
   at `odds_tries = 0` for their whole window. The pass makes 158 attempts a day against the ~1,152
   its own cadence table asks for, and a plan that allows 75,000. It was never quota.

   [!] PAGING IS HANDLED, NOT ASSUMED. Every league-day measured returned `paging.total: 1`, but
   the largest held nine fixtures and that is below any plausible page size - so a busy Saturday
   proving otherwise would SILENTLY DROP FIXTURES, which is the exact class of fault this project
   keeps paying for. The loop reads `paging.total` from the answer and fetches the rest, capped so
   a malformed answer cannot spin.

   [!] AND A FAILED CALL IS NOT AN ATTEMPT. `afFetch` returns `{response: []}` for a 429 and for a
   genuine empty alike (build 176), and the per-fixture loop stamped `odds_tries` either way. On
   the old shape that cost one fixture; measured, it had given up exactly FOUR outside the FA Cup,
   so it was never worth its own build. On THIS shape one refused call would mark a whole
   nine-fixture league-day as tried and af-30 would give up on all nine. So it ships here, for
   that reason and not as a fix to a problem that was hurting. */
const ODDS_MAX_PAGES = 5;
async function oddsLeagueDay(lid: number, season: any, date: string, key: string) {
  const byFx: Record<number, any> = {};
  let pages = 0, failed: string | null = null, pagesTotal = 1;
  for (let page = 1; page <= pagesTotal && page <= ODDS_MAX_PAGES; page++) {
    const j = await afFetch(
      `/odds?league=${lid}&season=${season}&date=${date}&page=${page}`, key);
    pages++;
    /* Build 176's rule at the only place it can still be applied: after this returns, an empty
       `response` and a refused request are the same object. */
    const why = whyFailed(j);
    if (why) { failed = why; break; }
    const t = Number(j?.paging?.total ?? 1);
    pagesTotal = Number.isFinite(t) && t > 0 ? t : 1;
    for (const e of (j?.response ?? [])) {
      const id = Number(e?.fixture?.id);
      if (id) byFx[id] = e;
    }
  }
  return { byFx, pages, failed, pagesTotal };
}
function oddsGapMin(hrs: number): number {
  if (hrs <= 0.5) return 8;
  if (hrs <= 6)   return 90;
  if (hrs <= 24)  return 360;
  return 1440;
}

/* Capture stops AT kick-off, not after it. A price taken once the match is under way is a live
   price, and quietly filing one as the closing line would put a number in the record that means
   something other than its column name — the fault that spammed users in build 92. */
/* ══ af-30 — A FIXTURE THE MARKET DOES NOT PRICE MUST STOP EATING THE ODDS PASS ════════════════
   🚨 MEASURED IN PRODUCTION THE HOUR af-29 WENT LIVE, over the 318 fixtures inside the 96-hour
   window:

       league 45  FA Cup    112 fixtures    112 tried    **0 priced**
       league 98  Japan      10 fixtures     10 tried    **0 priced**
       league 136 Serie B     9 fixtures      9 tried    **0 priced**
       league 253 MLS        15 fixtures     15 tried      15 priced
       league 39  Premier    10 fixtures     10 tried      10 priced

   **The FA Cup alone was 35% of the entire odds queue and none of it is priced** — those are
   qualifying rounds full of non-league clubs that no bookmaker quotes. The pass tried all 112 every
   cycle, and the run that exposed this captured **0 of 47 due, stopped by the odds time budget**.
   Adding the cups did not merely fail to produce picks; it was **actively starving the collection
   of the one thing that cannot be re-fetched**.

   THE RULE, AND WHY IT IS SHAPED THIS WAY. Give up on a fixture that has been asked ODDS_GIVEUP_TRIES
   times and never once returned a price — **but only while it is still far from kick-off.** Prices
   for an obscure tie can appear late, so inside ODDS_GIVEUP_KEEP_H everything is tried again
   regardless of history. A blanket give-up would quietly abandon exactly the closing captures M12
   exists to collect; this only stops the pointless far-out retries.

   ⚠ AND IT KEYS ON `odds_snaps == 0`, NOT ON THE COMPETITION. Hard-coding "skip the FA Cup" would be
   the name-keyed mistake this project keeps paying for, and it would be wrong the moment a cup
   reaches a round the market does care about. A fixture earns its retries by having been priced at
   least once; that is a fact about the fixture, not a guess about its league. */
/* ⚠ af-31 — FOUR WAS A GUESS AND THE MEASUREMENT WAS AVAILABLE. Over 308 priced fixtures, how many
   tries were wasted before the FIRST price arrived:

       0 wasted   264   86%
       1 wasted    25   94%
       2 wasted    11   97%
       5+          8   100%

   **86% are priced on the very first attempt.** A fixture still unpriced after two is ~6% likely to
   be priced later, and those are re-tried inside the keep window anyway, so the only thing given up
   is a far-out capture that is never the closing line.

   AND FOUR DID NOT BITE. Far from kick-off the cadence gap is 1,440 minutes, so four tries takes
   FOUR DAYS — longer than the 96-hour window itself. Measured after af-30 went live: 157 of 318
   fixtures in the window were unpriced and exactly **1** had been dropped, with 156 still short of
   the threshold. A rule that cannot reach its own trigger inside the window it governs is not a
   rule. Two is chosen from the distribution above, not from caution. */
/* af-46: two tries inside 96 h as before, plus one daily try for each extra day of lookahead. */
const ODDS_GIVEUP_TRIES = 2 + Math.max(0, Math.ceil((ODDS_LOOKAHEAD_H - 96) / 24));
const ODDS_GIVEUP_KEEP_H = 12;
function oddsDue(hrs: number, lastTry: string | null, tries = 0, snaps = 0): boolean {
  if (hrs <= 0 || hrs > ODDS_LOOKAHEAD_H) return false;
  if (hrs > ODDS_GIVEUP_KEEP_H && snaps === 0 && tries >= ODDS_GIVEUP_TRIES) return false;
  if (!lastTry) return true;
  const since = (Date.now() - new Date(lastTry).getTime()) / 60000;
  return Number.isFinite(since) ? since >= oddsGapMin(hrs) : true;
}

/* Provider market name -> selection name -> the column this project stores it in. Matched BY NAME
   and lower-cased, for the same reason statPair matches statistics by name: bet ids are stable
   until they are not, and a wrong number is worse than a missing one. A market that stops matching
   is reported in `oddsMarketsMissing` on every run rather than quietly producing nulls. */
const ODDS_MARKETS: Record<string, Record<string, string>> = {
  "match winner":     { "home": "h", "draw": "d", "away": "a" },
  "goals over/under": { "over 1.5": "o15", "under 1.5": "u15",
                        "over 2.5": "o25", "under 2.5": "u25",
                        "over 3.5": "o35", "under 3.5": "u35" },
  "both teams score": { "yes": "bttsy", "no": "bttsn" },
  "double chance":    { "home/draw": "dc1x", "home/away": "dc12", "draw/away": "dcx2" },
  /* BUILD 165 — THIS KEY WAS "draw no bet" AND COLLECTED NOTHING FOR A DAY.
     API-Football has no full-match bet called "Draw No Bet". The two-way, draw-void market is bet
     id 2, named **"Home/Away"**, and the probe's own prices prove it: 1X2 read 2.64 / 3.70 / 2.36
     on the sample fixture, and Home/Away read 1.95 / 1.77 — the same side favoured, two outcomes,
     a ~7.8% margin. That is a draw-no-bet book.

     TWO TRAPS SITTING RIGHT NEXT TO IT, BOTH VISIBLE IN betNamesAvailable:
       · "Draw No Bet (1st Half)" (id 109) and "Draw No Bet (2nd Half)" (id 182) DO carry that
         name. They are half-match markets. Matching on the words "draw no bet" — or on any
         substring — would have quietly filed a first-half price as a full-time one, which is a
         wrong number rather than a missing one and would have poisoned Milestone 15 invisibly.
         Lookup here is EXACT on the whole lower-cased name, so neither can be reached.
       · "Double Chance" has a SELECTION called "Home/Away" (dc12). No collision: markets are keyed
         by bet name and selections by value name, which are two different levels of the response. */
  "home/away":        { "home": "dnbh", "away": "dnba" },
};
const ODDS_KEYS = Object.values(ODDS_MARKETS).flatMap((m) => Object.values(m));

/* ══ BUILD 167 — THE WIDE MARKETS, at Ken's instruction: "collect HT/FT and Exact Score odds" ══
   Both are markets the app already PUBLISHES — the half-time/full-time panel (Milestone 18's whole
   market) and the correct-score panel from build 117 — and neither had a price to be tested against.
   They arrive in the SAME response as the five already collected, so the marginal API cost is zero
   and the cost of not taking them is the usual one: unrecoverable.

   WHY THESE TWO ARE NOT IN ODDS_MARKETS. Every market above maps each selection to its own numeric
   COLUMN, which works because five markets share seventeen selections between them. HT/FT has nine
   outcomes and Exact Score has around thirty-two, and they are open-ended — a bookmaker may quote
   5:2 on one fixture and not the next. Forty-one more columns, most of them null on most rows, to
   store a market nobody queries by selection, is a schema shaped by how the data arrives rather
   than by how it will be read. These go to one jsonb column each, keyed by the provider's own
   label.

   CONSENSUS ONLY, NO PER-BOOK BREAKDOWN, AND THAT IS A DELIBERATE TRADE. `prices` keeps every
   bookmaker's own number for the five core markets, because closing-line value is measured there
   and one book's line can matter. Thirty-two scorelines across thirteen books is ~400 numbers per
   snapshot for a long-shot market that will be compared against the app's own published price, not
   arbitraged between books. The median is enough for that, and a row that stays small is a row that
   keeps getting written. */
const ODDS_WIDE: Record<string, string> = {
  "ht/ft double": "htft",
  "exact score":  "cs",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let remaining = Infinity;   // read from response headers, never assumed

/* THE PER-MINUTE LIMIT, FOUND BY THE PROBE. Two of its 21 requests came back with
   `errors: { rateLimit: "Too many requests..." }` — at HTTP 200, with results: 0. The daily
   allowance was untouched (7,476 left); it is a SEPARATE per-minute cap.

   The first version treated that as a hard failure and moved on, which is why Brasileirao 2020 and
   Eredivisie 2023 read as "0 finished fixtures" in the probe when both are full seasons. **A
   throttle reported as an empty result is indistinguishable from no data** — the same trap as the
   §60 archive bug and build 90's phantom columns, arriving for the third time in this project.

   So: rateLimit is now a RETRY, not a result. Waits and tries again, twice, before giving up. §6's
   lesson holds — the wait is only taken when the provider says it is needed, never on a stopwatch. */
async function afFetch(path: string, key: string, attempt = 0): Promise<any> {
  if (remaining <= 2) return { response: [], _skipped: "quota" };
  const res = await fetch(AF_BASE + path, { headers: { "x-apisports-key": key } });

  // both header spellings appear in the wild; take whichever is present
  const rl = res.headers.get("x-ratelimit-requests-remaining") ??
             res.headers.get("X-RateLimit-Remaining");
  if (rl != null && rl !== "") remaining = Number(rl);

  if (res.status === 429) {
    if (attempt >= 2) return { response: [], _rateLimited: true };
    await sleep(20_000); return afFetch(path, key, attempt + 1);
  }
  if (!res.ok) return { response: [], _http: res.status };

  const j = await res.json();
  /* API-Football returns HTTP 200 with a populated `errors` object for a bad key, an expired
     plan, an unsupported parameter — or a per-minute throttle. Treating 200 as success is how a
     dead integration looks healthy for a week. */
  if (j?.errors && !Array.isArray(j.errors) && Object.keys(j.errors).length) {
    if (j.errors.rateLimit && attempt < 2) { await sleep(20_000); return afFetch(path, key, attempt + 1); }
    return { response: [], _apiErrors: j.errors };
  }
  return j;
}

/* BUILD 176's RULE, AS A FUNCTION INSTEAD OF A HABIT. afFetch returns `{response: []}` for every
   failure mode it has — _rateLimited, _http, _apiErrors, _skipped — so `!j?.response?.length` is
   true both when the provider genuinely has nothing and when the call never happened. Build 175
   stamped both as "tried", and build 176 had to unpick eight rows of rate-limit artefacts that had
   briefly looked like proof a major league has no 2020 statistics.

   Returns null when the call really succeeded, and a string naming the failure otherwise. A probe
   that reports a zero without consulting this is not reporting a measurement.

   The detail loop and the statistics probe each carry their own inline copy of this test, and both
   copies are pinned line by line by assertions that exist because one of them was mutated into
   vacuity already. Folding those two in here is correct and is its own build; this one adds no
   third copy. */
function whyFailed(j: any): string | null {
  return j?._rateLimited ? "rate limited"
       : j?._apiErrors   ? "api errors: " + JSON.stringify(j._apiErrors)
       : j?._http != null ? "http " + j._http
       : j?._skipped     ? "quota guard"
       : null;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/* API-Football status short codes -> the app's existing vocabulary, so nothing downstream has to
   learn a second dialect. FINISHED/NS are what the HTML already tests against. */
/* af-42 — THE LIVE FAMILY IS PASSED THROUGH, NOT COLLAPSED. Ken: "all live matches in the app
   should also show how many minutes is being played and halftime." Half-time was indistinguishable
   from the 31st minute because 1H, HT, 2H, ET, BT and P all became the single string "LIVE".

   SAFE BY CONSTRUCTION, AND CHECKED BEFORE CHANGING IT: the app funnels every status through
   `canonStatus`, tests finished with `isFin()` on ['FT','AET','PEN'] alone, and already carries
   LIVE_CODES = ['1H','2H','HT','ET','BT','P','INT','LIVE'] plus the same codes in STATUS_CODES.
   Every value this map can now emit is one the app already understands.

   The FINISHED family is deliberately untouched: the archive, the grader and the published record
   are all keyed on that string. */
const STATUS: Record<string, string> = {
  TBD: "SCHEDULED", NS: "NS", "1H": "1H", HT: "HT", "2H": "2H", ET: "ET",
  BT: "BT", P: "P", SUSP: "SUSPENDED", INT: "INT", LIVE: "LIVE",
  FT: "FINISHED", AET: "FINISHED", PEN: "FINISHED",
  PST: "POSTPONED", CANC: "CANCELLED", ABD: "CANCELLED", AWD: "AWARDED", WO: "AWARDED",
};

const num = (v: any) => {
  if (v == null) return null;
  const s = String(v).replace("%", "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};

/* Statistics arrive as an array of {type, value} per team, with human-readable type names.
   Pulling them by name is fragile if the provider renames one, so unknown names are ignored
   rather than mapped by position — a wrong number is worse than a missing one. */
function statPair(stats: any[], teamId: number, name: string) {
  const block = stats?.find((s: any) => s?.team?.id === teamId);
  const row = block?.statistics?.find((x: any) => x?.type === name);
  return num(row?.value);
}

/* BUILD 112'S PARSER, PORTED. The `time` column does not always hold "HH:MM" — some rows carry a
   full timestamp, and the old string-concatenation produced NaN. That NaN made kickoffPassed()
   return false, which switched OFF the freeze rule for those fixtures without a word on screen.
   The odds pass decides everything from hours-to-kick, so it inherits that bug wholesale if it
   builds the date by concatenation. It does not. */
function kickoffUTC(dateStr: any, timeStr: any): Date | null {
  const raw = String(timeStr ?? "").trim();
  if (!raw) return null;
  let m = raw.match(/(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})/);
  if (m) {
    const d = new Date(`${m[1]}T${m[2].padStart(2, "0")}:${m[3]}:00Z`);
    return isNaN(+d) ? null : d;
  }
  m = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!m || !dateStr) return null;
  const d = new Date(`${String(dateStr)}T${m[1].padStart(2, "0")}:${m[2]}:00Z`);
  return isNaN(+d) ? null : d;
}

/* MEDIAN, NOT MEAN, and this is a measurement decision rather than a stylistic one. Bookmakers in
   the response do not all update at the same moment; one book carrying a stale price from an hour
   ago drags a mean and cannot move a median. The same applies to the occasional 1.01 placeholder.
   Milestone 15 compares the model against the market, so the market number has to be the typical
   price and not the average of the typical price and one mistake. */
function median(xs: number[]): number | null {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return null;
  return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;
}

/* One /odds response -> consensus prices, every book's own prices, and WHAT WAS NOT FOUND.
   That last one is the part that matters. If the provider renames "Goals Over/Under" tomorrow,
   this returns nulls for four selections and carries on — indistinguishable from a fixture nobody
   prices, which is the trap that has now cost this project three separate rounds (build 90's
   phantom columns, §60's archive, build 159's FINISHED). So every run reports the markets it
   expected and did not see, and an empty list is the only healthy answer. */
function pickOdds(entry: any) {
  const byBook: Record<string, Record<string, number>> = {};
  const pool: Record<string, number[]> = {};
  const seen = new Set<string>();

  const widePool: Record<string, Record<string, number[]>> = {};

  for (const b of (entry?.bookmakers ?? [])) {
    const bookName = String(b?.name ?? b?.id ?? "?");
    const got: Record<string, number> = {};
    for (const bet of (b?.bets ?? [])) {
      const betName = String(bet?.name ?? "").trim().toLowerCase();

      /* The wide markets (build 167): pooled by the provider's own selection label, because their
         selection sets are open-ended and naming them here would mean guessing which scorelines a
         bookmaker will quote. Same price guard as everywhere else. */
      const wideCol = ODDS_WIDE[betName];
      if (wideCol) {
        seen.add(betName);
        for (const v of (bet?.values ?? [])) {
          const label = String(v?.value ?? "").trim().toLowerCase();
          const price = num(v?.odd);
          if (!label || price == null || price <= 1) continue;
          ((widePool[wideCol] ??= {})[label] ??= []).push(price);
        }
        continue;
      }

      const mk = ODDS_MARKETS[betName];
      if (!mk) continue;
      seen.add(betName);
      for (const v of (bet?.values ?? [])) {
        const key = mk[String(v?.value ?? "").trim().toLowerCase()];
        const price = num(v?.odd);
        /* An odd of 1.00 or below pays nothing back and is a placeholder, not a price. Letting one
           into the pool would drag the consensus toward a number no one could ever have bet. */
        if (!key || price == null || price <= 1) continue;
        got[key] = price;
        (pool[key] ??= []).push(price);
      }
    }
    if (Object.keys(got).length) byBook[bookName] = got;
  }

  const cons: Record<string, number | null> = {};
  for (const k of ODDS_KEYS) cons[k] = pool[k] ? median(pool[k]) : null;

  /* One consensus per label, or null for the whole market if nobody quoted it — a null column reads
     as "not offered", an empty object would read as "offered and empty". */
  const wide: Record<string, any> = {};
  for (const col of Object.values(ODDS_WIDE)) {
    const p = widePool[col];
    if (!p) { wide[col] = null; continue; }
    const out: Record<string, number> = {};
    for (const label of Object.keys(p)) {
      const mv = median(p[label]);
      if (mv != null) out[label] = mv;
    }
    wide[col] = Object.keys(out).length ? out : null;
  }

  return {
    cons, wide, byBook,
    books: Object.keys(byBook).length,
    marketsMissing: [...Object.keys(ODDS_MARKETS), ...Object.keys(ODDS_WIDE)]
      .filter((m) => !seen.has(m)),
  };
}

function mapFixture(f: any, lname: string) {
  const st = f?.fixture?.status?.short;
  const dt = f?.fixture?.date ? String(f.fixture.date) : null;
  return {
    fxid: f?.fixture?.id,
    lid: f?.league?.id,
    /* 🚨 af-35 — THE CURATED NAME WINS, AND UNTIL NOW IT NEVER DID. This read
       `f?.league?.name ?? lname` — the PROVIDER first, `AF_LEAGUES` only as a fallback — and the
       provider always supplies a name, so the curated list never fired once. Six lines of
       AF_LEAGUES say `// provider name is "Premier League" — MUST NOT be stored as that`, and this
       line stored exactly that, on every run, for every row.

       MEASURED 2026-09-04, seven of thirty-five competitions were stored under the provider's
       ambiguous name: Brazil as "Serie A", Egypt as "Premier League", Algeria as "Ligue 1", Saudi
       as "Pro League", Qatar as "Stars League", China as "Super League", South Africa as
       "Premier Soccer League". Three of those collide with a FITTED competition, and the app's
       `dampenFor` name fallback then handed **Egypt England's 0.70 and Algeria France's 0.45**.

       `af-27` recorded this risk exactly — *"the provider's own names would have priced Cairo with
       England's fitted constant"* — and added the naming list. **It never changed the line that
       consumes it.** A curated value that loses to its own fallback is build 129's `met` again: a
       thing computed, present, and never actually read.

       Build 267 removes the app-side name fallback independently, so neither half relies on the
       other. This one fixes the cause; that one removes the blast radius. */
    lname: lname ?? f?.league?.name,
    lcountry: f?.league?.country ?? null,
    llogo: f?.league?.logo ?? null,
    season: f?.league?.season ?? null,
    /* BUILD 194 — THE ROUND, WHICH DECIDES WHETHER A FIXTURE BELONGS IN THE LEAGUE TABLE.
       The standings sweep of 2026-08-20 proved the derived table is wrong wherever a competition
       plays anything besides its round-robin: Wolfsburg read 36 matches against the provider's 34
       because a relegation play-off is stored under the same league id, and the Champions League
       derived 82 teams against 36 because qualifying rounds and knockouts sit beside the league
       phase. `league.round` is the only field that separates them — "Regular Season - 38" from
       "Play-offs" or "Round of 16" — and it has been in every fixture payload since build 158,
       dropped here like the statistics before 163 and the season before 188.
       NOT filtered on yet. The values are a provider vocabulary nobody in this project has read, and
       build 171's rule is that a vocabulary is enumerated from the data before anything keys on it. */
    round: f?.league?.round ?? null,
    date: dt ? dt.slice(0, 10) : null,
    time: dt ? dt.slice(11, 16) : null,
    status: STATUS[st] ?? "SCHEDULED",
    /* af-42 — the minute the match is at. The COLUMN already existed and had never once been
       written: 0 of 49 live rows carried it when this was measured. */
    elapsed: f?.fixture?.status?.elapsed ?? null,
    home: f?.teams?.home?.name ?? null,
    away: f?.teams?.away?.name ?? null,
    home_logo: f?.teams?.home?.logo ?? null,
    away_logo: f?.teams?.away?.logo ?? null,
    gh: f?.goals?.home ?? null,
    ga: f?.goals?.away ?? null,
    ht_h: f?.score?.halftime?.home ?? null,
    ht_a: f?.score?.halftime?.away ?? null,
    /* af-41 — the score at the end of normal time. Spread in only when the columns exist. */
    ...(FT_COLUMNS ? {
      ft_h: f?.score?.fulltime?.home ?? null,
      ft_a: f?.score?.fulltime?.away ?? null,
    } : {}),
    provider: "af",
    venue_id: f?.fixture?.venue?.id ?? null,
    venue_name: f?.fixture?.venue?.name ?? null,
    venue_city: f?.fixture?.venue?.city ?? null,
    referee: f?.fixture?.referee ?? null,
    updated_at: new Date().toISOString(),
  };
}

/* THE 500 THAT SAID NOTHING. First real run returned:
     "can't access property 'error', a is undefined"
   — a minified message from inside supabase-js, with no stack and no indication of which line.

   The working refresh-scores.ts wraps its whole handler in try/catch and returns String(e). This
   one did not, so a normal failure arrived as an opaque 500. That is a diagnosis problem, not a
   football problem, and it is the third time this project has lost a round to an error message
   that described nothing (§87's 429, build 94's "Failed to fetch", build 123's silent drop).

   Three things now, so the NEXT run answers the question instead of repeating it:
     1. try/catch around everything, returning the message AND the stack.
     2. the environment is checked and named before anything uses it.
     3. {"dry": true} runs the entire fetch-and-map pipeline and writes NOTHING, reporting what it
        WOULD have written. If dry succeeds and the real run fails, the fault is the database —
        almost certainly a column the SQL has not added yet. If dry fails too, it is the provider
        or the mapping. One invocation separates two very different problems. */
Deno.serve(async (req) => {
 try {
  /* af-39 - before anything else, and before any clock starts: a preflight costs nothing. */
  if (req.method === "OPTIONS") return preflight();
  const refused = mmCronRefusal(req); if (refused) return refused;   // af-43 — before the body, the env, the database and the provider
  const t0 = Date.now();
  let body: any = {};
  try { body = await req.json(); } catch { /* cron sends no body */ }

  const KEY = Deno.env.get("AF_KEY");
  const SUPA_URL = Deno.env.get("SUPABASE_URL");
  const SUPA_SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const missing = [
    !KEY ? "AF_KEY" : null,
    !SUPA_URL ? "SUPABASE_URL" : null,
    !SUPA_SRV ? "SUPABASE_SERVICE_ROLE_KEY" : null,
  ].filter(Boolean);
  if (missing.length) return json({ ok: false, step: "env", missing }, 500);

  const supa = createClient(SUPA_URL!, SUPA_SRV!);
  /* af-41 — before ANY mode can map or write a row: do the 90-minute columns exist yet? */
  { const ftProbe = await supa.from("fixtures").select("ft_h").limit(1); FT_COLUMNS = !ftProbe.error; }
  const today = new Date();

  /* -- LEAGUE PROBE (af-36) ---------------------------------------------------------
     WHY THIS EXISTS: on 2026-09-05 I needed the provider ids for four second-tier competitions and
     the only tool available took ids as INPUT. So I guessed sequentially from the tier above and
     verified with the fixture probe. Three of four were right - China League One 170, Serie C
     Girone A 138, Algeria Ligue 2 187 - and the fourth, guessed as the Egyptian second tier, was
     actually HONDURAS Liga Nacional. Wired unverified it would have collected Honduran football
     under an Egyptian heading, which is build 158's exact failure: "fixtures appear with a blank
     prediction panel and a misleading message."

     A THREE-IN-FOUR HIT RATE IS WHAT MAKES GUESSING DANGEROUS. It is right often enough to feel
     safe and wrong often enough to poison a competition silently. Ken moved to the Ultra plan the
     same day - 75,000 requests where there were 7,500 - so the reason this never existed (calls
     were scarce) is gone, and one call per country now removes guessing from the process for good.

     Writes nothing. Returns id, name, type and season coverage so a competition can be chosen on
     evidence: `standings` coverage says the engine can build a single table from it, which is what
     a girone-split or multi-group competition will fail. */
  if (body?.leagueprobe) {
    const countries: string[] = body?.countries ?? [
      "Egypt", "Italy", "England", "Spain", "Germany", "Portugal", "China", "Algeria",
    ];
    /* "league" or "cup". Null asks for both - the default is leagues, because a cup is what the
       build-277 evidence floor has just finished excluding. */
    const wantType: string | null = body?.type === undefined ? "league" : body?.type;
    const LEAGUEPROBE_BUDGET_MS = 25_000;   // same reason the fixture probe has one: see af-178

    const results: any[] = [];
    let lpStoppedBy: string | null = null;

    for (const country of countries) {
      if (remaining <= 20) { lpStoppedBy = "api quota"; break; }
      if (Date.now() - t0 > LEAGUEPROBE_BUDGET_MS) { lpStoppedBy = "time budget"; break; }

      const j = await afFetch(`/leagues?country=${encodeURIComponent(country)}`, KEY!);
      const raw = j?.response ?? [];
      const leagues = raw.map((r: any) => {
        const seasons = (r?.seasons ?? []).map((x: any) => x?.year).filter((y: any) => y != null);
        const cur = (r?.seasons ?? []).find((x: any) => x?.current);
        return {
          id: r?.league?.id ?? null,
          name: r?.league?.name ?? null,
          type: r?.league?.type ?? null,
          country: r?.country?.name ?? country,
          seasons: seasons.length,
          oldest: seasons.length ? Math.min(...seasons) : null,
          newest: seasons.length ? Math.max(...seasons) : null,
          /* The one field that decides whether the engine can model it at all. */
          standings: !!(cur?.coverage?.standings),
          currentSeason: cur?.year ?? null,
        };
      /* af-37 - THIS FILTER MATCHED NOTHING AND SAID SO WITH A ZERO. af-36 shipped
         `r.type === wantType` with a default of "league", and the provider returns "League".
         Every country came back `matching: 0` out of `returned: 46` - a filter silently
         excluding everything, which is the failure this codebase has now met at least three
         times: build 90's ok:true / sent:0, af-35's curated name that never fired, and the
         collector_syntax gate that reported "0 warnings" because nothing had parsed.
         `returned` sat beside `matching` in the response and made it one glance to see, which
         is the only reason it was caught in the same minute rather than believed. */
      }).filter((r: any) => !wantType ||
        String(r.type ?? "").toLowerCase() === String(wantType).toLowerCase());

      results.push({ country, returned: raw.length, matching: leagues.length, leagues });
    }

    return json({
      ok: true, mode: "leagueprobe", fn: FN_VERSION,
      countriesAsked: countries.length, countriesDone: results.length,
      wantType, lpStoppedBy, remaining, results,
    });
  }

  /* ── PROBE ─────────────────────────────────────────────────────────────────────────
     Returns raw provider JSON for ONE fixture. Nothing is written. Run this FIRST and
     read the field names before believing any mapping above. */
  if (body?.probe) {
    /* FIRST PROBE RETURNED results: 0 — and that was this function's fault, not the plan's.
       It asked league 39 / season 2026 with `last=1`, which returns the last PLAYED fixture. On
       11 Aug 2026 the 2026-27 Premier League has not kicked off, so there were none. `errors: []`
       and `remaining: 7499` proved the key and the subscription were fine all along.

       THE LESSON, and it is the same one as build 90 and §60: an empty result is not a failure
       message. It looks identical to "no data exists", "wrong parameter" and "not on your plan",
       and only one of those is worth acting on. So this probe now says WHICH it is.

       It also answers the question that actually shapes Phase 2: HOW FAR BACK does the plan go?
       §6 measured Football-Data at exactly three seasons and that single fact determined what the
       engine could ever be trained on. The equivalent number for this provider decides the same
       thing, and it is cheap to measure now — one request per season. */
    const probeSeasons: number[] = body?.seasons ?? [2026, 2025, 2024, 2023, 2022, 2021, 2020];
    /* ══ BUILD 178 — THE PROBE HAD A QUOTA GUARD AND NO TIME GUARD ════════════════════════
       Build 177 added a statistics call per league-season and left the default at three leagues.
       That took the probe from ~25 API calls to ~46, and every one of them can sleep 20 seconds
       twice inside afFetch's 429 retry. The main run has TIME_BUDGET_MS; the probe never has. The
       worker was killed before it could return anything.

       WHAT THAT LOOKED LIKE, because the symptom named the cause once it was read properly:
       Supabase answered 500 with NO BODY, and the dashboard reported
         can't access property "error", a is undefined
       which is its own JavaScript failing on an empty response — SpiderMonkey phrasing, not Deno's.
       This function's catch always returns JSON with step "unhandled" and a stack, so an error from
       inside it could never look like that. A missing body means the worker died, not that it threw.

       One league across seven seasons is 14 calls and finds the boundary; more leagues only CONFIRM
       it. Pass {"probe": true, "leagues": [39, 71, 88]} for the cross-league version afterwards. */
    const probeLeagues: number[] = body?.leagues ?? [39];   // PL only — see above
    const PROBE_BUDGET_MS = 25_000;

    const depth: any[] = [];
    let sample: any = null;
    let probeStoppedBy: string | null = null;

    outer:
    for (const lid of probeLeagues) {
      for (const sn of probeSeasons) {
        if (remaining <= 20) { probeStoppedBy = "api quota"; break outer; }
        if (Date.now() - t0 > PROBE_BUDGET_MS) { probeStoppedBy = "time budget"; break outer; }
        const j = await afFetch(`/fixtures?league=${lid}&season=${sn}&status=FT`, KEY);
        const n = j?.response?.length ?? 0;

        /* ══ BUILD 177 — THE QUESTION THIS PROBE ASKED, AND THE ONE IT DID NOT ═══════════════════
           It measured FIXTURE depth per season and then tested statistics on exactly ONE sample —
           the newest season that had fixtures. "Six seasons of history" came from the fixture
           counts, and statistics availability was assumed to follow.

           IT DOES NOT. Build 176's queue reported 280 fixtures tried and 28 filled, and the tried
           ones were Premier League, La Liga, Serie A and Primeira Liga from September 2020, all
           answering with an empty statistics array on calls that SUCCEEDED. Fixtures exist for
           2020; statistics do not.

           That distinction decides what Milestone 14 can ever be trained on, so it is measured per
           season here rather than inferred: one statistics call on one fixture from each season
           that has any. `hasXg` is the number that matters — a statistics array can come back
           populated with possession and shots and still carry no expected_goals, which would be a
           third answer again, and a rolling xG feature cannot be built on it. */
        let statsProbe: any = null;
        if (n > 0 && remaining > 20) {
          const f0 = j.response[n - 1];
          const sj = await afFetch(`/fixtures/statistics?fixture=${f0?.fixture?.id}`, KEY);
          const failed = sj?._rateLimited ? "rate limited"
                       : sj?._apiErrors   ? "api errors: " + JSON.stringify(sj._apiErrors)
                       : sj?._http != null ? "http " + sj._http
                       : sj?._skipped     ? "quota guard"
                       : null;
          const types = sj?.response?.[0]?.statistics?.map((x: any) => x?.type) ?? [];
          statsProbe = failed
            ? { failed }                       // NOT evidence about the season — build 176's lesson
            : { teams: sj?.response?.length ?? 0,
                hasXg: types.includes("expected_goals"),
                typeCount: types.length };
        }

        depth.push({
          league: lid, name: AF_LEAGUES[lid] ?? String(lid), season: sn,
          finishedFixtures: n,
          statsProbe,
          apiErrors: j?._apiErrors ?? null, http: j?._http ?? null,
        });
        if (!sample && n > 0) sample = j.response[j.response.length - 1];
        /* Stop rather than sleep through it. A throttled probe that keeps going turns a 14-call
           read into minutes of 20-second retries and gets the worker killed again — and build 176
           settled that a throttled call is not evidence anyway. */
        if (statsProbe?.failed === "rate limited") { probeStoppedBy = "rate limited"; break outer; }
      }
    }

    if (!sample) {
      return json({
        ok: false, probe: true, step: "no finished fixtures found in any league/season tried",
        depth, remaining, probeStoppedBy,
        note: "If every row shows 0 with apiErrors null, the plan reaches these leagues but not " +
              "these seasons. If apiErrors is populated, read it — that is the real message.",
      }, 200);
    }

    const fid = sample?.fixture?.id;
    const [stats, lineups, events, odds] = [
      await afFetch(`/fixtures/statistics?fixture=${fid}`, KEY),
      await afFetch(`/fixtures/lineups?fixture=${fid}`, KEY),
      await afFetch(`/fixtures/events?fixture=${fid}`, KEY),
      await afFetch(`/odds?fixture=${fid}`, KEY),
    ];

    /* What the mapping ACTUALLY produced, beside the raw response. Comparing these two is the
       whole point — a field name I guessed wrong shows up here as a null next to real data. */
    const mapped = mapFixture(sample, AF_LEAGUES[sample?.league?.id] ?? "");
    const st = stats?.response;
    const hid = st?.[0]?.team?.id, aid = st?.[1]?.team?.id;
    const mappedStats = !st?.length ? null : {
      xg_h: statPair(st, hid, "expected_goals"), xg_a: statPair(st, aid, "expected_goals"),
      poss_h: statPair(st, hid, "Ball Possession"), shots_h: statPair(st, hid, "Total Shots"),
      sot_h: statPair(st, hid, "Shots on Goal"), saves_h: statPair(st, hid, "Goalkeeper Saves"),
      passacc_h: statPair(st, hid, "Passes %"),
      passes_h: statPair(st, hid, "Total passes"),
    };

    return json({
      ok: true, probe: true, fixtureId: fid, remaining,
      probeStoppedBy,
      probeTruncated: probeStoppedBy != null,
      seasonDepth: depth,
      statTypesAvailable: st?.[0]?.statistics?.map((x: any) => x?.type) ?? null,
      mappedByThisFunction: mapped,
      mappedStats,
      oddsBookmakers: odds?.response?.[0]?.bookmakers?.map((b: any) => b?.name) ?? null,
      raw: { fixture: sample, statistics: st, lineups: lineups?.response,
             events: events?.response?.slice(0, 6), odds: odds?.response?.[0] },
    }, 200);
  }

  /* ── ODDS PROBE ────────────────────────────────────────────────────────────────────
     {"oddsprobe": true}                 -> the next fixture to kick off, anywhere in the set
     {"oddsprobe": true, "fixture": 123} -> that fixture

     Writes NOTHING. Run this before believing a single line of the odds pass below.

     The first probe in this file existed because a mapping written from a plan is a guess until a
     response confirms it. This one has the same job and one extra: it SIZES THE BUDGET. It counts
     the fixtures actually sitting in the odds window and reports them per cadence tier, so the
     per-day request cost is a number read off real data rather than a hope. Getting that wrong is
     what killed the run at DETAIL_BUDGET 120.

     It also measures the cheaper alternative instead of assuming it. /odds accepts league+date as
     well as fixture, and if one call returns a whole matchday the per-fixture loop below is paying
     many times over for the same information. That is worth knowing and NOT worth guessing, so the
     probe fires one and reports `results` and `paging` untouched. Nothing is switched on the
     strength of it today — this build ships the shape that is already confirmed to work. */
  /* -- BULK PROBE - af-38 -------------------------------------------------------------
     {"bulkprobe": true}                                    -> where bulk would pay most
     {"bulkprobe": true, "league": 39}                       -> that league's busiest day
     {"bulkprobe": true, "league": 39, "date": "2026-09-07"}

     Writes NOTHING and fires exactly ONE provider request.

     [!] THIS EXISTS BECAUSE `oddsprobe` COULD NOT BE READ. It measures this same league-day call
     in its `bulkByDate` field - but it fires the PER-FIXTURE call first, and on 2026-09-06 that
     call hit afFetch's 20-second 429 backoff twice, so the probe exceeded the Edge Function's wall
     clock and returned "Failed to fetch" at 106 s. A measurement that cannot be read is not a
     measurement. This mode takes the one call that matters and nothing else.

     WHAT IT IS FOR, MEASURED 2026-09-06 over the preceding 72 hours:

         odds attempts the pass actually makes      158 / day
         attempts the cadence table asks for      ~1,152 / day   (12 captures x ~96 fixtures)
         attempts Ken's plan allows                 75,000 / day

     **The shortfall is not quota and never was.** `ODDS_TIME_MS` is 25 s and `afFetch` sleeps 20 s
     on a 429, so ONE rate-limited answer ends the odds pass for that run. 93% of measured
     within-run gaps fall between 19 and 22 s (p10 20.3, median 20.4, p90 20.8) - that sleep and
     nothing else. Of 960 played fixtures over ten days, 597 were NEVER ASKED: EFL League One and
     Two, Taca de Portugal and the KNVB Beker went the whole window with `odds_tries` at zero,
     while the Championship, which the pass does reach, is priced 35 of 35.

     [!] AND af-26's CLAIM THAT "BATCHED, THE WALL CLOCK STOPS BEING THE BINDING CONSTRAINT" IS
     REFUTED BY THAT MEASUREMENT. It is the binding constraint; the backoff eats it. Raising
     ODDS_TIME_MS only moves the loss onto the detail pass, which runs after it and gates M14.
     Asking for a whole league-day removes the need instead: 53 competitions across four days is
     ~212 requests - FEWER than the 158 the pass already manages - for all of it rather than 38%.

     THE FIGURE THAT DECIDES af-39 IS `coversOursPct`: of the fixtures we hold for that league-day
     and would otherwise ask for one at a time, how many did the single call return. `paging` is
     reported raw and never folded into it - a paged answer saves less than the count suggests.

     Nothing switches on this today. That is the same rule the oddsprobe's own bulkByDate note set
     and this build keeps: measure first, ship the shape once it is confirmed. */
  if (body?.bulkprobe) {
    const { data: bRows, error: bErr } = await supa
      .from("fixtures")
      .select("fxid,lid,lname,date,time,season")
      .eq("provider", "af")
      .in("status", ["NS", "SCHEDULED"])
      .gte("date", ymd(today))
      .lte("date", ymd(new Date(today.getTime() + ODDS_LOOKAHEAD_H * 3600000)))
      .limit(1000);

    const wantL = body?.league != null ? Number(body.league) : null;
    const wantD = body?.date ? String(body.date) : null;

    /* Grouped on the (league, date, season) TRIPLE because that triple is exactly what one
       request names. Season comes from the ROW rather than from the calendar year: `seasonFor`
       exists precisely because Japan, the Copa del Rey and the Coupe de France do not agree with
       it, and it is declared further down inside the main run where this cannot reach it. */
    const groups: Record<string, any> = {};
    for (const r of (bErr ? [] : (bRows ?? []))) {
      if (wantL != null && r.lid !== wantL) continue;
      if (wantD != null && r.date !== wantD) continue;
      const k = r.lid + "|" + r.date + "|" + (r.season ?? "?");
      (groups[k] = groups[k] ?? { lid: r.lid, lname: r.lname, date: r.date,
                                  season: r.season, fxids: [] }).fxids.push(r.fxid);
    }
    const ranked: any[] = Object.values(groups)
      .sort((a: any, b: any) => b.fxids.length - a.fxids.length);
    const g: any = ranked[0];
    if (!g) {
      return json({
        ok: false, bulkprobe: true, step: "no upcoming fixture matched the filter",
        dbError: bErr?.message ?? null, upcomingConsidered: (bRows ?? []).length,
        note: "Nothing in the next " + ODDS_LOOKAHEAD_H + "h matched. Check the fixtures table " +
              "before concluding anything at all about /odds.",
      }, 200);
    }

    const path = "/odds?league=" + g.lid + "&season=" + g.season + "&date=" + g.date;
    const tBulk = Date.now();
    const bulk = await afFetch(path, KEY);
    const requestMs = Date.now() - tBulk;
    /* Build 176's rule, and the reason this probe is trustworthy at all: afFetch returns
       `{response: []}` for a 429, an HTTP error, a bad key AND a genuine empty. Reporting a zero
       without consulting whyFailed would be the artefact this project has already paid for once. */
    const failed = whyFailed(bulk);

    const entries: any[] = Array.isArray(bulk?.response) ? bulk.response : [];
    const returnedIds = new Set(entries.map((e: any) => Number(e?.fixture?.id)).filter(Boolean));
    const ours = new Set(g.fxids.map(Number));
    let coversOurs = 0;
    for (const id of ours) if (returnedIds.has(id)) coversOurs++;

    /* A call returning rows the mapper cannot read is not a saving, so the shape is mapped here
       with the SAME pickOdds the pass uses. One mapper, never a second copy - build 203's rule. */
    const mapped = entries.length ? pickOdds(entries[0]) : null;

    return json({
      ok: !failed, bulkprobe: true, remaining, requestMs,
      tried: path,
      leagueDay: { lid: g.lid, lname: g.lname, date: g.date, season: g.season },
      leagueDaysAvailable: ranked.length,

      /* -- THE COMPARISON THAT DECIDES af-39 -- */
      ourFixturesInThatLeagueDay: ours.size,
      fixturesReturnedByOneCall: returnedIds.size,
      coversOurs,
      coversOursPct: ours.size ? Math.round(100 * coversOurs / ours.size) : null,
      requestsSavedOnThisLeagueDay: coversOurs > 0 ? coversOurs - 1 : 0,

      // raw and untouched
      results: bulk?.results ?? null,
      paging: bulk?.paging ?? null,
      whyFailed: failed,

      // does the existing mapper read what came back?
      firstEntryBooks: entries[0]?.bookmakers?.length ?? 0,
      mappedBooks: mapped?.books ?? 0,
      mappedConsensus: mapped?.cons ?? null,
      betNamesAvailable: entries[0]?.bookmakers?.[0]?.bets?.map((b: any) => b?.name) ?? null,
      marketsMissing: mapped?.marketsMissing ?? null,

      note: failed
        ? "THE CALL DID NOT HAPPEN. This is not evidence that league-day bulk is unavailable - " +
          "read whyFailed, then run it again."
        : "coversOursPct is the figure. paging.total above 1 means the answer is paged and the " +
          "real saving is smaller than fixturesReturnedByOneCall suggests.",
    }, 200);
  }

  if (body?.oddsprobe) {
    const { data: upRows, error: upErr } = await supa
      .from("fixtures")
      .select("fxid,date,time,home,away,lname")
      .eq("provider", "af")
      .in("status", ["NS", "SCHEDULED"])
      .gte("date", ymd(new Date(today.getTime() - 86400000)))
      .lte("date", ymd(new Date(today.getTime() + 8 * 86400000)))
      .limit(600);

    const cand = (upErr ? [] : (upRows ?? []))
      .map((r: any) => ({ r, ko: kickoffUTC(r.date, r.time) }))
      .filter((x: any) => x.ko)
      .map((x: any) => ({ ...x, hrs: (x.ko.getTime() - Date.now()) / 3600000 }))
      .filter((x: any) => x.hrs > 0 && x.hrs <= ODDS_LOOKAHEAD_H)
      .sort((a: any, b: any) => a.hrs - b.hrs);

    /* Captures one fixture will receive over its whole life, tier by tier — the honest per-fixture
       request cost, from the cadence table rather than from an estimate of it. */
    const tiers: Array<[number, number]> = [[0.5, 0], [6, 0.5], [24, 6], [ODDS_LOOKAHEAD_H, 24]];
    let perFixtureCaptures = 0;
    for (const [hi, lo] of tiers) perFixtureCaptures += Math.floor((hi - lo) * 60 / oddsGapMin(hi));

    const target = body?.fixture ? { r: { fxid: Number(body.fixture) }, hrs: null as any } : cand[0];
    if (!target) {
      return json({
        ok: false, oddsprobe: true, step: "no upcoming fixture in the window",
        upcomingInWindow: 0, dbError: upErr?.message ?? null,
        note: "No fixture kicks off in the next " + ODDS_LOOKAHEAD_H + "h. Either the collector " +
              "has not run, or it genuinely is an international break. Check the fixtures table " +
              "before concluding the odds endpoint is the problem.",
      }, 200);
    }

    const oj = await afFetch(`/odds?fixture=${target.r.fxid}`, KEY);
    const entry = oj?.response?.[0];
    const mapped = entry ? pickOdds(entry) : null;

    const day = ymd(new Date(today.getTime() + 86400000));
    const bulk = await afFetch(`/odds?league=39&season=${today.getFullYear()}&date=${day}`, KEY);

    return json({
      ok: true, oddsprobe: true, remaining,

      // what this would cost per day, measured
      upcomingInWindow: cand.length,
      tierCounts: {
        "under 30min": cand.filter((x: any) => x.hrs <= 0.5).length,
        "30min-6h":    cand.filter((x: any) => x.hrs > 0.5 && x.hrs <= 6).length,
        "6h-24h":      cand.filter((x: any) => x.hrs > 6 && x.hrs <= 24).length,
        "24h-96h":     cand.filter((x: any) => x.hrs > 24).length,
      },
      capturesPerFixtureOverItsLife: perFixtureCaptures,
      budgetPerRun: ODDS_BUDGET,
      runsPerDay: 144,
      ceilingCallsPerDay: ODDS_BUDGET * 144,

      // what the provider actually returned
      fixtureTried: target.r.fxid,
      hoursToKick: target.hrs == null ? null : +target.hrs.toFixed(2),
      oddsUpdatedAt: entry?.update ?? null,
      bookmakerCount: entry?.bookmakers?.length ?? 0,
      bookmakers: entry?.bookmakers?.map((b: any) => b?.name) ?? null,
      /* THE FIELD TO READ FIRST. These are the market names as the provider spells them today.
         ODDS_MARKETS is keyed on the lower-case of these strings, so anything in this list that
         has no counterpart there is a market being dropped on the floor. */
      betNamesAvailable: entry?.bookmakers?.[0]?.bets?.map((b: any) => b?.name) ?? null,

      // what the mapping made of it
      mappedConsensus: mapped?.cons ?? null,
      mappedWide: mapped?.wide ?? null,          // build 167 — HT/FT and correct score
      mappedBooks: mapped?.books ?? 0,
      marketsMissing: mapped?.marketsMissing ?? Object.keys(ODDS_MARKETS),

      // the cheaper shape, measured and not acted on
      bulkByDate: {
        tried: `/odds?league=39&season=${today.getFullYear()}&date=${day}`,
        results: bulk?.results ?? null, paging: bulk?.paging ?? null,
        apiErrors: bulk?._apiErrors ?? null, http: bulk?._http ?? null,
        note: "If results is large and paging.total is 1, one call covers a whole league-day and " +
              "the per-fixture loop is overpaying. Nothing switches on this today — it is a " +
              "measurement for the next build.",
      },

      raw: { firstBookmaker: entry?.bookmakers?.[0] ?? null, apiErrors: oj?._apiErrors ?? null },
      ms: Date.now() - t0,
    }, 200);
  }

  /* ── INJURY PROBE (build 181) ──────────────────────────────────────────────────────
     {"injprobe": true}                                        the default sweep, one league
     {"injprobe": true, "league": 135, "seasons": [2025, 2021]}

     Writes NOTHING.

     THE CLAIM THIS EXISTS TO SETTLE, WHICH HAS BEEN LOAD-BEARING FOR TWELVE BUILDS.
     Build 169 wrote that /injuries "answers who is hurt now, not who was missing two seasons ago",
     and used that to justify deriving absences from the starting XI instead. Ten features were
     built on the back of it and items 20, 21 and 25 were left unbuilt. IT WAS NEVER PROBED. The
     endpoint accepts `fixture` and `season` parameters, which is not the shape of something that
     only knows about today.

     This project has been wrong about what this provider supplies twice, in the same direction both
     times. `goals_prevented` and the in/out-of-box shot split were found at build 158 by reading a
     response rather than a plan. "Six seasons of history" turned out to be four seasons of xG at
     build 179, because the depth had been measured on FIXTURES and statistics were assumed to
     follow. An unread claim about a provider is a guess wearing a fact's clothes.

     THE CONTROL IS NOT OPTIONAL — IT IS THE WHOLE DESIGN. If every past season answers zero, that
     reads as "there is no history", and it is indistinguishable from "this endpoint returns nothing
     on this plan", "the parameter is unsupported" and "the call never happened". Builds 176 and 179
     each cost a round to exactly that conflation, and the rule they earned is already written in
     this file: AN EMPTY RESULT FROM AN INSTRUMENT IS NOT A NULL RESULT. So the live season is asked
     the same question in the same run, and a zero in a past season counts as evidence only when the
     control is non-zero. The live season is read from the database, never assumed from the calendar.

     THE VERDICT IS COMPUTED FROM RULES WRITTEN HERE BEFORE IT WAS RUN. That is build 168's habit
     with the goals_prevented correlation — register the reading in the source, so the number cannot
     be interpreted after it has been seen:

       historical-by-fixture  a PAST-season /injuries?fixture=... succeeded and returned players.
                              Items 20, 21 and 25 are buildable per fixture, and build 169 was wrong.
       historical-by-season   no past fixture answered, but a past league+season did. The history
                              exists and is keyed by season; whether each record names its own
                              fixture then becomes the next question rather than a settled one.
       now-only               every past call SUCCEEDED and returned nothing, while the control
                              returned rows. Build 169's claim is confirmed and items 20, 21 and 25
                              are recorded UNREACHABLE — a valid way for Milestone 13 to close them,
                              exactly as attendance, surface and captain were closed.
       undecided              anything else: a failure anywhere, or a control that answered zero as
                              well. NOT a finding and must not be written up as one. Run it again.

     AND IT MEASURES THE COST WHILE IT IS THERE, because that decides whether a positive verdict is
     even affordable. Per-fixture collection across 22,009 fixtures is a different project from one
     call per league-season. So the league+season call reports `results`, `paging`, and how many
     DISTINCT fixture ids arrived in that one response — the same measurement the odds probe makes
     with `bulkByDate`, and nothing switches on it here either. */
  if (body?.injprobe) {
    const INJ_BUDGET_MS = 25_000;
    const injLeague: number = body?.league ?? 39;
    /* 2022 is the xG boundary build 179 measured and 2020 is as old as this history gets, so this
       spread finds a frontier if one exists instead of proving a single point. */
    const injSeasons: number[] = body?.seasons ?? [2024, 2022, 2020];

    /* THE LIVE SEASON IS READ, NOT ASSUMED. A hard-coded 2026 becomes a silently wrong control the
       moment the calendar rolls, and a wrong control is worse than no control: it would make every
       past zero look like proof of "no history" on the one run where the endpoint was simply dead. */
    const { data: newestRows } = await supa
      .from("fixtures").select("season,date")
      .eq("provider", "af").not("season", "is", null)
      .order("date", { ascending: false }).limit(1);
    const liveSeason: number | null = newestRows?.[0]?.season ?? null;

    /* Control first. A sweep truncated by the clock or by quota must still carry the one call that
       makes every other row readable. */
    const askSeasons: number[] = (liveSeason == null ? [] : [liveSeason])
      .concat(injSeasons.filter((s) => s !== liveSeason));

    const seasons: any[] = [];
    let sampleRecord: any = null;
    let injStoppedBy: string | null = null;

    for (const sn of askSeasons) {
      if (remaining <= 20) { injStoppedBy = "api quota"; break; }
      if (Date.now() - t0 > INJ_BUDGET_MS) { injStoppedBy = "time budget"; break; }

      /* A fixture this database already holds, so the id is one the collector would really key on
         and the date is a real past date rather than one the provider chose to offer. */
      const { data: fxRows } = await supa
        .from("fixtures").select("fxid,date,home,away")
        .eq("provider", "af").eq("lid", injLeague).eq("season", sn).eq("status", "FINISHED")
        .order("date", { ascending: false }).limit(1);
      const fx = fxRows?.[0] ?? null;

      let byFixture: any = null;
      if (fx?.fxid != null) {
        const fj = await afFetch(`/injuries?fixture=${fx.fxid}`, KEY);
        const fFailed = whyFailed(fj);
        const frows: any[] = fFailed ? [] : (fj?.response ?? []);
        byFixture = fFailed
          ? { failed: fFailed }                    // NOT evidence about this season — build 176
          : { players: frows.length, results: fj?.results ?? null };
        if (!sampleRecord && frows.length) sampleRecord = frows[0];
      }

      const lj = await afFetch(`/injuries?league=${injLeague}&season=${sn}`, KEY);
      const lFailed = whyFailed(lj);
      const lrows: any[] = lFailed ? [] : (lj?.response ?? []);
      const fixIds = new Set(lrows.map((x: any) => x?.fixture?.id).filter((v: any) => v != null));
      const dates = lrows.map((x: any) => x?.fixture?.date).filter(Boolean).sort();
      const bySeason = lFailed ? { failed: lFailed } : {
        rows: lrows.length,
        results: lj?.results ?? null,
        paging: lj?.paging ?? null,
        /* THE NUMBER THAT DECIDES THE COST. If one call carries hundreds of distinct fixture ids
           spanning that season's real dates, the whole backfill is roughly 11 leagues x N seasons
           of calls rather than one call per fixture across 22,009 of them. */
        distinctFixtures: fixIds.size,
        fixtureDateRange: dates.length ? [dates[0], dates[dates.length - 1]] : null,
      };
      if (!sampleRecord && lrows.length) sampleRecord = lrows[0];

      seasons.push({
        season: sn,
        isControl: sn === liveSeason,
        fixtureTried: fx?.fxid ?? null,
        fixtureDate: fx?.date ?? null,
        fixtureTeams: fx ? String(fx.home) + " v " + String(fx.away) : null,
        byFixture, bySeason,
      });

      /* Build 178 — stop rather than sleep through it. A throttled probe turns a short read into
         minutes of 20-second retries and gets the worker killed, and build 176 settled that a
         throttled call is not evidence about anything anyway. */
      if (byFixture?.failed === "rate limited" || lFailed === "rate limited") {
        injStoppedBy = "rate limited"; break;
      }
    }

    /* ── THE PRE-REGISTERED READING ────────────────────────────────────────────────── */
    const control = seasons.find((r: any) => r.isControl) ?? null;
    const past    = seasons.filter((r: any) => !r.isControl);
    const anyPastFixture = past.some((r: any) => (r.byFixture?.players ?? 0) > 0);
    const anyPastSeason  = past.some((r: any) => (r.bySeason?.rows ?? 0) > 0);
    const controlAlive   = ((control?.bySeason?.rows ?? 0) > 0)
                        || ((control?.byFixture?.players ?? 0) > 0);
    const anyFailure = seasons.some((r: any) => r.byFixture?.failed || r.bySeason?.failed);

    const verdict = anyPastFixture ? "historical-by-fixture"
                  : anyPastSeason  ? "historical-by-season"
                  : (controlAlive && !anyFailure && past.length > 0) ? "now-only"
                  : "undecided";

    const VERDICT_MEANS: Record<string, string> = {
      "historical-by-fixture":
        "/injuries answers for a fixture played seasons ago, so build 169's claim is FALSE and " +
        "items 20, 21 and 25 are buildable. Read distinctFixtures before choosing how to collect.",
      "historical-by-season":
        "History exists at league+season while the per-fixture call returned nothing. Read " +
        "sampleRecord before designing anything: whether a record names its own fixture is the " +
        "next question, and it is not answered by this run.",
      "now-only":
        "Confirmed: the endpoint knows who is hurt now and nothing about past fixtures. Items 20, " +
        "21 and 25 are UNREACHABLE and must be RECORDED as such, the way attendance, surface and " +
        "captain were, so nobody rediscovers them in six builds.",
      "undecided":
        "This run measured nothing. Either a call failed or the live-season control was empty too, " +
        "and an empty instrument is not a zero reading. Do not write this up as a finding.",
    };

    /* The columns build 158 created and nothing has ever written to. Reporting the response's own
       field names beside them is how the NEXT build maps this from a response rather than from a
       plan — which is the only reason this project ever discovered goals_prevented. */
    const INJ_TABLE_COLS = ["fxid", "lid", "team", "player_id", "player", "type", "reason",
                            "fixture_date"];

    return json({
      ok: true, injprobe: true, remaining,
      verdict,
      verdictMeans: VERDICT_MEANS[verdict],
      injStoppedBy,
      injTruncated: injStoppedBy != null,
      league: injLeague, leagueName: AF_LEAGUES[injLeague] ?? String(injLeague),
      liveSeasonFromDb: liveSeason,
      controlAlive, anyFailure,
      seasons,
      injuriesTableColumns: INJ_TABLE_COLS,
      sampleRecord,
      note: "Writes nothing. The `injuries` table was created at build 158 and has never been " +
            "written to; this run is what decides whether it ever should be.",
      ms: Date.now() - t0,
    }, 200);
  }

  /* ── STANDINGS VALIDATION PROBE (build 189) ───────────────────────────────────────
     {"stdprobe": true}                                        -> ONE league-season
     {"stdprobe": true, "leagues": [39,140], "seasons": [2024]} -> a deliberate sweep

     WRITES NOTHING. There is an assertion in the lock saying so, for the same reason build 181's
     injury probe carries one: a probe aimed at data the app derives is the most tempting place in
     this project to "just store it and see".

     ── WHAT THIS IS FOR, AND WHY IT IS A PROBE RATHER THAN A COLLECTOR ──
     Build 188 derives the league table from fixtures this database already holds, because
     /standings returns a SNAPSHOT — for a finished season, the final table — while items 48, 49
     and 50 are about the table as at the fixture being predicted. Deriving it costs nothing and
     works on all history.

     TWO THINGS DERIVATION CANNOT REPRODUCE, and this call is how they stop being unknowns:
       1. ADMINISTRATIVE POINT DEDUCTIONS. Everton and Juventus have both been docked points. A
          deduction is invisible in a fixture list, so the derived table is simply wrong for that
          team-season and nothing says so.
       2. PER-COMPETITION TIE-BREAK RULES. Some separate level sides on head-to-head rather than
          goal difference, so two tables can hold identical points and different positions.

     ── WHY THIS DOES NOT RANK, AND THAT IS THE WHOLE DESIGN ──
     Ranking here would put the ordering rule in a SECOND file that must change together with the
     app's — which is exactly the duplication build 172 rejected when it refused to copy VENUE into
     this collector, and exactly the drift that left travel and derby broken for thirteen builds.
     So this compares ARITHMETIC only — played, points, goals for, goals against — which needs no
     ordering at all, and it RETURNS the provider's rank order untouched so the comparison against
     build 188's ordering happens where that rule already lives.

     ── AND IT MATCHES ON TEAM ID, NOT ON TEAM NAME ──
     /standings gives `team.id`. This table stores names. Build 174 found the id sitting inside
     `home_logo` (…/teams/746.png) where it has been since build 158, so the join is on an integer
     the provider cannot re-spell. Name matching here would be build 171's venue vocabulary again,
     and fuzzy matching is banned outright.

     ── THE VERDICTS. THEIR MEANINGS ARE FIXED HERE, BEFORE THE RUN ──
       "match"            every team agrees on played, points, goals for and against. The derived
                          table is arithmetically sound for this league-season; anything left is a
                          tie-break rule, readable from `order`.
       "points-differ"    points disagree while played and goals agree. THIS IS A POINT DEDUCTION —
                          the finding this probe exists for.
       "fixtures-differ"  played or goals disagree, or a team is on one side only. That is not a
                          deduction, it is THIS DATABASE'S fixture set being incomplete for that
                          league-season, and it is the more serious of the two.
       "no-standings"     the endpoint returned nothing for this league-season.
       "failed:<reason>"  rate limited, HTTP error, API error or quota guard. NOT EVIDENCE ABOUT
                          ANYTHING — build 176's rule, where throttled calls were stamped as though
                          the fixtures were empty and briefly looked like proof about a season.

     `singleTable` is reported separately rather than folded into the verdict: a group stage is a
     real competition shape, its per-team arithmetic is still comparable, and only the ORDERING
     comparison stops applying. Conflating the two would hide a genuine deduction inside a
     "wrong shape" answer. */
  if (body?.stdprobe) {
    const STD_BUDGET_MS = 25_000;

    /* THE DEFAULT IS ONE CALL. Build 178 had to bound the season probe after 177 nearly doubled its
       call count and got a bodyless 500 back; a diagnostic that can quietly become a 66-call sweep
       is a diagnostic that stops being run. Widen it deliberately, never by accident. */
    const stdLeagues: number[] = body?.leagues ?? [Number(body?.league ?? 39)];

    /* THE SEASON IS DERIVED, NOT WRITTEN DOWN. A literal year rots the moment the calendar rolls
       and then probes a season this database does not hold, which returns an empty answer that
       looks exactly like a real one. One back from the newest is the newest season certainly over. */
    const { data: newestStdRows } = await supa
      .from("fixtures").select("season,date")
      .eq("provider", "af").not("season", "is", null)
      .order("date", { ascending: false }).limit(1);
    const stdLive: number | null = newestStdRows?.[0]?.season ?? null;
    const stdSeasons: number[] = body?.seasons ?? (stdLive == null ? [] : [stdLive - 1]);

    const stdTeamId = (u: any) => {
      const m = /\/teams\/(\d+)\./.exec(String(u ?? ""));
      return m ? Number(m[1]) : null;
    };

    const stdResults: any[] = [];
    let stdStoppedBy: string | null = null;
    let stdSample: any = null;

    outerStd:
    for (const lid of stdLeagues) {
      for (const sn of stdSeasons) {
        if (remaining <= 20) { stdStoppedBy = "api quota"; break outerStd; }
        if (Date.now() - t0 > STD_BUDGET_MS) { stdStoppedBy = "time budget"; break outerStd; }

        const sj = await afFetch(`/standings?league=${lid}&season=${sn}`, KEY);
        /* whyFailed(), not a second copy of it. Writing the same five-way test out again here is
           the duplication this file keeps paying for, and the lock caught it on the first run of
           this build: build 181's "every provider call is classified" counts whyFailed() against
           afFetch() and an inline equivalent does not satisfy it. Correctly — the point is one
           classifier, so a sixth failure mode is handled everywhere at once. */
        const failed = whyFailed(sj);
        if (failed) {
          stdResults.push({ league: lid, season: sn, verdict: "failed:" + failed });
          if (sj?._rateLimited) { stdStoppedBy = "rate limited"; break outerStd; }
          continue;
        }

        const groups = sj?.response?.[0]?.league?.standings ?? [];
        if (!Array.isArray(groups) || !groups.length || !groups[0]?.length) {
          stdResults.push({ league: lid, season: sn, verdict: "no-standings", groups: 0 });
          continue;
        }
        if (!stdSample) stdSample = groups[0][0];

        const prov: Record<number, any> = {};
        const order: any[] = [];
        for (const g of groups) {
          for (const r of (g ?? [])) {
            const id = r?.team?.id;
            if (id == null) continue;
            prov[id] = { played: r?.all?.played ?? null, pts: r?.points ?? null,
                         gf: r?.all?.goals?.for ?? null, ga: r?.all?.goals?.against ?? null };
            order.push({ rank: r?.rank ?? null, id, name: r?.team?.name ?? null,
                         pts: r?.points ?? null, gd: r?.goalsDiff ?? null });
          }
        }

        /* BUILD 197 — the probe now judges by the SAME rule the app derives by, or it is grading a
           different table and its verdict means nothing. The filter runs here in TypeScript rather
           than as a PostgREST `or(like...)` so that it is the identical whole-token comparison the
           app does, character for character. A regression check asserts the two vocabularies match;
           that is how AF_LEAGUES and COMP_IDS are kept in step, and it is the only thing standing
           between one list in two files and the drift that broke travel and derby for 13 builds. */
        const { data: stdFx } = await supa
          .from("fixtures").select("home_logo,away_logo,gh,ga,round")
          .eq("provider", "af").eq("lid", lid).eq("season", sn).eq("status", "FINISHED")
          .limit(2000);
        const stdRoundKind = (r: any) => {
          if (r == null) return null;
          const s = String(r), i = s.indexOf(" - ");
          return i >= 0 ? s.slice(0, i) : s;
        };
        const stdLeaguePhase = (r: any) => {
          const k = stdRoundKind(r);
          return k != null && LEAGUE_PHASE_ROUNDS.indexOf(k) >= 0;
        };

        /* Three points for a win, one for a draw. That is arithmetic, not the ordering rule the
           app owns, and it is the only part duplicated here. */
        const der: Record<number, any> = {};
        const stdBump = (id: number | null, gf: any, ga: any) => {
          if (id == null || gf == null || ga == null) return;
          const r = der[id] || (der[id] = { played: 0, pts: 0, gf: 0, ga: 0 });
          r.played++; r.gf += gf; r.ga += ga;
          r.pts += gf > ga ? 3 : gf === ga ? 1 : 0;
        };
        let stdSkipped = 0;
        for (const f of (stdFx ?? [])) {
          if (!stdLeaguePhase(f.round)) { stdSkipped++; continue; }
          stdBump(stdTeamId(f.home_logo), f.gh, f.ga);
          stdBump(stdTeamId(f.away_logo), f.ga, f.gh);
        }

        const diffs: any[] = [];
        for (const k of Object.keys(prov)) {
          const id = Number(k), p = prov[id], d = der[id];
          if (!d) { diffs.push({ id, field: "missing", provider: p.played, derived: null }); continue; }
          for (const fld of ["played", "pts", "gf", "ga"]) {
            if (p[fld] != null && p[fld] !== d[fld]) {
              diffs.push({ id, field: fld, provider: p[fld], derived: d[fld] });
            }
          }
        }
        const onlyDerived = Object.keys(der).map(Number).filter((id) => !(id in prov));

        const fields = new Set(diffs.map((x) => x.field));
        const structural = fields.has("played") || fields.has("gf") || fields.has("ga")
                        || fields.has("missing") || onlyDerived.length > 0;
        const verdict = (diffs.length === 0 && !onlyDerived.length) ? "match"
                      : structural ? "fixtures-differ"
                      : "points-differ";

        stdResults.push({
          league: lid, name: AF_LEAGUES[lid] ?? String(lid), season: sn,
          verdict,
          singleTable: groups.length === 1,
          groups: groups.length,
          providerTeams: Object.keys(prov).length,
          derivedTeams: Object.keys(der).length,
          fixturesRead: stdFx?.length ?? 0,
          nonLeaguePhaseSkipped: stdSkipped,
          diffCount: diffs.length,
          diffs: diffs.slice(0, 40),
          onlyDerived,
          order,
        });
      }
    }

    return json({
      ok: true, stdprobe: true, remaining, stdStoppedBy,
      stdTruncated: stdStoppedBy != null,
      leaguesAsked: stdLeagues, seasonsAsked: stdSeasons, liveSeason: stdLive,
      results: stdResults,
      sampleRow: stdSample,
      wrote: "nothing",
      note: "Arithmetic only — played, points, goals. Ranking is deliberately NOT done here: the " +
            "ordering rule lives in the app and a second copy in this file is the drift that broke " +
            "travel and derby for thirteen builds. `order` carries the provider's ranking as-is so " +
            "the comparison happens where that rule already is. Teams are joined on the numeric id " +
            "inside home_logo, never on a name.",
      ms: Date.now() - t0,
    }, 200);
  }

  /* ── PASSFILL ─────────────────────────────────────────────────────────────────────
     THE ROWS THAT CARRY STATISTICS BUT NO PASS VOLUME. `af-19` (build 187) added `passes_h`/
     `passes_a`, and the detail pass selects `poss_h is null` — it never revisits a filled row. So
     every fixture detailed BEFORE af-19 went live on 2026-08-19 is permanently short of pass volume
     and nothing in the ordinary run will ever come back for it.

     🚨 MEASURED 2026-08-25, AND THE DISTRIBUTION IS THE WHOLE REASON THIS EXISTS: **all 2,273 of
     them are in the M14 HOLDOUT.** 46.0% of filled holdout rows carry passes, against 100% of
     training and 100% of validation (validation has exactly one gap, training none). That is the
     season-descending fill order crossed with af-19's go-live date — the earliest-filled rows are
     the newest fixtures, and the newest fixtures are the holdout. The set cannot grow.

     WHY THAT MATTERS MORE THAN A MISSING COLUMN NORMALLY WOULD. Nothing reads pass volume today, so
     no fit is affected. But build 204's rule is that a variable with no missing values in TRAINING
     gets no missingness indicator at all — so the day someone builds the pass feature, it arrives
     ~100% covered in training and ~46% in the holdout, and half the holdout is silently imputed to
     the training mean with nothing flagging it, on a slice correlated with date. Pool-wide coverage
     would read ~85% and look healthy throughout. **This backfill is the precondition for that
     feature ever being built honestly, and it is not tidy-up.**

     ⚠ RUN IT AFTER THE M14 POOL COMPLETES (2026-08-29 ~11:40 UTC), NEVER BEFORE. It spends the same
     API budget as the detail pass, and the detail pass is what gates Milestone 14. This mode is
     explicitly invoked and is NOT on the cron path, so deploying it costs nothing until it is called.

     THE DEADLOCK THIS IS BUILT NOT TO REPEAT — builds 175-179. A row that can never be filled sits
     at the head of the queue and is re-selected every run, forever, while the pass reports itself
     healthy. Here the risk is a fixture whose statistics genuinely carry no "Total passes" type.
     Two guards, because one is not enough:
       - filled rows LEAVE the selection on their own, so the common case needs no cursor at all;
       - `{"after": <fxid>}` steps past a stuck head, and the reply always returns `nextAfter` and
         the fxids that answered without pass volume, so a stall is visible in the response rather
         than being something you have to infer from a count that will not move.
     Ordering is by `fxid` ascending precisely so that cursor means something. The set is entirely
     2025-26, which certainly carries the type, so the guards should never fire — recorded that way
     so that if they DO fire, that is a finding rather than a mystery.

     A FAILED CALL IS NOT AN EMPTY FIXTURE. Build 176's rule, applied here from the start rather than
     after the damage: `afFetch` returns `{response: []}` for every failure it has, so only a call
     that genuinely succeeded is evidence about the fixture, and repeated failures stop the pass. */
  if (body?.passfill) {
    const PF_BUDGET = Math.min(Number(body?.budget ?? 60), 200);
    const PF_TIME_MS = 40_000;
    const PF_EMPTY_STOP = 10;
    const pfAfter = Number(body?.after ?? 0);
    /* 🚨 BUILD af-25 — A QUOTA FLOOR, BECAUSE THIS IS THE ONE MODE THAT CAN STARVE THE ODDS PASS.
       Every other pass is bounded per RUN and spreads its spend across 144 cron cycles. passfill
       is invoked by hand and walks 3,461 rows, so a determined session can drive the daily
       allowance toward zero — and `afFetch` only hard-stops at 2, by which point the next cron
       run’s odds pass (which stops at 5) has nothing left. Statistics can be re-fetched forever;
       A PRICE CANNOT. Milestone 12 lost ~51 closing prices to a 54-hour outage and they are gone
       permanently. So this pass stops while there is still a comfortable odds budget: 500 leaves
       about twenty full cron cycles at ODDS_BUDGET 25. Overridable, deliberately not removable. */
    const PF_QUOTA_FLOOR = Math.max(Number(body?.quotaFloor ?? 500), 50);

    const pfWhere = (q: any) => q
      .eq("provider", "af").eq("status", "FINISHED")
      .not("poss_h", "is", null).is("passes_h", null);

    // what is left, asked BEFORE anything is spent, so the reply can say whether it is finished
    const { count: pfRemaining } = await pfWhere(
      supa.from("fixtures").select("fxid", { count: "exact", head: true }));

    const { data: pfCand, error: pfErr } = await pfWhere(
      supa.from("fixtures").select("fxid,season,date"))
      .gt("fxid", pfAfter)
      .order("fxid", { ascending: true })
      .limit(PF_BUDGET * 2);
    if (pfErr) return json({ ok: false, mode: "passfill", step: "select", error: pfErr.message }, 500);

    let pfFilled = 0, pfNone = 0, pfFails = 0, pfRun = 0, pfLast = pfAfter;
    let pfStoppedBy: string | null = null, pfLastFail: string | null = null;
    const pfNoneIds: number[] = [];
    const tPf = Date.now();

    for (const r of pfCand ?? []) {
      if (pfFilled + pfNone >= PF_BUDGET) { pfStoppedBy = "passfill budget"; break; }
      if (Date.now() - tPf > PF_TIME_MS) { pfStoppedBy = "time budget"; break; }
      if (remaining <= PF_QUOTA_FLOOR) { pfStoppedBy = "api quota floor — odds pass protected"; break; }

      const sj = await afFetch(`/fixtures/statistics?fixture=${r.fxid}`, KEY);
      const pfFailed = sj?._rateLimited ? "rate limited"
                     : sj?._apiErrors   ? "api errors: " + JSON.stringify(sj._apiErrors)
                     : sj?._http != null ? "http " + sj._http
                     : sj?._skipped     ? "quota guard"
                     : null;
      if (pfFailed) {
        pfFails++; pfLastFail = pfFailed;
        if (pfFails >= 3) { pfStoppedBy = "fetch failures: " + pfFailed; break; }
        continue;                                  // NOT counted as evidence about this fixture
      }
      pfLast = r.fxid;

      const st = sj?.response;
      const pfH = statPair(st, st?.[0]?.team?.id, "Total passes");
      const pfA = statPair(st, st?.[1]?.team?.id, "Total passes");
      if (pfH == null && pfA == null) {
        pfNone++; pfRun++; pfNoneIds.push(r.fxid);
        if (pfRun >= PF_EMPTY_STOP) {
          pfStoppedBy = `no pass volume in ${PF_EMPTY_STOP} consecutive fixtures — pass {"after": ${r.fxid}} to step past them`;
          break;
        }
        continue;
      }
      pfRun = 0;

      const { error: pfUpErr } = await supa.from("fixtures")
        .update({ passes_h: pfH, passes_a: pfA }).eq("fxid", r.fxid);
      /* THE WRITE IS CHECKED. Build 202: supabase-js does not throw on a policy denial, it RETURNS
         `{error}` — an unread result is how the prediction archive sat dead for eight days. */
      if (pfUpErr) { pfStoppedBy = "write failed: " + pfUpErr.message; break; }
      pfFilled++;
    }

    return json({
      ok: true, mode: "passfill", fn: FN_VERSION,
      remainingBefore: pfRemaining ?? null,
      /* REPORTED, because a pass that can starve the odds collector must say what it left
         behind. Build 165’s lesson was a field nobody read; this one was not there to read. */
      quotaRemaining: remaining === Infinity ? null : remaining,
      quotaFloor: PF_QUOTA_FLOOR,
      filled: pfFilled, noPassVolume: pfNone, noPassVolumeIds: pfNoneIds.slice(0, 20),
      fetchFailures: pfFails, lastFetchFail: pfLastFail,
      stoppedBy: pfStoppedBy, after: pfAfter, nextAfter: pfLast,
      note: "run again until remainingBefore reaches 0; filled rows leave the selection on their own",
      ms: Date.now() - t0,
    });
  }

  /* ── HISTORY BACKFILL ─────────────────────────────────────────────────────────────
     {"history": true}                 -> backfill the CURRENT season, every league
     {"history": true, "season": 2024} -> backfill THAT season instead
     Mirrors refresh-scores.ts's own history mode: one season per call, no date window (a season
     fetch ignores WINDOW_PAST/WINDOW_AHEAD and asks for the whole season), base rows only. Ten
     leagues = ten requests — cheap and safe in a single invocation.

     Detail (statistics/lineups/events) is deliberately NOT done here — a full season is ~380
     fixtures per league, and clearing that against a 15-fixture budget is ~26 calls, not this
     call's job. The detail loop just below now scans the WHOLE 'af' table for anything finished
     and missing statistics, oldest first, not just what this particular run fetched — so history
     rows get their detail filled in automatically by the ordinary 10-minute cron over the
     following hours, the same way the rolling window already does. Call this once per season
     (six calls total for 2020-2025) and then leave it alone; do not call it repeatedly. */
  /* ══ af-32 — THIS MODE BLEW THE WORKER THE FIRST TIME IT WAS ASKED FOR 35 LEAGUES ═════════════
     🚨 MEASURED 2026-09-03: `{"history":true,"season":2025}` returned
     **HTTP 546 `WORKER_RESOURCE_LIMIT` after 65 seconds** — the platform killed it. The comment
     above still says "Ten leagues = ten requests — cheap and safe in a single invocation", and that
     was true when it was written. **At 35 leagues it is false**, and the failure mode is the one
     build 172 already paid for: an Edge Function killed mid-flight reports whatever the platform
     feels like, so a resource limit arrives looking like a code error.

     TWO CHANGES, AND THE FIRST IS THE ONE THAT MATTERS:
       · `leagues: [ids]` — back-fill a NAMED subset. Asking for seven cups should not re-fetch
         twenty-eight competitions that already have their history.
       · a wall clock and a row cap, so the mode STOPS and reports where it got to rather than
         being killed. `stoppedBy` tells the caller to run it again for the rest, exactly the way
         the detail pass is resumable.

     ⚠ THE COMMENT ABOVE IS NOW WRONG ABOUT "TEN LEAGUES" AND IS LEFT IN PLACE DELIBERATELY, because
     it records what was true when the mode was written. This block is the correction. */
  if (body?.history) {
    const wantSeason = Number(body?.season ?? today.getFullYear());
    const HIST_TIME_MS = 40_000;      // well inside the ~65 s the platform actually allowed
    const HIST_MAX_ROWS = 6000;       // memory, not time — the killed run held ~15,000
    const tHist = Date.now();
    const histRows: any[] = [];
    const histIssues: any[] = [];
    let histStoppedBy: string | null = null;
    const histWant = Array.isArray(body?.leagues) && body.leagues.length
      ? body.leagues.map(Number).filter((n: number) => AF_ALL[n] != null)
      : Object.keys(AF_LEAGUES).map(Number);
    const histDone: number[] = [];
    for (const lid of histWant) {
      if (Date.now() - tHist > HIST_TIME_MS) { histStoppedBy = "time budget"; break; }
      if (histRows.length >= HIST_MAX_ROWS) { histStoppedBy = "row cap"; break; }
      histDone.push(lid);
      const j = await afFetch(`/fixtures?league=${lid}&season=${wantSeason}`, KEY);
      if (j?._apiErrors || j?._http) { histIssues.push({ lid, err: j._apiErrors ?? j._http }); continue; }
      for (const f of (j?.response ?? [])) {
        const m = mapFixture(f, AF_ALL[lid]);
        if (m.fxid && m.home && m.away && m.date) histRows.push(m);
      }
    }
    if (histRows.length) {
      const up = await supa.from("fixtures").upsert(histRows, { onConflict: "fxid" });
      if (up?.error) return json({
        ok: false, step: "history-upsert", error: up.error.message,
        details: up.error.details ?? null, hint: up.error.hint ?? null,
      }, 500);
    }
    return json({
      ok: true, history: true, season: wantSeason,
      /* af-32 — what was ASKED FOR, what was REACHED, and why it stopped. The old field said how
         many leagues exist, which tells the caller nothing about whether the job finished. */
      leaguesRequested: histWant.length, leaguesDone: histDone.length,
      leaguesRemaining: histWant.filter((x: number) => !histDone.includes(x)),
      histStoppedBy, fixturesWritten: histRows.length,
      quotaRemaining: remaining === Infinity ? null : remaining,
      issues: histIssues,
      note: "Base rows only. Statistics/lineups/events fill in automatically over the next " +
            "cron runs — calling this again right away will not make detail appear any sooner.",
      ms: Date.now() - t0,
    }, 200);
  }

  /* ── NORMAL RUN ────────────────────────────────────────────────────────────────────
     Step 1: the fixture window for every league. Step 2: per-fixture detail, within budget. */
  const from = ymd(new Date(today.getTime() - WINDOW_PAST * 86400000));
  const to   = ymd(new Date(today.getTime() + WINDOW_AHEAD * 86400000));
  const season = body?.season ?? today.getFullYear();

  /* ══ af-29 — THE SEASON IS PER COMPETITION, AND THE PROVIDER IS ASKED RATHER THAN GUESSED ══════
   🚨 ONE GLOBAL `today.getFullYear()` WAS ALREADY WRONG FOR THREE COMPETITIONS WE WANT:

       Japan J1 League      current season 2027   (2026-08-07 -> 2027-06-06)
       Spain Copa del Rey   current season 2025
       France Coupe de France current season 2025

   Japan was kept out of wave 1 for exactly this. The failure is SILENT: the wrong season returns an
   empty fixture list, the league loads with no matches, and build 215 only reports an empty result
   for a competition that had something last time — so a new one is simply absent.

   ⚠ AND A FIXED PER-LEAGUE OFFSET WOULD BE WRONG TOO, which is why this asks instead of computing.
   J1 moved to an autumn-spring calendar, so its season is calendar+1 from August to December and
   calendar+0 from January to June. The roadmap's rule is already written: European seasons straddle
   two calendar years and Brazil's do not, and NO DATE RULE WILL EVER COVER THEM. The provider marks
   exactly one season `current` per competition; that is the only source that stays right.

   ONE CALL PER RUN, ~144/day against ~5,860/day of headroom, and it covers every competition at once
   however many are added. It cannot make things worse: if the call fails the map is empty and every
   league falls back to the global year, which is today's behaviour. */
  const seasonMap: Record<number, number> = {};
  {
    const lj = await afFetch(`/leagues?current=true`, KEY);
    for (const r of (lj?.response ?? [])) {
      const lid = r?.league?.id;
      const cur = (r?.seasons ?? []).find((s: any) => s?.current);
      if (lid != null && cur?.year != null) seasonMap[Number(lid)] = Number(cur.year);
    }
  }
  const seasonFor = (lid: number) => seasonMap[lid] ?? season;
  /* Reported so a competition quietly running on the fallback is visible rather than inferred —
     build 129's `met` is the lesson: a value computed and never surfaced is not an instrument. */
  const seasonOverrides = Object.keys(AF_LEAGUES)
    .map(Number)
    .filter((lid) => seasonMap[lid] != null && seasonMap[lid] !== season)
    .map((lid) => `${lid}:${seasonMap[lid]}`);
  const seasonUnknown = Object.keys(AF_LEAGUES)
    .map(Number)
    .filter((lid) => seasonMap[lid] == null);

  const rows: any[] = [];
  const issues: any[] = [];
  /* af-26 — how the tiered base pass actually split this run. Reported rather than inferred:
     `baseSkipped` sitting at zero run after run means the tiering is not doing anything, and
     `baseHot` equal to the league count means every competition is being treated as hot. */
  let baseHot = 0, baseSkipped = 0;
  /* Build 195 — carried to the response instead of aborting the run. See the upsert below. */
  let upsertError: any = null;

  /* BUILD 166 — THESE ELEVEN FETCHES WERE SEQUENTIAL, AND IT COST 20.4 SECONDS OF A 45-SECOND RUN.
     Measured, not guessed: {"dry": true} returned `ms: 20446` for eleven league fetches and nothing
     else. §6 recorded the same 20.5 seconds once before and it was read as the cost of doing
     business rather than as a thing to fix.

     TWO CONSEQUENCES, AND I HAD THE SECOND ONE BACKWARDS.

     1. It is most of the wall clock. `{"noodds": true}` — which skips odds and therefore hands the
        WHOLE remaining budget to the detail pass, three API calls per fixture — is the heaviest
        mode this function has, and it returned a bare 500 whose message this file already documents:
        "an Edge Function killed mid-flight reports whatever the platform feels like, which is how a
        resource limit arrived looking like a code error and cost three rounds." A 20-second head
        start on the heaviest mode is how you reach that limit.

     2. **It silently starved the odds pass — the exact opposite of what build 162 claimed.** That
        build put odds before statistics and asserted the ordering, on the grounds that odds expire
        and statistics do not. But ODDS_TIME_MS was measured from `t0`, the start of the RUN, and
        this loop had already spent 20 of those 25 seconds before the odds pass began. Odds were
        getting five seconds, not twenty-five. The visible symptom was there to be read and was not:
        1.7 snapshots per fixture and 23-minute gaps between captures.

        The ordering assertion passed the whole time, because odds genuinely did run before the
        detail pass. **What ran before both of them was not in the comparison.**

     The requests are independent, so they go in parallel. Eleven at once is well inside the paid
     plan's per-minute allowance, and afFetch still retries anything the provider throttles. */
  {
    /* ══ af-26 — THE BASE PASS IS TIERED, BECAUSE IT IS THE ONLY THING THAT SCALES WITH LEAGUES ══
       Every other pass here is capped per RUN (odds 25, detail 15). This one costs ONE CALL PER
       COMPETITION PER RUN — 144 a day each — so it is the entire marginal cost of Ken's expansion:
       11 competitions is 1,584 calls/day and ~50 is 7,200.

       AND MOST OF IT BUYS NOTHING. Measured 2026-09-02: on a quiet day only 2 of 11 competitions
       have a fixture at all (09-02 had 2, 09-04 had 7, 09-05 had 9). Refreshing a league with no
       match within a day and a half, every ten minutes, re-reads a fixture list that cannot have
       changed in any way that matters.

       HOT every run · COLD on a rotating hourly slot. A competition is HOT if it has a fixture
       between six hours ago and thirty-six hours ahead — wide enough to cover live status updates
       behind it and tomorrow's schedule ahead of it.

       🚨 A COMPETITION WITH NO ROWS AT ALL IS HOT, and that clause is the one that matters when
       leagues are added. A newly-added league has no fixtures in the database, so "has a fixture
       soon" is false for it — it would sit on the cold rota and take up to an hour to appear, and
       whoever added it would be watching an empty competition wondering what broke. This is the
       `attendance` rule in a different costume: absence of data is not evidence of absence.

       THE ROTA IS STATELESS AND SO NEEDS NO SQL. Keying it on `lid % slots` against the ten-minute
       tick spreads the cold leagues evenly across the hour with no table, no column and no
       migration — which matters because row 23's rule would otherwise put SQL in front of this
       deploy. It is also deterministic: the same league refreshes in the same slot every hour,
       rather than a random subset that could starve one league for a day by chance. */
    const allLids = Object.keys(AF_LEAGUES).map(Number);
    const hotFrom = new Date(today.getTime() - 6 * 3600000).toISOString().slice(0, 10);
    const hotTo   = new Date(today.getTime() + 36 * 3600000).toISOString().slice(0, 10);
    const hot = new Set<number>();
    const seen = new Set<number>();
    {
      const { data: hotRows } = await supa.from("fixtures")
        .select("lid").eq("provider", "af").gte("date", hotFrom).lte("date", hotTo).limit(5000);
      for (const r of (hotRows ?? [])) hot.add(Number(r.lid));
      /* Which leagues this database has ever heard of. Anything absent is brand new and must not
         wait for a rota slot. */
      const { data: anyRows } = await supa.from("fixtures")
        .select("lid").eq("provider", "af").limit(50000);
      for (const r of (anyRows ?? [])) seen.add(Number(r.lid));
    }
    const slots = Math.max(1, Math.round(BASE_COLD_EVERY_MIN / 10));   // ten-minute cron
    const tick = Math.floor(Date.now() / (10 * 60000));
    const lids = allLids.filter((lid) =>
      hot.has(lid) || !seen.has(lid) || (tick % slots) === (lid % slots));
    baseHot = lids.length; baseSkipped = allLids.length - lids.length;
    const settled = await Promise.all(lids.map((lid) =>
      afFetch(`/fixtures?league=${lid}&season=${seasonFor(lid)}&from=${from}&to=${to}`, KEY)
        .then((j) => ({ lid, j }))));
    for (const { lid, j } of settled) {
      if (j?._apiErrors || j?._http) { issues.push({ lid, err: j._apiErrors ?? j._http }); continue; }
      for (const f of (j?.response ?? [])) {
        const m = mapFixture(f, AF_LEAGUES[lid]);
        if (m.fxid && m.home && m.away && m.date) rows.push(m);
      }
    }
  }
  /* af-45 - THE DATE PASS for EXTRA_LEAGUES (see the list). Today and tomorrow every run; one
     other date of the window per run, rotating, so each is re-read about every 2 hours. */
  let datePass: any = { dates: [], kept: 0 };
  if (!body?.nodatepass) {
    const off: number[] = [];
    for (let d = -WINDOW_PAST; d <= WINDOW_AHEAD; d++) if (d !== 0 && d !== 1) off.push(d);
    const tickD = Math.floor(Date.now() / (10 * 60000));
    const want = [0, 1, off[tickD % off.length]];
    const dates = want.map((d) => ymd(new Date(today.getTime() + d * 86400000)));
    datePass.dates = dates;
    const got = await Promise.all(dates.map((d) => afFetch(`/fixtures?date=${d}`, KEY).then((j) => ({ d, j }))));
    for (const { d, j } of got) {
      if (j?._apiErrors || j?._http) { issues.push({ date: d, err: j._apiErrors ?? j._http }); continue; }
      for (const f of (j?.response ?? [])) {
        const lid = Number(f?.league?.id);
        if (EXTRA_LEAGUES[lid] == null) continue;
        const m = mapFixture(f, EXTRA_LEAGUES[lid]);
        if (m.fxid && m.home && m.away && m.date) { rows.push(m); datePass.kept++; }
      }
    }
  }
  const tFetch = Date.now() - t0;

  /* {"one": true} — the smallest possible write. One league, one row, and the client's ENTIRE
     result object returned without destructuring anything. If the upsert is what breaks, this
     says so with the real Postgres message. If this succeeds, the write path is fine and the
     fault is further along (the detail loop). */
  if (body?.one) {
    const j1 = await afFetch(`/fixtures?league=39&season=2025&status=FT&last=1`, KEY);
    const f1 = j1?.response?.[0];
    if (!f1) return json({ ok: false, step: "one-fetch", raw: j1 }, 200);
    const row = mapFixture(f1, "Premier League");
    const res: any = await supa.from("fixtures").upsert([row], { onConflict: "fxid" });
    return json({
      ok: !res?.error, step: "one-upsert",
      resultWasUndefined: res === undefined || res === null,
      status: res?.status ?? null, statusText: res?.statusText ?? null,
      error: res?.error ? { message: res.error.message, details: res.error.details,
                            hint: res.error.hint, code: res.error.code } : null,
      rowKeys: Object.keys(row),
    }, 200);
  }

  if (body?.dry) {
    return json({
      ok: true, dry: true, wroteNothing: true,
      fixtures: rows.length, leagues: Object.keys(AF_LEAGUES).length,
      quotaRemaining: remaining === Infinity ? null : remaining,
      issues,
      sampleRow: rows[0] ?? null,
      columnsThisWouldWrite: rows[0] ? Object.keys(rows[0]) : [],
      ms: Date.now() - t0,
    }, 200);
  }

  if (rows.length) {
    /* Defensive: destructuring { error } from an undefined result is exactly what produced the
       original unreadable 500. If the client ever returns nothing, say so plainly. */
    /* ══ BUILD 195 — THIS NO LONGER ABORTS THE RUN, AND A 54-HOUR OUTAGE IS WHY ══════════════════
       On 2026-08-20 17:50 UTC `af-21` went live carrying a new `round` column one deploy ahead of
       the SQL that creates it. Every base upsert then failed with "column round does not exist",
       this line returned 500, and the function died **before reaching the odds pass** — on every
       cron tick for 54 hours. `cron.job_run_details` reported `succeeded` throughout, because
       net.http_post returns an id the instant it is queued, so nothing anywhere said a word.

       THE STATISTICS LOST TO THAT WINDOW COST NOTHING — they re-fetch forever. **About 51 fixtures'
       CLOSING PRICES ARE GONE PERMANENTLY**, and they died for a schema mismatch that had nothing
       whatever to do with odds. That is the whole argument: the odds pass is the only irreversible
       thing this collector does, and it was sitting behind a fatal error belonging to another pass.

       So a failed base upsert is now RECORDED AND CARRIED, not thrown. Every later pass reads
       fixtures from the database rather than from `rows`, so they work perfectly well on the rows
       already stored — a schema mismatch on new base rows has no bearing on pricing a fixture that
       is already there. The error travels to the top of the response as `upsertError` and into
       `WARNING`, where it is impossible to miss.

       `ok` STAYS TRUE ON PURPOSE. It means "the run completed and did what it could", which is now
       the truth; `upsertError` is what says something is wrong. Returning ok:false would be the
       honest-looking choice and the wrong one — it invites the next reader to make it fatal again. */
    const up = await supa.from("fixtures").upsert(rows, { onConflict: "fxid" });
    if (!up) {
      upsertError = { error: "supabase client returned nothing", details: null, hint: null,
                      columnsAttempted: Object.keys(rows[0] ?? {}) };
    } else if (up.error) {
      upsertError = {
        error: up.error.message,
        details: up.error.details ?? null,
        hint: up.error.hint ?? null,
        note: "A column named here that you do not recognise means its SQL has not been run yet. " +
              "The run CONTINUED so that odds — the only thing here that cannot be backfilled — " +
              "were still collected. Fix the column and this clears itself on the next tick.",
        columnsAttempted: Object.keys(rows[0] ?? {}),
      };
    }
  }

  /* {"nodetail": true} — full fetch, full upsert of every row, and STOP. If this succeeds, the
     detail loop is the only remaining suspect and we have separated the two in one invocation. */
  if (body?.nodetail) {
    return json({ ok: true, step: "nodetail", fixtures: rows.length,
                  quotaRemaining: remaining === Infinity ? null : remaining,
                  issues, ms: Date.now() - t0 }, 200);
  }

  /* ══ af-44 (WO-49) — THE WINDOW IS A DATE RANGE, SO A MATCH THE PROVIDER MOVES DISAPPEARS ══════
     MEASURED 2026-10-10 (`MatchMind-WO49-STUCK-FIXTURES-FINDING.md`): **27 fixtures in the app's
     competitions were frozen as "not started" after their date, and all 27 had been MOVED by the
     provider**, 21 to 80 days later. None was played-and-missed, none cancelled, none still dated
     where we had it. A further 23 rows read POSTPONED at an old date while the provider already
     holds a new one.

     THE CAUSE IS THIS FILE AND NOTHING ELSE. The only per-league read is
     `/fixtures?league&season&from&to` with `WINDOW_PAST` 10 and `WINDOW_AHEAD` 7, so the answer
     lists only matches the provider dates INSIDE that window. The moment it moves a match out of
     it, the match is in no answer, nothing writes its row, and `updated_at` freezes with the old
     date and `NS`. Every other pass reads FINISHED rows or rows from today forward, and **nothing
     anywhere read a match by its id** — statistics, lineups, events, odds and injuries are all
     fetched by fixture id, the fixture itself never was. A row healed only when its new date drifted
     back inside "today + 7", which for the League One case is 80 days of showing a wrong date.

     WHAT THIS STEP DOES. After the date window, it asks the provider about the stuck rows BY ID:
     20 ids a call (the provider's own maximum), at most 5 calls, so at most 100 ids a run. A moved
     match takes the provider's new date, time and status through `mapFixture` and the same upsert
     every other row uses — there is no second write path and no special case. A match the provider
     now reports as played arrives as FINISHED and the existing detail and grading passes take it
     from there.

     ⚠ ONCE EVERY SIX HOURS, AND THE GATE IS A CLOCK SLOT RATHER THAN A STAMP. The cron ticks every
     ten minutes; left ungated this would cost 720 calls a day instead of 20. WO-49 asks for a
     stamp, and **this collector has nowhere to keep one**: it writes `fixtures` and
     `odds_snapshots` and nothing else, `app_state` is per-user with RLS, and a state table is new
     SQL that WO-49 does not grant. So the gate is the run's own UTC clock — the first tick of each
     six-hour block, 00/06/12/18 — which needs no storage, cannot drift, and cannot run away: it is
     four runs a day whatever happens. The cost is that a tick missed at exactly 00:0x waits for
     06:0x. **Reported in every reply (`byIdSkipped`) so the slot is never a silent no-op.**

     COST: 4 runs x 5 calls = **20 calls a day** against the Ultra plan's 75,000 (0.03%), and it
     stops dead above the existing `DETAIL_QUOTA_FLOOR` so it can never starve the odds pass — the
     one pass here whose data cannot be backfilled.

     🚨 IT CANNOT TAKE THE RUN DOWN. Everything below is inside one try/catch that records the error
     and carries on, which is build 195's rule: a fault in one pass must never reach another. */
  const BYID_CHUNK = 20;            // the provider's own maximum ids per /fixtures?ids= call
  const BYID_MAX_CALLS = 5;         // 100 ids a run — 83 were due on 2026-10-10
  const BYID_EVERY_H = 6;           // one slot every 6 hours: 00/06/12/18 UTC
  const BYID_STALE_H = 6;           // "more than 6 hours past kick-off and not finished"
  let byIdAsked = 0, byIdRedated = 0, byIdNowFinished = 0, byIdCalls = 0, byIdDue = 0;
  let byIdSkipped: string | null = null, byIdError: string | null = null;
  if (!body?.nobyid) {
    try {
      if (today.getUTCHours() % BYID_EVERY_H !== 0 || today.getUTCMinutes() >= 10) {
        byIdSkipped = "not this slot — the by-id re-read runs at 00/06/12/18 UTC";
      } else if (remaining <= DETAIL_QUOTA_FLOOR) {
        byIdSkipped = "api quota floor — odds pass protected";
      } else {
        /* NEWEST KICK-OFF FIRST, as WO-49 specifies: the most recently stuck match is the one a
           reader is most likely to be looking at. The limit is headroom; the 5-call cap decides
           the real stop, exactly as the detail pass does it. */
        const { data: stuckRows, error: stuckErr } = await supa.from("fixtures")
          .select("fxid,date,time,status")
          .eq("provider", "af")
          .in("lid", Object.keys(AF_ALL).map(Number))
          .not("status", "in", "(FINISHED,CANCELLED,AWARDED)")
          .lte("date", ymd(today))
          .order("date", { ascending: false })
          .limit(BYID_CHUNK * BYID_MAX_CALLS * 4);
        if (stuckErr) throw stuckErr;
        /* The 6-hour test is done HERE and not in the query, because kick-off is two columns
           (`date` + `time`) and PostgREST cannot add six hours to that pair. `kickoffMs` is this
           file's own parser, so a row with a full timestamp in `time` is read the same way the
           rest of the collector reads it. */
        const cutoff = today.getTime() - BYID_STALE_H * 3600000;
        const before = new Map<number, any>();
        const due: number[] = [];
        for (const r of (stuckRows ?? [])) {
          const ko = kickoffUTC(r.date, r.time);
          const k = ko ? ko.getTime() : null;
          const pastDate = String(r.date ?? "") < ymd(today);
          const stale = (k != null && k < cutoff) || (r.status === "POSTPONED" && pastDate);
          if (!stale || r.fxid == null) continue;
          before.set(Number(r.fxid), r);
          due.push(Number(r.fxid));
        }
        byIdDue = due.length;
        const ask = due.slice(0, BYID_CHUNK * BYID_MAX_CALLS);
        for (let i = 0; i < ask.length; i += BYID_CHUNK) {
          if (byIdCalls >= BYID_MAX_CALLS) break;
          if (remaining <= DETAIL_QUOTA_FLOOR) { byIdSkipped = "api quota floor — odds pass protected"; break; }
          const part = ask.slice(i, i + BYID_CHUNK);
          const j = await afFetch(`/fixtures?ids=${part.join("-")}`, KEY);
          byIdCalls++;
          if (j?._apiErrors || j?._http || j?._skipped || j?._rateLimited) {
            issues.push({ byId: part.length, err: j._apiErrors ?? j._http ?? j._skipped ?? "rate limited" });
            continue;
          }
          const back: any[] = [];
          for (const f of (j?.response ?? [])) {
            const lid = f?.league?.id;
            const m = mapFixture(f, AF_ALL[lid]);
            if (!m.fxid || !m.home || !m.away || !m.date) continue;
            const b = before.get(Number(m.fxid));
            if (b && (String(b.date ?? "") !== String(m.date) || String(b.time ?? "") !== String(m.time ?? ""))) byIdRedated++;
            if (m.status === "FINISHED") byIdNowFinished++;
            back.push(m);
          }
          byIdAsked += part.length;
          if (back.length) {
            const upb = await supa.from("fixtures").upsert(back, { onConflict: "fxid" });
            /* Recorded, never thrown — the same rule the base upsert learned at build 195. */
            if (upb?.error) issues.push({ byIdUpsert: upb.error.message });
          }
        }
      }
    } catch (e: any) {
      byIdError = String(e?.message ?? e);
    }
  }

  /* ── ODDS PASS (MILESTONE 12) ──────────────────────────────────────────────────────
     Upcoming fixtures, NEAREST KICK-OFF FIRST, within budget. {"noodds": true} skips it.

     Nearest-first is the opposite of the detail pass's oldest-first, and for the opposite reason.
     The detail pass takes the oldest because nothing is lost by making an old match wait. This
     pass takes the nearest because a fixture kicking off in twenty minutes has one chance left to
     be priced ever, while one three days out has dozens. When the budget runs out it must run out
     on the fixture that can still be caught tomorrow. */
  let oddsCaptured = 0, oddsNoPrice = 0, oddsDueCount = 0;
  /* af-40 - requests are now league-days, so the request count and the fixture count are no
     longer the same number and both are reported. */
  let oddsLeagueDays = 0, oddsPages = 0, oddsCallsFailed = 0;
  /* af-30 — declared beside its siblings, NOT inside the `noodds` block. The first draft put it
     next to the filter that increments it, where it is block-scoped and invisible to the
     response object that reports it. */
  let oddsGivenUp = 0;
  let oddsStoppedBy: string | null = null;
  let oddsWriteError: string | null = null;
  let oddsQueryError: string | null = null;
  const oddsMarketsMissing = new Set<string>();
  const oddsMissingCount: Record<string, number> = {};
  let oddsPricedForMarkets = 0;
  let oddsBackfillDue = 0, oddsBackfilled = 0, oddsBackfillAfterKick = 0, oddsBackfillNone = 0,
      oddsBackfillDays = 0, oddsBackfillStoppedBy: string | null = null;
  const snapRows: any[] = [];

  /* BUILD 166 — THE ODDS CLOCK STARTS WHEN THE ODDS PASS STARTS.
     It was `Date.now() - t0 > ODDS_TIME_MS`, measured from the start of the whole run, so every
     second the fixture fetch spent was a second taken off the odds budget — 20 of 25 of them. A
     budget that another stage can spend on your behalf is not a budget. This one is now measured
     from `tOdds`, so the odds pass gets its full allowance no matter what happened before it, and
     TIME_BUDGET_MS remains the absolute stop for the run as a whole. */
  const tOdds = Date.now();
  if (!body?.noodds) {
    /* odds_try_at, not odds_last_at, is what the cadence reads — see the patch below. */
    const { data: oCand, error: oCandErr } = await supa
      .from("fixtures")
      /* af-40 - `lid` and `season` are what one league-day request is NAMED by. Season comes
         from the row: af-29 exists because Japan is 2027 while everything around it is 2026,
         and 11 of the 287 upcoming fixtures are on that footing right now. */
      .select("fxid,lid,season,date,time,odds_snaps,odds_tries,odds_try_at,odds_open_h")
      .eq("provider", "af")
      .in("status", ["NS", "SCHEDULED"])
      .gte("date", ymd(new Date(today.getTime() - 86400000)))
      .lte("date", ymd(new Date(today.getTime() + 8 * 86400000)))
      .order("date", { ascending: true }).order("fxid", { ascending: true })
      .range(0, 999);
    /* af-46 - a second page. The old `.limit(600)` was unordered and the window now holds more than
       600 scheduled fixtures, so an arbitrary remainder was never considered at all. */
    let oCand2: any[] = [];
    if (!oCandErr && (oCand?.length ?? 0) >= 1000) {
      const { data: d2 } = await supa.from("fixtures")
        .select("fxid,lid,season,date,time,odds_snaps,odds_tries,odds_try_at,odds_open_h")
        .eq("provider", "af").in("status", ["NS", "SCHEDULED"])
        .gte("date", ymd(new Date(today.getTime() - 86400000)))
        .lte("date", ymd(new Date(today.getTime() + 8 * 86400000)))
        .order("date", { ascending: true }).order("fxid", { ascending: true })
        .range(1000, 1999);
      oCand2 = d2 ?? [];
    }

    const due = (oCandErr ? [] : [...(oCand ?? []), ...oCand2])
      .map((r: any) => ({ r, ko: kickoffUTC(r.date, r.time) }))
      .filter((x: any) => x.ko)
      .map((x: any) => ({ ...x, hrs: (x.ko.getTime() - Date.now()) / 3600000 }))
      .filter((x: any) => {
        const ok = oddsDue(x.hrs, x.r.odds_try_at, x.r.odds_tries ?? 0, x.r.odds_snaps ?? 0);
        if (!ok && x.hrs > 0 && x.hrs <= ODDS_LOOKAHEAD_H
            && x.hrs > ODDS_GIVEUP_KEEP_H && (x.r.odds_snaps ?? 0) === 0
            && (x.r.odds_tries ?? 0) >= ODDS_GIVEUP_TRIES) oddsGivenUp++;
        return ok;
      })
      /* ══ af-33 — NEAREST KICK-OFF FIRST, THEN THE FIXTURE THE MARKET ACTUALLY PRICES ══════════
         MEASURED 2026-09-03, from this collector's own `odds_try_at` stamps rather than estimated.
         A batch writes its eight fixtures at once, so the stamp clusters ARE the batches, and the
         gap between consecutive clusters was **20.4-21.0 s over seven of them, a spread of 0.6 s**.
         That is `afFetch`'s `sleep(20_000)` on the 429 path firing on essentially EVERY odds batch:
         the pass is rate-limited continuously, so `ODDS_TIME_MS` = 25 s buys exactly TWO batches —
         which is why a run's odds stamps land at 43 s, 64 s and 85 s and never further.

         WITH ONLY TWO BATCHES, ORDER IS THE WHOLE GAME — AND IT WAS ARBITRARY WHERE IT MATTERED
         MOST. `hrs` alone leaves fixtures sharing a kick-off MINUTE in undefined order. 2026-09-05
         has **117 fixtures at 14:00 and 107 of them are FA Cup ties no bookmaker quotes**, so the
         handful that are priced were being shuffled in among them. Simulated on the real fixture
         list over 40 trials at the measured latency: **69 of 77 closing lines captured, and all
         eight losses were Premier League and Championship at 14:00** — af-30's starvation, landing
         on the best fixtures in the book. With this tiebreak: **77 of 77, and it still reads 77 of
         77 at 30 s and 45 s per batch.**

         ⚠ IT KEYS ON `odds_snaps`, NEVER ON A COMPETITION. This is af-30's own rule applied to
         ORDER instead of to admission — *a fixture earns its retries by having been priced at least
         once; that is a fact about the fixture, not a guess about its league* — so a cup round the
         market does start pricing promotes itself, and nothing has to be edited when it does.
         The comparison is `>0`, not the count, so a fixture priced fifty times never outranks one
         priced once that is nearer its kick-off: kick-off still leads, and this only breaks its ties.

         🚨 AND IT ORDERS ON `ko.getTime()`, NOT ON `hrs`, WHICH IS THE DIFFERENCE BETWEEN THIS
         WORKING AND SILENTLY NEVER FIRING. `hrs` is built as `(ko - Date.now())/3600000` inside a
         per-element `.map`, so `Date.now()` is re-read for every fixture: two ties mapped either
         side of a millisecond boundary differ by ~2.8e-7 rather than 0, `a.hrs - b.hrs` is then
         truthy, and the tiebreak never runs. `ko.getTime()` is byte-identical for two fixtures
         kicking off at the same instant, and sorting on it is the SAME ordering because `hrs` is a
         monotonic transform of it. The first draft of this used `hrs` and would have shipped a
         change that measured 77/77 in simulation and did nothing in production. */
      .sort((a: any, b: any) =>
        (a.ko.getTime() - b.ko.getTime()) ||
        (((b.r.odds_snaps ?? 0) > 0 ? 1 : 0) - ((a.r.odds_snaps ?? 0) > 0 ? 1 : 0)));
    oddsDueCount = due.length;
    /* af-40 - LEAGUE-DAYS IN THE ORDER THEIR NEAREST FIXTURE KICKS OFF. `due` is already sorted
       nearest-first with af-33's tiebreak, and first-appearance order preserves exactly that: a
       league-day inherits the position of its earliest kick-off, so when the clock or the budget
       runs out it still runs out on the fixtures that can be caught tomorrow. */
    const bucketIx: Record<string, number> = {};
    const oddsBuckets: any[] = [];
    for (const x of due) {
      const k = x.r.lid + "|" + x.r.date + "|" + (x.r.season ?? "?");
      if (bucketIx[k] == null) {
        bucketIx[k] = oddsBuckets.length;
        oddsBuckets.push({ lid: x.r.lid, season: x.r.season, date: x.r.date, items: [] });
      }
      oddsBuckets[bucketIx[k]].items.push(x);
    }
    /* Reported separately from oddsWriteError, and NOT folded into it. A failed read and a failed
       write have different causes and different fixes, and a field named for one carrying the other
       is how build 92 spammed every user — a column read for a meaning its name did not have.
       `detailQueryError` below already makes this distinction; this matches it. */
    if (oCandErr) oddsQueryError = oCandErr.message;

    /* af-26 — BATCHED, NEAREST KICK-OFF FIRST. `due` is already sorted by hours-to-kick ascending
       and batches are taken in order, so the ordering guarantee that protects the un-retakeable
       captures is unchanged: if the budget or the clock runs out it runs out on the fixture that
       can still be caught tomorrow. The guards are checked once per BATCH rather than once per
       fixture, which is why the quota floor below is raised — with eight requests in flight,
       `remaining` can move by eight between checks. */
    for (let bi = 0; bi < oddsBuckets.length; bi += ODDS_PARALLEL) {
      if (oddsCaptured >= ODDS_BUDGET) { oddsStoppedBy = "odds budget"; break; }
      /* 🚨 THIS FLOOR STAYS AT 5 AND MUST STAY BELOW THE DETAIL PASS'S 10. The first draft of
         af-26 padded it to `5 + ODDS_PARALLEL` on the reasoning that eight requests in flight can
         move `remaining` by eight between checks. That is true and it was still wrong: 13 is ABOVE
         the detail floor, so on a tight allowance the odds pass would have stopped FIRST and the
         statistics pass carried on — abandoning the data that cannot be re-fetched to keep
         fetching the data that can, which is the exact inversion the lock was written to catch,
         and it caught it. The slack is unnecessary anyway: `afFetch` refuses at `remaining <= 2`
         on its own, so an in-flight batch cannot overshoot into the reserve. */
      if (remaining <= 5) { oddsStoppedBy = "api quota"; break; }
      if (Date.now() - tOdds > ODDS_TIME_MS) { oddsStoppedBy = "odds time budget"; break; }
      if (Date.now() - t0 > TIME_BUDGET_MS) { oddsStoppedBy = "run time budget"; break; }

      const batch = oddsBuckets.slice(bi, bi + ODDS_PARALLEL);
      const got = await Promise.all(batch.map((b: any) =>
        oddsLeagueDay(b.lid, b.season, b.date, KEY).then((res) => ({ b, res }))));
      /* Flattened back to one entry per DUE FIXTURE, which is the shape the body below has always
         taken. Nothing downstream of here knows the request changed - the snapshot row, the
         consensus, the opening stamp and the closing window are all untouched. A fixture the
         league-day did not mention gets `response: []`, which is a genuine no-price answer and is
         what af-30's give-up is built on; a fixture whose CALL failed carries `_bulkFailed` and is
         skipped entirely a few lines below. */
      const fetched: any[] = [];
      for (const { b, res } of got) {
        oddsLeagueDays++; oddsPages += res.pages;
        for (const x of b.items) {
          const e = res.byFx[Number(x.r.fxid)];
          fetched.push({ x, oj: res.failed ? { response: [], _bulkFailed: res.failed }
                                           : { response: e ? [e] : [] } });
        }
      }
      const writes: Array<Promise<any>> = [];

      for (const { x, oj } of fetched) {
      /* THE ODDS PASS OUTLIVES THE DETAIL PASS WHEN THE QUOTA RUNS LOW, and the two numbers have to
         be this way round. The detail pass stops at 10 remaining; this one runs down to 5. An
         earlier draft had it the other way — odds stopping at 15 while statistics carried on
         spending to 10 — which meant that on the one day the allowance was genuinely tight, the
         function abandoned the data that cannot be re-fetched in order to keep fetching the data
         that can. The whole ordering argument above, inverted by two constants.
         The guard itself now sits on the batch above; this comment stays with the reasoning. */
      /* af-40 - A CALL THAT NEVER HAPPENED IS NOT AN ATTEMPT, and under league-day requests that
         distinction stops being cosmetic: one refused call would otherwise stamp `odds_tries`
         on every fixture of a nine-fixture league-day and af-30 would give up on all nine. */
      if (oj?._bulkFailed) { oddsCallsFailed++; continue; }
      const entry = oj?.response?.[0];
      const nowIso = new Date().toISOString();

      /* THE ATTEMPT IS RECORDED WHETHER OR NOT IT FOUND ANYTHING, and this is not bookkeeping —
         it is what stops the pass eating itself. Plenty of fixtures have no prices yet: small
         competitions, and anything far enough out that the books have not opened. If the cadence
         were keyed on the last SUCCESS, those fixtures would read as due on every single run
         forever, sit at the front of the nearest-first queue, and consume the entire budget
         re-asking a question the provider has already answered — while the fixtures that DO have
         prices never get reached. A no-price answer is an answer and it costs a request, so it
         resets the clock exactly like a price does. */
      const patch: any = { odds_try_at: nowIso, odds_tries: (x.r.odds_tries ?? 0) + 1 };
      const o = entry ? pickOdds(entry) : null;
      /* af-46 - counted per priced fixture. A single book that quotes only 1X2 used to put all six
         other markets into the warning although 99% of captures carried them (measured 2026-11-21:
         of 3,070 snapshots in two days, O/U 2.5 3,040, BTTS 3,037, DC 3,027, DNB 2,996, HT/FT 3,022,
         exact score 3,036). The warning now names only a market absent from every priced fixture. */
      if (o && o.books > 0) { oddsPricedForMarkets++; o.marketsMissing.forEach((m) => { oddsMarketsMissing.add(m); oddsMissingCount[m] = (oddsMissingCount[m] ?? 0) + 1; }); }

      if (!o || o.books === 0) {
        oddsNoPrice++;
      } else {
        const mins = Math.round(x.hrs * 60);
        const snap: any = { fxid: x.r.fxid, captured_at: nowIso, mins_to_kick: mins,
                            books: o.books, prices: o.byBook };
        for (const k of ODDS_KEYS) snap[k] = o.cons[k] ?? null;
        for (const col of Object.values(ODDS_WIDE)) snap[col] = o.wide[col] ?? null;
        snapRows.push(snap);

        patch.odds_last_h = o.cons.h ?? null;
        patch.odds_last_d = o.cons.d ?? null;
        patch.odds_last_a = o.cons.a ?? null;
        patch.odds_last_at = nowIso;
        patch.odds_books = o.books;
        patch.odds_snaps = (x.r.odds_snaps ?? 0) + 1;

        /* "Opening" here means THE FIRST PRICE THIS COLLECTOR SAW, which is not the same thing as
           the price the market opened at — the books were quoting before this function existed.
           odds_open_at is stored beside it so the distance from kick-off is always visible and the
           column can never be read as a claim it cannot support. */
        if (x.r.odds_open_h == null && o.cons.h != null) {
          patch.odds_open_h = o.cons.h; patch.odds_open_d = o.cons.d ?? null;
          patch.odds_open_a = o.cons.a ?? null; patch.odds_open_at = nowIso;
          patch.odds_book = "consensus-median";
        }
        /* The closing line is only written inside the last ODDS_CLOSE_MIN minutes, and each later
           capture in that window overwrites the one before — so whatever survives to kick-off IS
           the last price seen before it. A fixture the budget never reached in that window keeps a
           null close, which is the truthful answer. Milestone 15 must be able to tell "no closing
           price was captured" from "the closing price was 2.10", and a half-hour-old stand-in
           dressed as a close would destroy exactly the measurement it was meant to serve. */
        if (x.hrs * 60 <= ODDS_CLOSE_MIN) {
          patch.odds_close_h = o.cons.h ?? null; patch.odds_close_d = o.cons.d ?? null;
          patch.odds_close_a = o.cons.a ?? null; patch.odds_close_at = nowIso;
        }
        oddsCaptured++;
      }

      /* Build 90 shipped a function filtering on two columns that did not exist and reported
         "ok": true, "sent": 0 for weeks, because PostgREST answers an unknown column with an empty
         result rather than an error. On UPDATE it does return one — so the update result is read
         rather than discarded, and a failure stops the pass instead of spending the rest of the
         budget writing into nothing. af-26 queues the writes and fires them together below; the
         result is still READ, which is the part that matters. */
      writes.push(supa.from("fixtures").update(patch).eq("fxid", x.r.fxid));
      }

      const wrote = await Promise.all(writes);
      const bad = wrote.find((u: any) => u?.error);
      if (bad) {
        oddsWriteError = bad.error.message;
        oddsStoppedBy = "fixtures update failed — has MatchMind-Odds-SQL.md been run?";
        break;
      }
    }

    /* == af-46 - A PLAYED FIXTURE THE COLLECTOR NEVER PRICED GETS ITS PRE-MATCH PRICE IF THE PROVIDER
       STILL HOLDS IT. The provider keeps pre-match odds for about a week after a match. The answer
       carries `update`, the time its prices were last moved, and that is what decides whether the
       price is a pre-match one: a capture whose update is at or after kick-off is NOT stored, and
       `mins_to_kick` is measured from `update`, never from now, so every reader that keeps only
       `mins_to_kick >= 0` still keeps only prices that could have been taken. Each fixture is asked
       at most twice (odds_tries), so a match no bookmaker quoted stops costing calls. */
    if (!oddsStoppedBy && remaining > 50 && Date.now() - t0 < TIME_BUDGET_MS - 20_000) {
      const { data: bf } = await supa.from("fixtures")
        .select("fxid,lid,season,date,time,odds_snaps,odds_tries,odds_try_at,odds_open_h")
        .eq("provider", "af")
        .eq("status", "FINISHED")
        .gte("date", ymd(new Date(today.getTime() - 6 * 86400000)))
        .lte("date", ymd(today))
        .or("odds_snaps.is.null,odds_snaps.eq.0")
        .order("date", { ascending: false }).order("fxid", { ascending: true })
        .limit(1000);
      const bix: Record<string, number> = {}, bdays: any[] = [];
      /* Eligible until it has been asked once well after the whistle: a try stamped before kick-off + 3 h
         was a pre-match or in-play try, so it does not count against the backfill. */
      const bfDue = (bf ?? []).filter((r: any) => {
        const ko = kickoffUTC(r.date, r.time);
        if (!ko || Date.now() - ko.getTime() < 2 * 3600000) return false;
        return !r.odds_try_at || new Date(r.odds_try_at).getTime() < ko.getTime() + 3 * 3600000;
      });
      for (const r of bfDue) {
        if (r.lid == null || r.season == null || !r.date) continue;
        const k = r.lid + "|" + r.date + "|" + r.season;
        if (bix[k] == null) { bix[k] = bdays.length; bdays.push({ lid: r.lid, season: r.season, date: r.date, items: [] }); }
        bdays[bix[k]].items.push(r);
      }
      oddsBackfillDue = bfDue.length;
      const BF_DAYS = 24, BF_TIME_MS = 15_000, tBf = Date.now();
      for (let bi = 0; bi < bdays.length && bi < BF_DAYS; bi += ODDS_PARALLEL) {
        if (remaining <= 50) { oddsBackfillStoppedBy = "api quota"; break; }
        if (Date.now() - tBf > BF_TIME_MS) { oddsBackfillStoppedBy = "backfill time budget"; break; }
        if (Date.now() - t0 > TIME_BUDGET_MS - 10_000) { oddsBackfillStoppedBy = "run time budget"; break; }
        const batch = bdays.slice(bi, Math.min(bi + ODDS_PARALLEL, BF_DAYS));
        const got = await Promise.all(batch.map((b: any) =>
          oddsLeagueDay(b.lid, b.season, b.date, KEY).then((res) => ({ b, res }))));
        const writes: Array<Promise<any>> = [];
        for (const { b, res } of got) {
          oddsBackfillDays++;
          if (res.failed) continue;   // a call that never happened is not an attempt
          for (const r of b.items) {
            const patch: any = { odds_try_at: new Date().toISOString(), odds_tries: (r.odds_tries ?? 0) + 1 };
            const entry = res.byFx[Number(r.fxid)];
            const o = entry ? pickOdds(entry) : null;
            const ko = kickoffUTC(r.date, r.time);
            const upd = entry?.update ? new Date(String(entry.update)) : null;
            const mins = ko && upd && !isNaN(+upd) ? Math.floor((ko.getTime() - upd.getTime()) / 60000) : null;
            if (!o || o.books === 0) oddsBackfillNone++;
            else if (mins == null || mins < 0) oddsBackfillAfterKick++;
            else {
              const at = upd!.toISOString();
              const snap: any = { fxid: r.fxid, captured_at: at, mins_to_kick: mins, books: o.books, prices: o.byBook };
              for (const k of ODDS_KEYS) snap[k] = o.cons[k] ?? null;
              for (const col of Object.values(ODDS_WIDE)) snap[col] = o.wide[col] ?? null;
              snapRows.push(snap);
              patch.odds_last_h = o.cons.h ?? null; patch.odds_last_d = o.cons.d ?? null;
              patch.odds_last_a = o.cons.a ?? null; patch.odds_last_at = at;
              patch.odds_books = o.books; patch.odds_snaps = (r.odds_snaps ?? 0) + 1;
              if (r.odds_open_h == null && o.cons.h != null) {
                patch.odds_open_h = o.cons.h; patch.odds_open_d = o.cons.d ?? null;
                patch.odds_open_a = o.cons.a ?? null; patch.odds_open_at = at; patch.odds_book = "consensus-median";
              }
              oddsBackfilled++;
            }
            writes.push(supa.from("fixtures").update(patch).eq("fxid", r.fxid));
          }
        }
        const wrote = await Promise.all(writes);
        const bad = wrote.find((u: any) => u?.error);
        if (bad) { oddsWriteError = (oddsWriteError ? oddsWriteError + " | " : "") + "backfill: " + bad.error.message; break; }
      }
    }

    if (snapRows.length) {
      const ins = await supa.from("odds_snapshots").insert(snapRows);
      if (ins?.error) {
        /* BUILD 167 — THE FALLBACK THAT PROTECTS THE MARKETS THAT ALREADY WORK.
           `htft` and `cs` are new columns. If this function is deployed before the build-167 SQL
           is run, PostgREST rejects the INSERT — and it rejects the WHOLE batch, so a schema gap
           affecting two new markets would take down the five that have been collecting cleanly all
           day. For data that expires, that trade is unacceptable in either direction: better to
           land the core markets and shout about the missing columns than to land nothing.

           One retry, wide columns stripped. This is not a substitute for running the SQL — the
           message says exactly what to do — it is a guarantee that forgetting to costs two markets
           for a few hours instead of all seven. */
        const stripped = snapRows.map((r: any) => {
          const c = { ...r };
          for (const col of Object.values(ODDS_WIDE)) delete c[col];
          return c;
        });
        const ins2 = await supa.from("odds_snapshots").insert(stripped);
        const note = ins2?.error
          ? `odds_snapshots insert failed even without the new columns: ${ins2.error.message}`
          : `HT/FT and correct-score odds are NOT being stored — run the build-167 SQL in ` +
            `MatchMind-Odds-SQL.md §2a. The five core markets were saved. (${ins.error.message})`;
        /* Appended, never assigned over the top: if the fixtures update above already failed, that
           is the more specific diagnosis and clobbering it would throw the better message away. */
        oddsWriteError = (oddsWriteError ? oddsWriteError + " | " : "") + note;
      }
    }
  }

  /* ── INJURY PASS (build 182) ────────────────────────────────────────────────────────
     Writes `inj_h` / `inj_a` on `fixtures`: space-separated API-Football player ids, one string
     per side. Runs after the odds pass and before the detail pass, on a hard budget.

     WHY IDS AND NOT THE PROVIDER'S RECORD, WHICH IS THE OPPOSITE OF WHAT BUILD 158 DID FOR EVENTS.
     Measured on the eleven-competition sweep of 2026-08-18: 8.1 injury records per fixture. Stored
     as the provider's object — id, name, type, reason — that is ~690 bytes per fixture and ~15MB
     across 22,000 of them, and EVERY BYTE OF IT IS SENT TO EVERY PHONE, because the app reads
     fixtures with select('*'). As player ids alone it is ~57 bytes per fixture and ~1.25MB total,
     on a row that already costs ~90 bytes. Items 20, 21 and 25 consume ids; the names and reasons
     are display fields and nothing displays them.

     Build 158 stored `events` whole on the principle that "a raw record cannot be wrong in a way
     that needs re-collecting". That principle was right there and does not transfer here, for a
     reason that is measured rather than argued: re-fetching events costs ONE CALL PER FIXTURE —
     22,000 calls. Re-fetching every injury this project can have costs SIXTY-SIX, because /injuries
     answers a whole league-season in one response (`paging.total` was 1 on all 30 calls of the
     sweep). Pre-digesting is cheap to undo here and was not there.

     🚨 NULL AND EMPTY ARE DIFFERENT VALUES AND THE PASS DEPENDS ON IT.
       null  -> this fixture's league-season has never been asked about
       ""    -> asked, and the provider reported nobody
     Collapse those two and Primeira Liga — a whole competition the sweep found to have 227 rows in
     April 2021 and NOTHING since — leaves every one of its 1,858 fixtures looking unfetched, so the
     pass re-asks the same empty league-seasons on every run and never advances. That is build 175's
     deadlock and build 179's sentinel bug in a new costume, designed out before it can happen
     rather than diagnosed after. A league-season that answers with nothing gets stamped "" for
     every fixture in it, which is the answer, and the queue moves on.

     THE QUEUE IS THE DATA. There is no bookkeeping table and no cursor: the next league-season to
     do is whichever one still has a null, taken season-descending so the seasons Milestone 14 can
     actually train on fill first (build 179). When none is left the pass costs one cheap indexed
     query and zero API calls, and switches to keeping the fixtures that are about to be published
     up to date. */
  const INJ_SEASON_BUDGET = 2;          // league-seasons per run — see the note on cost below
  const INJ_TIME_MS = 8_000;            // taken AFTER odds, never from them (build 166)
  const INJ_LOOKAHEAD_H = 48;
  const tInj = Date.now();
  let injSeasonsDone = 0, injRowsWritten = 0, injFetchFails = 0, injDupes = 0;
  let injStoppedBy: string | null = null;
  let injLastFail: string | null = null;
  let injRefreshed: string | null = null;
  const injTypesSeen = new Set<string>();

  /* One league-season, fetched and written. Returns the number of fixture rows actually CHANGED —
     not the number considered. A refresh that finds nothing new must cost no writes, or the live
     season is rewritten a few hundred rows at a time on every run for no reason. */
  async function injOneSeason(lid: number, season: number): Promise<number | null> {
    const j = await afFetch(`/injuries?league=${lid}&season=${season}`, KEY);
    const failed = whyFailed(j);
    if (failed) {                       // NOT an empty season — build 176, and never stamped
      injFetchFails++; injLastFail = failed;
      return null;
    }
    const recs: any[] = j?.response ?? [];

    /* The fixture row stores team NAMES, and an injury record names a numeric team id. `home_logo`
       is `.../teams/33.png`, so the id has been on every row since build 158 — build 174 found this
       for events and it is the same join here, which is why this needs no new columns. */
    const { data: fxRows, error: fxErr } = await supa
      .from("fixtures").select("fxid,home_logo,away_logo,inj_h,inj_a")
      .eq("provider", "af").eq("lid", lid).eq("season", season).limit(2000);
    if (fxErr) { injLastFail = "db: " + fxErr.message; return null; }

    const teamId = (u: any) => {
      const m = /\/teams\/(\d+)\./.exec(String(u ?? ""));
      return m ? Number(m[1]) : null;
    };
    /* Indexed once. A season is up to 556 fixtures and a response up to ~4,600 records, so a
       linear scan per record is ~2.5M comparisons inside a 45-second function that has a detail
       pass waiting behind it. */
    const byFx = new Map<number, { row: any; h: string[]; a: string[];
                                   seen: { h: Map<number, boolean>; a: Map<number, boolean> } }>();
    for (const r of (fxRows ?? []))
      byFx.set(r.fxid, { row: r, h: [], a: [], seen: { h: new Map(), a: new Map() } });

    for (const rec of recs) {
      const fid = rec?.fixture?.id, tid = rec?.team?.id, pid = rec?.player?.id;
      if (fid == null || tid == null || pid == null) continue;
      const bucket = byFx.get(fid);
      if (!bucket) continue;            // a fixture this database does not carry
      const row = bucket.row;
      const side = tid === teamId(row.home_logo) ? "h"
                 : tid === teamId(row.away_logo) ? "a" : null;
      if (!side) continue;              // attributable to neither side is not attributable
      /* THE VOCABULARY IS READ, NOT ASSUMED. Phase-1 SQL's comment says the provider writes
         "Missing Fixture" / "Questionable"; every record in the 2026-08-18 sweep said the former
         and the latter was never observed. So anything that is not an outright absence is marked
         `?` rather than being silently counted as one — a doubtful player is not a missing one —
         and the distinct strings are reported so the guess can be corrected by reading. */
      const t = String(rec?.player?.type ?? "");
      injTypesSeen.add(t);
      /* ONE ENTRY PER PLAYER PER SIDE. A duplicate is dropped, and "Missing Fixture" WINS over
         "Questionable" rather than whichever arrived last — an outright absence is the stronger
         claim and a doubtful flag must never overwrite it. Both statuses are live: the 2026-08-19
         run reported injTypesSeen ["Missing Fixture", "Questionable"], where the eleven-competition
         sweep had only ever seen the first. */
      const seen = bucket.seen[side];
      const hard = (t === "Missing Fixture");
      if (seen.has(pid)) {
        injDupes++;
        if (hard && seen.get(pid) === false) {
          bucket[side] = bucket[side].filter((x: string) => x !== "?" + String(pid));
          bucket[side].push(String(pid));
          seen.set(pid, true);
        }
        continue;
      }
      seen.set(pid, hard);
      bucket[side].push((hard ? "" : "?") + String(pid));
    }

    const changed: any[] = [];
    for (const r of (fxRows ?? [])) {
      const b = byFx.get(r.fxid)!;
      const h = b.h.join(" "), a = b.a.join(" ");
      if (h !== (r.inj_h ?? null) || a !== (r.inj_a ?? null)) {
        changed.push({ fxid: r.fxid, inj_h: h, inj_a: a });
      }
    }
    if (!changed.length) return 0;
    /* Upsert on the primary key, and ONLY with fxids read from this table moments ago — an upsert
       carrying an id that does not exist would INSERT a phantom fixture with no teams and no date,
       which the staleness fence cannot see and the feed would happily draw. */
    const up = await supa.from("fixtures").upsert(changed, { onConflict: "fxid" });
    if (up?.error) { injLastFail = "db: " + up.error.message; return null; }
    return changed.length;
  }

  while (injSeasonsDone < INJ_SEASON_BUDGET) {
    /* af-34 — the same floor as the detail pass, and for the same reason. `/injuries` fills
       `inj_h`/`inj_a`, M13 feature-layer columns the shipped app has not fetched since build 262,
       and this pass runs AFTER the odds pass — so at `remaining <= 30` it would spend 2 calls a run
       BENEATH the reserve, ~288 a day of a 2,000 reserve. A reserve with a leak is not a reserve.
       ⚠ The `injprobe` copy of this guard is deliberately NOT changed: a probe is invoked by hand,
       is not on the cron, and sits at 20 alongside the other three probes. Patching that copy
       instead of this one was the first draft's mistake — af-26's trap, which is that a line
       existing twice will be found in the wrong place. */
    if (remaining <= DETAIL_QUOTA_FLOOR) { injStoppedBy = "api quota floor — odds pass protected"; break; }
    if (Date.now() - tInj > INJ_TIME_MS) { injStoppedBy = "time budget"; break; }
    if (Date.now() - t0 > TIME_BUDGET_MS) { injStoppedBy = "run out of time"; break; }
    if (injFetchFails >= 3) { injStoppedBy = "fetch failures: " + injLastFail; break; }

    /* Never-asked first, newest season first. Same ordering rule as the detail queue and for the
       same reason: 33% of this history predates xG and cannot join a Milestone 14 fit anyway. */
    const { data: todo } = await supa
      .from("fixtures").select("lid,season")
      .eq("provider", "af").is("inj_h", null).not("season", "is", null)
      .order("season", { ascending: false }).limit(1);
    const next = todo?.[0];
    if (!next) break;                   // backfill complete — the refresh below takes over

    const n = await injOneSeason(next.lid, next.season);
    if (n == null) continue;            // failed: not stamped, not counted as done
    injRowsWritten += n;
    injSeasonsDone++;
  }

  /* THE REFRESH, AND IT IS DELIBERATELY THE SMALLEST THING THAT KEEPS THE FEATURE PUBLISHABLE.
     Injuries change up to kick-off, and the sweep showed the provider carries rows for fixtures two
     to three days out — which is what makes these features legitimately about the fixture being
     predicted, unlike the presence features of build 169. So exactly ONE league-season is refreshed
     per run: the one whose next kick-off is soonest. That is at most 144 calls a day, it always
     points at the competition about to publish, and because injOneSeason writes only rows whose
     value actually changed, a quiet refresh costs one API call and zero writes. */
  if (!injStoppedBy && injSeasonsDone < INJ_SEASON_BUDGET && remaining > 30
      && Date.now() - tInj <= INJ_TIME_MS) {
    const { data: soon } = await supa
      .from("fixtures").select("lid,season,date,time")
      .eq("provider", "af").in("status", ["NS", "SCHEDULED"])
      .gte("date", ymd(new Date(today.getTime() - 86400000)))
      .lte("date", ymd(new Date(today.getTime() + 3 * 86400000)))
      .limit(400);
    const nextUp = (soon ?? [])
      .map((r: any) => ({ r, ko: kickoffUTC(r.date, r.time) }))
      .filter((x: any) => x.ko && x.ko.getTime() > Date.now()
                       && x.ko.getTime() - Date.now() <= INJ_LOOKAHEAD_H * 3600000)
      .sort((a: any, b: any) => +a.ko - +b.ko)[0];
    if (nextUp?.r?.lid != null && nextUp?.r?.season != null) {
      const n = await injOneSeason(nextUp.r.lid, nextUp.r.season);
      if (n != null) { injRowsWritten += n; injRefreshed = `${nextUp.r.lid}/${nextUp.r.season}`; }
    }
  }

  const msInj = Date.now() - tInj;

  /* Detail pass. Finished fixtures missing statistics, oldest first, within budget.
     THIS USED TO FILTER `rows` — only what THIS run's rolling window fetched. That meant a
     history backfill (which writes base rows but no detail, on purpose) could never have its
     statistics filled by the ordinary cron, because those older fixtures never reappear in the
     window. Reading from the database instead of the run's own memory means ANY 'af' fixture
     missing detail gets picked up, however it got there — the window, a manual call, or a
     season backfill. That is what makes the history mode above actually work over time instead
     of just writing bare scores forever. */
  /* ══ BUILD 175 — THE DEADLOCK. THIS QUEUE COULD NOT ADVANCE, AND IT REPORTED ITSELF HEALTHY ═════
     Measured from the database on 2026-08-17: 22,005 finished fixtures, 28 with xG (0.13%), and all
     28 dated 2026-08-07 to 08-10 — a four-day window at the WRONG END of a queue that is ordered
     oldest-first. The last detail write was two minutes before the measurement, so the collector was
     running the whole time.

     WHAT WAS HAPPENING. The six-season backfill put ~22,000 fixtures dated 2020-2025 at the front of
     this queue. They return no statistics, so each one hit `if (!st?.length) continue;` — no row
     patched, `xg_h` still null, `detailed` not incremented — and the IDENTICAL 75 rows were selected
     again on the very next run. Every run burned up to 75 API calls and wrote nothing. The 28 rows
     that did fill were detailed BEFORE the backfill landed.

     AND NOTHING REPORTED IT. The loop completes normally when every row is skipped, so `stoppedBy`
     stayed null and `detailed` stayed 0 — a deadlock whose telemetry says "healthy run, nothing to
     do". Build 165's lesson in a new costume: the fault was not that an instrument went unread, it
     was that no instrument distinguished "nothing left to do" from "nothing I can do".

     THE FIX IS TO RECORD THE ATTEMPT, NOT THE OUTCOME. `detail_tried_at` is stamped on every fixture
     this pass touches, whether or not statistics came back, and the queue is ordered by it with
     never-tried rows first. A row that returns nothing therefore drops to the back instead of
     blocking the front, and the queue always advances. Rows are retried after DETAIL_RETRY_D so a
     transient provider gap heals itself rather than being written off forever.

     DELIBERATELY NOT DONE: raising DETAIL_BUDGET, which only burns more quota on the same unfillable
     rows; and marking rows dead permanently, which would turn a provider outage into permanent data
     loss with no way back.

     THIS IS ALSO THE MEASUREMENT. Nothing here yet proves WHY 2020 fixtures return no statistics —
     provider coverage on this plan, or genuinely absent for those league-seasons. After one run,
     `detailNoStats` below answers it: a large count with `detail_tried_at` set and `xg_h` still null
     is the provider saying it has nothing, and that is a fact worth knowing before six seasons of
     history are counted on. */
  const DETAIL_RETRY_D = 30;
  const retryCutoff = new Date(Date.now() - DETAIL_RETRY_D * 86400000).toISOString();

  let detailed = 0, noStats = 0, fetchFails = 0;
  let lastFetchFail: string | null = null;
  const triedIds: number[] = [];
  const { data: needDetail, error: needDetailErr } = await supa
    .from("fixtures")
    .select("fxid,date,season")
    .eq("provider", "af")
    .eq("status", "FINISHED")
    /* ══ BUILD 179 — THE SENTINEL WAS xG, AND A THIRD OF THE HISTORY CAN NEVER HAVE ANY ════════
       Measured by the af-14 probe on the Premier League, one statistics call per season:

         season 2025 / 2024 / 2023  → 18 stat types, expected_goals PRESENT
         season 2022                → 17 stat types, expected_goals PRESENT
         season 2021 / 2020         → 16 stat types, expected_goals ABSENT

       **xG begins at season 2022.** Seasons 2020 and 2021 still return sixteen perfectly good
       statistics — possession, shots, cards, saves, passes — they simply have no xG, and 2022 is one
       type short of the modern set (goals_prevented arrived after expected_goals).

       TWO CONSEQUENCES, AND THE FIRST IS A BUG THIS QUERY HAD ALL ALONG.

       1. `.is("xg_h", null)` asked "is xG missing", and used the answer as "does this fixture still
          need fetching". For 7,185 fixtures in 2020-2021 those are different questions FOREVER: the
          row is filled with all sixteen statistics the provider has, `xg_h` stays null because there
          is no xG to write, and the fixture matches this filter again on the next sweep, and the
          next, for as long as the project exists. The retry window bounds the waste; it does not
          stop it. The sentinel is now `poss_h` — "do we have ANY statistics for this fixture" —
          which is the question actually being asked, and which goes non-null for every season.

       2. Never-tried rows were tie-broken by date ASCENDING, so the pass began at 2020-08-08 and
          spent its whole budget on the two seasons that cannot produce the feature layer's core
          input. 7,185 of 22,009 fixtures is 33%, about 3.3 days of collector time at 15 per run.
          Season DESCENDING puts 2025 first and 2020 last, so every run now fills fixtures Milestone
          14 can actually be trained on. The old seasons are not skipped — their sixteen statistics
          feed possession, shots, cards and saves — they are simply last in the queue rather than
          first, which is what "oldest first" accidentally inverted. */
    .is("poss_h", null)
    .or(`detail_tried_at.is.null,detail_tried_at.lt.${retryCutoff}`)
    // never-tried first, then least-recently-tried; then the seasons that can carry xG
    .order("detail_tried_at", { ascending: true, nullsFirst: true })
    .order("season", { ascending: false })
    .order("date", { ascending: false })
    .limit(DETAIL_BUDGET * 5);   // headroom only — the budget/time guards below decide the real stop
  const finished = needDetailErr ? [] : (needDetail ?? []);

  let stoppedBy: string | null = null;
  for (const r of finished) {
    if (detailed >= DETAIL_BUDGET) { stoppedBy = "detail budget"; break; }
    if (remaining <= DETAIL_QUOTA_FLOOR) { stoppedBy = "api quota floor — odds pass protected"; break; }
    if (Date.now() - t0 > TIME_BUDGET_MS) { stoppedBy = "time budget"; break; }
    const sj = await afFetch(`/fixtures/statistics?fixture=${r.fxid}`, KEY);
    const st = sj?.response;

    /* ══ BUILD 176 — A FAILED CALL IS NOT AN EMPTY FIXTURE, AND BUILD 175 COULD NOT TELL ══════════
       `afFetch` returns `{ response: [] }` for EVERY failure mode it has: a 429 that exhausted its
       retries (`_rateLimited`), a non-OK status (`_http`), API-Football's 200-with-errors body
       (`_apiErrors`), and the local quota guard (`_skipped`). So `!st?.length` is true both when the
       provider says "this fixture has no statistics" and when the call never really happened.

       BUILD 175 STAMPED BOTH AS TRIED. That is worse than the deadlock it replaced: under sustained
       rate limiting it would walk the entire 22,000-row backlog marking perfectly fillable fixtures
       as "tried and empty", pushing each to the back for DETAIL_RETRY_D days and learning nothing.
       A wrong record at full coverage, which is this project's oldest lesson.

       CAUGHT BY READING THE DATA, NOT THE CODE. The first run after the fix stamped exactly 8 rows,
       six of them Brazilian Serie A 2020 — Flamengo, Grêmio, Santos, Internacional, a major league.
       Their `detail_tried_at` timestamps fall in three bursts 20 seconds apart, which is exactly
       `await sleep(20_000)` on the 429 retry path. The run did not find eight empty fixtures; it
       spent its time budget being throttled.

       So a failure is now counted separately and NOT stamped, and repeated failures stop the pass
       rather than burning the budget one 20-second sleep at a time. Only a call that genuinely
       succeeded and returned an empty array is evidence about the fixture. */
    const failed = sj?._rateLimited ? "rate limited"
                 : sj?._apiErrors   ? "api errors: " + JSON.stringify(sj._apiErrors)
                 : sj?._http != null ? "http " + sj._http
                 : sj?._skipped     ? "quota guard"
                 : null;
    if (failed) {
      fetchFails++;
      lastFetchFail = failed;
      if (fetchFails >= 3) { stoppedBy = "fetch failures: " + failed; break; }
      continue;                                  // deliberately NOT stamped — nothing was learned
    }

    /* THE LINE THE DEADLOCK LIVED ON. `continue` alone left the row exactly as it found it, so the
       next run selected it again — forever. A genuine empty answer is now recorded before moving on. */
    if (!st?.length) { triedIds.push(r.fxid); noStats++; continue; }

    const hid = st[0]?.team?.id, aid = st[1]?.team?.id;
    /* Fields added after reading the probe, not before. `goals_prevented` and the inside/outside
       box split were NOT in the plan — the provider simply has them, and both reach items the
       plan had written off:
         goals_prevented  -> item 4 (PSxG) territory. It is a keeper-quality number derived from
                             post-shot expected goals, which was marked unreachable.
         shots in/outside -> item 10 (average shot distance), coarsely. A side taking most of its
                             shots from outside the box is the "settles for low-probability long
                             shots" team that item describes.
       Two items recovered for free, found by reading a response instead of a plan. */
    const patch: any = {
      xg_h: statPair(st, hid, "expected_goals"), xg_a: statPair(st, aid, "expected_goals"),
      gprev_h: statPair(st, hid, "goals_prevented"), gprev_a: statPair(st, aid, "goals_prevented"),
      sib_h: statPair(st, hid, "Shots insidebox"), sib_a: statPair(st, aid, "Shots insidebox"),
      sob_h: statPair(st, hid, "Shots outsidebox"), sob_a: statPair(st, aid, "Shots outsidebox"),
      blocked_h: statPair(st, hid, "Blocked Shots"), blocked_a: statPair(st, aid, "Blocked Shots"),
      offsides_h: statPair(st, hid, "Offsides"), offsides_a: statPair(st, aid, "Offsides"),
      poss_h: statPair(st, hid, "Ball Possession"), poss_a: statPair(st, aid, "Ball Possession"),
      shots_h: statPair(st, hid, "Total Shots"), shots_a: statPair(st, aid, "Total Shots"),
      sot_h: statPair(st, hid, "Shots on Goal"), sot_a: statPair(st, aid, "Shots on Goal"),
      corners_h: statPair(st, hid, "Corner Kicks"), corners_a: statPair(st, aid, "Corner Kicks"),
      fouls_h: statPair(st, hid, "Fouls"), fouls_a: statPair(st, aid, "Fouls"),
      yellows_h: statPair(st, hid, "Yellow Cards"), yellows_a: statPair(st, aid, "Yellow Cards"),
      reds_h: statPair(st, hid, "Red Cards"), reds_a: statPair(st, aid, "Red Cards"),
      saves_h: statPair(st, hid, "Goalkeeper Saves"), saves_a: statPair(st, aid, "Goalkeeper Saves"),
      passacc_h: statPair(st, hid, "Passes %"), passacc_a: statPair(st, aid, "Passes %"),
      /* ══ BUILD 187 — PASS VOLUME, AND WHY IT SHIPS AHEAD OF THE FEATURE THAT WANTS IT ═════════
         The {"probe": true} run on 2026-08-19 listed all eighteen statistic types this plan
         returns, and THREE of them have been arriving on every response and being dropped:

           "Shots off Goal"    derivable — Total(21) - on(6) - blocked(7) = 8, and 8-3-2 = 3.
                               Verified on BOTH teams of the probe fixture. No column.
           "Passes accurate"   derivable — 285/346 = 82.4%, which is the stored "Passes %" of 82.
                               Given the total it is the same fact twice. No column.
           "Total passes"      NOT derivable from anything stored. This one.

         WHY IT IS WORTH A COLUMN. The probe fixture is the argument by itself: Sunderland 346
         passes at 82%, Chelsea 452 at 83%. Identical accuracy, completely different build-up.
         Build 186's item 15 can currently see only the 82 and the 83, and pass ACCURACY without
         pass VOLUME cannot tell a side that controls a game from one that simply does not misplace
         the few passes it attempts.

         AND WHY IT SHIPS TODAY RATHER THAN WITH THAT FEATURE. The detail pass never revisits a
         filled row, so every fixture written between now and the column existing is a fixture that
         costs one API call to re-fetch. 12,664 of the 14,830-fixture Milestone 14 pool were still
         unfilled on 2026-08-19, so ~86% of it gets this for free as the backfill runs; after the
         pool completes (~2026-08-27 at the measured rate) the same change costs 14,830 calls,
         about seven days of this function's entire budget. THE COST OF THIS CHANGE RISES WITH
         DELAY, which is build 184's event-player-id decision and build 162's odds decision in a
         third costume. The feature that uses it waits for coverage; the column cannot. */
      passes_h: statPair(st, hid, "Total passes"), passes_a: statPair(st, aid, "Total passes"),
    };
    /* LINEUPS carry the coach id per fixture. That is better than the /coachs endpoint for item 51
       (new-manager bounce): a change of manager is visible as coach.id changing between one
       fixture and the next, at no extra request. Formation (item 34) and positions — "G", "D" —
       come in the same call, which is items 22 and 23. */
    if (remaining > DETAIL_QUOTA_FLOOR) {
      const lj = await afFetch(`/fixtures/lineups?fixture=${r.fxid}`, KEY);
      const lu = lj?.response;
      if (lu?.length >= 2) {
        const side = (i: number) => ({
          formation: lu[i]?.formation ?? null,
          coachId: lu[i]?.coach?.id ?? null,
          coach: lu[i]?.coach?.name ?? null,
          xi: (lu[i]?.startXI ?? []).map((p: any) => ({
            id: p?.player?.id, name: p?.player?.name, pos: p?.player?.pos, grid: p?.player?.grid })),
        });
        const H = side(0), A = side(1);
        patch.formation_h = H.formation; patch.formation_a = A.formation;
        patch.lineup_h = H; patch.lineup_a = A;
      }
    }

    /* EVENTS give goal minutes (items 26-28) and substitution minutes (item 33). Stored whole
       rather than pre-digested — Phase 2 decides what to extract, and a raw record cannot be
       wrong in a way that needs re-collecting. */
    if (remaining > DETAIL_QUOTA_FLOOR) {
      const ej = await afFetch(`/fixtures/events?fixture=${r.fxid}`, KEY);
      const ev = ej?.response;
      if (ev?.length) {
        patch.events = ev.map((e: any) => ({
          m: e?.time?.elapsed ?? null, x: e?.time?.extra ?? null,
          team: e?.team?.id ?? null, type: e?.type ?? null, detail: e?.detail ?? null,
          player: e?.player?.name ?? null, assist: e?.assist?.name ?? null,
          /* BUILD 184 — the ids, so a scorer can be joined to an injury record. The names are kept
             beside them: a person reads a name, a join needs an id, and dropping either would mean
             re-fetching 22,000 fixtures to get it back. */
          pid: e?.player?.id ?? null, aid: e?.assist?.id ?? null,
        }));
      }
    }

    patch.detail_tried_at = new Date().toISOString();   // stamped on success too, so ordering is total
    await supa.from("fixtures").update(patch).eq("fxid", r.fxid);
    detailed++;
  }

  /* One write for every row that came back empty, rather than one per row inside the loop. These are
     the rows being pushed to the back of the queue; if this write fails they stay at the front and
     the deadlock returns, so the error is surfaced rather than swallowed. */
  let detailStampError: string | null = null;
  if (triedIds.length) {
    const up = await supa.from("fixtures")
      .update({ detail_tried_at: new Date().toISOString() })
      .in("fxid", triedIds);
    if (up.error) {
      detailStampError = up.error.message;
      issues.push("detail_tried_at could not be written — the detail queue will stall again: "
                  + up.error.message + " (has MatchMind-Detail-SQL.md been run?)");
    }
  }

  /* BUILD 165 — THE FIELD THAT REPORTED THE FAULT EXISTED AND WAS NOT READ.
     `oddsMarketsMissing` was built at build 162 precisely so a provider name change could never be
     silent. It correctly listed "draw no bet" from the very first run, sat two thirds of the way
     down a forty-field response, and Draw No Bet collected nothing for a day.

     An instrument nobody looks at is not an instrument. So the same fact is now also stated once,
     in English, as the FIRST key in the response — null when healthy, a sentence when not. Ordering
     is the whole point: JSON keys render in insertion order, so this is the first thing on screen
     rather than the thirty-first. It says what is wrong and what to run next.

     This does NOT set ok:false. The run genuinely succeeded and the cron should not start reporting
     failures for a partial market set — a warning that cries wolf gets switched off, and then the
     next real one is invisible too. */
  /* BUILD 195 — A DROPPED MARKET STILL COMES FIRST, and the first draft of this build got that
     wrong. It put the upsert failure ahead, on the reasoning that a failed base upsert stops
     everything while a renamed market loses only one market. The lock rejected it, correctly.

     The ordering rule here is not "biggest blast radius", it is IRREVERSIBILITY, which is the same
     rule that puts the odds pass ahead of the statistics pass. **This very build is what makes the
     upsert failure recoverable** — fixtures simply re-upsert on the next tick once the column
     exists — while a market that goes uncollected is gone for those fixtures forever. Promoting the
     recoverable fault above the permanent one would have quietly undone build 162's reasoning while
     looking like an improvement.

     Both are reported when both are true, so nothing is hidden by the ordering. */
  const upsertWarn = upsertError
    ? `FIXTURES ARE NOT BEING STORED: ${upsertError.error}. Odds and detail still ran, so nothing ` +
      `irreversible is being lost, but no new fixture, score or status is landing until this is ` +
      `fixed. If the message names a column, its SQL has not been run — see upsertError.`
    : "";
  const oddsMarketsPartial: Record<string, number> = {};
  for (const m of [...oddsMarketsMissing]) {
    if ((oddsMissingCount[m] ?? 0) < oddsPricedForMarkets) { oddsMarketsPartial[m] = oddsMissingCount[m]; oddsMarketsMissing.delete(m); }
  }
  const WARNING = oddsMarketsMissing.size
    ? `A market this app PUBLISHES is not being collected: ${[...oddsMarketsMissing].join(", ")}. ` +
      `The provider has probably renamed it. Run {"oddsprobe":true} and compare betNamesAvailable ` +
      `against ODDS_MARKETS. Odds cannot be backfilled, so every run in this state is a permanent loss.`
      + (upsertWarn ? `  ALSO: ${upsertWarn}` : "")
    : (upsertWarn || null);

  return json({
    WARNING,
    ok: true,
    provider: "api-football",
    window: { from, to, season },
    leagues: Object.keys(AF_LEAGUES).length,
    fixtures: rows.length,
    baseHot,
    baseSkipped,
    oddsGivenUp,              // af-30 — far-out fixtures the market has never priced
    datePass, extraLeagues: Object.keys(EXTRA_LEAGUES).length,
    seasonOverrides,          // af-29 — competitions not on the calendar year
    seasonUnknown,            // af-29 — competitions the provider did not mark current

    /* MILESTONE 12. oddsMarketsMissing is the field to watch on a normal day: it should be an
       empty array, and a market appearing in it means the provider renamed something and this
       function has been quietly storing nulls for it ever since. oddsDue far above oddsCaptured
       run after run means the budget is too small for the fixture load and the tail is never
       being priced — the probe's tierCounts is what to read next. */
    oddsCaptured,
    oddsNoPrice,
    oddsDue: oddsDueCount,
    /* af-40 - oddsLeagueDays is the REQUEST count and oddsCaptured the FIXTURE count; the gap
       between them is the whole point of the build. oddsPages above oddsLeagueDays means a
       league-day paged, which every measurement so far said never happens. */
    oddsLeagueDays,
    oddsPages,
    oddsCallsFailed,
    oddsStoppedBy,
    oddsSnapshotsWritten: snapRows.length,
    oddsMarketsMissing: [...oddsMarketsMissing],
    oddsMarketsPartial, oddsPricedForMarkets,
    oddsBackfillDue, oddsBackfilled, oddsBackfillAfterKick, oddsBackfillNone, oddsBackfillDays, oddsBackfillStoppedBy,
    oddsWriteError,
    upsertError,
    oddsQueryError,
    /* BUILD 166 — the number that was invisible. The league fetch took 20.4s of a 45s run and
       silently ate the odds budget; nothing in the response said so. Now every run reports it. */
    msLeagueFetch: tFetch,

    detailed,
    detailStoppedBy: stoppedBy,
    /* af-34 — reported, because build 129's `met` sat computed and unread for 119 builds while the
       app told users a number it had measured. A floor that cannot be seen from a run's response
       cannot be tuned from evidence, and this one is explicitly provisional. */
    detailQuotaFloor: DETAIL_QUOTA_FLOOR,
    detailRemainingToDo: Math.max(0, finished.length - detailed),
    detailQueryError: needDetailErr?.message ?? null,
    /* BUILD 175 — THE FIELD THAT WOULD HAVE CAUGHT THE DEADLOCK ON DAY ONE. `detailed: 0` with
       `detailStoppedBy: null` used to mean "nothing left to do"; it actually meant "nothing I can
       do", and no field told them apart. detailNoStats is that distinction: fixtures the provider
       answered with an empty statistics array. A large number here run after run, while `detailed`
       stays low, says the history has no statistics available and no amount of budget will change
       it. detailStampError is louder still — if that is set the rows were NOT pushed to the back of
       the queue and the deadlock is live again. */
    detailNoStats: noStats,
    detailStampError,
    /* BUILD 176 — the distinction build 175 was missing. `detailNoStats` now means ONLY "the
       provider answered and had nothing"; anything that failed is counted here instead and is not
       stamped, because a throttled call is not evidence about a fixture. If detailFetchFails is
       high while detailNoStats is low, the backlog is being rate limited rather than being empty —
       which is exactly what the first post-fix run turned out to be. */
    detailFetchFails: fetchFails,
    detailLastFetchFail: lastFetchFail,
    /* BUILD 182 — the injury pass, reported with the same distinctions the detail pass had to
       learn the hard way. injSeasonsDone counts league-seasons that ANSWERED; injFetchFails
       counts calls that did not happen and were therefore never stamped. injRowsWritten counts
       fixtures whose value actually CHANGED, so a quiet refresh reads 0 and that is health, not
       a stall — read injRefreshed beside it. injTypesSeen reports the provider's own vocabulary
       for `player.type`: the sweep only ever saw "Missing Fixture", and anything else is
       encoded with a `?` prefix rather than being counted as an outright absence. */
    injSeasonsDone,
    injRowsWritten,
    /* BUILD 184 — the provider repeats records. This counts what was dropped, because a
       dedupe that silently swallows everything looks identical to one that never fires. */
    injDupes,
    injRefreshed,
    injStoppedBy,
    injFetchFails,
    injLastFail,
    injTypesSeen: [...injTypesSeen],
    msInj,
    /* af-44 (WO-49) — THE BY-ID RE-READ, REPORTED IN FULL. `byIdSkipped` is set on every run that
       is not in the six-hour slot, so a reply that shows nothing happened always says WHY. A step
       whose cap and cost cannot be read from a run's response cannot be checked from evidence —
       af-34's own lesson about `detailQuotaFloor`. */
    byIdDue, byIdAsked, byIdRedated, byIdNowFinished, byIdCalls,
    byIdMaxCalls: BYID_MAX_CALLS,
    byIdEveryHours: BYID_EVERY_H,
    byIdSkipped,
    byIdError,
    quotaRemaining: remaining === Infinity ? null : remaining,
    issues,
    ms: Date.now() - t0,
  }, 200);
 } catch (e: any) {
   return json({ ok: false, step: "unhandled", error: String(e?.message ?? e), stack: e?.stack ?? null }, 500);
 }
});

/* == af-39 - A PREFLIGHT IS NOT A COLLECTION RUN ================================================
   MEASURED 2026-09-06, and it is the reason af-38's own measurement could not be read. This
   function had NO OPTIONS BRANCH AT ALL, so a browser preflight fell straight into the handler,
   `req.json()` threw on the empty body, `body` stayed `{}` - which is precisely what cron sends -
   and the preflight RAN THE ENTIRE COLLECTOR: fixtures, odds and detail, ninety seconds and a
   share of the day's API allowance, to answer a question the browser asks BEFORE it is allowed to
   send anything at all.

   It then replied with `access-control-allow-origin` and nothing else, because `json()` is written
   for real answers and a preflight is not one. A preflight for a request carrying `apikey`,
   `authorization` and `content-type` needs those NAMED in `access-control-allow-headers`, so the
   check failed, the browser refused to send the POST it was asking permission for, and the caller
   saw "Failed to fetch" - after ninety seconds of collection nobody asked for. Three of those sit
   in the invocation log for 2026-09-06 between 01:16 and 01:34, each one mine, each one logged as
   OPTIONS with no POST behind it.

   [!] CRON IS UNAFFECTED AND MUST STAY SO. Cron sends POST with no body; ONLY the OPTIONS method
   returns here, and an empty `{}` body goes on meaning "the normal run" exactly as before. The
   test that matters is that a POST with no body still collects.

   [!] AND IT IS A SEPARATE FUNCTION RATHER THAN A HEADER ADDED TO `json()`. A preflight answers
   with permissions and no payload; a real response answers with a payload. Folding the two would
   put `access-control-allow-headers` on every collector result, which is build 92's fault in
   miniature - a field carrying a meaning its name does not have. */
/* == af-43 (WO-03) - ONLY THE SCHEDULER MAY CALL THIS FUNCTION ==================================
   The public anon key satisfied the platform's JWT check and nothing in here checked anything else,
   so every mode (history backfills, probes, passfill) was open to anyone holding the key the app
   ships. The pg_cron job now sends `x-mm-secret`, read at run time from the Vault (`mm_cron_secret`,
   SQL ledger 2026-09-24), and every call without it is refused before the body is read, before any
   env beyond the secret, and before the database or the provider is touched. Unset env is 503. The
   same function sits in send-push.ts. */
function mmCronRefusal(req: Request): Response | null {
  const want = Deno.env.get("MM_CRON_SECRET") ?? "";
  const refuse = (status: number) => {
    console.warn("refused");
    return new Response(JSON.stringify({ ok: false }), { status, headers: { "content-type": "application/json" } });
  };
  if (!want) return refuse(503);
  const a = new TextEncoder().encode(req.headers.get("x-mm-secret") ?? "");
  const b = new TextEncoder().encode(want);
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a[i] ?? 0) ^ b[i];
  return diff === 0 ? null : refuse(401);
}
function preflight() {
  return new Response("ok", {
    status: 200,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "authorization, apikey, content-type, x-client-info",
      "access-control-max-age": "86400",
    },
  });
}
function json(o: any, status = 200) {
  if (o && typeof o === "object") { o.fn = FN_VERSION; o.ftColumns = FT_COLUMNS; }
  return new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}
