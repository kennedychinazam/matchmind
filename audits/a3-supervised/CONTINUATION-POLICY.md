# A3 scoped study continuation — offline implementation

Policy `a3-study-continuation-v1`; source review
`a3-continuation-source-review-v1`; optional risk receipt
`a3-scoped-capacity-risk-v1`.

## Scope and default state

This is the Director-authorized **offline** correction following the comprehensive
execution audit at `aaaa61f615966fedcaf41d18b74bace8d90c5f92`. It adds one narrow
continuation path to the existing supervised controller, not a halt-clearance
operation, new ledger, generation CLI or automatic experiment.

The provisional scope is Fiorentina–Atalanta, fixture 1550169, Serie A 135/Italy,
kickoff 2026-10-29T19:45:00Z, issuance UTC October 28 or 29, GPT-6 Luna through the
standard OpenAI/openai backend. These are **admission restrictions**, not new
source verification or certification of a live schedule. Any changed fixture,
orientation, kickoff, model or date rejects. The latest fixed pre-HTTP deadline
is strictly before 19:37:30Z; every earlier expiry remains authoritative.

Nothing is active by default. The extension is not installed into the existing
research database by this change. No operational study, source review,
continuation approval, capacity receipt, paid authorization, reservation or
provider request is created. The real 3,452-event head, six reservations, original
halt and consumed Santos latches stay unchanged. Later installation and every
operational receipt require separate authorization. An implementation approval
must never be represented as exact-request operational consent.

## Three independent receipt purposes

All are immutable rows in the additive private `a3_continuation_receipts` table.
Only the existing trusted `shadow_operator` can record them through the new
closed writer; public/anonymous/authenticated/runner roles cannot. A caller JSON
flag, copied receipt file or arbitrary SQL callback cannot authenticate one to
the genuine controller. It reads through the owned pinned local repository.

Every receipt binds study_id, job_id, fixture_id, kickoff_at_utc,
issuance_date_utc, model/provider/backend, request_hash, canonical
request_body_hash, packet_hash, source_hash, prompt_hash, schema_hash,
profile_hash and endpoint_contract_hash.

1. **Source review:** binds the exact original database receipt string and a
   retained review-artifact hash. Requires reviewed current pre-match receipts
   and verified regulation 90+stoppage settlement basis. It must precede the
   continuation approval. This is a **trusted independent review attestation**,
   not an automatic proof that a hash/boolean makes missing source evidence true.
   The reviewer must actually examine original collection provenance, inventory,
   time availability and period evidence. No reviewer, provider payload, receipt
   authority or settlement evidence is fabricated or enrolled here. Missing
   genuine support blocks the future operation. Packet limitations and
   certified_prospective=false remain unchanged.
2. **Study continuation:** requires explicit later Director approval, binds the
   source-review row/hash and acknowledges a complete exact list of historical
   halt event IDs/body hashes. Specifies one attempt, max_new_micros 306000,
   selected capacity mode and expiry. It does not authorize payment. The new study
   must differ from the ancestor study of each acknowledged halt. Altered,
   removed, additional or same-study halt records invalidate the receipt.
3. **Optional capacity risk:** only if the study approval explicitly selects
   capacity_risk. Requires a separate typed receipt binding that approval and its
   hash, the exact request bytes, endpoint 922000/1050000/128000 limits, 4096 output,
   technical-review hash and explicit later Director consent to the risk.
   capacity_status is always unverified and complete_input_upper_tokens is null.
   This never copies, renews or consumes a Santos exception. Alternatively use
   the unchanged reviewed-capacity readiness path; no new risk receipt is needed.

A later Director statement may explicitly cover both new-study consent and its
capacity-risk consent; the two different typed receipts still have independent
scope checks. A statement cannot be replayed into another study or another
receipt of the same purpose. Final **paid** authorization remains a separate
explicit owner decision and must bind the continuation row/hash and, when used,
the scoped capacity row/hash. Consent authenticity remains the trusted operator's
responsibility; a digest is an audit identity, not a cryptographic human signature.

## Halt enforcement and one attempt

