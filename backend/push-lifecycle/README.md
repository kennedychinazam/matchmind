# Matched push sender candidate

Local proposal only, built from exact captured hosted send-push version 9 (SHA-256 2625107daf82e72c535d0968e152e76bb9ec89f3904e748d0bdd5940bd7bb9d1). The builder rejects a different baseline or overwriting it. Source function version becomes 99; Supabase SDK is pinned to 2.119.2 and web-push to the existing 3.6.7, with a frozen lock.

Every dispatch checks the exact endpoint, owner and updated_at generation through the lifecycle RPC. Every successful send records its receipt through the atomic owner/generation RPC rather than a blind upsert. Stale 404/410 cleanup matches all three fields. Eligibility/record failures remain closed and raw transport details are not returned. The existing scheduler-secret gate is preserved. Number.isNaN(date.getTime()) replaces two invalid TypeScript Date checks with equivalent kickoff behavior, covered by a parity test.

This cannot recall an already-dispatched external push or lock an external call across a database transaction. Old sender pause/drain and matched SQL deployment are mandatory release gates. No real push was sent. Fifteen synthetic actual-handler/helper tests, frozen Deno checking and a 60-module bundle passed. See ../account-lifecycle/ROLLOUT-PROPOSAL.md.
