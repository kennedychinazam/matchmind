# Settlement-ordering safeguard — draft engineering checkpoint

Base: takeover candidate `581ccc5f32a19eabe10e46c2a55b78a1734969ea`. New isolated branch `codex/settlement-ordering-20261101`; no merge, deployment or historical regrading. This note supersedes only the settlement-ordering blocker described in the earlier takeover checkpoint, within this draft patch's tested scope. All other release gates remain NO-GO.

## Defect and correction

After a timestamped confirmed90-minute2–2, an older3–2 could reach direct settledRow consumers although the registry retained2–2; an undated3–2 also replaced the registry. Both were reproduced before implementation. The prior observation API returned only a refusal Boolean, which could not distinguish rejection from permission to project incoming data.

The observation decision now returns `accepted`, `reason`, `prior` and `authoritative`. Registry states and their shallow source-row snapshots are frozen. settledRow projects the authoritative accepted score, matching raw final/fulltime fields and original timestamp fields, never a mixture of accepted and rejected observations. Missing non-score metadata may still come from the caller, but rejected score/timestamp fields cannot masquerade as accepted evidence. Original caller rows are not mutated. The in-memory registry does not create a new persistent source record or authenticate a provider.

| Situation | Decision / result |
|---|---|
| No prior observation | Accept confirmed or unresolved state as before. |
| Strictly newer dated observation | Accept valid correction or missing-score refusal; legitimate later recovery remains available. |
| Older or undated observation versus dated prior | Reject replacement; direct consumers receive the existing authoritative confirmed result or refusal. |
| Same timestamp, confirmed90-minute/raw-final score contradiction | Install an unresolved conflict state; no grade. |
| Same timestamp, prior unresolved | Keep refusal; same-time confirmed replay cannot clear it. |
| Same timestamp, identical confirmed score/final | Duplicate; retain prior observation. |
| Both observations undated | Preserve existing arrival-order/legacy recovery behavior; no timestamp authority claimed. |
| Ordinary FT/FINISHED fallback | Existing settledScore rules remain unchanged. |

Equal-time conflicts require a genuinely newer source observation to recover. Both actual AET and PEN paths are exercised. Once a fixture has session authority, later FT/FINISHED status spellings cannot bypass the same ordering decision. Accepted newer FT/FINISHED observations use the unchanged settledScore calculation, including its legacy fallback; no new regulation-time proof is inferred. Missing goals produce refusal for a tracked fixture when the row reaches settledRow; some existing consumers filter null-goal rows before calling settlement, so this is not a guarantee that every provider withdrawal reaches the registry; untracked ordinary FT/FINISHED behavior remains unchanged. Repeated already-projected rows reconstruct their preserved raw final and keep unresolved markers, preventing false recovery and loss of AET display. Correctly accepted raw finals are preserved alongside their own90-minute scores; a stale incoming raw final cannot make an impossible combined result. Rejected input remains available in its unchanged original object.

## Tests and review

Seven new registered consumer tests cover both predecessor defects before implementation, explicit decisions, equal-time conflicts/recovery, rejected missing updates and projection idempotence. Tests call actual direct grading, fixtureResult and gradeFromHistory on ephemeral synthetic state; no real forecast is regraded. Timestamp-alias coherence, unchanged inputs, both AET/PEN, raw finals and repeat conflict handling are asserted.

One inherited R7 assertion expected a stale missing row itself to remain unresolved after a newer confirmed correction. Independent debugging confirmed that this expectation conflicts with the newly authorized direct-authority contract. It now explicitly checks the accepted2–2 score,3–2 raw final and original newer timestamp instead. The initial refusal, older/undated recovery rejection and subsequent legitimate correction checks remain intact. No test is skipped or weakened to hide the defect.

The existing44 registered tests plus seven new cases form the full51-test Node20/24 suite. Final exact commit/CI evidence is linked from the draft PR. Full consumer/source review is independent of implementation. Expected failing-first results and the inherited assertion mismatch are retained in the private engineering evidence; they are not represented as production incidents.

## Preserved boundaries and limitations

No Build355 formula/coefficient, original forecast, archived receipt, financial guard, production record, source collector, publisher, manifest, service-worker or paid/provider execution path is changed. No research DB/ledger/archive mutation is performed. Build/cache remain357 on this unpublished candidate.

This is local session ordering, not upstream authenticity or complete historic settlement repair. Date.parse retains the pre-existing millisecond resolution and timestamp-parser behavior; invalid/absent stamps are undated. Collector write timestamps do not prove original provider update time. Rows without trustworthy original FT/AET/PEN distinctions, plausible-but-wrong fulltime pairs, unobserved old cache rows, and live source semantics remain unresolved limitations. Frozen scalar scores/timestamps are protected from caller mutation; nested metadata is not a new deep immutable evidence store.

Provider publication/crest rights, separate pilot/subscription retention decisions, lawful owner-controlled backend/RLS/auth and physical-device acceptance, source/probability provenance and other documented release blockers remain open. Synthetic tests do not validate forecast accuracy or confer a source-review attestation. No new future-fixture policy, AI request or financial authority is introduced.

## Rollback

While draft/unmerged, retain the previous takeover head and review/revert this isolated safeguard diff. No database rollback or archive restoration is needed. If a future separately authorized deployment includes it, revert through a reviewed forward build/cache version and rerun the full suite; never use rollback as permission to silently re-enable unsafe grading. No deployed rollback was performed or certified here.

STOP FOR DIRECTOR REVIEW. Publication remains NO-GO.
