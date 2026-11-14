# Prospective settlement policy 2 — review-only database proposal

Director authority: prospective cohort and minimal per-selection ledger approved
12 November 2026. Baseline PR #28 `c5260ca674f8430c428cd83089c467e603bbebc1`.
These SQL files are **not installed or activated** in staging or production.
They are proposals, not Supabase CLI migration-history entries.

## Scope and separation

The legacy `pickPlayState` clock-only rule remains byte-for-byte unchanged for
historical compatibility. Replacing it globally would reclassify history without
an authoritative historical void ledger. Policy `matchmind-settlement/2` instead
has its own enrollment and final decisions. No application build, historical
date, fixture date or `made_at` cutoff confers membership.

The proposal adds a private `mm_settlement` schema and nonlogin, non-bypass owner:

- `policy`: one named version, initially inactive; activation cannot be reversed
  by a routine update.
- `selections`: one independent identity per prediction, or per issued slip's
  `(day, tier, ordinal)` selection. It stores fixture ID, complete original
  issuance JSON, original UTC kickoff, market/code/probability, enrollment time,
  policy, status/reason, evidence and decision time.
- `observations`: the latest minimal, trusted fixture observation with source
  timestamp and writer role. Older observations cannot displace it; equal-time
  contradictions fail closed until a strictly newer trusted observation arrives.

These tables have RLS and no anonymous/authenticated table grants. The owner reads
only the required fixture columns through a dedicated SELECT policy. Functions
have fixed search paths and explicit execution ACLs. No secret is stored or
returned by this proposal.

## Issuance and settlement lifecycle

After explicit activation, AFTER INSERT triggers on `predictions` and
`daily_slips` enroll new selections in the **same issuance transaction**. The
existing scoped publisher gate must authorize the writer. Replays that insert
nothing create no duplicate membership; updates cannot enroll historical rows.
Any invalid enrollment aborts the new issuance rather than silently publishing
an unsupported prospective selection. Supported codes are exactly the existing
grader's 25 result, DNB, goals, BTTS and HT/FT codes.

Enrollment requires the accepted fixture to be NS/TBD, a complete kickoff in the
future and the source selection's matching schedule. Prediction kickoff/time
must match; a slip's missing optional time is captured from the accepted fixture
**at issuance**, not reconstructed later. Neither selection nor probability is
rounded or rewritten. The original snapshot remains immutable.

The authoritative process is the existing scheduled publisher's source INSERTs,
not a visitor opening the public app. The public client remains unable to
publish. This proposal does not alter that client, the private master, publisher
code or production schedules. Installation acceptance must verify that the
actual scheduled publisher uses the reviewed source tables and scoped role.

Only observations written through the authorized publisher/collector scope are
captured. A later authorized tick cannot launder an administrator/untrusted table
write into evidence. Missing/future timestamps, foreign providers and conflicting
observations do not settle anything. The authority is the trusted ingestion
boundary; a timestamp alone is never proof that an arbitrary row is correct.

Statement-level triggers reconcile after fixture batches and on the existing
bounded edition refresh. The latter supplies the clock check when a standing
postponement crosses 48 hours without another provider request. A service-only,
fixed `matchmind_settle_prospective_v2()` RPC also permits an explicit retry. No
new scheduler, provider call or model calculation is introduced.

Rules for an unresolved selection:

- NS/TBD with only elapsed time remains unresolved indefinitely.
- At least 48 hours from the original kickoff plus accepted PST/CANC, or accepted
  NS/TBD rescheduling of at least 48 hours, permits a non-play void.
- ABD/SUSP/INT alone never establish a void, including when the schedule changed.
- A completed match needs the accepted regulation-time pair; unresolved extra
  time/penalties cannot supply a made-up result. The existing FT fallback is kept.
- A match actually played at least 48 hours after original kickoff retains the
  existing late-played void guard. A delayed *arrival* of an on-time result instead
  receives its normal grade. DNB draws retain their legitimate void treatment.
- Missing HT/FT components leave that selection unresolved, without blocking a
  different market on the same fixture from settling.

Row locks and conditional updates make concurrent settlement idempotent. A final
row cannot be updated or deleted, including by routine owner writes. New evidence
never silently replaces a final result. Any disputed final decision requires a
separately reviewed append-only amendment protocol, not an overwrite.

Not every selection can be promised a final outcome: if sufficient authoritative
evidence never arrives, it must remain unresolved. Source ingestion/edition refresh
availability is therefore an operational acceptance requirement.

## Historical protection and reporting

