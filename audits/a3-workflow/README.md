# Isolated independent A3 workflow — offline only

This is the smallest working continuation of MatchMind's existing independent
Home/Draw/Away experiment. It does not restart A4, build a value selector or enable
live execution. Stage3C remains accepted. Every previously tracked implementation
file is unchanged; this work is additive under its own namespace.

## Working path

1. Admit a source capability. `authority.mjs` accepts the **exact previously
   accepted private LAFC journal byte digest** for historical replay. It binds the
   packet's canonical content, original database receipt and database body-hash
   identity. This is retained-evidence use, not a new recovery/archive audit.
   Separate synthetic capabilities always remain synthetic. Caller-provided
   `verified` flags, replacement files and arbitrary current mutable data cannot
   mint a genuine source capability. There is no general real-source registry.
2. `buildPacket` constructs `a3-football-evidence-v1`: source-bound fixture identity,
   original receipt/read time, complete as-collected competition table, explicit
   21-field dictionary, limitations and deterministic packet hash. It preserves
   every required row, value, null, row order and missing-field representation;
   it rejects missing required columns rather than inventing them. It uses the
   existing lossless `evidenceView` projection. No history truncation or rounding.
3. `draftRequest` prepares an **offline** pinned OpenAI or Gemini body with new
   prompt 1.0.0 and a strict A3-compatible JSON response schema. Both receive
   identical football packets. Source read must be within 15 minutes, the profile
   must pass the existing integrity/freshness checks, and the fixture must still
   be pre-kickoff. There are no tools, search, plugins, fallback routes or engine
   forecasts. `arm=A3-OFFLINE` and a new request version deliberately fail the
   existing live executor's request admission before any reservation/transport.
4. `validateAnalysis` checks the richer response, exact fixture/packet, allowed
   citations, separate football analysis/risk/limitations and explicit unvalidated
   calibration. It projects the original A3 decision fields into the **unchanged**
   existing `parseResponse` for provider identity, usage, probability sums and
   abstention rules. It never treats malformed JSON/provider refusal/truncation
   as a model abstention. Such failures throw for the caller to retain as failures.
5. `freezeComparison` places an unchanged engine artifact alongside separately
   identified AI probabilities and risk. No averaging, multipliers, adjustment,
   value ranking or replacement of an abstention with engine probabilities.
6. `writeReview` creates a new private local directory with exclusive writes,
   a content-hashed comparison and manifest with actual file-write time. It fails
   if the directory already exists. These are offline review artifacts, **not**
   new forecast issuance, an append to historical research, a shared financial
   ledger, or a replacement for established immutable research checkpoints.

`replayLegacyEvents` is a bounded offline projection of supplied legacy events.
Its engine/model lineage remains unverified without the retained wrapper.
`replayRetained` obtains exact accepted-journal authority, rebuilds the original
request view, validates original request/profile/response/forecast joins and
chronology, and labels the resulting comparison as verified retained replay.
It does not use caller flags to assert that a model actually ran.

## Narrow contract and independence

The football table admits only fixture/competition labels and IDs, UTC date/time,
season, source status/provider, six source score fields, two xG-labeled fields and
two opaque player-ID-token fields. `contract.mjs` contains the complete dictionary
and semantic validator. Row objects with extra/aliased/nested fields reject;
schema-bound football label validation and injury-token syntax prevent free
commentary from entering those scalar channels. Finished matches at/after receipt
reject; unplayed rows with goals/xG reject; the target must be unplayed, future
relative to its receipt and correctly oriented. Receipt does not prove an old
historical value was available before an even earlier match's kickoff.

The private engine source packet contains engine originals/measurements and odds.
They remain available for historical engine lineage **downstream only**. The
explicit football projection never serializes these objects into the analyst
input. Unknown row columns reject instead of being silently dropped. The table
includes scheduled/cancelled inventory rows, labeled by status, never outcomes
invented for them. Required scope is the complete competition as collected, not
an invented claim of provider-wide or all-competition schedule completeness.

Known source limits remain visible: normalized FINISHED is not a proven
90-minute settlement label; xG field names do not independently certify measured
provider semantics; opaque injury tokens are not named confirmed absences; tactics,
lineups, travel, rest completeness and current news are not fabricated. Supported
qualitative claims require review; a valid citation is not semantic proof.

These narrower **A3** requirements do not amend or satisfy the accepted twelve-topic
**A4 v0.2.0** contract. A4's active/baseline prompts, schemas, source authority and
feature mapping are unchanged. No A3 record becomes A4. All packet outputs remain
`certified_prospective=false` in this offline implementation.

## Prompt, response and capacity

The complete new prompt is `prompts/1.0.0.md`; the strict proposed response schema
is `response.schema.json`. `artifact-manifest.json` pins their identities on load.
Any later semantic change needs a new version and tests, not a silent file edit.
The response keeps the legacy `abstain`, `reason`, `probabilities`, `evidence_refs`
fields and adds exact fixture/packet identity, up to six cited football statements,
a distinct cited risk assessment and required uncertainty limitations with
`calibration=not_validated`. Risk concerns do not mechanically adjust a forecast.
Abstention requires null probabilities, empty analysis and insufficient-evidence
risk. No confidence score or goal-rate multiplier is introduced.

