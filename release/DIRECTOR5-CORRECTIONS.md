# Director 5 focused release corrections

Baseline: draft PR #28, `d05dde4c645f819f06c8f974772cf8d4b098927b`.
Authority: owner final status ruling of 10 November 2026, issue comment 6770342305,
superseding earlier Director wording. PUBLICATION REMAINS NO-GO.

## Reviewable corrections

- Current accepted fixture date/time and competition drive public grouping; the
  archived forecast retains its original kickoff, time, identity and probability.
- PST/ABD/CANC/SUSP/INT use distinct full status words immediately in Analysis,
  Scores and details. Exceptional status takes precedence over a cached unresolved
  extra-time score. No score or settlement is manufactured.
- Full accepted public fixture inventory remains visible even without a pick.
- Read-only forecast presentation no longer calls the historical clock-only void
  helper with a null result. Expiry presentation needs an original archive and
  48 hours from its original kickoff plus PST/CANC or an evidenced reschedule of
  at least 48 hours. ABD/SUSP/INT alone never establish expiry.
- Exceptional fixtures and expired forecasts are excluded from Top Matches.
  Green DNB/probability and normal winning/losing chips retain their appearance.
  A completed DNB draw has a neutral original-selection `DNB · Void` badge;
  genuine expired forecasts read `Pick expired`. Both have tap/keyboard explanations.
  The older-date display's DNB void is excluded from its displayed hit-rate denominator.
- A failed Scores refresh preserves its match count and competition-filter disclosure.
- Scores row text is escaped at the actual renderer boundary, including the raw
  cloud-shaped path. Public no-SDK/account/discovery/privacy messages no longer
  request personal service keys. Direct-provider discovery is disabled publicly.
- Added runtime two-card shared-fixture settlement evidence using unchanged grading;
  delayed Champions League edition/loading, original-row preservation, current
  competition grouping, stale-edition rejection and publisher inventory evidence.

## Unresolved settlement policy conflict — Director decision required

`pickPlayState(pred,f,nowMs)` still returns `void` after 48 hours from the original
kickoff without requiring any evidence of non-play when no final score is available.
`pickVerdict` and derived historical record/CLV/day consumers use this legacy helper.
Thus a provider AF `NS` row with a delayed result can still be classified `voidLate`
in those historical/derived record paths. It can also void an ABD/SUSP condition
without the newly required approved settlement evidence. The new display guard
is deliberately NOT a claim that this underlying conflict is resolved.

Smallest proposed subsequent correction: retain the existing late-played guard and
normal result grader; gate the *pending-result* 48-hour branch on explicit accepted
postponement/non-play evidence, preserving original kickoff. Apply only to records
proved unsettled under an approved policy/version boundary. Identify and preserve
already settled outcomes before recomputing any published historical aggregate.
The current schema does not provide this patch with an authoritative settled-void
reason ledger; do not infer or retroactively migrate it. Director approval and a
separate reviewed prospective settlement correction are required before release.
No historical grader, archive writer, formulas, engine, SQL, publisher, schedule,
backend security or financial controls are changed here.

### Prospective implementation prepared — 12 November 2026

The separately approved policy-2 implementation is proposed in
`backend/settlement-cohort/PROPOSAL-up.sql`, with its activation and rollback gates
documented in that directory's `README.md`. It enrolls new authorized issuance
transactionally, preserves final per-selection decisions and exposes separate
aggregate reporting. It does not change `pickPlayState` for historical records,
backfill reasons or recalculate published aggregates. No hosted migration or
activation has occurred. This release hold remains until staged source/consumer
integration and explicit activation review; backend proposal tests alone do not
establish live remediation or public-release approval.

## Evidence and limits

`test/director5-release.test.mjs` covers exceptional statuses before kickoff,
current versus original schedules, NS delayed results, exact 48-hour boundary,
reschedules, DNB draw/win/loss, malicious Scores rows, no-key public paths,
two-card settlement, missing older-date results and 320/390px mobile layout.
The workflow also runs this file in simulated WebKit.
Existing provenance and immutability assertions were updated only where the final
owner ruling explicitly changes visible date/time, full inventory or DNB wording.
The combined-security harness observes completion of the real startup refresh
before installing its unrelated account stub, removing a reproduced baseline race.

The existing publisher has no LIMIT/OFFSET in materialization, projects the admitted
source inventory atomically, and refuses missing immutable predictions, board/slip
references or payload bounds/identity violations. It cannot prove collector source
completeness or a universal expected competition count. No screenshot-specific
server root cause or real-origin acceptance is claimed.

Offline CI and browser simulation do not establish hosted Auth/RLS/session/sync,
physical Android/iPhone, installed-PWA update/rollback, publication rights, branding,
retention, subscription or operator evidence. One consolidated staging deployment
and acceptance require separate authorization. Production merge/deploy/publication
also require separate approval. No staging/production/provider/paid requests occur.

The public HTML is patched on the pinned accepted public branch, not regenerated
from the private builder. The WO62B source manifest remains the original integration
provenance; it is not a claim that the post-Director HTML has that original hash.
Do not overwrite this candidate with older generator output without parity review.
STOP for Director 5 review.
