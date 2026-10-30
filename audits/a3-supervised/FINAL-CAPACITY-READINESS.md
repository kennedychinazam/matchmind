# Final A3 capacity and provider readiness review

Reviewed 2026-10-27. Accepted executable baseline:
`7b6af1776555071881707c11fb8f10515419f5da`.
Scope: complete retained Santos–Palmeiras request, public provider documentation,
authenticated metadata GETs, isolated database SELECTs and offline regression tests.
No generation, token-counter upload, reservation, approval receipt or hosted write.

## Decision

**NOT DISPATCH READY.** The strict response schema passes the documented subset
review. Current runtime, dedicated-key identity, endpoint limits and conservative
financial arithmetic check out. A verified bound for the endpoint's complete
processed input has **not** been established. The existing 4,096-token allocation
is a total generation budget, not a demonstrated allowance for complete visible
JSON after reasoning. Neither gap is a demonstrated provider incompatibility.

Do not insert a reviewed-readiness receipt with a guessed token count. One narrow
price-ceiling serialization correction is implemented below. No schema adapter
is justified by this review. Prompt 1.0.0, the accepted A3 local validator, A4
prompts, controller and original Sunday policy remain unchanged.

## Exact complete-request measurements

These are measurements of the retained request, not a prospective authorization.
All 1,947 competition rows and 21 columns remain present, including nulls and
scheduled rows. The surrounding approved collection retains 93,584 rows across
55 competitions. Engine output is separate from independent AI messages.

| Component | UTF-8 bytes |
| --- | ---: |
| Exact `JSON.stringify(plan.body)` transport body | 355,943 |
| System prompt content | 3,801 |
| User evidence packet content | 310,795 |
| Both message contents, before wire escaping | 314,596 |
| Serialized messages array, including roles and JSON escaping | 353,898 |
| Schema object, compact or canonical JSON | 1,648 |
| Schema file on disk, including formatting | 1,707 |
| Serialized response-format wrapper | 1,746 |
| Body with `messages` omitted | 2,033 |

The last row includes routing and schema; these overlapping rows must not be
summed. Wire escaping accounts for much of the difference between message-text
bytes and body bytes. Wire JSON is not the provider's internal prompt format.

Exact body SHA-256:
`078496f2f5d99d020e226d4b26b5066e797bd77c1f75c832a83889554aa87872`.
Plan identity:
`2e61f0ea82f797299b36d1ecac474aaf8416c736d3910cbe5425d454c26a7e4f`.
Packet identity:
`dcb1fe3635712a1ea86c27e606f1d1b6fcc8b5dfcd3610903138bbc5cb64cc09`.
Schema canonical SHA-256:
`7347a74b07cc5f0379db773dc4f174fe12d6c6ebf083fedf422379acaee5f500`.
Private bodies and authenticated account receipts remain outside Git.

### Narrow price-ceiling correction

The retained body serializes its prompt ceiling as `0.19999999999999998` dollars
per million. Binary multiplication of the approved per-token cap caused this
round-down below the intended `0.20`. This is an offline-confirmed request defect;
actual gateway rejection was not tested. The isolated A3 builder now shifts its
already validated, pinned decimal cap in text before converting to a JSON number,
so the wire ceiling is exactly `0.2` (completion `0.75`). It neither increases
the approved cap nor changes profile/reservation arithmetic. Historical builders
and retained request bodies are untouched.

The draft version becomes `a3-offline-request-v1.1.0`; prompt and schema versions
and hashes are unchanged. A failing-first regression reproduced the price
mismatch, then verifies the serialized OpenAI and Gemini ceilings against literal
approved values and long-context tiers. Gemini's inclusion is preservation
coverage, not permission to select or dispatch Gemini in this experiment.

Applying only this correction to a copy of the old body gives 355,927 bytes and
SHA-256 `87520e531682f0a0b890692272952f057877626b5365f521c5b3d8d3f887504f`.
This is an **offline derivative**, not a freshly admitted plan. Old body/plan
identities above identify the reviewed historical preparation; all new plans and
authorizations must bind the corrected body and freshly collected evidence.

