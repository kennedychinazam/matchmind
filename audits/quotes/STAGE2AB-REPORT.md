# Stage 2A/2B implementation and verification report

**Scope:** existing source/provenance inspection and isolated offline canonical quotes. No live bookmaker integration, operational source verification, actionable price admission, real value recommendation or later AI stage.

## Implemented

The closed versioned JSON Schema and strict semantic validator represent fixture/team orientation, individual bookmaker identity, exact fourteen-market selections/half-unit lines, exact decimal prices, provenance, six distinct operational clocks, status/rules/access claims and revision ancestry. Missing metadata stays null/unknown. Bounded JSON rejects duplicate keys, prototype fields, accessors, hidden properties, cycles, oversized input and invalid nesting; canonical values are detached and deeply frozen. Schema changes cannot silently introduce unsupported validation keywords.

The legacy adapter accepts original retained database-row JSON text. It preserves snapshot and fixture IDs (including original numeric/string types), exact book display/code, original JSON numeric token/value and capture label, source reference and raw row bytes/hash. Canonical decimals retain precision using integer rational checks; the original upstream vendor representation is explicitly unavailable. No provider bookmaker/market IDs, first receipt, status/rules/access or timestamps are invented. Optional fixture context is a separately supplied current stored join, not verified historical identity.

All fourteen mappings are exact and independently tested: HOME/DRAW/AWAY; DC_1X/DC_12/DC_X2; BTTS_YES/BTTS_NO; OVER/UNDER 1.5, 2.5 and 3.5. Unknown aliases, DNB/Asian/team-total/half-time/live/promotion/extra-time variants cannot be silently cast into this universe. Nominal mapping does not establish provider catalog or settlement compatibility. No averaging or composite bookmaker price is constructed.

Classification separates historical origin, normalized research-only observations, rejection/quarantine and a **future source-verifiable candidate** containing unverified claims. The latter is not a verified quote. Every output is `actionable:false`; no source verifier, positive authorization mechanism or enabling flag exists. Missing origin/identity/status/upstream seen/receipt/rules/access/rights, freshness policy or evidence causes quarantine. A new database read does not refresh a provider observation. Future rules/access evidence fails the decision cutoff as well.

Replay preserves all original records and input ordering. It distinguishes duplicate observations, unchanged rational prices, price moves and status/correction/retraction records. Conflicting IDs, split-stream references, inconsistent identity/ancestry and ordering regressions quarantine affected streams. Suspensions/withdrawals/retractions never revive older offers. Partial/unavailable inventories—including explicit zero-price failure barriers—latch quarantine for the **entire batch**, including omitted markets; fallback is always disabled. This conservative rule avoids assuming authenticated source scope. It requires future review before any controlled recovery or persistence workflow.

## Offline normalization of the accepted census

Source: already retained Stage 2 `S2-READ-01` fixed query, not a new hosted/provider read. Original row slices were extracted without numeric reserialization. Full private normalized source/quote artifacts remain outside Git/public output.

| Result | Count |
|---|---:|
| Original retained snapshots | 838 |
| Named bookmaker strings | 10 |
| Approved canonical markets | 14 |
| Normalized quotes | 84,558 |
| Research-only normalized quotes | 84,558 |
| Unsupported legacy entries retained as rejections | 7,680 |
| Actionable or operationally verified offers | **0** |
| New hosted reads/writes or external provider calls | **0** |

The rejected count includes legacy DNB entries outside the fourteen approved markets; it does not imply source corruption. The complete original source remains retained. All approved-market counts match the accepted reconnaissance census. Original retained-file SHA-256 hashes were checked before and after normalization and were unchanged. The pretty-printed row slices total 2,733,867 bytes; this differs from earlier compact selected-payload byte counts because representation/whitespace differ. The preserved bytes are those of the retained database response, not a recovered original upstream bookmaker payload.

See `normalization-results.json` for aggregate per-market/book results and a non-sensitive private-artifact hash. No private raw fixture rows, provider responses, ledger, credentials or financial records are committed.

## Verification

Focused contract/legacy/replay tests cover exact mappings, book-name identity, unknown metadata, decimal precision, cross-field and provider-label contradictions, wrong orientation/line/period, unsafe JSON/resource limits, chronology/pre-KO/freshness, no fake historical receipt, status claims, corrections/suspensions, duplicate/conflicting revisions, incomplete/empty inventory, no fallback, no legacy promotion, deterministic replay and football-only boundary rejection. The boundary demonstrator is not a full A4 ingestion workflow and cannot authenticate mislabeled facts.

Tests were written and observed failing before implementation/fixes. Independent review identified exact-decimal/capture/ID preservation, split-stream adverse-update, omitted-stream partial-inventory and future ancillary-evidence issues; each has a failing-first regression and is fixed. Unknown origin cannot enter the future candidate class. No important review finding is deferred.

An independent Python Draft 2020-12 validator checked the schema itself and 30 normalized examples; all passed. This verifies structural compatibility only, not semantic source authenticity. Full Node 20/24 suite and GitHub CI outcomes are recorded in the final verification receipt supplied with this report. Do not infer a passing full run from focused tests alone.

## Source inspection and remaining blockers

See `SOURCE-INSPECTION.md` for exact repository paths and recoverable fields. The existing staging adapter/writer supports constrained `odds_1x2`, stamps genuine local writer receipts and preserves immutable manifests in local tests. It is not the deployed multi-market provider collector and cannot recover discarded historical upstream fields. Client reading/publication code gives legacy snapshot linkage but no active same-book offer proof.

The approved available artifacts did not contain the actual deployed API-Football collector/DDL/catalog or original per-book raw provider archive. No account-specific rights/rules/access evidence was available. No privileged key, management export, blocked host or new service was accessed. These gaps remain explicit rather than repaired by assertions.

`MISSING-EVIDENCE.md` records original-writer/catalog/raw-response, genuine upstream/receipt clocks, suspension/inventory, settlement/access/rights, durable revisions, representative latency/coverage and A4 calibration/policy requirements. Stored historical prices remain fundamentally distinct from current offers.

## Safeguards and next steps

Build 355, Stage 1 math, E-MARKET behavior, A1/A2/A3, the first experiment, private archives/journal/checkpoints, all retained reservations, lifetime ceiling, BYOK, Sunday guard and provider restrictions are unchanged. New modules have no import path into production or existing inference execution. Regression databases use existing disposable local test infrastructure; no hosted database operation or production change occurred. PR #6 stays draft/unmerged; no deployment.

The changed-file inventory, exact implementation commit and Node/CI links are in the final verification receipt. Changes consist solely of this isolated framework/schema/tests, source/evidence documentation, a Stage 2 plan and research roadmap updates.

Next safe steps require Director review first. Obtain approved original source/catalog/response evidence; separately authorize source-specific offline adapters/verification and eventual persisted source observations. Only after source usability is demonstrated should live integration be considered. Independent A4 requires complete point-in-time football packets, equivalent evidence, a realistic training cohort and learned/frozen numerically validated contribution. Real selection additionally requires probability calibration, uncertainty and predeclared model/ranking/abstention policies. No invented boosts, TTLs, thresholds or risk allowances are activated.

**STOP after Stage 2A/2B. No paid requests, new integrations, subscriptions, hosted writes, reservation reuse, real recommendations, merging or deployment. Await Director review.**
