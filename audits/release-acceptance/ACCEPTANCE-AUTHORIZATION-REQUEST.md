# Build 357 release acceptance — configuration, cost and authorization requests

Branch `claude/release-acceptance-20261106`, from the verified head of draft PR #23,
`7ed7a9f56ca9552665c0f6c425f513ba26aebe92`. Nothing in this document has been executed.
No hosted resource was created, no account was opened, no payment was made, no provider
was contacted and no production row was read or written.

## 1. What could be proved in this container, and what could not

| Proof | Status |
|---|---|
| Browser/PWA regressions, Node 20 and 24, offline Chromium | DONE. 217 tests, 217 pass, 0 fail, 0 skipped, 0 cancelled, locally and on GitHub Actions |
| The RLS raw fence, on an isolated local PostgreSQL 16.15 cluster | DONE. `backend/fixture-delivery/local-fence-regression.sql`, 8 asserting probes |
| Emulated phone and tablet acceptance | DONE. Four device profiles, `test/mobile-pwa-acceptance.test.mjs` |
| The repository's own synthetic Postgres + PostgREST proof | **BLOCKED — no Docker in this container** |
| Production-equivalent hosted staging | **NOT STARTED — needs the authorizations below** |
| Physical-device acceptance | **BLOCKED — needs an operator with hardware** |

### Why the repository's synthetic database proof could not run

`backend/fixture-delivery/local-integration.mjs --run-local-synthetic` requires the Docker
daemon. This container has none:

```
$ ls -la /var/run/docker.sock
ls: cannot access '/var/run/docker.sock': No such file or directory
$ docker --host=unix:///var/run/docker.sock info --format '{{.ServerVersion}}'
failed to connect to the docker API at unix:///var/run/docker.sock
```

The `docker` client binary exists; the daemon and socket do not. It pins
`postgres@sha256:858bb5e9…` and `postgrest/postgrest:v14.18@sha256:c7cd7e26…` on an
internal-only network, so it needs no outbound access, only a daemon.

The local PostgreSQL cluster I used instead is a genuine database proof of the RLS
question and nothing more. It does **not** cover PostgREST behaviour: request shaping,
`Prefer` headers, embedded resource expansion, `?select=` column projection, Range
pagination headers, the JWT role switch, or the `/rpc/` surface. Those remain unproven
until either a Docker host runs `local-integration.mjs` or a staging deployment exists.

**AUTHORIZATION REQUEST 1 — a Docker-capable runner.** No hosted resource, no account, no
cost, no external network. This is the cheapest remaining gain in confidence.

## 2. Production-equivalent staging: exact configuration and cost

Nothing here exists. Each line is what would be created if approved.

| Component | Exact configuration | Cost |
|---|---|---|
| Supabase project | New project on the existing `MatchMind` organization, named so it cannot be mistaken for production (e.g. `matchmind-staging-357`), region `eu-west-2` and **PostgreSQL 17** to match production | See the cost note below |
| Database contents | Schema and grants only, then **synthetic rows generated locally**. Zero production fixtures, predictions, forecasts, accounts, archives or financial records copied | 0.00 USD |
| Auth users | Three synthetic accounts: ordinary A, ordinary B, one enrolled principal. Invented addresses on a domain the Director nominates, passwords generated at run time and never committed | 0.00 USD |
| Edge Functions | **None deployed.** The two patches in this proposal are artifacts, not functions; they need the then-current deployed source for comparison, which is deliberately outside this repository | 0.00 USD |
| Static hosting | None. The PWA is one file served from the local test origin | 0.00 USD |
| Provider access | **None.** No API-Football key is installed in staging and no provider request is made | 0.00 USD |
| Paid inference | **None.** OpenRouter stays disabled; the lifetime ceiling, retained reservations, consumed latches and the global halt are untouched | 0.00 USD |

### Cost note, from the account as it actually stands

Read from the Supabase management API, metadata only. No production table, row or backup
was read.

- Organization `MatchMind` (`tpbuhnouchqssmunxqgv`), plan **free**, the only organization.
- Two projects already exist, both in `eu-west-2`:
  - `MatchMind Project` (`toqfdrcjzwnlydqekude`), **ACTIVE_HEALTHY**, PostgreSQL 17.6.1.147
  - `EduVanta` (`kbkzwcaffyjxnsbvtsnw`), **INACTIVE**

The free plan allows two *active* projects per organization. One is active and one is
paused, so a third project would be the organization's second active project and should
remain free. That depends on how Supabase counts a paused project at the moment of
creation, and on `EduVanta` staying paused. I am not willing to state 0.00 USD as a fact
on that basis.

**Expected cost: 0.00 USD. Worst case: 10 USD per month** if the organization must move to
Pro because the new project is counted as a third. If the create call reports any charge,
or asks to upgrade the plan, I will stop and report rather than proceed.

Free plan limits worth stating before approval: 500 MB database, 5 GB egress, 50,000
monthly active users. The synthetic dataset acceptance needs is a few thousand rows, far
inside that.

### One version gap to record

