# Final integrated release candidate — 2 November 2026

Status: **NO-GO for publication**. Offline corrections are assembled on `codex/release-final-20261102`, based on accepted PR #21 at `34005c10da5566249f60631bd43bc73a78cef524`. Accepted branches remain unchanged, draft and unmerged. This document is a review artifact, not deployment authority. Final exact-head CI and review receipts belong in the associated draft PR and private Director package.

## Implemented corrections

- **Personal credentials:** account-owned, provider-specific credential envelopes; matching account, authentication epoch, credential revision and provider/generation checks at dispatch. New guest keys are explicit, memory-only sessions. Legacy credentials remain preserved and unassigned; they are not imported into the next account or exported through personal-state sync. Saving does not send a request. Browser storage is not encryption or protection against same-origin scripts or a person controlling the profile.
- **Account deletion:** completion is bound to the initiating user, exact authentication context and client. An obsolete completion cannot sign out, clear, notify or reload another account. Origin-wide erasure and SDK sign-out are removed from this handler. Device copies are preserved. A confirmed server acknowledgement with revoked session can detach only the still-current initiating identity; ambiguous session verification receives an honest terminal warning. Server deletion completeness and cross-device revocation remain unverified.
- **Neutral branding:** the release source defaults third-party imagery off. Team initials and generic competition symbols replace supplied crests/logos at audited rendering sinks, including cached competition labels. Inert source URLs remain where required for identity/model inputs. Re-enabling imagery needs separately documented rights.
- **PWA verification:** a real local Chromium service-worker harness records controller changes, worker identity, cache inventories and served/cached/offline content digests through an update and forward-version rollback. Only synthetic HTTP response fixtures use higher versions. The repository worker, application build number and production registration are unchanged.

## Verification scope

The complete Node 20/24 suite includes existing settlement, ownership, Search/accessibility and prediction regressions plus credential, deletion, branding and PWA tests. Deliberate failing-first evidence and intermediate failures are retained privately. Two legacy saved-key tests were intentionally changed: automatic use of ownerless credentials is replaced by matching-owner restoration and explicit session consent; no test is silently skipped.

A separate isolated local Supabase stack passed **34/34** Auth/Data API/RLS checks. The actual candidate browser and Supabase-js SDK passed **13/13** UI/authentication/owner-state checks against that stack. The local schema is a deliberately narrow app-state reference, not a production clone. Shared-football GETs were empty stubs and unavailable functions returned synthetic 503; external requests were intercepted. These checks do not establish live collector freshness, deployed functions, production RLS equivalence or physical-device behaviour. The local synthetic containers were stopped; their evidence/data were preserved.

## Current provider-rights decision

API-Football remains the primary provider. The following are **SUPPORTED BY PROVIDER CORRESPONDENCE**, based on the Director's attestation of Kevin's written reply retained privately:

1. A standard paid public prediction application.
2. In-app fixtures, kickoff times, names, results, scores, standings and statistics, subject to applicable rights.
3. Private normalized historical processing while the subscription is active.
4. Commercial publication and post-expiry retention of independently generated, non-reconstructive derived predictions, parameters and aggregates.

This supersedes a blanket unresolved-provider-use classification. Official [API-SPORTS terms](https://api-sports.io/terms), read 2 November 2026, identify their update as 21 May 2025. Applicable governing terms and third-party obligations still apply. The private original correspondence was not independently authenticated by this code review.

Separate raw-data resale, another API/feed and bulk download are excluded. Crests, trademarks and competition imagery are not fully cleared. Permanent raw retention after expiry is not covered; temporary cache duration is unspecified. Renewal after a lapse is not retroactive. Share images mixing derived predictions with raw fixture details need an explicit scope decision for onward publication.

No explicit raw-download UI was found, but read-only production catalog evidence confirms public SELECT authorization across 89 fixture columns and public lean/competition views. This permits reconstruction-capable access and remains a **specific release blocker** pending a precise serving contract and separately authorized backend correction or scope clarification. No bulk data download or production mutation was performed. Neutral imagery does not solve this backend issue.

## Continuity and retention

The Director intends continuous renewal. Actual entitlement must be evidenced separately; this work did not log in, renew, pay or consume provider quota. The reported **10 November 2026 12:00 UTC pilot cutoff** and **11 November 2026 13:47:51 UTC subscription expiry** are separate. Renewal does not automatically extend the pilot. Keep append-only entitlement intervals and a separate pilot decision record, with raw/derived/mixed copy inventory and custodians. Preserve archives pending an authorized disposition; no grace period, automatic deletion or migration is introduced.

## Remaining acceptance gates and required authority

| Gate | Current finding | Next authority/evidence |
|---|---|---|
| Offline credential/lifecycle/branding/PWA corrections | Implemented; final exact-head suite/CI and independent review recorded with PR | Director review of final artifact |
| Local Auth/RLS and real-SDK browser reference | 34/34 and 13/13 passed within stated scope | Does not replace production-equivalent acceptance |
| Raw provider-data delivery | Public catalog permissions confirmed; publication blocked | Approve precise serving policy/backend change and rights scope |
| Provider-supported intended uses | Supported as described above | Preserve private correspondence and applicable account/terms linkage |
| Subscription continuity and pilot | Intention and reported dates recorded; actual entitlement not independently observed | Redacted current account entitlement and distinct pilot decision |
| Production security/operations | Source/metadata reviewed only | Separate authorization for each hosted test/change; verify secret wiring, actual RLS/functions, freshness and recovery |
| Physical Android/iOS Safari/desktop and accessibility | Real-device acceptance not established by synthetic Chromium | Named devices/operators and recorded acceptance, including assistive technology |
| Production offline/update/rollback | Bounded synthetic lifecycle proved only | Operational acceptance and explicit deployment/rollback authority |

Production metadata also reports pg_net in public and leaked-password protection disabled. Six RLS/no-policy tables can be deny-by-default; that alone is not proof of exposure. `send-push` source checks MM_CRON_SECRET before work despite verify_jwt=false; deployed secret/wiring is not proved by source inspection. No production fixes were made.

## Preservation and rollback

Build 355 mathematical formulas, frozen forecast/archive files, research execution/financial controls, worker and manifest are outside this correction. No historical regrading, live account deletion, provider generation, financial reservation, production write, merge or publication is authorized or performed by this candidate. Alternative-provider work remains **DEFERRED until after launch and separate approval**.

Before merge, rollback is simply to close/discard this draft candidate and continue using the accepted baseline; no production state has changed. Any future deployed rollback must be separately approved, retain owner-bound/quarantined data and use a forward worker version so stale caches are not resurrected. Do not roll back to automatic legacy-key use or origin-wide deletion. No destructive storage migration or cleanup is part of this patch.
