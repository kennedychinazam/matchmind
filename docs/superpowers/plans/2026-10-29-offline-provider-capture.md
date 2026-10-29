# Offline provider capture adapter

Goal: extend baseline 748dc6b with an injected-response-only capture boundary. The Director's implementation instruction is the binding specification; no live transport, credentials, SQL installation or production modification is authorized.

Architecture: add one isolated module beside the accepted prototype, importing its capture/reconciliation utilities and existing bounded JSON/hash/clock policies. The input is inert response bytes and closed synthetic metadata, never a function, native Response, URL client or credential. A per-session latch consumes one fixture attempt before validation; simulated status metadata has a separate one-attempt latch. Real transport always rejects.

Files: provider-adapter.mjs (plan, receipts, pure reconciliation, private verified persistence); provider-adapter.example.mjs (synthetic-only example); provider-capture-adapter.test.mjs (behavioral regressions); PROVIDER-ADAPTER.md (interfaces, limits, evidence and remaining gates).

1. Write tests before implementation for missing adapter, exact whitespace/binary bytes, complete status/score projection, invalid/partial/error responses, ID inventory, metadata/header credential exclusion, attempt latches and disabled real transport. Observe assertion failure.
2. Implement closed metadata/response validation, exact copied bytes and receipt hashes, and default period-unverified prototype reconciliation. No synthetic period-certification rule is accepted by the adapter.
3. Add failing persistence tests for exclusive writes, private file modes, symlinks/tampering and readback; implement standalone private receipt envelope using existing immutable directory conventions. Do not change offline.mjs.
4. Reconcile generated synthetic bodies against the private retained three-row inventory; preserve all original files. Publish only hashes/classifications, not raw private rows.
5. Run focused and complete Node 20.20.2 / 24.19.0 suites, independent fresh-context review, fix material findings with regressions and reverify. Keep PR6 draft and unmerged; deliver exact changed-file inventory, synthetic example and error register.

Review focus: getters/native-response callbacks; header/body/content-decoding mismatches; duplicate/missing IDs; partial bytes incorrectly treated as complete; manifest tampering or symlink traversal; resetting attempt latches; synthetic authority promotion.

Ruling: native managed-worktree creation rejected the repository path because it is outside this chat's roots. An independent local clone inside this chat's workspace isolates the exact accepted commit. No original worktree file was changed.
Ruling: the detailed Director instruction already approves implementation and independent review. Execute this plan directly; do not introduce another approval gate for the same offline work.
