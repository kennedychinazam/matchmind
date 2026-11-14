# WO-62B selective public release integration

This is an isolated, undeployed public candidate. The private master remains the source of the approved Build 356 feature definitions; this public index is not a replacement master.

## Inputs and exact scope

- Accepted public Build 358/PR27 baseline: `7420905be001749246bd5eebd61a2f255ab5b32a`.
- Approved private Build 356 feature checkpoint: `314b14d90690a7a021e9b8b69bc6596767dfefb4`.
- Director order snapshot: `8ff923c5c5c9c0f82bd40c2fb028ecd3119779b1`, `workflow/orders/WO-62B-RELEASE-FAST-TRACK.md`.
- Exact artifact and builder digests: `wo62b-source-manifest.json`.

Only the approved public name/title, introductory screen and daily-card allocation snippets were selected from Build 356. The public baseline supplies all accepted settlement, provenance, authentication, account ownership, display and PR27 corrections. The private HTML, developer tools, private archives and original source patch are not copied here.

The public personal-provider policy is an immutable false constant. Credential entry controls are absent; compatibility nodes are non-input elements. Guest/account credential activation and saves return without reading or overwriting credential stores. Direct personal transports reject before HTTP, and server failure cannot use a forced in-memory personal key. Existing server session ownership, authorization epoch and quota handling remain authoritative. Existing legacy and owner credential records are preserved, not assigned or deleted. Browser storage is not encryption or protection against control of the browser profile or malicious same-origin scripts.

Card allocation carries the approved Build 356 conflict table unchanged: at most two tracked fixture selections across cards, rejecting duplicate and table-defined conflicting codes before per-fixture selection. The table defines directional/overlapping-pick conflicts; it is not a general independence or portfolio-risk guarantee. The inherited missing-ID/unsupported-code behavior is unchanged; ordinary source/market admission remains required. Frozen/shared cards, settlement, historical grading, publisher operation and model thresholds are unchanged. This does not reissue historical cards.

Intro adaptations are limited to modal accessibility, focus/keyboard containment and storage-failure correctness. A setItem-only failure still respects dismissal in the current session. Initial dialog focus preserves its heading on small screens; legal links and dismissal restore a usable focus destination. Figures are read from the existing record API rather than invented constants.

## Generation and temporary divergence

The original private `build-deploy.py` is unchanged. It performs private-master developer-fence/key stripping and PWA generation. It does **not** yet reproduce all accepted Build 358 public security/provenance corrections. Running that older private output over this candidate would regress the accepted public baseline and is prohibited for this integration.

For this release only, the auditable derivation is the pinned public base plus this reviewed selective public patch. Reproduce in a disposable local worktree:

```sh
git diff --binary 7420905be001749246bd5eebd61a2f255ab5b32a RELEASE_HEAD > /tmp/wo62b-public.patch
git worktree add --detach /tmp/mm-wo62b-replay 7420905be001749246bd5eebd61a2f255ab5b32a
git -C /tmp/mm-wo62b-replay apply --check /tmp/wo62b-public.patch
git -C /tmp/mm-wo62b-replay apply /tmp/wo62b-public.patch
sha256sum /tmp/mm-wo62b-replay/index.html
```

Replace `RELEASE_HEAD` with the exact reviewed integration commit. Compare the result with the manifest. This patch contains public candidate changes only, not a confidential private-master patch. Preserve the reviewed commit and the private upstream checkpoint; do not automatically backport, overwrite or claim whole-master parity.

Post-release reconciliation is deferred: port accepted public security/data-contract fixes into a separately reviewed private source branch, update the existing generation process and prove identical public output before adopting regenerated artifacts. No new provider migration or forecast-model work is included.

The existing `staging/build-preview.mjs` remains the separate staging transform. Its only new transform obligation is preserving the STAGING prefix when APP_NAME sets the runtime title. It still rejects unexpected anchors, points only at the staging project, blocks provider/function/push access and copies the worker/icons unchanged. A generated local staging artifact is not a deployed or accepted artifact.

## Test boundaries and remaining gates

New tests cover actual card-loop selection, original grading consumer preservation, immutable model region hashes, public credential rejection, first-run/blocked-storage/legal journeys and accepted Analysis/filter recovery. Existing UI tests explicitly identify returning-user fixtures so the first-run modal does not intercept unrelated interactions; their behavior assertions remain intact. The original credential-ownership assertions run in a clearly marked nonpublic synthetic variant; separate unmodified-public tests enforce public denial. The two original launch tests that intentionally exercise personal-key compatibility also opt into nonpublic synthetic HTML on separate localhost origins; every other launch case stays public-disabled. No assertion is relaxed to make public key use pass.

Full Node 20/24, targeted Linux WebKit and existing synthetic database/contract jobs must pass at the exact review head. Emulation is not physical Samsung or iPhone acceptance. Actual staging origin checks, authorized hosted Auth, installed-PWA version rollout, publication rights and final release authorization remain separate gates. No hosted mutation, provider generation, deployment or merge is authorized by this candidate.

Rollback is to leave this draft unmerged, or return an isolated candidate branch to the pinned public baseline. No database rollback, archive rewrite or financial operation is needed.
