# Santos A3 capacity-risk exception — implementation review

Director-authorized scope: implementation and offline testing only, based on
`9616cb5d07c94d8af3f1cd7534fc37dbc0f3dbe9`. No genuine source refresh,
exception/authorization receipt, financial reservation, inference, hosted write,
merge or deployment was performed. All new receipt and reservation examples in
tests use synthetic data and disposable, network-none PostgreSQL databases.

## Isolation and decision

The controller has an additional, explicitly selected receipt pathway:
`a3-capacity-risk-exception-v1`. It applies only to experiment
`santos-palmeiras-1492438-20261028-a3-capacity-risk-v1`, fixture 1492438,
Santos home / Palmeiras away, competition 71, Brazil, kickoff
2026-10-28 22:30 UTC. It admits issuance only October 27 or 28, strictly before
22:22:30 UTC on October 28, and within all earlier source/operator deadlines.

The normal `a3-reviewed-provider-bound-v1` branch retains its original bound,
schema, endpoint and usage comparisons. No exception is inferred from a missing
bound or an approval boolean. Supplying both pathways is rejected. An exception
cannot masquerade as a normal readiness receipt: they occupy separate tables,
have different reader methods and use different versioned contracts.

**Software preparation is offline-verifiable; actual input compatibility remains
unverified.** The exception never provides a tokenizer measurement or upper bound.
A later genuine request may be rejected or may exhaust its 4,096-token total
output allocation without a valid forecast. A rejection, malformed response or
ambiguity retains liability and ends this exception's experiment without retry.

## Receipt contract and authority

The new receipt is a closed, flat object with all 30 fields required; unknown
fields, nested replacements and incorrect types/identities are rejected. The
SQL body limit is 8 KiB. Identifiers and hashes are bounded; the reviewed request
size must exactly match the complete serialized body. Hashes use the existing
canonical SHA-256 contract, except the SQL receipt body hash, which uses the
existing PostgreSQL `body::text` digest convention.

| Fields | Required meaning |
| --- | --- |
| `version`, `experiment_id` | Exact fixed version/experiment above |
| `director_approved`, `director_approval_sha256` | Explicit trusted operator record of the Director's approval of this exception, with message identity |
| `study_id`, `job_id`, `fixture_id`, `kickoff_at_utc` | Exact immutable source/job/study and fixed target binding |
| `issuance_date_utc`, `expires_at_utc` | Actual permitted UTC issuance date; expiry at most ten minutes after receipt and before fixture deadline |
| `request_hash`, `request_body_hash`, `packet_hash` | Exact admitted plan, complete request body and football evidence packet |
| `prompt_hash`, `schema_hash`, `profile_hash`, `endpoint_contract_hash` | Unchanged analyst contract and selected endpoint/profile identities |
| `model`, `provider`, `backend` | `openai/gpt-6-luna`, `OpenAI`, `openai` only |
| `input_bytes` | Exact complete body byte size, not a token bound |
| `complete_input_upper_tokens`, `capacity_status` | Exactly JSON `null` and `unverified` |
| `provider_input_cap_tokens`, `context_tokens`, `physical_output_tokens`, `output_tokens` | Exactly 922000 / 1050000 / 128000 / 4096; endpoint limits, not input measurements |
| `schema_contract_reviewed`, `output_contract_reviewed`, `review_artifact_sha256` | Separate review attestations and reviewed artifact identity; no claim of demonstrated provider acceptance |

The actual immutable receipt additionally carries its database receipt ID,
study/job IDs, original receipt time and verified body digest. A genuine source
requires the existing owned isolated repository and genuine-bound transport.
An arbitrary JSON object, flag, copied store or synthetic packet cannot obtain
a genuine HTTP permit. The trusted operator remains responsible for the truth
of the recorded Director approval and review; hashes and booleans are not
cryptographic proof of the Director's authorship.

Separate final paid authorization is still mandatory. For this route it must
also name `capacity_exception_id`, the exact `capacity_exception_body_hash`, and
`capacity_status=unverified`. Thus the implementation approval, an exception
receipt, and a final paid authorization are distinct. None was recorded in the
retained genuine database during this stage.

## Optional isolated database extension

`singleStore.installCapacityException()` explicitly installs the new SQL only
through the existing pinned local socket/image/network-none boundary. It is
not automatically installed by `installSingle` and has not been applied to the
retained recovery database. Never apply it to hosted Supabase.

New functions are `a3_capacity_record` and `a3_capacity_reserve`; both are private
to `shadow_operator`. Public, anon, authenticated and runner roles cannot invoke
them. Receipt and attempt tables have private RLS, immutable triggers and foreign
keys. The recorder rejects duplicate IDs and repeated Director-approval hashes.
The source target must occur exactly once with the correct orientation, and an
original source receipt from the future is rejected.

The reservation function independently checks the immutable paid authorization,
exception binding, fixed amount, selected route/output controls and clocks. It
uses the **existing research control lock, weekend financial writer, reservation
events and commit-confirmation function**. It inserts the existing study-attempt
latch and a new experiment-level immutable latch in the same transaction.
There is no new spending ledger, release mechanism or reservation refund.

