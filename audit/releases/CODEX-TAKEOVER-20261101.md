# Build 357 takeover — isolated UI correction checkpoint

Baseline: PR #12 `d4185144e77723137ab8f00852a812b434b04a4a`, based on public main Build355 `036f09b29f27a10c7d8bdcec1f16efd557c714e4`. This branch remains a draft review candidate. No merge, deployment, provider request or production mutation is authorized.

## Reconciled work

PR #10 already contains loading-state, statistical descriptor, hero DNB, saved-key and Build356/cache corrections. PR #11 already contains AET/PEN unresolved-score refusal, consumer protection and the reviewed R7 recovery. PR #12 integrates those changes and preserves corrected extra-time final display at Build357. Their reviewed scenarios pass the existing36 tests. Those completed changes are not reimplemented here; research PR #6 remains separate and unmerged.

## Narrow additional changes

- Built-in/fallback analysis is labeled statistical; a successful AI prose response retains provider attribution. Alternate unavailable/API-prediction paths reset attribution rather than keeping a previous model label.
- DNB share images identify the headline as a win share excluding draws and show the displayed outright win/draw-refund/loss breakdown. Missing or visibly inconsistent vectors disable export with an explanation. Values are copied rather than recalculated later. Agreement at displayed precision is a consistency check, **not evidence of common source provenance**; legacy board/local on-screen probability linkage remains unresolved.
- Empty injury lists mean no injuries reported in available data, not a verified clean bill of health.
- Accordion controls support keyboard focus, Enter/Space and expanded/controlled-panel state, including programmatic opening.
- Narrow-screen styling keeps the320px top bar within the viewport. The first remote run exposed a2px fallback-font overflow missed locally; a DejaVu Sans reproduction showed that the unwrappable row was fragile. Narrow wrapping/right alignment preserves labels and the44px Search target; font variants are included in regression coverage. Exact final results remain in the draft PR checks.
- The isolated takeover branch runs the full offline suite through the existing Node20/24 integration workflow, including eight new synthetic UI regressions.

No prediction formula, coefficient, settlement function, source collector, frozen forecast, research financial control, archive, robot, manifest or service-worker file changes in this patch. Build/cache stay357 because this is an unpublished continuation of the same candidate; no new deployment is performed. Original HTML CRLF endings are preserved.

## Verification and limits

Baseline independently rerun in local Chromium:36/36 on Node20.20.2 and24.19.0, zero skipped. The eight new regressions were first observed failing on the uncorrected candidate. Final changed-tree counts and exact GitHub run links are in the draft PR/checks. Tests use local synthetic data, blocked off-host requests and temporary browser state; they do not verify real backend permissions, live provider behavior, physical-device behavior or forecast accuracy.

Independent patch review identified and closed attribution-transition and DNB-export gaps. Missing-vector/recovery cases are covered; nonfinite-vector rejection was inspected in source. This review is not a complete release security sign-off.

## Release remains NO-GO

An independently reproduced **settlement-ordering gap** remains unpatched pending the significant-safeguard review decision: an older confirmed score can reach direct settledRow consumers while the registry retains a newer score; an undated conflicting score can also replace a newer confirmed registry entry. Existing refusal/recovery tests do not cover this confirmed-predecessor case. Reproduction uses synthetic local rows; no production incidence is established. A narrow fix must preserve equal-time fail-closed rules, legacy undated recovery, original FT behavior, raw final display and frozen records. Do not silently reinterpret normalized FINISHED rows or regrade history.

Other unresolved gates: plausible-but-wrong provider fulltime residual; legacy board/local probability provenance; rejected-auth exceptional recovery; owner-controlled live Supabase/RLS/auth/collector and real-device acceptance; public fixture-data/crest rights; subscription and all-copy retention decision under Issues #8/#9. Original governing terms and owner-relayed support evidence still require independent authentication. No unvalidated cup/tier numerical changes are made.

Target Friday6November remains conditional on quality, rights and explicit owner approval. No scheduler or unattended daily execution is established. Owner/Director controls any payment, data lifecycle change, model change, merge or publication.

## Rollback proposal

While unmerged, retain the original PR #12 head and review/revert only this isolated UI diff. If a future authorized deployment includes it, rollback requires a reviewed forward cache/build version rather than silently serving an older cache number; retain forecast and data histories. No database rollback is required by this patch because it has no migration or live write. Production rollback has not been rehearsed or executed by this checkpoint.