## Capacity proof: what is missing

The authenticated standard OpenAI endpoint declares a 1,050,000-token context,
922,000 maximum prompt and 128,000 physical completion maximum. Admission requires
`I_upper <= 922000` and `I_upper + 128000 <= 1050000` under the existing conservative
controller. These inequalities do not supply `I_upper`.

The retained official tiktoken model registry has neither an exact GPT-6 Luna
mapping nor a matching GPT-6 prefix. Its GPT-5 mapping to `o200k_base` is not
authority to assign that encoding to GPT-6 Luna. Reviewed registry artifact hash:
`600f26902d1cf6a1a5f54e37be988b3e0d911f1ff17ba7060bb361f9b5295521`.
The public registry was also inspected during this review; no usable mapping was
identified. Installing an arbitrary encoding would provide a comparison estimate,
not the requested endpoint guarantee.

For a verified byte-level BPE whose preprocessing does not expand text, initial
byte symbols provide a text-token upper bound before merging. Applying that
argument here additionally needs authoritative model/encoding binding, complete
preprocessing rules, and a bound on gateway translation, schema representation
and special framing tokens. Those premises have not been established. Counting
all wire bytes or adding an arbitrary framing margin does not establish them.
The existing `bytes + 16384` check remains a rejection heuristic only.

OpenAI's token-counting documentation explicitly includes message-boundary
formatting and notes local limitations for schemas and model-specific behavior.
It documents a server-side Responses input-count endpoint. No private content was
sent there. A direct Responses count is not automatically a count for an
OpenRouter Chat Completions translation; exact payload/route equivalence or a
verified translation bound is also required.

**Shortest safe resolution:** obtain authoritative local tokenizer and framing/
translation assets for this exact route, or a provider-produced nonbillable count
of the exact processed request with documented route equivalence. Existing
authorization excludes uploading private evidence to a counting service. A
remote-count route therefore needs separate explicit approval and an already
approved transport/credential arrangement; this report does not authorize a new
endpoint, new credentials, networking changes or an experimental generation.
Do not assume the OpenRouter key authenticates a direct OpenAI service. An
operator may instead supply a verifiable count/proof receipt obtained through
their approved environment, bound to this body and endpoint contract.

## Strict output and output budget

The unchanged schema has a root object, four closed object definitions, 16 total
properties and a maximum object depth of three counting the root. Every defined
property is required. It uses enums, nullable probabilities and bounded strings,
arrays and numbers; it has no unsupported conditional composition. Current
OpenAI documentation places the cited string/number/array-bound exclusions on
fine-tuned models. The selected endpoint is the standard model, not a fine-tune.
The schema is well below the documented 5,000-property and ten-level limits.

The authenticated endpoint advertises `response_format`, `structured_outputs`,
`max_tokens`, reasoning and `tool_choice`; routing requires supported parameters.
**Documented subset compatibility is established; actual gateway acceptance has
not been exercised.** No schema stripping or adapter is necessary on the evidence
available. The local validator still independently checks fixture/packet identity,
citations, probability sums, abstention consistency, football-only content and
the 32,768-byte response ceiling. Provider schema conformance cannot prove that
football reasoning is supported by its citations.

The existing body requests 4,096 output tokens and does not set reasoning effort.
The exact model documentation identifies medium as the default and supports
none/low/medium/high/xhigh/max. OpenRouter documents that reasoning consumes the
generation budget; hiding reasoning does not restore that budget. Its generic
effort percentages are approximate and cannot establish a visible-output floor.

