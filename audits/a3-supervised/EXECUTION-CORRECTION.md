# Isolated A3 execution correction

This is an operating correction, not authorization for an experiment or removal
of a halt. The original Sunday controller, all SQL, Build 355, A3 prompt/schema,
A4 contracts and historical research remain unchanged.

## Pre-stage before collection

`stageExecution` composes reviewed checkpoint creation, separate checkpoint
verification, metadata refresh and transport functions entirely offline. It makes
no external request, source collection, authorization write or reservation. There
is no automatic dispatch CLI. An exclusive private `wrapper-stage.json` records
UTC staging time, canonical source-text hashes for the wrapper/controller/
transport/diagnostics/window/checkpoint code, and `dispatch_authorized: false`.
The wrapper also prepares an append/fsync private `diagnostics.jsonl` outside Git.

Before genuine dispatch, the controller requires an owned staging capability,
unchanged receipt/code, exact staged dependency functions, and a stage time
strictly preceding both earliest source collection and final authorization.
Dependencies cannot be replaced at invocation. Each wrapper permits only one
invocation, even if it fails before reservation. Staging is an operating artifact,
not source authenticity, provider readiness, capacity review or paid authorization.
Injected clocks in offline tests are synthetic; a real operation must use trusted
current UTC. No genuine operating wrapper was run by this correction.

## Remaining-time policy: a3-pre-http-margin-v1

Reject request preparation when its known source/kickoff/midnight window is
insufficient. Require **strictly more than 360 seconds** before initial metadata work and again
immediately before reservation, measured to the earliest hard deadline:

- Authorization expiry and original authorization receipt plus ten minutes.
- Original BYOK confirmation plus ten minutes.
- Original earliest complete-source receipt/source-read time plus 15 minutes.
- Kickoff minus 450 seconds, UTC midnight, and capacity-exception expiry if selected.

Rationale: two remaining metadata cycles with four existing 30-second GET limits
(240 seconds), checkpoint/verification allowance (60 seconds), local gates,
commit and scheduling allowance (60 seconds). This is a conservative operational
policy, not a validated upper latency bound. Slow/unbounded filesystems may exceed
it. Check actual timings before a future operation; stop rather than silently
reduce the allowance or extend any expiry. The policy is recorded with any future
reservation. Renewably observed account/fixture/runtime freshness remains a
separate gate; it cannot renew a hard source or authorization deadline.

All prior gates remain. Native transport rechecks deadline/runtime **after** the
last durable pre-HTTP diagnostic write, directly before subprocess invocation.
There are no further diagnostic writes between that check and invocation.

## Safe diagnostics: a3-failure-phase-v1

Closed phases: pre_reservation_validation, reservation_and_confirmation,
checkpoint_creation, checkpoint_verification, final_provider_admission,
immediately_before_http, transport_execution, provider_response_handling,
ai_validation, post_response_checkpoint.

Records include sequence, genuine observation timestamp, phase and HTTP-state
category. Failure codes are a fixed allowlist; arbitrary messages become
unclassified_failure. Only trusted subprocess-boundary observations may include
integer exit status, actual HTTP status or a closed signal name. HTTP 000 and
missing values remain unobserved. Error messages/stacks, stderr, credentials,
headers, request/response bodies and caller-supplied diagnostic properties are
never copied. Existing private raw-response retention remains separate.

The legacy `dispatched` status is retained for SQL compatibility but explicitly
means dispatch_intent_only with http_transmission_confirmed=false. Local invocation
intent is also not a send. States distinguish not started, intent only, execution
with transmission unknown, and observed response status. A response status does
not establish a model generation. Only genuine provider evidence and existing
strict validation may establish that. No response does not establish no HTTP.

Pre-reservation failures persist through the staged private sink without financial
events. Confirmed holds receive the original safe failure diagnostic inside an
immutable halt and verified checkpoint. A reservation-transport failure triggers
a read-only check for a committed hold. An inaccessible result remains explicitly
reservation_outcome_unknown and cannot be retried. Failures of diagnostic writes,
halt persistence or recovery checkpointing are explicitly flagged to the caller.
Post-response checkpoint failure preserves already recorded raw response/forecast.
A diagnostic write failure before invocation stops invocation. Process death can
still leave incomplete evidence; absent observations are never manufactured.

## Verification and limits

Failing-first regressions reproduce lost phase evidence and unwanted admission
with 30 seconds left. Regressions cover separate checkpoint verification, atomic
reservation ambiguity, intent-write failure, final admission, AI validation,
post-response checkpoint, private-text exclusion, closed phases, synthetic HTTP
429/502/200-invalid-JSON, real local subprocess exit evidence, final admission
after diagnostic I/O, wrapper timing/tampering/replacement, retained liability,
no retry and the strict six-minute boundary. Ordinary capacity and the Santos-only
exception tests remain. Subprocess tests use local synthetic output, never HTTP.
The full existing Node 20.20.2 / 24.19.0 CI matrix remains unchanged.

Existing halt and consumed experiments stay blocked. No study, receipt, source,
reservation or provider request is created here. A future study requires separate
Director authorization, an approved date/capacity admission path, complete fresh
source, unchanged engine lineage, current endpoint/account/runtime/BYOK evidence,
verified private recovery copies, sufficient time and exact-request paid approval.
The closed request and consumed capacity experiment cannot be reused.

The separately authorized October 28 activity lookup must wait until October 29
00:00 UTC, using existing access and supported filters only. No new management key
or account change is permitted. Aggregate usage cannot identify a particular
request. No automatic lookup or experiment has been scheduled.