There is no source UPDATE, historical INSERT SELECT enrollment, archive rewrite,
aggregate recomputation or history-reason inference in the migration. After
activation, a trigger rejects changes/deletion/creation of the legacy `engine`
and `clv` shared-record keys, except exact no-op replays. This prevents either
existing publisher from replacing history with mixed-policy calculations. It is
an explicit refusal, not a silently successful publication.

`matchmind_prospective_report_v2()` returns only policy activation and separate
prediction/slip populations with enrolled, unresolved, hit, miss and void counts.
It returns no individual selection, fixture document or evidence. It neither
combines its denominator with legacy records nor computes/replaces legacy CLV.
Do not add the prediction and slip populations together: they are separate units.

The current browser and bounded edition contract are intentionally unchanged.
They do **not** yet consume individual policy-2 ledger decisions. Activation must
wait for reviewed consumer routing so new cohort selections cannot appear as
legacy clock-derived outcomes in historical/detail views. Likewise, the actual
private publisher must handle frozen legacy aggregate writes explicitly rather
than treating their expected refusal as a reason to retry/recompute history.
These are release/activation blockers, not claims that the live conflict is fixed.

## Installation, activation and recovery gates

1. Verify deployed source table shapes, immutable issuance, write grants/RLS,
   provider status vocabulary, original UTC kickoff representation and existing
   `mm_fixture_delivery.publisher_allowed()`/edition-refresh contracts. The local
   proof is PostgreSQL 16.6 with synthetic schema, not deployed-schema parity.
2. Independently review `PROPOSAL-up.sql`; install only in explicitly approved
   isolated staging. It requires the bounded-delivery schema and starts inactive.
3. Verify new-cohort consumer routing, private scheduled publisher compatibility,
   evidence capture and cadence in staging. Preserve old shared-record payloads
   and timestamps exactly. No inference/backfill of any historical settled void.
4. Separately approve `ACTIVATE-review.sql`. Its source-table locks and the
   enrollment policy-row lock separate in-flight legacy issuance from the new
   policy. An old repeatable-read issuance snapshot fails rather than missing
   enrollment after cutover. Ordinary app openings grant no authority.
5. `PROPOSAL-down.sql` is allowed only while inactive and empty. Once activated or
   populated it refuses: retain the ledger and evidence for recovery. Never roll
   back by deleting decisions or reverting enrolled picks to the old rule.

No production approval, data operation, installation or activation is implied.
The original mathematical engine, archives, probabilities and financial controls
are unchanged. Publication/branding rights and other existing release gates remain.

## Verification

`test/prospective-settlement.test.mjs` creates only its own ephemeral PostgreSQL
container, with pinned image digest, no network and no published ports; teardown
removes that container and its anonymous volume. Production clock reads database
statement time. Only the isolated test replaces that private clock function to
exercise the exact 48-hour boundary; no production clock override exists.

Run on Node 20.20.2 and 24.19.0:

```
node --test test/prospective-settlement.test.mjs
```

The 17 tests include migration/empty rollback, old-snapshot cutover, authorized
atomic enrollment, delayed NS, PST/CANC boundaries, evidenced rescheduling,
ABD/SUSP/INT, delayed finals, accepted observation provenance, incomplete issuance,
DNB and late-played outcomes, independent selections, concurrency, immutable final
decisions, protected historical aggregates and private evidence/aggregate-only ACLs.
One test compares all 25 supported codes across 2,000 score/half-time cases against
the existing application grader. Existing settlement-consumer, immutable-engine
and staging-preview checks are reused separately. The focused CI workflow has no
deployment permissions and does not change the existing development preview.

Final local verification on 12 November 2026:

| Runtime | Prospective PostgreSQL tests | Existing settlement/engine/staging tests | Failures |
|---|---:|---:|---:|
| Node 20.20.2 | 17 | 23 | 0 |
| Node 24.19.0 | 17 | 23 | 0 |

The existing group comprises 17 settlement-consumer tests, 2 immutable-engine
checks and 4 staging-preview checks. There are 80 passing test executions across
the two runtimes; the 2,000 grader comparisons per runtime are assertions within
one test, not 2,000 additional test-runner tests. All SQL tests use real local
PostgreSQL, synthetic facts and a substituted local-only clock. No hosted SQL was
executed. Generated staging HTML SHA-256:
`515606a56cbe36ca03efec59a8e75fb1a71a25880353aac686ab85b9754d9408`.
All six generated files passed exact protected email/password/admin-key scans and
production-binding/privileged-key marker checks. The public client, forecast
engine, publisher, existing workflows and staging builder remain at baseline.