Production runs **PostgreSQL 17.6.1**. The fence regression in this branch ran on
**PostgreSQL 16.15**, which is what this container has. The restrictive/permissive policy
semantics the regression turns on have been PostgreSQL's documented behaviour since
restrictive policies were introduced in 9.5, and I have no reason to expect a difference,
but I did not test it on 17: this container has only 16. The regression records the version
it ran on. Staging should be created on PostgreSQL 17 so the acceptance evidence sits on
the production engine.

**AUTHORIZATION REQUEST 2 — create the staging Supabase project** on the terms above,
including the worst-case 10 USD per month if Supabase counts it as a third project.

Each of the following needs its own authorization. None is implied by Request 2, and I
will not execute any of them without it. They are listed separately because each is a
distinct write.

**AUTHORIZATION REQUEST 3 — apply `PROPOSAL-up.sql` to staging only.** One transactional
install against the staging database. It aborts by design on unsupported authority, an
unreviewed dependent object or an inherited anonymous grant. Production is not touched.

**AUTHORIZATION REQUEST 4 — create the three synthetic staging accounts** and write the
synthetic rows. Includes the account-creation writes and the seed inserts.

**AUTHORIZATION REQUEST 5 — run the denied-operation probes.** Anonymous raw select,
ordinary authenticated raw select, unrestricted pagination, bulk extraction, a generic
`?select=*` through PostgREST, cross-account reads, and a write attempt from each role.
These are reads and refused writes, but the refused writes still reach the server, so they
are named separately.

**AUTHORIZATION REQUEST 6 — rehearse `PROPOSAL-revert.sql` on staging.** Noted plainly:
the revert restores the previous broad exposure. It is a rollback rehearsal, never a
release fallback.

**AUTHORIZATION REQUEST 7 — delete the staging project when acceptance ends.** A
destructive operation, so it is asked for rather than assumed.

**AUTHORIZATION REQUEST 8 — the Director's secret-free export** of the actual production
schema, grants, policies, triggers, views, functions, configuration and inventory sizes.
One question cannot be answered without it, and it decides whether the install is safe:

> Is `service_role`'s SELECT on `fixtures`, `predictions`, `daily_slips`, `shared_records`,
> `odds_snapshots`, `injuries`, `match_context`, `predictions_retired`, `match_analysis`
> and `venues` an **explicit grant to `service_role`**, or is it inherited via `PUBLIC`?

`PROPOSAL-up.sql` runs `revoke select on <table> from public,anon,authenticated`. If the
collector's access came through `PUBLIC`, that statement strips the collector and the
refresh pipeline stops. My local replica cannot answer this: it is a fact about the
production catalogue. The proposal's preflight does not check it either. It should, and I
can add that check once the export shows the intended shape.

## 3. Physical-device acceptance: exactly what needs an operator

Chromium device emulation is recorded in `test/mobile-pwa-acceptance.test.mjs`. Emulation
cannot establish any of the following, each of which needs a person holding hardware:

1. **iOS Safari.** Emulation runs Chromium. iOS uses WebKit, where service-worker cache
   eviction, storage quota, and the behaviour of a backgrounded tab all differ. One iPhone
   on a current iOS, Safari only.
2. **Add to Home Screen, and launch from the icon.** The standalone launch, the splash
   screen, the status-bar treatment, and whether the app returns to the right view. iOS and
   Android separately.
3. **Real touch.** Tap accuracy on the five navigation targets, scroll momentum, the date
   strip under a thumb, and whether any control is unreachable one-handed. Measured 44 CSS
   px is the geometry, not the experience.
4. **Notification permission.** The real OS prompt, a delivered push, and the behaviour
   when the app is closed. The worker's push handler has never run against a real push
   service.
5. **Network transitions.** Offline to online mid-read, a captive portal, 3G-grade latency,
   and airplane mode on a cold start. The offline shell is proven against a destroyed
   local origin, which is not a flaky mobile radio.
6. **Storage pressure.** `saveState` writes against a roughly 5 MB quota with an empty
   catch. A device with a full browser store is the only place that surfaces.
7. **Screen sizes in the hand.** 320 px and 390 px are proven to fit without sideways
   scroll; whether the text is comfortable is a judgement only a person can make.

**AUTHORIZATION REQUEST 9 — an operator session on physical devices**, one iOS and one
Android, running items 1 to 7 and recording the result per item.

## 4. API-Football policy

Per the Director's instruction, routine renewal and further subscription-proof demands are
not treated as release blockers, and the earlier 10 November three-fixture pilot date is
treated as an internal evidence check, not a retention deadline. No data was deleted. No
provider contact was made and none is proposed here. Branding stays neutral.

One licensing question is left materially unresolved by the bounded presentation contract,
and it is for the rights review rather than the provider: the bounded editions are still a
finite, inspectable, recordable projection of provider facts served to the public. Bounding
the fields and denying generic SQL reduces extractability; neither confers a publication
right. Until that is settled, external invitations and public release stay blocked, which
is the position PR #23 already records.
