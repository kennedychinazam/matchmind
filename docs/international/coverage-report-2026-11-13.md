# International football coverage and admission research

Research date: 2026-11-13 UTC. Source baseline: `d624081f87cd441ea339ac8fdafcc72e2748c130`. Research only: no provider API requests, forecasts, production writes, subscriptions or model activation were made by this workstream.

## Decision

Separate fixture display from prediction admission. Display a verified fixture with its available approved football analysis even without a qualifying pick. Keep new international forecasting disabled pending independent validation and Director approval. A public coverage listing or a provider prediction flag is insufficient evidence to issue a MatchMind prediction.

Five API-Football competition identities are supported by current official provider articles below. Most requested competition IDs, season-specific flags and live fixture inventories remain unverified. This report deliberately leaves those cells unknown. It does not claim comprehensive live provider acceptance.

## Evidence limits and reproducibility

Started with the requested [v3 documentation](https://www.api-football.com/documentation-v3) and [coverage catalog](https://www.api-football.com/coverage/). The documentation page returned no readable lines through the research connector; indexed documentation sections and official provider tutorials supplied endpoint evidence. The coverage page reported an update of **2026-11-13**. Its extracted capability cells were empty: an empty extracted cell does not mean either supported or unsupported. The catalog exposes no usable ID/season registry in the extracted text.

Shell access to the catalog failed with proxy `CONNECT` HTTP 403. Public web research succeeded using the available web-search connector. No authenticated `/leagues`, `/fixtures`, `/teams`, `/odds` or account-status endpoint was called. Consequently, article samples below establish identifiers and documented behavior, not current API response contents or bookmaker availability. Source citations are sufficient to repeat the public research; a dated, authorized API capture is still required to close the unknown cells.

## Competition matrix

Legend: **U** = unverified, not false; **C** = listed in the official catalog, without a verified season or capability response; **E** = official provider article sample. **O/S/Q** = actual bookmaker odds / fixture statistics / confirmed national squad. Unless stated, O/S/Q are **U/U/U**. Ranking source **M** means FIFA men's official editions, **W** means FIFA women's editions; these are separate from the provider and are not ingested by this change. Youth and CHAN must not inherit senior ranking strength without validation.

| Competition family | Verified API-Football v3 ID | Verified API season evidence | Availability evidence | O/S/Q | Ranking source | Proposed admission |
|---|---:|---|---|---|---|---|
| World Cup, senior men | 1 | 2026 [P1] | E: schedule/team/detail examples; no live capture | U/U/U | M | Verified fixture display; predictions held |
| World Cup qualifying, Europe | 32 | 2024 [P2] | E: named England fixtures with IDs | U/U/U | M | Campaign-season discovery; predictions held |
| World Cup qualifying, Africa | U | U | C | U/U/U | M | Discover and verify first |
| World Cup qualifying, Asia | U | U | C | U/U/U | M | Discover; handle joint qualification stages |
| World Cup qualifying, CONCACAF | U | U | C | U/U/U | M | Discover; preserve stage/group |
| World Cup qualifying, Oceania | U | U | C | U/U/U | M | Discover; predictions held |
| World Cup qualifying, South America | U | U | C | U/U/U | M | Discover; avoid duplicate campaign imports |
| World Cup intercontinental play-offs | U | U | C | U/U/U | M | Discover; neutral/knockout checks |
| European Championship and qualifying | U / U | U / U | C | U/U/U | M | Discover separately; no legacy IDs |
| UEFA Nations League | 5 | 2018 only [P1] | E: historical H2H sample; current season U | U/U/U | M | Verify 2026/27 provider season before display |
| Africa Cup of Nations and qualifying | U / U | U / U | C | U/U/U | M | Discover separately |
| African Nations Championship and qualifying | U / U | U / U | C | U/U/U | Senior M contextual only | Distinct domestic-player cohort |
| Copa America | U | U | C | U/U/U | M | Discover; qualification route by edition |
| CONCACAF Gold Cup and qualifying | U / U | U / U | C | U/U/U | M | Discover; link Nations League qualification |
| CONCACAF Nations League | U | U | C | U/U/U | M | Discover; league/group/play-in distinctions |
| AFC Asian Cup and qualifying | U / U | U / U | C | U/U/U | M | Verify schedule revisions and edition |
| Other senior national tournaments | U | U | Catalog includes OFC, Arab, COSAFA, SAFF, regional events | U/U/U | M if applicable | Explicit cohort review; no blanket World-country inclusion |
| National-team friendlies | 10 | 2026 [P2] | E: England player/fixture examples | U/U/U | M or W, identity dependent | Display verified fixture; fresh real odds plus validation before picks |
| Club friendlies | 667 | U [P2] | E: identity distinguished from national friendlies | U/U/U | No FIFA national ranking | Actual bookmaker market and supporting data required; forecasting held |
| Women's World Cup and qualifiers | U | U | C | U/U/U | W | Separate gender-specific validation |
| Women's continental cups/qualifiers | U | U | C: UEFA/CAF/AFC/Copa families | U/U/U | W | Verify each competition-season independently |
| Women's Nations Leagues | U | U | C: UEFA/CONMEBOL | U/U/U | W | Independent rules and validation |
| Youth World Cups, men/women U17/U20 | U | U | C | U/U/U | No validated youth ranking feed | Separate age/sex cohort; no senior calibration |
| Continental youth tournaments/qualifiers | U | U | C: UEFA/AFC/CAF/CONCACAF/CONMEBOL | U/U/U | None verified | Verify team age identity and roster turnover |
| Olympics and qualification, men/women | U | U | C | U/U/U | Cohort dependent | Separate age/eligibility and neutral-venue validation |

The matrix's common cost rule is: existing approved cached records add no provider calls; discovery/enrichment requires an explicitly approved request budget. Every U cell remains a release blocker for that feature, rather than a promise of future coverage. Competition names alone cannot resolve gender, age class, team identity, or national versus club status.

**Primary ID evidence.** [P1: API-Football World Cup guide, 2026-04-13](https://www.api-football.com/news/post/fifa-world-cup-2026-guide-to-using-data-with-api-sports) explicitly identifies `1/2026`; its historical H2H sample identifies `5/2018`. It illustrates Belgium team ID `1` and an England/Croatia H2H using `10-3`. These are article examples, not a live participating-team audit. Its example capability object is conditional, not proof every fixture has data.

[P2: API-Football player-statistics guide, 2026-10-26](https://www.api-football.com/news/post/2026-ballon-dor-how-to-retrieve-podium-statistics-using-api-football) verifies `32/2024`, `10/2026` and club-friendlies ID `667`; it shows why calendar-year season guessing fails across national competitions. It also identifies England team ID `10` and qualifier fixture IDs such as `1323291`. No current kickoff or roster is inferred from those examples.

The [2019 Euro article](https://www.api-football.com/news/post/euro-championship-2020) gives `403` in its historical API context. It is **not** accepted as a v3 competition ID. MatchMind's old Football-Data World Cup `2000` and Euro `2018` identifiers are also not API-Football v3 mappings (`index.html`, migration commentary around `COMP_IDS`).

## Required inputs and proposed evidence rules

These are proposed requirements, not activated features or claims that an endpoint currently supplies them.

| Input | Authorized candidate source | Required metadata and completeness rule |
|---|---|---|
| FIFA rank, points, publication | [FIFA ranking hub](https://inside.fifa.com/fifa-rankings/world-ranking?os=win), official archived edition | Store rank **and** points, gender, edition publication date/time precision, source URL, retrieval time, immutable edition ID. Never use live unofficial ranking as an official edition. |
| Alternative team strength | [World Football Elo](https://eloratings.net/), or an independently validated internal rating | Permission and historical as-of dataset required before reuse. No machine-readable licensed feed verified here. Keep source/model versions separate from FIFA. |
| Recent national form and opposition | API-Football dated fixtures plus verified rating snapshots | Join by provider team ID and cohort across competitions; retain outcome/90-minute score and opposition rating **as known before** kickoff. Sparse form is missing data, not league-average certainty. |
| H2H | API-Football historical H2H | Preserve dates, age/sex cohort, venue and match class; old meetings receive no automatic predictive weight. |
| Home/away/neutral | Fixture venue plus organizer confirmation | Listed home side does not prove home advantage. Store explicit neutral flag with evidence, actual venue and host country; unknown stays null. |
| Squad/available players/injuries/suspensions | Organizer and national association announcements; conditional provider injury/squad endpoints | Current registered squad is not a confirmed call-up or eligible match squad. Track announcement/replacement dates and competition-specific suspensions. Unknown injury report is not full availability. |
| Confirmed XI | Organizer/team release and provider fixture lineups | Store confirmed flag and announcement/capture time; reject retrospective XI in historical training. Unavailable XI must not be guessed. |
| Club player form/minutes | Conditional provider player and fixture statistics | Stable player IDs; league-season/date-specific minutes, position and source freshness. Cross-club/cross-season aggregation requires a defined window and missingness audit. |
| Manager/tactics | National association appointment/release and official match lineups | Record appointment effective date and observed formations. No invented tactical narrative or causal adjustment. |
| Travel/rest/location | Verified fixture calendar, actual venues, squad call-up itinerary when published | Compute rest from timestamps; venue distance is a proxy, not actual player travel. Record timezone/altitude evidence if used; unknown itinerary stays missing. |
| Tournament format/importance | Current organizer regulations, groups and qualification tables | Version rules per edition; distinguish group progression, aggregate ties, extra time and 90-minute betting outcome. No subjective must-win multiplier without validation. |
| Goal/defensive trends | Verified regulation-time results and conditional fixture statistics | Exclude extra-time/shootout goals from 90-minute training target. Use national cohort/opposition/venue adjustment; club standings are not national-team form. |
| Historical/current bookmaker prices | Authorized provider pre-match odds and already-retained snapshots | Require named bookmaker, market/outcome/line, decimal price >1, quoted_at/captured_at, fixture ID and settlement rules. Null is missing, never zero; retain overround and source. |
| Quality/freshness/licensing/cost | Capture receipts, provider coverage response, rights records and quota budget | Reject partial pagination, API errors, stale timestamps, uncertain identity, unsupported rights or exhausted budget. Distinguish unsupported coverage from not-yet-published data. |

**Ranking dates observed.** The official FIFA indexed hub and association pages retrieved on 2026-11-13 identify the men's last official edition as **2026-10-07** (next announced 2026-11-18), and women's as **2026-10-20** (next announced 2026-12-07). The direct hub extraction omitted these fields; the [official England association page](https://inside.fifa.com/associations/ENG) independently surfaced the dates. No exact UTC publication clock-time or complete rank/points table was retrieved. Therefore no ranking dataset is certified as current or ready for ingestion. Preserve date-only precision, not a fabricated midnight timestamp. Before admission, capture the full official edition and establish its exact available timestamp. FIFA's [men's procedure](https://inside.fifa.com/fifa-rankings/world-ranking/procedure-men) and [SUM specification](https://img.fifa.com/image/upload/edbm045h0udbwkqew35a.pdf) explain opponent/match-importance dependence; a ranking is a strength feature, not a result probability.

## Official organizer cross-checks

These sources corroborate competition context; they are not API-Football ID registries or blanket licenses for automated collection.

- [UEFA Nations League fixtures, updated November 2026](https://www.uefa.com/uefanationsleague/news/02a2-1fea18abbcbc-456e846509e7-1000--2026-27-uefa-nations-league-all-the-league-phase-fixtures-a/) confirms the 2026/27 league phase and current fixture context. Its existence does not verify the API's 2026 season key.
- [CAF's CHAN eligibility explanation](https://www.cafonline.com/caf-african-nations-championship/news/rising-stars-making-their-mark-at-totalenergies-chan-2024/) confirms domestic-league player eligibility. CHAN is a different squad-strength problem from unrestricted senior internationals.
- [CONCACAF November schedule](https://www.concacaf.com/competitions/nations-league/news/2026-27-concacaf-nations-league-november-schedule-confirmed) and [qualification pathway](https://www.concacaf.com/news/2027-concacaf-gold-cup-qualification-pathway-confirmed) connect the 2026/27 Nations League with 2027 Gold Cup admission. Preserve league, group, quarterfinal and play-in context.
- [AFC Asian Cup schedule revision](https://www.the-afc.com/en/national/afc_asian_cup.html/news/important-update-afc-asian-cup-saudi-arabia-2027%E2%84%A2) moves the named 2027 edition to 2027-12-23 through 2028-01-21, superseding older January/February schedule articles. Verify source publication/version and provider update before accepting kickoff dates; edition name is not the season or calendar-year rule.
- [CONMEBOL official final 2026 World Cup qualifier schedule](https://cdn.conmebol.com/wp-content/uploads/2025/07/Eliminatorias-FWC2026-%E2%80%93-Calendario-de-Partidos_Jornadas-17-y-18_v1.pdf) is a dated calendar with local/GMT venues and times. [Women's Copa America 2025 regulations](https://cdn.conmebol.com/wp-content/uploads/2024/12/CONMEBOL-Copa-America-Femenina-2025-Reglamento_20250307.pdf) illustrate edition-specific qualification rules. Do not invent a separate men's Copa qualifier where the organizer has not established one.

## Discovery and bounded publishing proposal

1. Accept a private, authorized `/leagues` capture with capture timestamp, provider version, returned competition ID/name/type and **each returned season's** start/end/current flag and capabilities. Do not fetch during public navigation, assume `new Date().getFullYear()`, or select `current=true` blindly: multi-year campaigns can retain older season keys.
2. Match candidates to an explicit reviewed competition/cohort registry. Country `World`, name regexes or a positive provider `predictions` flag alone cannot admit a competition. Verify national team identity, sex and age class independently; clubs and national teams must never share ratings merely because names match.
3. Verify complete fixture/team responses for that ID-season and requested date window, with exact fixture IDs, genuine names, UTC kickoff, status, source update, stage/group and validated crest URL. Postponed/TBD fixtures must remain truthful. Use approved provider crests when available; flags require an approved identity mapping, not guessed country codes.
4. Publish a closed, capped display projection with provenance and source timestamps through the existing private publisher/staging mirror. Preserve every already-issued prediction byte/identity/probability. Empty pick is not empty football analysis. No direct provider traffic, personal keys, new public raw readers, or unpublished model values labeled as locked predictions.
5. Friendlies may be displayed as verified fixtures; **prediction** admission additionally requires actual fresh bookmaker prices and reliable supporting inputs. A coverage flag, empty odds response, fabricated quote or provider statistical forecast cannot satisfy this rule.
6. Fail closed on unverified metadata, expired evidence, mismatched identities, missing pages or exceeded caps. Retain the last verified staging edition and separate all international forecast experiments from public UI deployment.

## Existing MatchMind support and gaps

Observed in this baseline, not inferred from deployment:

| Source path/function | Existing support | International gap / required adjustment |
|---|---|---|
| `index.html`: `COMP_IDS`, `LEAGUE_UNFITTED`, `predictsComp()` | Explicit competition inventory plus domestic division exclusions | No national-team cohort admission. A new ID falls through a permissive scope rule; do not add international IDs to this prediction set. |
| `footballEngine.predict()`, `strengths()`, `neutral()`, `marketsFor()` | Opponent-adjusted goal model, home/away strength, goal markets; unknown-team shrinkage | `neutral()` is the league-average baseline, **not** a neutral venue switch. Sparse national samples, roster turnover, cross-confederation graph and actual neutral venues need dedicated validation. |
| `TUNE`, `DAMPEN_BY_LEAGUE`, `gateBarFor()`, `gateEdgeFor()`, `autoGate()` | Existing domestic fits, fallback constants and publication gates | Unfitted fallback is not evidence of international calibration; preserve all current constants and thresholds. Existing 15-match engine and 150-match measurement counts do not establish national-team adequacy. |
| `xcAdjust()` and concurrent domestic records | Existing club cup strength adjustment | Club concurrent standings/league form do not directly represent national-team strength; do not reuse this adjustment for national teams. |
| `staging/mirror/refresh.mjs`, `backend/fixture-delivery/contract.mjs` | API-Football-first, fixed-host GET-only source capture; bounded cards and immutable prediction projection | Can display already-collected verified fixtures without generating forecasts. Baseline card contract lacks season/round/group/national cohort/ranking provenance. Expand only with reviewed source-backed fields; no raw JSON pass-through. |
| `robot/publish.mjs` | Protected existing publisher with issued-record workflow | Keep its forecasting and immutable history unchanged. New national forecasting must be an isolated private experiment, never a visitor API-key flow. |
| `backend/fixture-delivery/refresh-af-v54-presentation.patch` | Proposed post-collection presentation refresh hook | Full deployed collector is absent from this checkout. Its discovery/season handling and provider budget cannot be certified here; independent deployed-source review is required before collector changes. |

The baseline preview mirror uses up to 1,000 cards and 512 KiB, verifies two source reads, and retains isolated staging editions. These bounds must remain effective when international metadata is added. The baseline board includes only approved fields; a domestic fallback must not silently activate because a fixture now appears in Scores or Analysis.

## Request costs, freshness and rights

The [official pricing page](https://www.api-football.com/pricing) lists Free 100 requests/day, Pro USD19/month with 7,500/day, Ultra USD29 with 75,000/day, and Mega USD39 with 150,000/day. These are public advertised terms, not the account's verified contract. Confirm actual plan, historical access and rate limits privately before any calls. The [October 2026 import guide](https://www.api-football.com/news/post/how-to-get-all-data-from-a-league-with-api-football) states Free plan season/page restrictions; do not assume Free can retrieve the current season or a complete historical player dataset. Current squad output is not historical roster evidence.

The [odds documentation](https://www.api-football.com/documentation-v3#tag/Odds-(Pre-Match)) describes a seven-day history window, ten results per page, approximately 1–14 days of pre-match availability and three-hour updates. These are provider indications, not guaranteed fixture availability. Historical model/closing-price tests require legitimately retained snapshots or a separately authorized historical odds source; missing old prices cannot be reconstructed by invention. The [provider beginner guide](https://www.api-football.com/news/post/how-to-get-started-with-api-football-the-complete-beginners-guide) describes lineups typically appearing 30–60 minutes pre-kickoff and conditional injury coverage. Do not poll every visitor or every fixture indiscriminately.

Proposed **budget estimate**, not measured usage: one daily metadata capture + two inventory captures per admitted competition + paginated odds every three hours + one complete team/squad bootstrap + limited pre-match detail refresh. For 20 competitions with 40 unique teams and ten active fixtures, a sample day could cost `1 + 2*20 + 40 + 8*ceil(10/10) + 2*10 = 109` requests **before** historical backfill, pagination, player forms, injuries or retries. Do not treat this illustration as a production quota. Record actual response-page counts, cap concurrency/retries, reuse team data, and stop before the approved per-day reserve is consumed. Backfill requires a separate estimate and explicit authorization.

The [provider terms](https://www.api-football.com/terms) do not grant competition commercial/publication rights; third-party data and visual rights may require authorization, and direct data resale is restricted. Organizer public pages are corroboration sources, not authorization to scrape or redistribute. Preserve MatchMind's existing rights controls; obtain the relevant evidence before expanding public datasets. No provider account, balance, key or paid generation was accessed.

## Proposed validation before any international predictions

This is a proposed protocol requiring approval and preregistration, not a claim of measured improvement.

1. Build immutable as-of datasets split by senior men, senior women, youth age/sex, CHAN and club friendlies. Audit identities, 90-minute targets, actual neutral venues, squad dates, ranking editions, missingness and source rights. Never overwrite historical forecasts or settlement decisions.
2. Use rolling-origin training by date, keeping whole tournament editions and international windows together. Hold out later editions and at least one cross-confederation setting. Keep a final untouched test set and publish its cohort counts/coverage before model selection. Prevent future ranking/roster/lineup/odds leakage.
3. Compare prespecified baselines: approved de-vig bookmaker 1X2 where genuinely captured, a simple validated rating-only model, and separately fitted goal models with a neutral-venue parameter. Domestic calibration may be reported as a comparison only. Candidate strength pooling must handle weakly connected opponents and rare fixtures explicitly.
4. Assess proper scoring rules (multiclass log loss and Brier), reliability diagrams with uncertainty, high-confidence bands, draws, neutral venues, tournament stage, confederation, favorites/underdogs and each missingness stratum. Evaluate goals, DNB conditional probabilities and each market separately; keep unconditional 1X2 probabilities distinct from DNB's conditional win probability.
5. Estimate uncertainty by resampling international windows/tournaments rather than treating correlated fixtures as independent. Prespecify a sample-size/power analysis and the acceptance margin before opening held-out results. Small cohorts stay disabled; do not pick an arbitrary minimum count after seeing performance.
6. Validate the **existing** publication thresholds on international holdouts; do not lower thresholds to increase coverage. Report price freshness, overround, source completeness, valid-price sample count and closing-line analysis only where retained prices exist. No fabricated backtest odds or profitability claim.
7. Run private prospective shadow predictions, with immutable time-stamped candidates and no official issue, settlement ledger activation or public claims. Independent reviewer checks feature provenance, calibration, code, data leakage and admission rules. Activation requires a separate Director decision, bounded rollout and rollback evidence.

## Remaining decisions and unclosed acceptance

- Director authorization for a bounded private metadata/fixture/team/odds request budget, or an existing timestamped authorized export, is needed to verify the remaining actual IDs, seasons, per-fixture odds and capabilities. No new paid requests are implied by this research.
- Confirm exact provider plan/rate limits, redistribution rights and historic-data access privately.
- Obtain complete official FIFA rank/points editions with publication precision and licensed historical as-of ratings if used.
- Review the deployed private collector separately; it is not fully present here. Do not modify private master or production as part of this deliverable.
- Approve and preregister validation protocol and later review results before enabling any new international predictions. Fixture display work can proceed independently for already-verified existing records.
- Independent review of this report and the isolated display implementation is still required. No claim of hosted international-fixture acceptance, live odds coverage, Samsung hardware acceptance, or model validation is made by this research workstream.