Without an explicitly selected, valid continuation receipt, the original
unconditional halt guard is unchanged. With one, **only** its exact historical
halt set may be acknowledged for **only** its exact study/request. The rows remain
immutable, still visible to all other requests. The controller revalidates them
on every admission cycle. A new failure creates an additional halt; an old
approval cannot acknowledge it automatically.

`a3_continuation_attempts` has a unique fixed scope key for this provisional
fixture experiment, plus unique approval/reservation/risk IDs and the original
study latch. Both capacity modes share it. A changed request hash or study name
cannot create a second attempt after this scope has been consumed. The old
Santos global capacity latch remains in its original table, consumed and unusable.
No deletion, update, release, reset or automatic retry API is added.

## Atomic and exact financial binding

The new SQL takes the existing research.control lock, revalidates approval,
source review, current halt inventory, request/authorization, capacity evidence,
source and operator clocks and six-minute margin. Verified mode then calls the
original `a3_single_reserve`; risk mode uses the same original weekend_append
reservation/confirmation writer. Both consume the original per-study latch and
new fixed-scope latch in one transaction. The unchanged shared $5 budget and
resource ceiling remain authoritative. A failed budget/deadline/latch insert
rolls back the entire synthetic/operational transaction rather than creating a
second ledger or releasing an older hold.

For this new path only, the reservation also retains canonical_request_body.
SQL hashes those exact canonical bytes against the reviewed body hash and checks
that the parsed object equals request.body. This prevents a changed HTTP body
being paired with an unchanged claimed hash at the reservation boundary. It
adds a bounded private serialization copy, never another model input or history
truncation. Existing raw/request records and formats are not rewritten.

## Preserved execution gates

Source 15-minute freshness starts at the **original earliest collection receipt**;
review/enrollment cannot renew it. Operator/BYOK/paid authorization retain their
10-minute rules; current fixture/account observations 2 minutes; runtime 10 minutes.
Continuation and optional risk receipts expire within 10 minutes and cannot extend
source, kickoff or UTC-date limits. Source review precedes continuation; consent
and risk precede final paid authorization. All existing model/profile/pricing,
key/workspace/BYOK, backup, checkpoint, strict response, independence and genuine
transport checks remain mandatory. The normal complete-input bound pathway is
unchanged. Actual usage on risk admission is checked against declared endpoint
limits and the4096 output cap; failures retain raw evidence/liability and halt.

The existing pre-staged owned wrapper now fingerprints the new JavaScript policy
too. It still must precede source collection and authorization and cannot be
reused/replaced. Require strictly more than 360 seconds to the earliest hard
expiry before remaining metadata work and reservation. SQL independently checks
that margin against hard expiries, while retaining the shorter account/fixture
effective deadline for the atomic commit. Slow operations do not extend expiry.
The original Sunday executor/date restriction is untouched.

## Verification and remaining readiness

Synthetic controller tests exercise accepted normal/risk scope, missing or
cross-study approval, all halt mutations, old Santos scope/latches, source review,
capacity limits, new halts during checkpoint, budget, timing and failure handling.
Isolated PostgreSQL tests exercise actual role restrictions, closed immutable
receipts, exact-body checks, original function preservation, shared-ledger
rollback and one-attempt consumption. All financial/approval records in those
tests exist solely in disposable network-none synthetic databases.

After the fixed fixture window expires, the SQL tests explicitly report a skip
for the positive-path exercise rather than claim it ran; deterministic synthetic
controller tests continue to cover those admission branches. In-window SQL runs
are recorded separately.

Passing these tests establishes admission behavior, not provider compatibility,
source authenticity, real football reasoning, calibration or a prediction.
Before genuine preparation: Director accepts the implementation; separately
approves any database installation; genuine Fiorentina source/period review is
satisfied; an exact new study/request and capacity route receive explicit consent;
a reviewed wrapper is staged before owner-coordinated collection; then all
original runtime, source, financial, BYOK, backup, checkpoint and final paid gates
pass with enough time. None is supplied by this implementation.

Keep PR #6 draft/unmerged. No inference, provider metadata request, financial
reservation in the existing database, hosted write, production/Build356 change,
deployment or subsequent stage is authorized or performed.