The experiment-level primary key permits one committed attempt across all study
and exception IDs. Competing calls cannot create two holds. A changed request,
new study, different approval or fresh exception cannot reset a consumed latch.
Ordinary reservation/authorization SQL functions and the original Sunday writer
are not replaced or edited; the database regression compares their definitions
before and after installing the extension.

## Dispatch and failure behavior

The existing source, fixture, account, dedicated key, BYOK, runtime, endpoint,
financial, ancestry, recovery and external-copy checks remain required. The
exception is rechecked before reservation, after checkpoint and immediately
before HTTP. Its expiry is included in the dispatch deadline alongside source,
operator, account/runtime and kickoff deadlines. Fresh metadata cannot renew
old source evidence. Source age remains at most 15 minutes from the earliest
receipt; the existing stricter timing and authorization checks still apply.

The prompt/schema, full evidence serialization, independent football assessment,
risk/abstention behavior and 4,096 output allocation are unchanged. No history is
truncated, compressed or replaced. No retry loop, fallback, provider substitution,
search, tools, automatic execution CLI or new future-date pathway was added.

After the sole separately authorized attempt, raw provider evidence is persisted
before validation. Prompt/completion counts must be nonnegative safe integers;
prompt usage must be <=922000, completion <=4096, and total <=1050000. Model,
backend, charges, citations, JSON/response semantics and abstention still pass the
existing strict validator. A successful response does not retrospectively prove
a preflight bound. Reservation and forecast records retain explicit
`capacity_status=unverified` and `complete_input_upper_tokens=null` metadata.

Provider rejection, excessive usage, malformed/length output or ambiguous HTTP
retains the hold and records the existing halt. A failure of the post-response
checkpoint preserves the raw response and already immutable forecast, records
the halt and permits no retry. No record is silently removed to repair failure.

## Financial and historical safeguards

The maximum proposed genuine hold remains $0.306000, conditional on fresh
unchanged pricing/no-cache conditions. Existing retained $2.753008 stays held.
A hypothetical authorized attempt totals $3.059008, leaving $1.940992 below the
shared $5 ceiling. These figures do not authorize a reservation. Key, account
and ledger reconciliation must be refreshed at the later preflight.

Build355, E-Refreshed, A1/A2/A3 history, A4 v0.2.0 and frozen v0.1.0, Stage1/
E-MARKET mathematics, Stage2 quotes, original Sunday execution, private source
receipts/checkpoints/backups, all retained liabilities and the separate Build356
repository are unchanged. No genuine private financial data is included here.

## Failing-first and regression evidence

- The initial positive exception test failed at the old mandatory readiness
  gate. The new path now succeeds only with a synthetic, fully bound exception
  plus separate synthetic final authorization.
- The isolated database test initially failed because the new API was absent.
  It now exercises real SQL roles, immutability, duplicate approvals, two racing
  reservation calls, atomic rollback and cross-study reuse prevention.
- Additional failing-first source tests exposed future-clock and conflicting
  duplicate-target admissions in the new recorder. Both were corrected before
  delivery; the ordinary recorder was left unchanged.
- Controller tests reject missing/expired/altered approvals, wrong study/job/
  fixture/orientation/date/body/packet/prompt/schema/profile/backend/size, invented
  counts and extra fields. They preserve runtime, source, billing, financial and
  fixture gates; cover checkpoint/HTTP/usage failures and valid abstention; and
  show observed synthetic usage never becomes a certified bound.
- Existing ordinary A3 admission, independence, response validation, genuine
  transport boundary and no-retry tests run alongside the exception tests.

Focused Node20/24 results and full GitHub CI receipts for the exact final commit
are supplied with delivery. A synthetic success is not a genuine prediction,
provider compatibility test, measured token count or forecast-quality result.

## Changed-file inventory

1. `audits/a3-supervised/controller.mjs`: explicit exception selection, checks and metadata.
2. `audits/a3-supervised/local.mjs`: optional isolated receipt/attempt methods.
3. `audits/a3-supervised/capacity-exception.mjs`: closed policy, bindings and actual-usage validation.
4. `audits/a3-supervised/capacity-exception.sql`: additive immutable receipt and atomic experiment latch.
5. `audits/test/a3-capacity-exception.test.mjs`: synthetic controller and adversarial regressions.
6. `audits/test/a3-capacity-exception-local.test.mjs`: isolated SQL authority/concurrency regressions.
7. `audits/a3-supervised/README.md`: extension pointer and isolation boundary.
8. `audits/a3-supervised/CAPACITY-EXCEPTION-IMPLEMENTATION.md`: this report.

## Next action after Director review

If approved to continue nonbillable preparation, install the optional extension
in the existing isolated journal, refresh complete genuine evidence, rebuild the
unchanged engine and complete independent request, and prepare the exact bound
exception review. Recheck fixture and account/model/runtime/financial/checkpoint
requirements before seeking fresh BYOK confirmation and separate final paid
authorization. Do not create those records or refresh sources prematurely.

Stop here for Director review. PR #6 remains draft and unmerged.
