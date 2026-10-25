# Explicit prospective Gemini comparison implementation plan

User specification: the 25 October director request authorizes research-only implementation, tests and updating the existing draft continuation branch, without paid inference. Native execution in the existing isolated worktree.

Architecture: preserve MODELS and the original Sunday path. An explicit prospectiveModel option selects an approved second model only for the prospective experiment; its declared model identities drive jobs, virtual coverage and reports. Pin Google AI Studio's standard endpoint. Keep the existing capacity bound and complete evidence unchanged. Reserve physical completion and separately priced reasoning maxima conservatively. Require Google BYOK absence evidence for Gemini and retain the legacy confirmation contract for Kimi.

1. Write failing Gemini contract tests: exact holds, complete live-shaped pricing, unsupported charges, pinned routing, response failures, source equivalence, unchanged capacity bound and BYOK isolation.
2. Extend contracts, read-only metadata allowlist and selected-pair preflight. Reject unsupported billing components and bound text-only cache/reasoning prices.
3. Write failing integration tests for explicit prospective selection, original-study refusal, model-specific reporting, duplicate guards, shared retained liability and failure handling. Implement selection in orchestration and reports without editing historical records or the engine.
4. Run focused tests, then the complete Node 20.20.2 and Node 24.19.0 CI suites. Obtain a fresh whole-change review. Update draft PR #6 on its existing branch, never merge or deploy.
5. Refresh runtime, authenticated pricing/account metadata and complete fixture evidence. Verify all four exact request bodies fit. If time or any gate fails, preserve progress without enrollment or dispatch.

Review focus: historical study/model identity; unknown pricing and separate reasoning charges; Google BYOK omission; provider/model response mismatch; capacity failure before any paid reservation. No production files, engine inputs, archived SQL or recovered journal may be modified.
