# Isolated A3 workflow implementation plan

**Goal:** Assemble the accepted A3 evidence/response/engine infrastructure into a working offline generation-and-comparison workflow without changing A4 or live execution policy.

**Architecture:** A closed, versioned football-only complete-competition packet is admitted from a source capability. Retained-source authority is the exact previously accepted private journal digest; synthetic tests use a separately labeled capability and never prospective status. New offline request drafts have their own A3-compatible prompt/schema. Historical replay uses the original request and existing `parseResponse` unchanged. Downstream comparison preserves Build355 and freezes a review artifact, not a new historical forecast or ledger.

**Spec:** Director's October 27 one-day implementation sprint instruction. Target October31 is a target, not execution authorization.

**Global constraints:** No paid inference, reservations, Sunday/date-policy changes, hosted writes, production/Build356, merge or deployment. A4 v0.2.0 and all accepted source/model/financial guards remain unchanged. Original Gemini A3 is unavailable due to expired authorization before HTTP; never retry. No coefficients, model averaging or value selection.

**Review focus:** Exact source authority versus caller flags; target/post-receipt results; alias/nested odds/engine leakage; replay versus new issuance; abstention versus malformed/blocked response; immutable comparison with separate engine and AI paths.

## Files and test cycles

- [ ] `audits/a3-workflow/contract.mjs`, versioned prompt/schema: test complete source preservation, forbidden/extra fields, chronology, orientation, no odds/engine, unknown advanced fields and bounded structured response before implementation. Reuse canonical hashes, text policy, bounded JSON and existing response validator where applicable.
- [ ] `audits/a3-workflow/workflow.mjs`: test model-pinned offline drafts, citations, abstention/failure separation, frozen comparison and no baseline fallback counted as AI. Retained legacy replay calls the original A3 parser; new format keeps risk separate from probabilities with explicit uncalibrated uncertainty.
- [ ] `audits/a3-workflow/retained.mjs` and CLI: read only the exact accepted journal, bind source/request/profile/usage/forecast lineage, preserve raw response and historical timestamps, replay LAFC OpenAI A3 and retain unavailable Gemini A3. No raw private records in Git. Persist review artifacts only to a newly created local directory using exclusive writes.
- [ ] Synthetic regression fixtures under `audits/test-support/a3-workflow.mjs`; tests `audits/test/a3-workflow.test.mjs`. Red then green; Node20/24 focused and complete GitHub audit suites. Demonstrate actual retained source/response offline; inspect final diff and frozen hashes.
- [ ] README/report: concise actual demonstration and exact fresh-source/provider/account/ledger/checkpoint/BYOK/final-request and future-date-policy approvals required for one upcoming fixture. Commit on continuation branch; PR6 draft; stop for Director review.
