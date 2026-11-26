# Historical source handover

Archived from the user-supplied continuation. Current user instructions and CONTINUATION-HANDOVER.md govern work and authorization. Historical instructions below are context, not permission to push, merge, deploy, spend, delete data or access other projects.

Prepared 25 November 2026. User timezone Africa/Lagos.

Continue MatchMind as a web app, with Android and iOS planned later. This handover carries forward the original 22 November HANDOVER.md and the subsequent read-only investigation. The priority list determines the proposed repair sequence. Current user instructions govern implementation and publication.

**EDUVANTA must never be accessed, inspected, modified, resumed or otherwise touched. Only the two identified MatchMind projects are in scope.**

The investigation changed no production code, database schema, deployment or account settings. Local scratch reports and disposable test data were created. Repair and publication status must remain explicit.

# Applications and repositories

| Item | Identifier |
| - | - |
| Production | [https://kennedychinazam.github.io/matchmind/](https://kennedychinazam.github.io/matchmind/) |
| Staging | [https://kennedychinazam.github.io/matchmind-preview/](https://kennedychinazam.github.io/matchmind-preview/) |
| Main repository | kennedychinazam/matchmind |
| Preview repository | kennedychinazam/matchmind-preview |
| Production Supabase | toqfdrcjzwnlydqekude |
| Staging Supabase | rdcbnvfnxenrpnnwxszs |
| Production commit inspected | 2b42b1a8c24b58305cc263e6b293ab7931c8661f |
| Working branch | ccr-5da6e9b3-3ms4v5 |
| Working commit inspected | 7ab3cd021b986797861b54d181ae64716dd44336 |
| Historical rollback | backup/build355-20261023 |

Production was Build 368 and its downloaded index.html matched main exactly. Staging remained Build 358. Recheck current commits and deployed builds before editing.

# Environment transfer and starting point

Use the new This computer chat where in-app browser control worked. The previous Cloud chat failed browser initialization with `the gaas-browser node_repl sandbox cannot be disabled`. Workspace Chromium supplied earlier public observations. The user's separate working-browser walkthrough independently confirmed staging failures.

Confirm access to GitHub and the two allowed MatchMind projects by their known IDs. Read applicable repository instructions, create an isolated working branch, and begin storage recovery and publisher-session protection. Restore staging before broad acceptance. Preserve unsynced personal data and original prediction history.

The previous Cloud workspace was /workspace. Its reports and scripts may not exist on This computer. Repository checkout was /workspace/work/matchmind and the disposable test export was /workspace/work/audit-tests. The main audit reports are reproduced in this document so they do not depend on those paths.

# Context from the original handover

Builds 358–359 restricted anonymous raw-table access and fixed reconstructed-pick loading. Build 361 restored match panels through a context RPC. Builds 360, 362 and 364 introduced Strong, Lean and no-call tiers. Build 365 expanded international coverage and introduced cross-competition ratings. Build 366 corrected recent goals calibration. Build 367 improved odds collection and Slip Generator delivery. Build 368 made Tips markets independent and removed Under 2.5 and BTTS No from new selections. Historical grading for removed markets must remain supported.

Main auto-publishes through GitHub Pages. Supabase edge functions deploy separately. API-Football supplies source data. The robot opens the production client and uses its engine. It runs at 23:17, 05:17 and 17:17 UTC, corresponding to 00:17 next day, 06:17 and 18:17 Lagos.

Public data uses matchmind_display_v1, matchmind_history_v1, matchmind_leans_v1, matchmind_odds_v1 and matchmind_match_context_v1. Editions refresh approximately every five minutes. Edge versions inspected were refresh-af 58, ai-analyze 17, delete-account 2, send-push 9 and ai-shadow 2.

Original open work included verifying the 22 November 17:17 UTC issuance, MLS calibration, UCL/UECL future eligibility, diagnostic branches, Goals/BTTS future lookahead, authenticated AI verification and collector headroom. Preserve honest historical No pick states. UCL and Conference League Strong caps should remain until evidence supports promotion. The original statement that preview refresh was adequate is superseded by the confirmed broken reader described below.

# Additional staging walkthrough findings

A separate This computer walkthrough on 25 November confirmed Build 358, repeated HTTP 500 from mm_preview_display_v3 and HTTP 200 from mm_preview_status_v1. Failed loads produced zero-competition and no-fixtures messages. Match details were inaccessible, and date-picker behaviour remains unconfirmed.

Additional findings extend the existing priority items. Guest privacy statements conflict with disclosures of IP transmission to hosting/font/library providers. Privacy and Contact overstate what Clear cached data removes. slipOdds and riskSlider lack programmatic labels. Market tabs lack selected/pressed accessibility state. Responsible-play resources are plain text rather than actionable links. Operator/contact placeholders were independently confirmed in both staging and production. Verify the other newly observed Build 358 defects against current production before applying fixes.

# Verification and limits

All 39 isolated account-ownership and navigation tests passed. The enabled PWA lifecycle test failed before browser execution because its expected worker hash and Build 358 assumptions are stale. No complete independent historical regrading, production exploit test, actual push-delivery test, destructive account test or authenticated AI-generation test was performed. Real Android/iOS hardware and native packaging remain unverified.

Read the original HANDOVER.md with this continuation. Its historical suggestions are context, and current user instructions determine authorized actions.

# S20 Ultra startup/storage investigation — 25 November 2026

Read-only source trace and isolated Node VM reproduction using exact deployed preserveLegacy/personalSelect functions. No access to the user's physical phone storage. EDUVANTA excluded.

Screenshots show Build368 personal storage unavailable/sync paused, shared record unavailable while Lean record exists, Sample data/empty Tips, and Storage full toast.

Confirmed source findings

- index.html24866 personalSelect calls preserveLegacy before reading the owner partition. preserveLegacy24875 copies entire old mm_state into mm_state_UNASSIGNED. This may require temporary duplication of a large historical cache. Existing different backup throws Unassigned legacy backup already exists even with free storage. Corrupt owner JSON or blocked localStorage also fail selection.

- Isolated reproduction confirmed quota failure, conflicting legacy backup, and malformed owner JSON all emit the same Personal data could not be read; sync is paused and leave \_personalReady=false. Healthy case succeeds. Evidence storage-repro.cjs. Exact phone root cause remains unconfirmed without error name and storage-key size inventory from the device.

- saveState24903 catches every error and labels first failure Storage full. It sets \_personalReady=false even when optional cache persistence fails. personalStore relies on personalToken, which requires ready=true. Subsequent saveState calls cannot self-recover from this state. cloudPullMerge25008 returns early when personalCurrent fails, so local failure prevents cloud recovery. Correct isolation of account ownership must be retained while enabling explicit recovery.

- Clear cached data26180 clears in-memory structures then calls saveState, which can fail in the same paused state, but unconditionally says Cached data cleared and reloads. It does not remove the offending legacy/backup keys. Therefore it is not a reliable remedy for these cases.

- loadSharedRecords22832 catches unavailable Supabase, RPC/display validation and account-change failures and discards previous record. fixtureTable3356 routes ordinary public record reads through bounded display RPC; cannot assert it is the same obsolete raw read as staging. Successful header/Lean read does not prove records screen read succeeded.

- Sample data initial header plus no fixtures is consistent with unhydrated or failed public loading. Screenshots alone cannot distinguish slow network, expired session, rejected edition or interrupted boot. No evidence S20 hardware itself is faulty.

Recommended repair\
Collect safe local diagnostics (error type, key names/byte counts, migration stage, request status) without credentials or personal contents. Preserve old owner/legacy data before any removal. Make migration idempotent and avoid copying entire football cache to preserve small personal data. Store bulk football cache in bounded IndexedDB, retaining small account preferences in localStorage. Separate optional cache failure from personal partition availability. Provide explicit retry after proven storage availability and completed migration. Render specific quota, unavailable storage, corrupt data and migration conflict messages. Fix Clear action to remove only regenerable keys, verify removal and truthfully report success. Public scores/records load independently of personal-sync failure, retain last successful record with timestamp and stale label where appropriate.

Do not recommend browser clear-all/uninstall as initial recovery while sync is paused, because unsynced favourites may exist only locally. More free disk or cloud database upgrade does not establish a fix for browser quota or migration conflict.

# MatchMind database capacity — 25 November 2026

Strict read-only aggregate/catalog queries against only production toqfdrcjzwnlydqekude and staging rdcbnvfnxenrpnnwxszs. EDUVANTA not queried or listed.

pg_database_size production417213587 bytes (417.2 decimal MB/397.9MiB), staging18192051 bytes (18.2MB/17.35MiB). Screenshot432/500MB is86.4% with68MB shown headroom at screenshot time. Live postgres physical metric, timing and dashboard billing metric differ; do not attribute exact org total or infer EDUVANTA usage.

Production top relations inclusive indexes/TOAST: fixtures245383168 bytes (245.4MB); odds_snapshots116170752 (116.2MB); cron.job_run_details33153024 (33.2MB). Combined394.7MB \~94.6% database. Public editions2.52MB, match_analysis1.11MB, predictions0.92MB, retired predictions0.67MB, app_state0.36MB. Actual forecast archive is a small contributor.

Fixtures137822 rows spanning2013-06-23 through2027-06-06. Main heap139.5MB indexes33.8MB remainder largely TOAST/auxiliary. JSON lineups average925 bytes summed where present, events845 bytes where present. Dead tuple estimate19805 with recent autovacuum; does not quantify reclaimable bloat.\
Odds55693 snapshots since2026-08-15;7913 inserted last7days. Average prices703 bytes, htft253, correct-score711 where nonnull. Source collector inserts snapshots, no snapshot retention deletion found in inspected collector. Need retention preserving original/open/close pricing, CLV and research provenance. Historical inserted rows support ongoing accumulation; no exact whole database growth forecast from one size snapshot.\
Cron50276 runs since2026-07-25,36127 older than30days,4190 last7days. Five cron schedules three/10min, display/5min, daily digest. No dedicated cleanup cron listed. Cron history offers first reviewable cleanup candidate after retaining incident evidence. Do not claim DELETE immediately shrinks allocated DB files; ordinary vacuum reuses free space, physical shrinking may require locking rewrite or planned alternative.\
Staging largest relation mirror editions5.32MB; total18.2MB so production is main concern.

Recommended sequence set usage alerts/retention policy; preserve required audit data; bounded cron retention first; design compact odds archive/open-close preservation and capped detailed snapshots; assess optional old fixture JSON against engine/form/scorer dependencies; measure bloat/index workload before maintenance. Preserve original picks/results and needed training history. Capacity upgrade may supply headroom but is separate from phone localStorage and needs explicit choice. No deletes/vacuum/plan changes executed.

# Independent priority review

25 November 2026. Read-only local review of the six saved specialist audits plus the parent's latest phone code trace and two MatchMind database measurements. EDUVANTA was excluded. This review makes no production changes and does not certify fixes.

## Ordering decision

Start with the user's demonstrated storage/sync failure and protect the publisher session in parallel. Restore a trustworthy staging path and release tests before shipping broad repairs. Database capacity belongs in the first batch because production has limited headroom, but the available numbers do not show that database storage has reached its limit. Do not diagnose the S20 warning as a Supabase capacity error. The warning originates in browser persistence code and can be emitted for exceptions unrelated to quota.

Security containment can be a small reviewed change while the storage repair is built. A strict serial order should not delay a readily contained high-impact risk behind a long migration. The numbered order below is an implementation queue, with dependencies noted. All work remains proposed until implementation is authorized.

## Consolidated ordered backlog

| Order | Priority | Work item and included queries | Reason and acceptance evidence |
| - | - | - | - |
| 1 | P1 current user failure | S20 personal storage, legacy migration and sync recovery. Trace quota, malformed data, conflicting UNASSIGNED backup, failed writes, and sticky personalReady=false. Preserve unsynced favourites and owner separation. | Reproduced screenshots establish user impact. Exact on-device exception still unknown. Test upgrade with realistic old caches, near-quota storage, corrupt partitions and existing backup conflict. Error type must be accurate. Successful recovery must re-enable sync without discarding data. |
| 2 | P1 security containment | Publisher browser-profile cache and privileged session retention. Review caches/sessions, stop retaining credential-bearing storage, maintain per-run secret-based authentication. | High potential impact, cache access preconditions apply. No theft demonstrated. Verify sanitized cache and publisher access without retrieving/distributing tokens. Can proceed alongside item1. |
| 3 | P1 deployment prerequisite | Repair preview reader's HTTP401 through an approved projection/scoped reader; restore fresh staging. Repair stale PWA test baseline and bind release tests to deployed artifact/hash. | Current staging is expired, latest runs fail after tests. The repair must preserve revoked anonymous raw access. Fresh preview and acceptance are needed for broad subsequent changes. Local isolated tests can support urgent containment. |
| 4 | P1 capacity prevention | MatchMind database budget and retention plan. Measure fixtures, odds snapshots and cron history growth, data/index/TOAST/dead tuple components, snapshot retention and archive dependency. | Parent measured production417.2MB, staging18.2MB; largest production relations245.4MB fixtures,116.2MB odds snapshots,33.2MB cron logs. These are current sizes, not growth rates or all reclaimable space. Preserve prediction/history/calibration evidence. No blanket deletion or automatic expensive rewrite. Establish trend, headroom and alert threshold before choosing cleanup or plan upgrade. |
| 5 | P1 data security | Server-bound AI fixture prompts/cache provenance and atomic quota reservation/deduplication. | Ordinary signed-in caller can influence uncached shared analysis; concurrency can undercount paid usage. Test with synthetic fixtures/providers, ensuring no unrelated shared cache overwrite and no concurrent quota overrun. |
| 6 | P1 record integrity | Strong prediction server-side pre-kickoff insertion, server issuance time, immutable published fields and precise update scopes. | Current permission architecture leaves authorized-publisher timing gaps;42 recent rows show no stored late issuance. Test old row compatibility and every publisher path without rewriting history. |
| 7 | P1 privacy and recovery | Transactional/recoverable deletion, push subscription orphan prevention, honest partial-result responses, device-copy/session lifecycle. | Cleanup failures can precede successful auth deletion and prevent retry. Validate injected partial failures on isolated accounts, completed state and retained-data disclosure. |
| 8 | P1 availability | Edition validation diagnostics, rejected-payload provenance, publication/collector monitoring and request deadlines. | 28 refresh failures and145-minute success gap occurred below outer payload bounds. Recover exact nested validation reason; validate downstream calls as well as cron enqueue. No blind limit increase. |
| 9 | P1 public startup | Public edition/record loading, retry and stale states. Address Sample data, empty fixtures, shared-record failure, per-resource hydration and foreground/network recovery. | User screenshots show public failure alongside personal errors. Separate causal paths; fixtureTable routes ordinary users through bounded RPC. Keep last-known data with explicit age when policy allows, avoid false final empties. |
| 10 | P1 probability correctness | DNB slip full payout/reduced payout/refund/loss probabilities, independence disclosure, consistent payout interpretation. | Source-confirmed wrong headline interpretation. Test exact outcome enumeration including several voids. |
| 11 | P1 prediction clarity | Unified Strong/Lean/informational/withheld state across list, hero, market panel and narrative, including no-pick floor reason. | Contradictory70%Lean and below65% explanation observed. Verify all supported loading orders and competition gates. |
| 12 | P2 result correctness | Original kickoff missing-time policy, postponement48-hour rules, extra-time/penalty90-minute provenance, numeric validity, stale/equal-time conflicting scores, match-context extra-time fallback. | Source-confirmed edge paths affect record trust; production affected counts remain unknown. Use settlement truth table and independent sampled outcomes. Preserve removed-market historical grading. |
| 13 | P2 publication completeness | Robot eligible-artifact reconciliation, Lean association, Tips outputs, exact live build check, metadata/read-back and nonfatal coverage warnings. | Successful robot run does not prove all required artifacts exist. Accept legitimate zero-eligible days and ensure missed eligible outputs fail clearly. |
| 14 | P2 exposure boundary | Review match-context competition-wide60-month export, arbitrary existing fixture access, response/query bounds and data-license fit. | Bounded endpoint still exports substantial provider data. Determine actual product need; preserve required form/standings if narrowing. No license breach was established. |
| 15 | P2 confidential diagnostics | Remove future disclosure route in diagnostic output/optional public branch; inspect stale branches' purpose and history exposure. | Existing diag-results/picks branches and diagnostic route remain. Deleting branch alone does not purge historical public copies. Any destructive cleanup needs its own concrete review. |
| 16 | P2 browser durability | Service-worker app-specific cache namespace, successful GET-only cache writes, worker-lifetime handling, offline snapshot expiry/recovery and scoped notification destinations/window reuse. | Cross-app cache deletion and error-shell caching are deterministic risks; offline fixtures failed. Verify production/preview isolation under same origin and update/rollback acceptance. |
| 17 | P2 user-facing state | Goals/BTTS today/yesterday false empties, strongest-read market/scope labels, Scores vs Tips inventory counts, fixture date bucketing, saved result metadata preservation and settlement hydration. | Multiple confirmed misleading states. Compare same fixtures/date/timezone across views, distinguish deliberate coverage from dropped data. |
| 18 | P2 account usability | Password recovery and authenticated journeys, labelled email/password/timezone fields, deep-link recovery, leaked-password protection. | Recovery UI absent and inputs unlabeled. Validate reset/session lifecycle on isolated users and target mobile browsers. |
| 19 | P2 accessibility/navigation | Keyboard favourite stars and competition options, unique legal link names, tab-scroll affordance, text scaling, contrast measurement and complete screen-reader traversal. | Enter works for search/accordions, so focus on actual gaps. Test S20 text scaling and narrow layouts without inferring all controls are broken. |
| 20 | P2 generator boundaries | Explain target mode's leg-count override, maximum risk advice, unreachable targets, partial odds, market eligibility and price timestamp/source. | 20 legs can appear despite12 visible choices; raise-risk instruction appears at99%. Verify min/max inputs and output constraints. |
| 21 | P2 legal/support | Real operator/controller identity, monitored support/privacy contact and accurate data lifecycle wording. | Public placeholders alongside signup impede support and privacy requests. Needs owner factual input. Can be prepared concurrently with technical repairs. |
| 22 | P2 research assurance | Reproducible backtest export/hash/cutoff, untouched prospective evaluation, same-day kickoff chronology and stable fixture matching, ROI denominator and accuracy/profit distinction. | Existing tuning uses reported evaluation windows and scratch data dependencies. Do not claim observed leakage without proof. |
| 23 | P2 model calibration | MLS overclaim recalibration and prospective monitoring; UCL/UECL caps remain until evidence supports promotion; audit XR name keys, ID collisions, inactivity decay, neutral/host rules and corrected-history assumptions. | Model tuning follows trustworthy evaluation and settlement inputs. No urgency to lift functioning safety gates. |
| 24 | P2 narrative and risk wording | Correct deterministic vs cached AI attribution, probability availability, step-stake simulation labels, conditional correct-score wording and evidence limits. | Professional AI label currently appears for signed-out deterministic text. Avoid implying guaranteed outcomes or prospective profitability. |
| 25 | P2 dependency/security hardening | Exact dependency pins/locks, CSP, Actions runtime updates, dedicated-origin strategy, advisory review of pg_net schema, RLS init plans/permissive policies and meaningful keys/indexes. | Source/metadata risks and performance advisories need measured validation. Unused index notice is insufficient basis to drop it. Dedicated origin migration must preserve local data and auth links. |
| 26 | P3 product completion | Goals/BTTS next3/7-day lookahead, pending signed-in AI verification, notifications delivery verification and consistent meaningful offline contract. | Feature extension follows reliability and data integrity. Authenticated read/write tests require appropriate isolated accounts and user authorization for any consequential action. |
| 27 | P3 brand/domain decision | Select distinctive name, confirm registrar eligibility/pricing and trademark/app-store conflicts; reserve chosen domains only after approval. | Direct MatchMind/MatchMind Pro conflicts are established. RDAP404 shortlist is preliminary availability. Start decision in parallel to avoid rework, apply branding after core reliability scope is stable and before store packaging. |
| 28 | P3 maintainability/polish | Incremental source separation, tracked dependency cleanup, clear release provenance, metadata description/h1, record discoverability, search coverage wording and desktop layout polish. | Avoid disruptive rewrite solely because the file is large. Some copy fixes can accompany related earlier repairs. |
| 29 | Release gate | Real Android/iOS device acceptance, installation, safe areas/keyboard, system Back, deep links, foreground/background, push permissions/destinations and erasure flows; then native packaging/store submission. | Last release gate depends on stable storage, auth, records, branding and legal content. A wrapper cannot substitute for fixing current web behaviour. |

## Critical qualifications

The dashboard432/500MB screenshot describes hosted database usage. The phone toast is emitted by local browser code and does not prove that either phone disk or Supabase is full. A conflicting legacy backup can trigger the same generic Storage full toast. Exact on-device storage bytes and thrown exception remain unobserved.

Database row counts, physical relation size and reclaimable disk are different measurements. The two current database sizes must not be summed and asserted to be the dashboard's exact billed metric without checking its quota definition and observation time. No EDUVANTA inspection is needed to establish MatchMind's own leading consumers.

39 isolated account/navigation tests passed, but those fixtures do not cover every legacy migration/quota failure. Preserve that positive evidence while adding the missing scenarios.

Repair order prioritizes existing user interruption and irreversible/security consequences before feature expansion. Staging is a dependency for broad verification, not a reason to delay bounded emergency containment. Database cleanup is proposed maintenance; the read-only investigation has performed no deletes, vacuum, migration or upgrade.

## Additional evidence supplied after initial ordering

The coordinating reviewer ran the actual preservation/selection functions in an isolated VM. Quota failure, a different existing UNASSIGNED backup despite free space, and malformed owner JSON each reproduced sync-paused behaviour. A healthy control passed. This upgrades the code-path diagnosis to reproduced failure modes while the exact S20 trigger remains unmeasured. The generic saveState error additionally leaves personalReady false, and subsequent personalStore calls can reject until a later successful personalSelect, making recovery a first-order requirement.

Aggregate production counts are137,822 fixtures dated2013–2027,55,693 odds snapshots with7,913 from the latest seven days, and50,276 cron records with36,127 older than30 days. The three largest relations represent approximately94.6% of production physical size. These counts support bounded retention assessment, particularly cron logs; they do not prove every older record is safe to remove or that physical disk immediately shrinks after row deletion.

# Live database audit

Observed 24 November 2026 around 18:31–18:35 UTC (19:31–19:35 Lagos). Strict SELECT/catalog/advisor inspection. No database changes or publish calls were executed.

## Confirmed operational incident — high

Production `toqfdrcjzwnlydqekude` had 28 consecutive `matchmind-display-refresh` failures from 02:03 through 04:18 UTC (03:03–05:18 Lagos). Last success before incident 01:58 UTC, first recovery 04:23 UTC, a 145-minute gap between successful editions. Error was `Incomplete or unsupported presentation inventory (1289 cards, approximately 1.31 MB)`, raised by `mm_fixture_delivery.materialize()` after `payload_valid(built)` returned false. This is below the current 3,000-card/4 MiB outer bounds. Raising those bounds alone would not address this incident. Exact failing field is unavailable from the generic error and historical rejected payloads were not retained in this inspection.

At 18:31:46 UTC the newest edition was 18:28:00 UTC, so publishing had recovered and was fresh at observation. Last 24 hours contained 260 successful and 28 failed materializations. Collector and push cron jobs showed successful enqueue SQL, which does not establish successful downstream HTTP calls.

The validator enforces nested limits (including 1,000 board rows, 1,500 Leans, 128 slip rows, maximum 90 tips legs), identity matching, referenced-card presence and probability sums. It catches every exception and returns false, losing diagnostic detail. The materializer retains only roughly 30 minutes/at least three editions and therefore cannot itself supply the rejected historical state. Error strings still mention old 1,500-card/2 MiB limits despite enforcing 3,000/4 MiB.

## Raw-table access and privileges

Every public table inspected has RLS enabled. Anonymous SELECT grants are revoked on fixtures, predictions, retired predictions, shared records, daily slips, odds, injury/context/analysis tables, venues and Lean picks. Authenticated roles retain SELECT grants but restrictive `mm_source_raw_fence` policies require an enabled, unexpired principal. These restrictive policies prevent older permissive `true` policies from reopening raw access. User-owned profiles/app_state/AI usage and push subscriptions use ownership predicates. `push_sent` has RLS with no policies, which denies ordinary reads despite table privileges.

`raw_allowed()` and `publisher_scope()` use authenticated user ID against private principals, enabled flag and expiry. Private principals and editions have no anonymous/authenticated table SELECT grants. Raw scope differs from publisher scope explicitly. Public wrapper RPCs use a fixed `pg_catalog` search path. Publisher wrapper and materialize are authenticated-executable but materialize checks scoped publisher authorization. Anonymous cannot execute publication RPC. Public display/history/odds/leans are intentional controlled functions.

## Strong pick database enforcement gap — high architectural finding

Live `predictions` has only its fxid primary key among inspected constraints and no triggers. Its INSERT RLS limits the caller to the publisher email and requires kickoff date <= current UTC date +5, but contains no lower time bound and no server override of `made_at`. This means a compromised or buggy authorized publisher could insert retrospective predictions or supply an issuance timestamp. It does not show that this happened.

UPDATE grants are column-limited to `final_at`, `final_pick`, `final_prob`, `withheld_at`, protecting original pick/probability fields. UPDATE RLS accepts fixture date >= current UTC date, so final fields can be changed after actual kickoff on the same day. There is no trigger enforcing minute-level freeze. Original headline picks are protected by column grants, while drift fields and issuance timing depend on application behaviour. The public promise that nobody can change a published prediction should precisely identify which fields are frozen.

Lean records have stronger enforcement. `lean_guard` rejects UPDATE/DELETE, validates fixture league/date, requires status NS and future kickoff, refuses fixtures already carrying a Strong pick, limits horizon to eight days and sets made_at to server statement time. Lean code checks still permit historical U25/NBT, reasonable for old records but not a database block on issuing them anew.

## Post-build issuance verification

Since 22 November 17:17 UTC, observed 28 Strong insertions (13 Double Chance, 10 Draw No Bet, 3 Goals, 2 Winner) and 14 Lean insertions (all Double Chance). No new Under 2.5 or BTTS No selections were found by Strong pick text / Lean code checks. All 42 inspected rows had parseable kickoff time and zero were issued at or after their stored kickoff date/time. This checks current stored timestamps, not an independent immutable audit log. No new BTTS Yes Lean occurred in this cohort, so handover expectation of some BTTS Leans is unconfirmed rather than evidence of an error.

Shared board, CLV and engine records were Build 368, computed around 16:58 UTC on 24 November. Edition freshness and model-record freshness are different measures and should both be monitored.

## Match context exposure and historical semantics

`public.matchmind_match_context_v1(fxid)` is intentionally anonymous-executable SECURITY DEFINER with fixed pg_catalog search path. The implementation returns the entire competition's past 60 months of compact results plus 60 days of upcoming team/season pairs, rather than only the selected teams. Bounds are 6,000 finished results, 1,500 team names, 1,000 upcoming fixtures and 768 KiB. The caller can choose any existing positive fixture ID; there is no requirement that it belong to the public edition window. This is a bounded but substantial provider-data export and expensive repeated query surface. Decide whether this exposure matches the data license and original access boundary.

For AET/PEN fixtures, context score extraction uses ft_h/ft_a when valid, otherwise final gh/ga. Consequently extra-time final scores can enter context form/standings calculations where strict 90-minute data is absent. This differs from strict unresolved-settlement handling and should be checked against displayed claims.

## Account deletion and AI cache

Live match_analysis and match_context have no triggers constraining privileged cache writes. profiles, app_state and ai_usage reference auth.users with ON DELETE CASCADE. push_subscriptions has no auth.users foreign key. Therefore the edge deletion flow's ignored push cleanup error could leave push subscription rows after auth deletion, even though the three cascading tables would be cleaned. This supports the edge-agent finding with live schema evidence.

## Security advisors

Confirmed warnings include disabled leaked-password protection and pg_net in public. The anonymous/authenticated SECURITY DEFINER warning targets the intentional match-context RPC and requires scope review, not an automatic conclusion of compromise. RLS-without-policy notices on backups and push_sent describe default denial.

- Password protection guidance [https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

- Function execution guidance [https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable)

- Extension schema guidance [https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)

## Remaining verification

No mutation tests were attempted. No historical rejected payload was reconstructed, no complete record recalculation performed, and no leaked/private credentials or user profile data were retrieved. Staging and performance advisory follow-up pending at report creation. This audit confirms controls from grants, RLS, function definitions, triggers and aggregate stored records, without claiming proof against all privileged actors or all API routes.

## Follow-up observed 25 November 2026, 03:16 Lagos

Production was healthy at this specific read. Database time was 02:16:10 UTC, newest display edition was 02:13:00 UTC (approximately 3 minutes 10 seconds old), and display cron job 12 had zero failed runs in the preceding hour. The 24 November incident above is historical and recovered, rather than an assertion of a current outage.

**High staging-readiness issue.** Staging project rdcbnvfnxenrpnnwxszs was ACTIVE_HEALTHY, but its preview mirror was stale. At 02:16:43 UTC on 25 November, mm_preview_mirror.editions contained 38 editions, newest as_of 21 November 00:23:30 UTC (21 November 01:23 Lagos), and latest expiry 22 November 00:23:30 UTC. The newest mirror was more than four days old and its latest expiry more than three days past. Infrastructure health therefore does not establish useful current preview data. Trace the preview GitHub refresh schedule and failures before treating preview acceptance as representative of current production.

Staging's eleven public tables have RLS enabled. Anonymous SELECT is revoked on the ten football/model source tables. The remaining app_state grant has only an authenticated ownership policy with both USING and WITH CHECK matching auth.uid() to user_id, so its anonymous table grant alone does not provide row access. Each source table has a restrictive mm_source_raw_fence policy invoking raw_allowed(). Public display/access wrappers have a fixed pg_catalog search path and are SECURITY INVOKER. Anonymous execution is denied for the publication wrapper. Private mirror tables have RLS with no policies, representing ordinary-role denial. Staging leaked-password protection is disabled, as in production.

Performance advisors reported 14 production RLS init-plan warnings and 13 multiple-permissive-policy warnings. Staging reported 11 and 14 respectively. These are optimization opportunities, not measured latency regressions or evidence of privilege bypass. Evaluate wrapping per-query auth functions in SELECT and simplifying redundant permissive policies while retaining restrictive fences. Production also has five no-primary-key notices, mainly backup/helper tables, and one unused push-subscription index notice. Staging has eight no-primary-key notices, including seven public mirror/source tables. Their refresh-oriented use may explain the design. An unused-index observation alone is insufficient grounds to drop an index.

Advisor references

- [https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)

- [https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies](https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies)

- [https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key](https://supabase.com/docs/guides/database/database-linter?lint=0004_no_primary_key)

- [https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)

- [https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)

This supplement closes the staging catalog, staging freshness and performance-advisor follow-up noted above. It does not include a staging refresh execution, a full query-plan workload benchmark or a production mutation test.

### Stale preview root cause traced to GitHub refresh

The latest ten preview workflow runs inspected all concluded failure. In run 45456855694 on 24 November 18:11 UTC (19:11 Lagos), the candidate verification completed **143 tests with 143 passes**, then `Refresh bounded public records into isolated staging` failed at 18:14 UTC with `Source shared_records read HTTP 401`. Build, deployment and hosted acceptance were skipped as dependent jobs. The workflow declares a quarter-hour cron (`8,23,38,53 * * * *`), but the observed run timestamps were much more widely spaced. Scheduling delay/drop cause was not determined.

The preview workflow checks out `kennedychinazam/matchmind` branch `codex/wo62b-public-release-20261110`. Its `staging/mirror/refresh.mjs:29–32` calls production `/rest/v1/<table>` using a publishable key only, and line 79 reads `shared_records`. Production now revokes anonymous raw-source SELECT grants, including shared_records, as verified in the catalog audit. The old mirror reader therefore conflicts with the current public-access boundary. A repaired preview pipeline should use an approved bounded projection or a narrowly scoped reader, with permissions defined explicitly. Broadening production anonymous grants would reopen the exposure that the new architecture closes.

Evidence

- [https://github.com/kennedychinazam/matchmind-preview/actions/runs/45456855694](https://github.com/kennedychinazam/matchmind-preview/actions/runs/45456855694)

- [https://github.com/kennedychinazam/matchmind-preview/blob/a53874cff361a4a7529c5456e235058975f4a806/.github/workflows/matchmind-preview.yml](https://github.com/kennedychinazam/matchmind-preview/blob/a53874cff361a4a7529c5456e235058975f4a806/.github/workflows/matchmind-preview.yml)

- [https://github.com/kennedychinazam/matchmind/blob/codex/wo62b-public-release-20261110/staging/mirror/refresh.mjs](https://github.com/kennedychinazam/matchmind/blob/codex/wo62b-public-release-20261110/staging/mirror/refresh.mjs)

Read-only job log retrieval confirmed the failure message. No workflow was rerun and no mirror publication was attempted.

# Edge functions and workflow audit

Read-only inspection on 24 November 2026. Repository main commit 2b42b1a8c24b58305cc263e6b293ab7931c8661f. Deployed sources retrieved through Supabase get_edge_function. No function invocation, workflow trigger, remote mutation, credential cache retrieval, or production exploit test was performed. Local copies of deployed sources are in work/edge-source for audit evidence.

## Deployed inventory

Production has five active functions. ai-analyze version 17 and delete-account version 2 have gateway JWT verification enabled. ai-shadow version 2 is publisher-restricted in its handler. refresh-af version 58 uses gateway JWT verification plus a custom scheduler secret in its imported implementation. send-push version 9 has gateway verification disabled and validates the custom scheduler secret itself. Absence of gateway verification alone does not establish anonymous access.

## High — Shared AI cache accepts caller-controlled fixture content

Deployed ai-analyze index.ts lines 195–204 validates a real user with admin.auth.getUser. Lines 207–208 accept prompt, provider, mode, and fxid from that caller. Lines 217–223 return a shared fixture cache entry before quota checks. Lines 287–288 send the caller prompt to the model, prepending only formatting/context instructions. Lines 349–352 save the result with service-role privileges keyed solely by fxid. There is no server-side retrieval of authoritative teams, fixture date, published probabilities, or binding of the prompt to fxid. The context cache has the same binding issue at 229–235 and 361–362.

A signed-in ordinary user with an available quota can supply unrelated or misleading content for an uncached or expired fixture. If the model produces usable text and the cache write passes database constraints, later signed-in readers of that fixture receive the resulting analysis for up to twelve hours. An existing fresh cache prevents immediate replacement. This is an integrity risk, not evidence that poisoning has happened. Live database catalog review by the database agent confirmed no triggers on match_analysis or match_context. Client callProxy index.html:2831–2834 passes the locally assembled prompt and pendingMetaFxid, so the endpoint is used through the ordinary app flow. The appropriate correction is authoritative server-side context and a cache key incorporating version and input provenance.

## High — Daily AI quota is vulnerable to concurrent requests

ai-analyze lines 264–267 reads count and lines 268–273 checks the limit. Provider work occurs afterward. Lines 343–346 writes used+1 through upsert and only logs an error. Two concurrent requests can both observe the same count, both consume provider resources, and both store the same increment. This defeats the intended per-user ceiling and can undercount usage. Cache misses for the same fixture can also generate duplicate paid requests. A transactional reservation before provider work and an explicit reservation-release policy would make quota enforcement consistent. No concurrent paid requests were issued in this audit.

## High — Publisher credentials are retained in the Actions browser-profile cache

.github/workflows/publish-picks.yml restores and saves the whole mm-profile directory, with the save step configured if: always(). robot/publish.mjs:261 launches a persistent browser context at that directory. index.html:24939 configures Supabase persistSession\:true and autoRefreshToken\:true. robot/publish.mjs:398 closes the context without sign-out or removal of authentication storage. Thus the cache design is expected to retain publisher refresh/session tokens along with data.

The 22 November failed workflow run 45077902793 explicitly saved a 71,691,198-byte profile cache after the publisher step. Cache contents were not downloaded or inspected. Exposure requires a context allowed to restore/read that cache, such as a permitted Actions execution or compatible pull-request workflow. The current main publisher workflow is schedule/manual only, so anonymous theft was not demonstrated. Public-repository Actions cache policy and future pull-request workflows make retention of a privileged session an unnecessary high-impact risk. Cache public/noncredential data only, authenticate from secrets per run, and inventory existing caches and sessions before deciding remediation.

## High — Account deletion can finish after cleanup errors

Deployed delete-account lines 69–85 store cleanup errors in the deleted object and continue. Lines 100–113 then delete the auth user and return ok\:true if that operation succeeds. Its comments at 60–62 claim the account remains available for retry when cleanup fails, which the control flow does not guarantee. Any related table lacking an effective foreign-key cascade can retain orphaned personal data. Live database catalog review confirmed push_subscriptions has only its endpoint primary key and no auth-user foreign key. It can therefore retain orphan subscriptions if cleanup fails. profiles, app_state, and ai_usage do have auth.users ON DELETE CASCADE, which reduces their orphan risk. Conversely, if auth deletion fails after successful preceding deletions, the response says 'Nothing else was lost' at 104 despite already-deleted data. The caller is securely identified by getUser and cannot choose another user's ID. The defect concerns partial completion, response accuracy, and retryability.

## Medium — Public diagnostics retain a route to publishing withheld information

Main .github/workflows/diagnose-picks.yml grants contents\:write and exposes a manual save_to_branch input. When enabled it writes full diagnostic logs, explicitly including internal prices for withheld fixtures, into diag-results. Default is false. This workflow can disclose engine information through public logs even without branch persistence, depending on diagnostic output. Both diag-results (5d74620…) and picks/build360 (3f88fa9…) still existed when checked with git ls-remote. No branch histories were purged or changed. The handover's cleanup remains outstanding. Historical public exposure cannot be undone by deleting a branch alone.

## Medium — Publication success has incomplete coverage guarantees

robot/publish.mjs:335–339 correctly treats failed board writes as fatal. However lines 345–346 only warn when fixtures were never priced or board rows lack probability bars. Final checks at 384–393 verify authentication, publisher identity, shared bars loading, archive failure/denial, and duplicate fixtures. New prediction count, tips market coverage, current public edition age, Lean association completeness, and per-fixture metadata consistency are not explicit final failure predicates. Zero new predictions can correctly occur, so a blanket nonzero requirement would be wrong. Required eligibility-dependent artifacts need explicit reconciliation.

The robot loads the live GitHub Pages URL at line 83, rather than the checked-out index.html. This deliberately shares the production engine but means a run's Git commit alone does not prove the browser engine version it executed. The summary logs APP_BUILD. A future release gate should verify the deployed build/hash and data freshness alongside artifact counts.

## Medium — Real publication failure after the handover

GitHub read endpoints show recent publisher successes. The first thirty repository workflow runs inspected included ten publisher successes and three publisher failures. This is a bounded sample, not an uptime rate. Run 45077902793, created 22 November at 22:28 UTC, failed at 23:30 UTC with 'the board was not written: Bounded public display publication failed'. That is 00:30 WAT on 23 November. The cache save step succeeded afterward. Two earlier publisher failures in this sample were 44955490372 and 44915395918. Their root causes were not inferred from status alone.

Sources

- [https://github.com/kennedychinazam/matchmind/actions/runs/45077902793](https://github.com/kennedychinazam/matchmind/actions/runs/45077902793)

- [https://github.com/kennedychinazam/matchmind/actions/runs/44955490372](https://github.com/kennedychinazam/matchmind/actions/runs/44955490372)

- [https://github.com/kennedychinazam/matchmind/actions/runs/44915395918](https://github.com/kennedychinazam/matchmind/actions/runs/44915395918)

- [https://github.com/kennedychinazam/matchmind/actions/runs/45431440257](https://github.com/kennedychinazam/matchmind/actions/runs/45431440257)

## Collector, push, and AI operational observations

refresh-af version 58 contains a three-line bootstrap importing the exact production commit's release/collector-budget/refresh-af-v58-af47.ts. The dependency is immutable by commit and needed during deployment/bundling. The imported implementation is minified into essentially one very long line, making operational review, patches, and source-level debugging substantially harder. It defines a 78-second work budget and provider retries. A work-loop budget does not bound individual fetch latency because the provider fetch helper lacks an explicit AbortController deadline. External calls can therefore exceed the intended work budget. Existing database cron/runtime evidence should establish actual impact.

send-push lines 64–75 compares x-mm-secret with MM_CRON_SECRET and fails closed when missing. It applies to status, test, kickoff, result, and digest routes. The old public test-notification handler has been removed from index.html, so a public test button failure should not be reported. Notification payloads use url:'./', which should be reviewed with the service worker's origin-relative resolution by the platform audit.

ai-shadow uses a verified account email allowlist and a service-role-only probe exception. It has an explicit sixty-second AbortController timeout for each Gemini request and no database writes in the endpoint itself. It normalizes returned probabilities and rejects unknown market codes. Its vocabulary includes Under 2.5 and BTTS No, which were removed from public production picks. This is a research-arm divergence to document, not proof those markets are being published publicly. The handler identifies itself ai-shadow-1 even though the deployed platform version is 2, making both identifiers important in operational logs.

Several edge functions import @supabase/supabase-js\@2 through esm.sh without an exact patch version. They can resolve different dependencies at redeploy time. GitHub actions use major tags @v4, and the robot installs playwright-core\@1.63.0 at runtime with no checked-in lock for that install. Version pinning is partial. Workflow logs also report Node 20 deprecation. These are maintenance findings, not demonstrated compromise.

## Limits

No user deletion, notification delivery, AI generation, collector refresh, or publisher execution was triggered. Cache poisoning and quota findings are control-flow findings with clear preconditions. This audit did not access secret values or download credential-containing caches. Database policies, cron responses, and deployed RPC behavior are covered by the separate database audit. A successful scheduler/Actions run alone does not establish every downstream public view is fresh.

# Engine and records source audit

Read-only review of main commit 2b42b1a. No publishing scripts or remote mutations executed. Evidence paths below are relative to the repository. Live observations from the prior browser audit supplement source findings, but database enforcement is delegated to the database reviewer.

## Confirmed defects

### High — DNB slip probability describes the wrong outcome

index.html:19666 multiplies conditional DNB probabilities into comb. Line 19723 labels 1-comb as chance of losing and says every leg must win. DNB draws void. Example two independent legs each with outright win .60, draw .20, loss .20 yields conditional win .75. Current headline gives 56.25% success and 43.75% loss. Actual no-loss chance is 64%, loss 36%, full payout 36%, all-void 4%. The expected-return block at 19696 separately handles draws, showing inconsistent interpretations in one component. Define full win, reduced payout, refund and loss and calculate these explicitly. Independence needs to be stated and validated.

### High — No-pick reason does not test the claimed floor

index.html:6106 says no call clears 65% whenever a probability vector exists under low/nobase/empty gate. fixtureVector at 13100 only reads a valid probability vector. leanFor check at 6093 depends on separately loaded Lean association. Reproduced earlier on Arsenal 70.2% while saying below 65%. Need a reason based on actual issuance and restriction, with an explicit loading state.

### Medium — Missing original kickoff time can void too early

index.html:5673 pickOriginalKick falls back to midnight on the original date. Its comment claims this cannot void early, which is mathematically reversed for the original timestamp. With original kickoff date Nov 20 and missing time, an actual 20:00 kickoff reaches 48 hours on Nov 22 20:00, but code reaches it Nov 22 00:00. pickPlayState at 5726 uses that value directly. Current fixture time fallback has the opposite effect and may hide lateness. Need explicit policy for unknown original time and test old records with blank ktime. This is a source-confirmed edge-case risk, not a counted production incident.

## Statistical assurance gaps

- Calibration selection uses reported test windows. release/goal-level/shiftNew\.mjs:4 sweeps five shifts on train, test and recent windows. index.html:6642 says the chosen step brings every window within two points. Those windows influenced tuning and cannot simultaneously serve as untouched final evaluation. Fixture-level walk-forward validity does not remove model-selection bias. Request frozen prospective or nested rolling evaluation.

- Backtest scripts require missing personal scratch exports. release/btts-tabs/lib.mjs:2–7 reads /tmp/claude-0/bb and /tmp/claude-0/bt files. Need documented export recipe, immutable hashes, cutoff and code revision. Avoid publishing proprietary raw data.

- Date-only ordering needs kickoff-level audit. release/goal-level/dump-page.js:8 comparator ignores time and returns 1 for equal dates. release/btts-tabs/lib.mjs:12 repeats ordering to reconstruct fixture names by index. No demonstrated leakage yet. Stable fixture IDs and kickoff cutoffs are required to demonstrate same-day chronology.

- ROI denominator excludes void stakes. release/btts-tabs/lib.mjs:57–60 skips void rows before recording priced stake count. This measures ROI on decisive bets, which differs from total stakes including refunds. Label and reconcile with public ledger.

- release/btts-tabs/f_slips.txt reports negative real-price ROI despite calibration. Straight-win 65% floor approximately -2% over 206 priced legs and doubles -7.9% over 41 days. BTTS Yes approximately -7.3% over 78 legs and doubles -24.3% over 22 days. These samples do not establish profit potential.

## Market ladder coverage

index.html:5439 rungsFor selects the highest single result first, then DNB when the leading result is not a draw, then favored-side double chance, then the strongest of O25/U35/BTTS Yes. It calibrates before ranking. O15 is deliberately absent from the official ladder. Removed U25 and BTTS No remain in grading tables for historical rows. RUNG_MIN is empty. ladderPick takes first rung meeting Strong threshold, with rounded probability at publication. leanPickFor at 5512 requires shared bars, rejects any qualifying Strong rung, skips away DNB for calibration reasons, and stops when the chosen rung fails edge. This is a preference ladder rather than exhaustive search of all eligible markets. Product wording should explain that a rejected early rung can suppress later markets.

Strong minimum is .75 and Lean .65. XR competitions outside the allowlist receive Strong threshold 1.01. XR_STRONG_OK at 6544 allows Europa League, World Cup, AFCON, African World Cup qualification, Euro qualification and AFCON qualification. The XR report gives UCL actual .756 versus stated .802 over 432 Strong-like observations and UECL .755 versus .789 over 565. Capping is implemented, but the historical gate is selected from the same report and needs ongoing prospective monitoring.

## XR model coverage and limitations

index.html:6425–6510 uses club ratings keyed by team name and separate national ratings also keyed by name. Club and national pools are separated, which avoids cross-type collisions. Stable provider team IDs would better withstand naming changes and same-name clubs. No production collision was established.

Club rating decay occurs only after more than 120 days and shrinks 25% toward the pool mean. National ratings have no analogous inactivity decay. Club home advantage is keyed by domestic league or a single continental bucket, not literally country as the handover suggests. National finals use hardcoded host-season mapping and a 100-point host adjustment, while nonfinal national matches use fixed 100 home advantage. Finals club neutrality is inferred from competition IDs or a round string exactly matching final. These are explicit modelling assumptions to validate for neutral fixtures and future tournament hosts.

XR keyOf is date|home|away, without competition or fixture ID. The pre-match map could collide when two records share those strings. build sorts by date and processes sequentially, requiring the same kickoff-level leakage check as above. Unknown teams are counted and marked by xrPredict. Historical build accepts results already corrected in the current database, so reconstruction is not necessarily the exact information set available to the original prediction.

## Settlement and historical coverage

- gradePick at 5607 explicitly handles 1/X/2, 1X/X2/12, 1D/2D, O15/U15/O25/U25/O35/U35, BTS/NBT and all nine HT/FT combinations. Unknown codes return null, avoiding substring grading. HT/FT validates integer half/full scores and half scores not exceeding full. Goals grading only checks null, so numeric validity depends on upstream normalization.

- DNB on a drawn result returns void. Removed markets retain rules so old predictions remain interpretable.

- settledScore at 4363 accepts a nonnegative integer 90-minute pair no larger than final goals. AET/PEN without such a pair return unresolved. FT without that pair retains final score fallback.

- Plausible but incorrect provider fulltime scores remain accepted. Comments explicitly record seven of 128 audited extra-time rows with this issue. Events or independent provenance are needed to resolve such cases, rather than inferring them from score shape.

- settledRow and observe90Settlement at 4398/4453 fence older/undated observations after a dated one. Equal-time contradictory observations become unresolved. verified90Fixture takes precedence over caches; unresolved IDs block fallback in fixtureResult at 4325.

- The observation map is session memory. Source comments acknowledge old cached fixtures outside refreshed coverage can retain contaminated legacy scores. Database projections and migration coverage must be verified independently.

- pickVerdict at 5762 classifies orphan, live, expired, graded and pending. Original kickoff drives 48-hour expiration, finished matches moved at least 48 hours are void. Missing provider on unfinished old fixtures is classified orphan, making provider projection part of correctness. Abbreviated statuses and stale live statuses deserve table-driven tests against current normalization.

- renderLeanRecord at 13117 excludes voids from graded denominator and shows stated average, pending and total separately. archiveRow preserves original kickoff, issued probability and reconstructed marker. No inference that database guards are complete follows from client code alone.

## Publishing architecture

robot/publish.mjs navigates the shipped app, signs into publisher, waits for measured bars, reloads and publishes through browser app logic. It avoids a duplicate engine but couples publication to boot, hydration and deployed client. Required verification includes exact build, before/after row counts, deduplication, original timestamps, settlement readback and each output family, rather than idle state alone. Workflow reviewer owns live run inspection.

## Scope and outstanding proof

Inspected source for main ladder, Lean selection, calibration, XR ratings and competition gates, slip aggregate and payout formulas, generic grading, extra-time projection and observation ordering, original-kickoff expiration, record rendering, archive normalization, robot architecture, and persisted research reports/scripts. No raw production dataset or missing backtest export was downloaded by this agent. No whole-engine replay or backend write test was run. Database enforcement, current population counts, authenticated consumers and independent raw-score truth remain to be verified by other agents. These limitations prevent calling the engine calibrated or the record fully correct on the strength of this source audit alone.

# Live public application audit

Date 24 November 2026. Build 368. URL [https://kennedychinazam.github.io/matchmind/](https://kennedychinazam.github.io/matchmind/)

## Method and limits

Signed-out Chromium sessions, Africa/Lagos timezone, disposable local browser storage. Existing tests exercised real public application through browser controls. Desktop browser integration failed earlier with a sandbox startup error, so workspace Chromium supplied the observed interactions. Audited source screenshots and browser text evidence. No app code, production records, accounts, or deployment were changed. Local favourites and settings were exercised only in disposable sessions. Public reads may generate normal access logs. No registration submission with real details, authenticated AI generation, push dispatch, account deletion, production cache clearing, or robot execution.

The scope is every public main section and visible feature family. Every possible fixture, market combination, device, authentication state and timing condition has not been exhaustively enumerated. Real Android/iOS hardware and app-store packages are untested.

## Confirmed defects and discrepancies

1. High. Published Lean identity is inconsistent across list, detail and narrative. Analysis shows Arsenal–Borussia Dortmund as 70% Lean. Early detail says no call clears 65% while 70.2% home probability is visible. After hydration, hero can say 'No qualifying pick', lower result section says 'Lean: Arsenal · 70%', then 'Informational model analysis · no issued pick'. Narrative says 'No published model probabilities for this fixture, so no verdict is given.' This persists in a fresh settled-data walkthrough. Reproduce Analysis > Arsenal–Dortmund after loading > compare hero, result section, analysis paragraph. Evidence deep-live.log STATE analysis/ucl, deep-ucl.png and earlier k.log. Check the distinction between Strong pick, issued Lean, informational estimate and missing read. The current words do not explain that distinction.

2. High. Generated DNB slips label a product of conditional probabilities as 'TO LAND' and its complement as chance of losing. Example default three DNB legs gave 70.6%, 29% chance loses, plus 'Every leg must win'. DNB draws can void a leg. Engine source review separately confirms the computation. The displayed maximum dollar return also needs explicit void qualification. Evidence t.log generate, m.log target 50.

3. Medium. Goals Today falsely claims 'No Tips have been issued for today or yesterday.' Clicking Yesterday immediately displays seven settled goals tips, and BTTS displays two settled BTTS Yes tips. This is a definite empty-state copy/state defect, not evidence that all issues are missing. Reproduce Tips > Goals > Today > Yesterday. Evidence deep-live.log STATE goals/yesterday goals/btts. Correct empty state must apply to selected issue and selected market.

4. Medium. Startup confuses loading and terminal states. Header briefly says 'Sample data' alongside 69 timestamped fixture rows. Analysis early says 'Matches temporarily unavailable', then populates. Lean chips and strongest-read/slip eligibility change as other feeds hydrate. Smart Bet initially reports pending records then resolves settled losses. Evidence w\.log, e.log, z.log. Use explicit per-resource loading state and retain known data while refreshing.

5. Medium. Offline reload loses the fixture view despite previously loaded data. After an online load and tab walkthrough, disabling network and reloading yields shell and bottom nav, header Unavailable and 'Matches temporarily unavailable'. Evidence deep-live.log OFFLINEBODY. This verifies shell survival and failure of offline fixture access in the tested session. It does not prove offline support was promised. A deliberate offline product contract is required before native packaging.

6. Medium. Narrow Tips navigation conceals Slip Generator. At 390 px, the last tab is offscreen and only a narrow clipped edge indicates horizontal scrolling. At 320 px, Smart Bet and Slip Generator extend past viewport. No document-wide overflow occurs because the strip is scrollable. Screenshot deep-Tips.png inspected. Improve discoverability with visible scroll affordance or a responsive tab arrangement. Do not call this full page overflow.

7. Medium. Account email/password and timezone have no associated labels or aria-labels. They rely on placeholders or nearby text. Five legal links use identical 'Read' labels. Fixtures' favourite stars are spans in observed markup. Some competition options are plain divs. Contrast and complete screen-reader traversal were not measured. Visible labels and stateful keyboard controls are required.

8. Medium. Legal and support pages expose unfinished placeholders. Terms lacks operator identity and notices address. Privacy lacks controller identity/contact. Contact lacks actual email. These are live user-facing placeholders, not private TODOs. The sign-up UI is accessible in the same build. Evidence m.log Legal 0/1/4.

9. Medium. Public statistical narrative is titled 'Professional AI Write-up' in signed-out sessions. Orlando narrative is populated, while Arsenal says probabilities unavailable despite visible result probabilities. Distinguish cached AI text, deterministic statistical text and unavailable analysis at rendering time. Authenticated AI response quality was not tested.

10. Medium. Data scope needs clear labels. Scores showed 69 fixtures for Today while Tips described 86 fixtures. Analysis includes UCL matches missing from the observed Scores competition picker. Differences may reflect separate data sources or coverage windows, requiring database reconciliation. This is an observed inconsistency, not proof of missing provider fixtures. Competition inventory should be reconciled per date/source.

11. Medium. Saved finished fixture reload temporarily loses final state. Botafogo–São Paulo starred from Scores preserved favourite membership, but immediately after reload displayed 00:00 and team initials instead of FT 1–1. In Favs its date was 23 November, while Scores grouped it under 24 November. Verify shared date bucketing and preserved last-known metadata. Evidence k.log saved/persist.

12. Low/medium. Search empty copy says the engine covers 'about ten major competitions' and lower divisions won't be present. Actual app shows broader competition coverage including lower divisions. Search scope should describe indexed records accurately. Search itself found Arsenal and returned sensible no-match state for an impossible query.

13. Medium. Header/global strongest read survives market switches. Goals/BTTS can display a Double Chance highlight. Seven-day banner says no eligible slip leg while generator builds upcoming legs. Eligibility policies can differ, but the screen lacks a concise explanation of that difference. Avoid interpreting 'no eligible slip leg' as a whole-app fact.

14. Medium. Performance presentation changes while data arrives. Two slips initially awaiting results then render two losses and -100% ROI. Timezone toggles co-occurred with that change but subsequent checks did not establish timezone as cause. Treat as hydration observation only. Evidence z.log.

15. Low. More's accuracy is buried below settings/account/legal. Main user promise is published record, yet onboarding sends users to More, and the record appears far down that page. Current record was 1952/2602 at 75.0%, last seven days 120/166 at 72.3%; these are snapshot UI values, not independently recomputed database totals.

16. Low. SEO basics include 45-character title, language and viewport, but no description and no h1. App likely depends more on app discovery and usability than static page SEO. One meaningful active page heading and concise description would improve navigation/metadata.

## Coverage matrix

| Surface | Exercised | Outcome / remaining boundary |
| - | - | - |
| First-run intro | Read, Open app | Opens Scores; record initially unloaded |
| Scores | All, Live, Upcoming, Finished | 69 total, 67 upcoming, 2 finished; Live empty with Show all recovery |
| Scores competitions | Open picker, Championship selection | Count narrowed to 8 of 69 |
| Dates | Previous/next day, today reset; native picker opened | Date list updates; native picker selection unverified |
| Search | Open, query Arsenal, no-match query, Escape | Match/team results and explicit empty state |
| Analysis | Full competition list, pick/Lean/no-pick examples | Hydration and cross-view discrepancy confirmed |
| Strong detail | Orlando–Golden Arrows | DNB 87.9%, outright win 69.6%, draw 20.8%, away 9.6%; DNB excludes draws disclosed |
| Lean detail | Arsenal–Dortmund | 70.2/19.5/10.3 result vector, contradictory hero/narrative |
| Result/odds | Expanded | 1X2, double chance, DNB, goals and BTTS price rows load |
| Goals | Expanded on both details | Strong match populated; Arsenal expected goals unavailable |
| Combos | Expanded | Strong match populated; Arsenal unavailable |
| HT/FT | Expanded | Nine outcomes and model reliability warning |
| Correct score | Expanded | Conditional outcome wording and probabilities on Strong fixture; Arsenal unavailable |
| Scorers | Expanded | Named players and season-share note; Arsenal unavailable |
| Form/H2H | Expanded | Recent form points, historical matches or no meetings |
| Standings | Expanded | Derived table and deductions caveat |
| Written analysis | Read signed out | Populates; AI heading attribution problem |
| Tips Winner | Today/3 days/7 days | Populates and market prices vary by availability |
| Goals/BTTS | Today/yesterday/3 days/7 days | Yesterday settled rows exist; future issuance limitation stated |
| Smart Bet | Safe/Value/Bold, 7/30-day tracker, earlier day | Today unavailable bands explained; past slip leg results and loss displayed |
| Step calculator | Read default | $10 base, $150 full cycle exposure, fixed example payout; input variation not completed in original walkthrough |
| Slip Generator | Generate default, target 50, open leagues, Why | 3 unpriced/partial-price legs and 11-leg 51.49 target output |
| Favourites | Match star, Matches/Leagues & teams, reload | Local persistence; transient fixture metadata regression |
| Themes | Dark/Light/Auto | Dark and Light attributes switch |
| Timezone | Device/Lagos/London | Kickoff shifts one hour; settings text updates |
| Login/signup | Toggle forms | No authenticated account journey |
| Terms/Privacy/Responsible play/How it works/Contact | All opened/read | Placeholders in identity/contact; responsible-play record populated |
| Notifications | Inspected entry | Permission prompt, delivery and native push untested |
| Clear/delete | Inspected entries | Destructive actions deliberately unexecuted |
| Responsive | All five tabs at 320,390,768,1280 | No document overflow; tab/date controls clipped at narrow widths |
| Offline | Online load then offline reload | Shell survives; fixtures unavailable |
| PWA/native | Source reviewed by platform agent | Installation, iOS Safari, Android Chrome hardware and store wrappers untested |

## Visual observations

Dark navy panels, gold active states, fixed five-item bottom navigation and short team rows form a consistent mobile layout. At 390 px screenshots, the selected section is easy to identify. Strongest-read card occupies most of the first Tips screen, pushing actual market list below fold. Small muted timestamps and labels need formal contrast measurement. The screenshot confirms 90-minute result unavailable on an upcoming fixture, which should normally remain pending until its match state justifies another label. Desktop uses a narrow centred 520 px content column, preserving mobile readability but leaving substantial unused space.

## Suggested verification criteria for fixes

- Fixture list, detail hero, market panel and narrative agree on issued Strong/Lean state after each supported loading order.

- Empty market state never denies existence of other dates' rows.

- Offline policy is explicit and tested with last successful snapshot, expiry and recovery.

- Every interactive control is keyboard reachable, named and exposes selected/expanded state.

- Dates follow one selected timezone across scores, favourites, detail and issued records.

- Generator defines loss/full payout/reduced payout/refund and calculates each consistently.

- Signed-out deterministic analysis has a matching heading; authenticated AI paths have separate verified attribution.

- Loading odds/history cannot cause a false final no-results or no-eligible message.

## Evidence

/workspace/work/mm-audit/deep-live.log\
/workspace/work/mm-audit/deep-live.cjs\
/workspace/work/mm-audit/deep-Tips.png\
/workspace/work/mm-audit/deep-More.png\
/workspace/work/mm-audit/deep-ucl.png\
/workspace/work/mm-audit/w\.log\
/workspace/work/mm-audit/k.log\
/workspace/work/mm-audit/m.log\
/workspace/work/mm-audit/t.log\
/workspace/work/mm-audit/z.log

## Additional boundary tests in resumed session

Evidence final-live.log and final-live.cjs.

- Search result keyboard activation worked. Focusing a result and pressing Enter opened Slavia Praha–Arsenal detail.

- Detail accordion keyboard activation worked. Enter changed the Goals accordion from closed to open.

- Generator risk 1% produced an explicit no-eligible-legs explanation.

- Generator risk 99%, target odds 100000, produced 20 legs with combined odds 1381.13 and a 0.7% headline probability. Target shortfall was disclosed. The advice then said 'Raise the risk slider' despite its already being at its maximum 99%. This is a confirmed boundary-copy defect. Target mode also exceeded the visible number-of-games choices, which stop at 12, by producing 20 legs. That may be deliberate target-mode behavior but is insufficiently explained.

- Sign-up empty email input has native validity true and no validation message, so required-field enforcement is not represented by HTML required validation. A blank submit was exercised, without supplying personal data. This observation alone does not prove the server accepts blank registrations, and the app's own inline feedback was not recorded. Do not claim registration bypass.

- Visible fixture favourite is a span with no tabindex or role in its outerHTML, confirming the keyboard semantics concern.

# Platform, architecture and mobile readiness audit

Read-only examination of main and origin/ccr-5da6e9b3-3ms4v5 in /workspace/work/matchmind. No production actions. Findings below distinguish code-demonstrable defects from deployment risks. Real iOS and Android execution remains unverified.

## Findings

1. **High when sibling apps share the origin — service worker deletes unrelated caches.** sw\.js:39–42 enumerates every Cache Storage cache and deletes every name other than matchmind-v368. Cache Storage belongs to the origin, not a service worker path. A separate preview at kennedychinazam.github.io/matchmind-preview/ shares that origin. An activation can therefore remove preview or other app caches. This is deterministic code behaviour, although a live cross-app deletion was deliberately not triggered. Scope deletion to an app-specific prefix that also distinguishes preview and production.

2. **Medium — default notification destination resolves to the wrong path.** sw\.js:84 defaults the payload URL to './'. sw\.js:94 resolves it against self.location.origin, which produces [https://kennedychinazam.github.io/](https://kennedychinazam.github.io/), rather than /matchmind/. Line 99 accepts any same-origin browser window, so an existing preview or unrelated project tab can receive the open-fixture message and focus instead. A real push payload might override the URL, which narrows the first defect to default/relative payloads. Resolve against registration.scope and constrain reuse to app scope. Validate permitted destination origin and handle an existing fragment explicitly.

3. **Medium — HTTP errors can replace a functioning offline shell.** sw\.js:54–58 caches every same-origin response without checking res.ok or request method, then uses a cache fallback only on network rejection. An HTTP 404/500 for index.html is a fulfilled fetch and can overwrite the last working shell. Cache writes also lack event.waitUntil and rejection handling, so their completion is not tied to worker lifetime. Restrict cache writes to successful expected GET resources and decide how HTTP errors should use an existing shell. This is a code path analysis, not an induced production outage.

4. **High verification gap — PWA integration test is stale and normally skipped.** On working branch test/pwa-lifecycle.test.mjs:14–25, test is skipped unless PWA_PLAYWRIGHT and PWA_CHROMIUM exist. It asserts a fixed worker SHA and APP_BUILD 358, sets synthetic baseline to 358, and replaces matchmind-v358 in worker source. Current app/worker is 368. The suite cannot establish current release update/rollback acceptance as written. Refresh the fixture baseline and execute the opt-in test in required CI. The working branch also contains navigation/mobile/account tests absent from main; a release must name which commit and suite it validates.

5. **Medium — unpinned third-party executable dependency.** index.html:1136 loads @supabase/supabase-js\@2 from jsDelivr with no integrity attribute. This permits dependency bytes to change within major version 2 without a MatchMind release. App uses that library for persistent sessions at 24939. Pin exact reviewed dependency bytes and make the build reproducible. No compromise was observed. Source contains no CSP meta; server response headers require separate verification before claiming no CSP is deployed.

6. **Medium privacy/account usability gap — deletion deliberately retains device credentials and data.** index.html:25456–25520 captures account identity and request epoch defensively, posts DELETE confirmation, and on success explicitly retains local copies, credentials, backups and SDK session while detaching app context. It only acknowledges server response and says erasure is unverified. This protects against falsely claiming completion but leaves a material account-lifecycle task for a future store release. Backend agent must verify deletion implementation, token validity after deletion, backups, and whether the user can complete local removal. Do not test destructive deletion in production.

7. **Medium — account recovery UI absent in examined source.** Login/signup functions at 24972–25007 support signup, password login and logout. Searches for resetPassword, password reset and Forgot return no recovery flow. A user who loses the password has no evident self-service recovery path. Confirm provider configuration and implement recovery/deep links before mobile packaging.

8. **Medium — app isolation must consider the shared GitHub Pages origin.** LocalStorage, IndexedDB, cache and auth state are origin-based. Account partitions are thoughtful (24861 onward), but those do not isolate a separate web application on the same origin from reading browser storage. This is a deployment trust-boundary consideration, not evidence another application has read user data. A dedicated domain makes that boundary clearer and simplifies push/deep links.

9. **Mobile readiness gap — PWA capability exists, native readiness is unproven.** manifest.webmanifest defines relative start_url/scope, standalone mode and 192/512 icons, with the 512 icon marked any maskable. This supports a PWA baseline. index.html:25220–25239 explicitly explains iOS home-screen requirements before Web Push. No native Android/iOS project is present in main's top-level tree. A wrapper would need verified authentication links, system back behaviour, safe-area layout, keyboard resize, permissions, lifecycle and offline behaviour on real devices. No safe-area or viewport-fit declarations were found. That alone does not prove clipping because default browser insets may protect it, but edge-to-edge native packaging needs explicit testing.

10. **Maintainability/release traceability.** Main concentrates client, model, account flows and data rendering in \~26k lines of index.html, deployed directly with a service worker and manifest. Working branch adds many tests, release tools and source material and also tracked node_modules. Do not treat this as an automatic rewrite requirement. First ensure the deployed artifact, generating source, dependency versions and test commit are explicitly related. Incremental extraction should preserve the normal entry points and issuance/settlement semantics.

## Positive controls observed

- Auth operations capture owner and epoch, preventing stale asynchronous account operations from updating another account's screen.

- User-supplied signup name/email rendered in status HTML pass escapeHtml.

- Local personal data uses ownership partitions and guards, while cloud merge validates user_id and array/object shapes.

- iOS push support identifies standalone installation requirement with explanatory UI.

- sw\.js excludes service-worker version probe requests from Cache Storage and sweeps legacy probe entries.

- Navigation history has a dedicated mocked-browser regression suite.

## Safe verification commands supplied to parent

In a disposable scratch export of the working branch, MM_TEST_CHROMIUM=/usr/bin/chromium node --test test/account-ownership.test.mjs test/navigation-history.test.mjs. Reviewed both entry points: all browser network requests are fulfilled with synthetic responses or aborted, and service workers are blocked. PWA lifecycle test uses isolated local server/proxy and expected stale fixture assertions; opt in using PWA_PLAYWRIGHT and PWA_CHROMIUM. Do not run unreviewed whole-suite tasks because some are intentionally hosted or staging acceptance.

## Limits

This report does not certify mobile store compliance, actual push delivery, native installation, signed-in production flows, account deletion, live attack exploitability or every third-party dependency. Those require separately controlled evidence. Backend RLS, edge authentication and cron ownership are covered by other agents.

# MatchMind naming and domain investigation

Read-only research completed 24 November 2026 at approximately 19:32 Africa/Lagos (18:32 UTC). No domain reservations, purchases, trademark filings, or external messages were made.

## Finding

**MatchMind does not meet the requested distinctiveness goal.** Multiple football prediction products already use the same name, including an exact MatchMind Pro listing on Apple's App Store. This creates direct app-store discovery and customer-confusion risk before the planned Android and iOS launches.

Primary evidence includes these live store listings and product sites. Their marketing performance claims were not audited.

- [MatchMind: AI Match Predictor on Google Play](https://play.google.com/store/apps/details?id=com.badiniibrahim.matchmind), by BadiniIbrahim, offers football predictions, scorers, tactical analysis and a Pro subscription.

- [MatchMind AI – Football Tips on Google Play](https://play.google.com/store/apps/details?id=com.ata.matchmindai), by AtaKaan, uses the same central name in the same product category.

- [MatchMind Pro on Apple's App Store](https://apps.apple.com/il/app/matchmind-pro/id6757497096) is a football prediction game with scores, contests and subscriptions.

- [MatchMind Football AI on Apple's App Store](https://apps.apple.com/es/app/matchmind-football-ai/id6769380735) links its terms to the MatchMind AI website.

- [MatchMind public prediction league](https://www.mymatchmind.com/) presents pre-kickoff predictions and a public accuracy record, closely overlapping this project's positioning.

- [MatchMind AI product website](https://www.match-mind-ai.com/en) markets football analysis across mobile platforms.

Registry lookup returned registered domain objects for both [matchmind.com](https://rdap.verisign.com/com/v1/domain/matchmind.com) and [matchmind.app](https://pubapi.registry.google/rdap/domain/matchmind.app). Ownership was not investigated and these records do not establish any relationship among the services above.

## Shortlist

The five candidates below had no registration object in the authoritative registry RDAP checks for either extension at the recorded time. Each returned HTTP 404. That is evidence consistent with an unregistered domain. **Registrar availability, reserved-name status, premium pricing and successful checkout remain unverified.** A candidate cannot be promised available until a registrar confirms registration eligibility. Domain registration also does not establish trademark clearance.

| Candidate | Pronunciation and intended impression | Search result | .com registry result | .app registry result |
| - | - | - | - | - |
| **Kickveri** | kick-VEH-ree; short football cue with a verification association | No relevant exact-name brand found in sampled web searches. One unrelated result joined “Kick” and Turkish “Veri” in page text. | [No registration object](https://rdap.verisign.com/com/v1/domain/kickveri.com) | [No registration object](https://pubapi.registry.google/rdap/domain/kickveri.app) |
| **Golavero** | go-la-VEH-ro; an international goal association with room for a standalone identity | No relevant exact-name app or business found. Unrelated old OCR and subtitle matches appeared. | [No registration object](https://rdap.verisign.com/com/v1/domain/golavero.com) | [No registration object](https://pubapi.registry.google/rdap/domain/golavero.app) |
| **Pitchovra** | pitch-OH-vra; visibly rooted in football with a distinctive ending | No relevant exact-name result found in sampled searches. Pronunciation needs a small audience test. | [No registration object](https://rdap.verisign.com/com/v1/domain/pitchovra.com) | [No registration object](https://pubapi.registry.google/rdap/domain/pitchovra.app) |
| **Netivaro** | neh-ti-VAH-ro; flexible brand with a subtle net association | No relevant exact-name app or business found. An unrelated nineteenth-century OCR match appeared. | [No registration object](https://rdap.verisign.com/com/v1/domain/netivaro.com) | [No registration object](https://pubapi.registry.google/rdap/domain/netivaro.app) |
| **Fixturelume** | FIX-cher-loom; fixtures plus illumination, clearest descriptive connection | No relevant exact-name result found in sampled searches. Longer to type and spell than the other candidates. | [No registration object](https://rdap.verisign.com/com/v1/domain/fixturelume.com) | [No registration object](https://pubapi.registry.google/rdap/domain/fixturelume.app) |

**Kickveri is the leading candidate for this product.** It is short, has an immediate football association, and can support a brand built around publishing and checking forecasts. Golavero is the second choice for a smoother international name. These are editorial recommendations based on this preliminary screen. Neither has completed trademark or linguistic clearance.

## Candidates screened out

- PitchVero is an existing presentation-design business at [pitchvero.com](https://pitchvero.com/).

- Formivo already has several commercial uses, including [formivo.io](https://formivo.io/) and [formivo.store](https://formivo.store/).

- Formetric has an existing [Google Play app](https://play.google.com/store/apps/details?id=com.musoftware.formetric) and other established uses.

- Formlume is already used for a [research practice](https://research.stefanal.com/about/) and software listings.

- FormQuill is an existing [forms platform](https://www.formquill.com/), and PitchQuill is an existing [email product](https://pitchquill.com/en/).

- Formavero and Formivaro have registered .com domains and visible existing uses. [Formavero community](https://linktr.ee/formavero), [Formivaro store](https://formivaro.com/).

- Pitchlume.com and Pitchvanta.com returned registered RDAP objects. Their .app variants had no registration object, which does not satisfy the preference for an available matching .com.

- MatchVora appeared as an existing sports YouTube identity in an indexed third-party channel listing. It was excluded from the shortlist pending direct channel verification.

## Evidence and limits

Authoritative endpoints used were Verisign's .com RDAP service and Google's .app registry RDAP service. Full status results were saved to `/workspace/work/naming/rdap.json` and `/workspace/work/naming/rdap-shortlist.json`. Fixturelume.com initially returned HTTP 503 and returned 404 on retry. Netivaro.com also returned 503 initially, followed by 404 on retry. The initial 503 responses were never interpreted as availability.

The web searches used exact candidate names, small grouped OR queries, and app/football qualifiers. Search indexes can miss new products, private companies, local businesses, unindexed trademark records and similar-sounding names. No formal national or international trademark registry clearance was completed. There is therefore no basis to certify any suggested name as globally unique. The observed exact-name conflicts are sufficient to recommend moving away from MatchMind before store branding becomes harder to change.

Before adopting a finalist, verify registrar registration eligibility and price, search relevant trademark registries for exact and similar names, check Apple/Google store naming conflicts directly, and test spelling/pronunciation with the intended audience. These are follow-up verification steps, not completed actions.