Concise analysis or abstention can fit, but the schema permits much longer
statements and reference lists. Schema-valid output is not automatically within
either 4,096 tokens or the local byte ceiling. No deterministic sufficiency proof
or real provider measurement is available. A future reviewed request may retain
4,096 as an explicitly experimental cap with truncation risk, or use a separately
versioned output/reasoning policy with a justified allowance. Neither option may
weaken local validation or imply guaranteed successful generation. This review
does not silently change the accepted request to a different reasoning policy.
Length termination, refusal, invalid JSON or semantic rejection must retain the
attempt's liability and must not trigger a retry.

## Authenticated financial and security observations

At **2026-10-27T15:51:02.161Z**, the approved nonbillable key, credits and selected
model endpoint GETs showed:

- Dedicated key identity hash matches the retained operator identity; key limit
  $5, no reset, unchanged usage $0.192135475, remaining key/account credit
  $4.807864525. No key value, label or workspace identifier is published here.
- BYOK usage zero and `include_byok_in_limit=false`. This does not prove external
  credentials absent; fresh workspace/key-bound operator confirmation is still
  mandatory. Account credit cannot override the research ledger.
- Standard OpenAI route `openai`, not Flex, Fast, Azure or another backend. Base
  input/output prices are $0.10/$0.50 per million; whole-request long-context tier
  starts at 272,000 input tokens and costs $0.20/$0.75 per million. No separate
  reasoning rate or request fee is declared for this endpoint.
- No implicit caching. Explicit cache controls, tools and plugins remain absent;
  `tool_choice=none`, provider `only=[openai]`, fallbacks disabled. Cache-write
  rates can exceed the prompt cap, so changed caching capability must fail closed.

Current runtime observations showed desired/observed revision **54/54**,
observations current, restricted networking enforced, `openrouter.ai` allowed,
and `OPENROUTER_API_KEY` ready. One metadata call reported a configuration-change
error; a fresh observation succeeded. No current failed secret binding was found.
These observations expire and must be refreshed at dispatch.

Read-only SQL confirmed **3,423 events, five retained reservations totaling
$2.753008, zero corrupt event-body hashes and zero halt events**. No history or
ledger maintenance was performed. This aggregate check is not a fresh full-chain
recovery certification. Existing verified recovery/backup requirements remain.

The unchanged conservative proposed maximum is:

`1050000 * $0.00000020 + 128000 * $0.00000075 = $0.306000`.

It deliberately overcovers the jointly admissible input/output limits. Physical
output, including reasoning, is already covered; increasing a proposed output
allocation within that physical limit would not itself increase this maximum.
This statement depends on the exact no-cache/no-tool endpoint contract above.

Current conservative ledger headroom is **$2.246992**. A separately authorized
$0.306000 hold would bring retained liability to **$3.059008**, leaving
**$1.940992** under the shared ceiling. Actual historical usage already covered
by retained holds is not subtracted twice. All existing holds, including the
original $0.306 and blocked Gemini A3 liability, remain retained. No new hold was
created and no claim of releasable money is made.

## Final execution sequence after technical resolution

1. Resolve the input proof and review the explicit output policy first. Ensure
   the Director is available before collecting a new packet. Do not spend the
   source freshness window doing documentation research.
2. Refresh the complete approved source and retain all page/count/identity/
   receipt evidence. Freshness starts at the **earliest** receipt, not database
   write time. Preserve complete history, nulls and explicit period limitations.
3. Enroll in the existing isolated shared journal, rebuild unchanged Build355 and
   the football-only independent request. Verify engine lineage, packet/body/
   prompt/schema/model/backend identities and the newly complete input bound.
   Changed rows or body invalidate the previous request-specific count/proof.
4. Recheck fixture identity, NS/SCHEDULED status and kickoff from the approved
   source. Santos–Palmeiras 1492438 is targeted for **2026-10-28 22:30 UTC**;
   issuance must be **strictly before 22:22:30 UTC**. The retained fixture/source
   observations are expired and do not establish current eligibility.
5. Record the reviewed technical artifact and readiness receipt bound to the new
   request/profile/schema. Refresh runtime, endpoint/pricing, key, account,
   reconciled ledger, recovery/external-copy readiness and no-attempt/no-halt
   state. Preparation must not create a financial reservation.
