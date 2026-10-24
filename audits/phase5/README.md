# Phase 5 reproducible offline research

Read [REPORT.md](REPORT.md) for decisions and [SHADOW_PROTOCOL.md](SHADOW_PROTOCOL.md) for the unactivated private evaluation design. No module here is loaded by the application or publisher. There are no provider clients, AI calls, Supabase migrations or resource-creation scripts.

## Reproduce

1. With separately authorized read-only database access, run **the entire** `011_readonly_cohort.sql` transaction. It begins `REPEATABLE READ READ ONLY`, applies a 30-second timeout and ends with `COMMIT`. Do not run it through a migration tool. Save the final `audit` JSON object as `cohort.json` in a private directory outside this repository, mode 0700 with file mode 0600. Never put database credentials, tokens, private collector code or raw exports in GitHub. Do not add write permissions to get an export.
2. Run offline, with Node 20.20.2 or 24.19.0:

   ```sh
   node --test audits/test/*.test.mjs
   node audits/phase5/analyze.mjs /private/path/cohort.json > /private/path/analysis.json
   ```

3. Compare the export SHA-256, query/source hashes and metadata with `results/2026-10-24-analysis.json`. The checked-in JSON contains aggregate metrics, not fixture rows. Identical private export and source produce byte-identical aggregate output on both tested Node versions. A new live read may change labels/coverage and cannot be expected to reproduce the old hash. Keep a private copy of the frozen export if long-term exact replication is required; cloud workspace retention alone is not an archival guarantee.
4. Audit 003 overall/confidence/monthly results map to `baseline`, `confidence_bins`, `by_match_month`; 004 to `market`; 005 to `legacy_blends`; 006 to `disagreement` and paired calibration; 008 to `paired_competition` (stable league ID, minimum 20). `by_issue_month` and `experiments` intentionally use issuance time. Original SQL 004 has tighter clock-format/status predicates than 003; its principal current totals reproduce, but future malformed-time rows could make the cohorts differ. Do not presume universal equivalence of these predicates.
5. Audits 009/010 were separately repeated read-only at the timestamps in `results/2026-10-24-coverage.json`; those mutable-archive reads do not enter candidate fitting or the earlier frozen cohort. Retain their source files and read timestamps. Raw initial connector responses are not distributed in the public repository. Source query hashes for the frozen extraction and analysis modules are in the result manifest; the Git commit versions the other audit sources.

## Metrics and controls

- `validation.mjs`: rejects invalid triples/labels/duplicate fixture IDs; exact identity handling; Brier/log loss; deterministic paired cluster sensitivity intervals; class reliability/Wilson intervals/AUC; conservative retrospective label-update proxy; fixed-grid training-only selection; microsecond timestamp prerequisite.
- `saved-lambda.mjs`: extracts the existing trusted repository grid into a Node VM without loading DOM/network application code. Accepts only bounded numeric lambdas/rho. This is a numerical diagnostic, not a security sandbox for arbitrary code or an exact historical input replay.
- `analyze.mjs`: consumes private extraction and emits aggregates, source hashes and qualified exploratory experiments. Candidate selection sees training labels only. History diagnostics never become candidate inputs. Publication, collection and deployment are outside scope.
- Tests include known independent probability scores, Poisson-grid reference, label cutoff isolation, future/missing/invalid timestamps including microseconds, immutable-rounded identity, duplicate handling, paired cluster degeneracy, empty cohorts, tied AUC, and end-to-end synthetic grouping of competition display aliases.

The legacy market timing contract is weaker than authoritative receipt provenance. Neither a `captured_at` field nor `shadowTimingEligible` certifies a source. Future confirmatory acceptance is intentionally blocked until the full protocol prerequisites are satisfied. No old historical row is relabelled as immutable evidence.

## Verification and rollback

The feature baseline has 34 tests; nine added Phase 5 tests give 43. PR #1's 107 tests live on its separate branch and were not imported. CI on this branch and PRs to the feature branch runs the audit suite on Node 20/24 with read-only GitHub permissions and no production secrets.

Closing/reverting this draft reverses the work. No database backup/restore, app redeployment or engine rollback is necessary because none was changed. Future private shadow backup/repair requirements are design-only in the protocol. Preserve `main`, Build 355 backup, feature branch and PR #1. Paid AI remains disabled.
