# Historical exploratory view for the legacy Sunday baselines, 25 October 2026

Owner-approved research-integrity policy, implemented additively. No private
checksum, backup, packet or credential appears here or anywhere in this
repository. See the [unresolved recovery dependency](UNRESOLVED-RECOVERY-DEPENDENCY.md)
and the [full-cycle dry run](2026-10-25-full-cycle-dry-run.md).

## Why an exception exists at all

The Sunday cohort was written by code that sets `requires_confirmation` into a
database restored from a Saturday-era dump whose kind constraint could not store
a `confirmation` row. The acknowledgement was **impossible, not withheld**. The
restored head still carries that constraint, with no `confirmation` kind, which is
the documented fact the exception rests on.

`report.mjs` therefore downgrades every such forecast to
`failed / commit_unconfirmed`, and the strict view keeps doing exactly that.

## What the policy does and does not allow

- Checkpoint verification is **not** an accepted confirmation. No confirmation
  event is created, backdated, rewritten or manufactured, anywhere.
- The **strict view is unchanged**. Unconfirmed forecasts stay failed and are
  never counted as confirmed.
- A separate **historical exploratory view** may reclassify qualifying records as
  `legacy_checkpoint_verified_unconfirmed`, keeping their original contents,
  their issue timestamps and their missing acknowledgement visible on the record.
- The exception is scoped to the attested study's **original E-Refreshed engine
  baseline on `sunday-engine` jobs only**. AI arms, paid requests, later studies
  and any other unconfirmed record keep the strict rules.
- The view may compute retrospective descriptive performance from genuine settled
  results. It never claims confirmed issuance, publication or confirmatory
  superiority.

## Eligibility proof, per record

`audits/phase8-continuation/legacy-exploratory.mjs`. `legacyAttestation` refuses
to exist without every proof, rather than degrading to a weaker check: a
checkpoint chain that passes the repository's own `verifyAncestry`, the restored
kind constraint text (and it must **not** admit confirmations), zero corrupt body
hashes, a restored event count equal to the verified head, the exact study
identity present in that head, and the original engine input hash.

`qualifyLegacyForecast` then requires, per forecast: arm `E-Refreshed`, cohort
`sunday-engine`, original status `forecast`, `requires_confirmation` true, no
acknowledgement present, presence in the verified head manifest, a body hash equal
to the attested hash, forecast to job to packet to attested study lineage, receipt
strictly before its own kickoff, generation at or before its own receipt, a
64-hex input hash equal to the attested engine input hash, a non-empty engine
source hash, and three probabilities in range summing to one.

Any failure excludes the record and records the precise reason. The reasons in use
are `arm_not_original_engine_baseline`, `cohort_not_sunday_engine`,
`status_not_forecast`, `confirmation_not_required`, `acknowledgement_present`,
`event_absent_from_verified_head`, `body_hash_mismatch_against_verified_head`,
`verified_study_lineage_mismatch`, `unparseable_receipt_or_kickoff`,
`receipt_not_before_kickoff`, `generated_after_receipt`,
`engine_input_lineage_absent`, `engine_input_hash_mismatch`,
`engine_source_hash_absent`, `invalid_probabilities` and `original_event_absent`.

`applyLegacyException` returns a new study view and mutates nothing: not the
journal, not the strict study object, not the ledger. `evaluateHistorical` runs the
existing `evaluateContinuation` over that view, so every denominator, settlement,
void and pending rule stays in one place, and adds `view`,
`confirmed_issuance: false`, the exception ledger and its own limitations.

## Denominators

The whole declared roster is kept. Engine classifications are preserved on the
record. Event counts are reported separately from fixture counts, so a baseline
present on several cohort jobs of one fixture is never read as several fixtures.
Failed, excluded, abstained, pending, invalid and missing records all stay
visible. A1, A2 and A3 acquire no score under any circumstances.

One deliberate behaviour worth knowing: a continuation row carries a merged copy
of its baseline's forecast rather than an event of its own, so the exception
refuses it as `original_event_absent` instead of admitting a copy. The fixture's
real baseline, on its engine job, is admitted, so no fixture loses its baseline.

## Tests

`audits/test/phase8-legacy-exploratory.test.mjs`, pure and deterministic, on fixed
timestamps with no wall-clock dependence:

1. The strict report still refuses every unconfirmed forecast.
2. The historical view admits only the attested study's original engine baselines,
   and reclassified records keep contents, receipt and missing acknowledgement.
3. An AI forecast can never borrow the exception, and no AI arm acquires a score.
4. A tampered head hash, a forked chain, a non-zero corrupt-hash count, a wrong
   restored event count, a constraint that admits confirmations, an absent study,
   a malformed engine input hash and an empty chain are each refused.
5. A newer study missing its confirmations cannot use the exception, by study
   scope and by engine input hash.
6. The view changes no denominator, leaves the strict study byte-identical, and
   settles only on genuine results: regulation time over extra time, 48-hour void,
   pending, and ambiguous extra-time scores.
7. No performance is reported before genuine settled results exist.

## Limitations that remain

Sunday outcomes have not been collected, so no Sunday performance figure exists in
either view and none is claimed. Sunday 25 October kickoffs have passed, so no
pre-kickoff AI forecast for those fixtures is possible. A1, A2 and A3 hold no
genuine model output anywhere in the journal. The retained worst-case reservation
is untouched, and actual provider cost stays unknown rather than zero.
