# MM-06 issuance and immutability review

27 November 2026, Africa/Lagos. Active job after MM-05 local behavioral acceptance. Only MatchMind is in scope. No hosted mutation is authorized by this local phase. MM-07 has not started.

Primary reviewed and accepted the bounded inspection plan at workspace work/mm06-evidence/LOCAL-INSPECTION-PLAN.md. Primary independently confirmed archivePrediction checks kickoff before queueing (index.html:12431), supplies device made_at, and flushPredictionArchive awaits price lookup before inserting without a new kickoff/session check (12961 onward). This ordering permits a deferred request to cross its admission boundary. A server guard remains necessary because device time and browser checks cannot establish issuance integrity.

Primary then ran one catalog-only SELECT independently against each named MatchMind project. No user rows or provider data were queried. Production toqfdrcjzwnlydqekude was observed at2026-11-27T02:49:05.623489Z, staging rdcbnvfnxenrpnnwxszs at02:49:06.714492Z. Exact queries, captures, hashes and summarized effective column privileges are retained under work/mm06-evidence/.

Production has no prediction triggers. The effective authenticated UPDATE grant is limited to final_pick,final_prob,final_at,withheld_at; original fields are already denied by column grants. The INSERT policy binds publisher email and upper date ceiling but has no exact lower kickoff/server made_at check. The UPDATE policy checks joined fixture date>=UTCtoday. Therefore arbitrary original-field UPDATE by an ordinary production authenticated publisher is NOT a confirmed defect. The proposed trigger must preserve existing grants and add a server boundary, including privileged service paths, rather than broaden client writes.

Staging differs: broader synthetic publisher update privileges and a smaller prediction schema lacking final_prob/final_at. No staging equivalence or migration compatibility is assumed. A production-specific SQL proposal must not be installed in staging unchanged.

One agent is authorized for a bounded local repair/test phase: reproduce delayed price/identity failures; add dispatch-time client checks; reproduce production roles/RLS/column grants in its own pinned network-isolated PostgreSQL fixture; prepare and test an additive server guard as PROPOSAL ONLY. Exact UTC cutoff and lock delays, server issuance/event time, duplicate-ignore races, every original field, role negatives, legacy NULLs and build=-1 reconstruction must be covered. Existing rows must remain byte-for-byte unchanged on installation. The current scoped reconstructed path remains explicitly reconstructed and cannot promote/replace a live row. No DELETE/retention changes belong to this phase.

No MM-06 implementation result is accepted yet. Hosted SQL installation, exact catalog fingerprint preflight, publisher pause/drain, staging adaptation, rollback and hosted verification remain open. After MM-06 local primary assessment/applicable gates, the next original item is MM-07 deletion and lifecycle. It has not started.


Primary client review found a regression in the initial context guard: including archiveWritable in the identity predicate skipped existing same-owner cleanup after the first drift denial. The agent reproduced that failure, separated context identity from availability, and added coverage for every untried optimistic guard. The corrected current client, prior AI client cases and actual Chrome PWA lifecycle independently passed27/27 with0failures/skips/cancellations (work/mm06-evidence/primary-client-pwa.log). Byte-splicing preserves original mixed line endings outside the intended helper/flush region. The server proposal and production-shaped PostgreSQL tests remain in progress; this is not whole-job acceptance.

Exact current-app PWA receipt baseline HTML SHA256 feb9112bcfb8cd00e767e77e1eec98c53904d23cf4d6d8464c178ecc1e9d0744; worker SHA256 e1535f343745966a5a7adb818feba0a4216b8646a8c3cf5de097deda86104860.


## Primary local acceptance — 27 November 2026

The local MM-06 repair and production-specific unexecuted SQL proposal are accepted after code/SQL assessment. Agent combined verification passed26/26 (12client,14PostgreSQL), with0failures/skips/cancellations. Primary independently passed27/27current-client/prior-AI-client/Chrome-PWA checks and3/3targeted real PostgreSQL checks for invalid identities, the private owner/UTC contract and a lock delay across kickoff. These are separate runs with overlapping coverage, not a unique-test aggregate. Every final file hash matches the agent receipt. All app bytes outside helper/flush match the accepted MM-05 checkpoint.

Preserved before-proofs include six delayed-dispatch/context failures, same-owner denial cleanup, late live insertion with caller timestamp1900 and ten matching invalid canonical identities. Primary review required the denial cleanup and canonical identity fixes before acceptance. New records now require positive fixture/league IDs and nonblank team labels within the established160character public contract. Existing rows survive installation unchanged; legacy metadata no-ops remain possible and changed events with unknown cutoff fail closed. Exact first-writer, server-clock, role boundaries and reconstruction behavior are exercised by the synthetic protocol.

Hosted behavior is unchanged. Production/staging schema divergence, complete fresh catalog fingerprints, issuer/service/maintenance dependencies, fixture lock contention, publisher pause/drain, matched client/server installation, rollback and hosted acceptance remain deployment gates. The production proposal is not a staging migration or a release instruction. No SQL installation, data rewrite/deletion, provider call, publisher session cleanup, production merge/deployment or phone-data clearing occurred. MM-05 strict-type/dependency and hosted gates remain open too.

Next original job: MM-07 transactional/recoverable deletion and lifecycle; bounded read-only inspection first, then primary assessment before repair. No later job is authorized to leapfrog it.