The new request's 4,096-token **proposed** output allocation is explicitly different
from legacy A3's 1,024; actual adequacy and the exact backend's schema support are
not demonstrated by local tests. Existing physical output/pricing/profile caps
are still used for conservative draft checks. Byte/context proxy checks measure
serialization and fail without truncation; they are not tokenizer measurements
or evidence of current provider readiness. New replies are limited to 32KiB and
strict bounded JSON. Packets are bounded to 10,000 competition rows and existing
16MiB JSON limits; exceeding a bound fails admission and never shortens history.
Legacy replay separately bounds complete serialized message strings at 2MiB and
total string/key bytes at 16MiB, depth16/nodes100,000, preserving all input. It does
not change the accepted A4 parser's limits.

## Genuine offline demonstration

Run only with the existing private accepted journal, outside public Git:

```sh
node audits/a3-workflow/replay-cli.mjs PRIVATE_JOURNAL_PATH NEW_PRIVATE_REVIEW_DIR
```

The path must be the exact accepted file; the output directory must not exist.
The CLI has no network/credential/database/ledger writer, uses actual replay time,
and emits a concise comparison plus hashes. It preserves original issue/receipt
times independently from today's artifact creation time. Re-running produces a
new review artifact, never another HTTP attempt or historical forecast event.

The real demonstration's source receipt, full competition-row count, original
model probabilities, exact issue/receipt timestamps and immutable comparison
references are included only in the private Director delivery package. Actual
historical predictions and provider records are not published in this checkout.

The replay uses the accepted genuine historical prediction, not newly generated
AI analysis. Historical narrative/uncertainty fields absent from the original
structured contract stay absent. The new packet supplies source limitations
separately; it does not attribute invented explanations to an old provider
response. The earlier original published E context is not reconstructed: its
stored abstention is preserved. No later match outcome is used in this replay.

## Exact remaining authorization and technical gates

October31 is a research launch target, not permission to execute or deploy.
The existing real executor still admits only **2026-10-25 UTC**. No Sunday guard
or future-date dispatch policy changed. The new drafts deliberately cannot run
through it. Current A3 source authority is a single retained historical anchor;
new real fixtures cannot gain authority through the synthetic adapter.

The smallest next proposal is **one new fixture, one explicitly selected GPT-6
Luna A3 request**, pinned to OpenAI, compared with unchanged Build355. The richer
request includes a separate risk field, avoiding an extra scout call and avoiding
new A1 multipliers. Gemini draft support stays independently identified, never a
fallback or automatic second call. Its old blocked request remains non-repeatable.

Before any paid final proposal, separately authorize only:

1. A tested, narrowly date/fixture/study-bound supervised future-experiment
   controller and new-contract adapter, preserving the original Sunday function
   and all per-request runtime, source, profile, account, confirmation, timing,
   ledger, no-retry and checkpoint guards. No unrestricted date flag or paid
   future-date pathway is installed by this sprint.
2. A fresh source read/enrollment using existing approved infrastructure for the
   actual upcoming fixture: exact identity/status/kickoff, complete required
   as-collected competition history, original database receipt, sealed content
   and existing immutable checkpoints. Bind the new A3 capability to that real
   receipt. Reuse old history only as genuinely available at the new issuance;
   never use it as proof of old forecast-time availability or use post-cutoff data.
3. Nonbillable authenticated endpoint/pricing/capacity, account/key/ledger and
   restricted-runtime checks, and a review of the **exact** selected provider's
   support for this schema/output/reasoning contract. No experimental provider
   generation or hosted token-count call is performed by this sprint.

Only after those pass should the Director receive a concrete **separate final
dispatch authorization** request identifying fixture/kickoff, study/request/prompt/
source hashes, model/backend, issue deadline, exact worst-case new reservation,
combined retained liability, current headroom and valid BYOK confirmation. No
old LAFC authorization is reused. Fresh operator confirmation is sought only once
the other gates are ready. No retried, failed, ambiguous or blocked old request
is dispatched. Any new attempt requires safely recorded shared-ledger reservation
and pre/post immutable checkpoints; its liability is retained on ambiguity.

The actual worst-case amount must come from current verified bounds, not a
headline token-cost estimate or available provider credit. All historical holds
and the existing shared $5 lifetime ceiling remain authoritative. The sprint
creates **zero reservations**, reads no live account and sends **zero inference**.

## Verification and stop

`node --test audits/test/a3-workflow.test.mjs audits/test/a4-*.test.mjs` covers the
new contracts plus all accepted A4 regressions. Synthetic legacy event replay
exercises joins, profile integrity, model identity, missing/blocked/refused/truncated
responses, risk/abstention distinctions, response/source hashes and chronology.
Actual private replay separately verifies retained evidence through the same
replay engine. New offline drafts are tested against the old executor to ensure
zero reservation writes and zero transport calls. No mathematical calibration,
football reasoning accuracy or profitability is inferred from these results.

Final commit, file inventory, complete Node20/24 CI receipts and the genuine
private demonstration summary are provided in the Director delivery package.
PR6 remains draft. Stop for Director review; no merge, deployment or next phase.