6. Obtain fresh key/workspace-bound BYOK confirmation for the five required
   external providers. Then present the exact one-request final authorization
   request with fixture, UTC issuance date, request and packet hashes, prompt and
   schema identities, GPT-6 Luna/OpenAI route, output policy, maximum $0.306000,
   retained/combined liability, source expiry and kickoff deadline.
7. Only after that separate approval, record immutable authorization and use the
   accepted supervised controller. It revalidates before reservation, after
   checkpoint and immediately before HTTP. Require the financial reservation and
   checkpoint/confirmation before sending. On failure or ambiguity preserve the
   hold, halt and never retry.

Source age must remain within 15 minutes, authorization/BYOK within ten minutes,
account/fixture observations within two minutes and runtime proof within ten
minutes, subject to all stricter existing checks and midnight/date binding.
Monitor the earliest deadline throughout; if any window expires, stop. Do not
backdate receipts or renew freshness by reserializing old data. A refreshed source
requires a new bound/request review and corresponding authorization. Do not
reuse the expired retained plan as if it were current.

## Verification and references

Focused baseline regression rerun on Node 24.19.0: **79/79 pass**. The final
price-corrected focused rerun passes **80/80**, zero failures or skips. The
accepted baseline's GitHub CI independently reports
**654/654** on both Node 20.20.2 and Node 24.19.0, run
[40528894974](https://github.com/kennedychinazam/matchmind/actions/runs/40528894974).
The final revision's CI status must be checked separately on its commit. The
added price regression and final focused rerun results are reported with delivery;
the baseline's 654-test runs are not evidence that a later commit passed.

Changed-file inventory:

- `audits/a3-workflow/workflow.mjs`: isolated decimal cap serialization and draft
  version; no prompt, response schema, source or dispatch-gate changes.
- `audits/test/a3-workflow.test.mjs`: failing-first serialized price-cap regression.
- `audits/a3-supervised/FINAL-CAPACITY-READINESS.md`: this report and execution sequence.

Relevant repository files:

- `audits/a3-workflow/workflow.mjs`, `contract.mjs`, `authority.mjs`,
  `response.schema.json`, `artifact-manifest.json`, `prompts/1.0.0.md`.
- `audits/a3-supervised/controller.mjs`, `source.mjs`, `local.mjs`,
  `transport.mjs`, `README.md`.
- `audits/phase8-continuation/contracts.mjs`, `runtime.mjs`, `transport.mjs`,
  `checkpoint.mjs`; `audits/phase8/engine.mjs`.
- `audits/test/a3-supervised.test.mjs`, `a3-supervised-local.test.mjs`,
  `a3-workflow.test.mjs`; `.github/workflows/audit-regression.yml`.

Public technical references, inspected 2026-10-27:

- [OpenAI token counting](https://developers.openai.com/api/docs/guides/token-counting)
  — complete input accounting and local counting limitations.
- [Official tiktoken model registry](https://github.com/openai/tiktoken/blob/main/tiktoken/model.py)
  — no reviewed exact Luna encoding binding; mutable URL, retained artifact hashed above.
- [OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs)
  — required properties, closed objects, subset and size limits.
- [GPT-6 Luna](https://developers.openai.com/api/docs/models/gpt-6-luna)
  — context/output limits and reasoning settings/default.
- [OpenRouter structured output](https://openrouter.ai/docs/guides/features/structured-outputs)
  — strict response format and provider capability selection.
- [OpenRouter reasoning](https://openrouter.ai/docs/guides/best-practices/reasoning-tokens)
  — reasoning/output budget interaction and truncation risk.
- Authenticated metadata route `GET /api/v1/models/openai/gpt-6-luna/endpoints`;
  receipts retained privately with key/credit receipts and measurement artifacts.

PR #6 remains draft and unmerged. No paid authorization is requested while the
technical proof is unresolved. Stop here for Director review.
