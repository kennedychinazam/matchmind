# MatchMind Build 357 — final release acceptance report

Prepared against the Director's work order of 7 November 2026 on PR #26. Four priorities, four
roles, one report.

**Nothing in this round changed production, mutated hosted staging, made a paid request, merged,
deployed, or touched the prediction engine.**

---

## 0. What is being released

| | |
|---|---|
| Build | `APP_BUILD = 357`, service worker cache `matchmind-v357` |
| `index.html` | sha256 `a3e27362ac0e19710a8d34734223ab5b71188afaad8189ff1187063dcf5ccc9a` |
| `sw.js` | sha256 `67640f8c46be5635b6efe536f33564ec08530c84e8b79ca5b527c79ee15d430a` |
| Migration | `PROPOSAL-up.sql` blob `2e850a5206e0f178ffbb1847fc7c182288283eaa` |
| Branch | `claude/staging-s1-s2-20261107`, PR #26 |

Two checks worth stating because they are the ones that make the staging evidence transferable:

- The migration blob on this branch is **byte-identical** to the one the Director installed on
  staging. Verified with `git rev-parse HEAD:backend/fixture-delivery/PROPOSAL-up.sql`.
- `index.html`, `sw.js` and the manifest are **byte-identical** to PR #25 head `c63e6e6`, so the
  app under test has not moved since it was reviewed.

---

## 1. Priority 1 — genuine Auth sign-in: **BLOCKED, harness ready**

**Not done, and not claimable.** The work order's own instruction applies: identify the exact
access requirement rather than claim completion.

### The two blockers, established not assumed

```
$ curl https://rdcbnvfnxenrpnnwxszs.supabase.co/auth/v1/health
curl: (56) CONNECT tunnel failed, response 403
```

1. **This container cannot reach the staging host.** Its network policy denies it. That is why the
   Director's own live HTTP tests ran from a GitHub Actions runner.
2. **No Auth Admin capability exists here.** The Supabase tooling in this session can read
   publishable keys and run SQL; it cannot create an Auth user. There is no service_role key in
   this environment. The work order forbids the two shortcuts — repeating the rate-limited public
   signup, and writing password hashes into auth tables — and neither was attempted.

### What is ready, so the gap closes in one action

`backend/fixture-delivery/staging-authenticated-acceptance.mjs`, run by
`.github/workflows/staging-authenticated-acceptance.yml`. It creates two disposable users through
the official Admin API with `email_confirm`, signs both in with the **publishable** key exactly as
the app does, and then proves over real HTTP with real JWTs:

- `role` is `authenticated`, `sub` matches the created user, no elevated claim, future expiry
- A writes and reads only its own row; B likewise
- A cannot read, update, or insert against B; B's row is unchanged after A's attempts
- an authenticated ordinary user reads no raw feed from any of seven tables, has `raw_allowed`
  false, and still reads the bounded display
- the publish entry point refuses them **and refuses by the runtime gate rather than by an ACL**,
  which is the honest form of that claim
- a re-encoded JWT claiming `service_role` is rejected; a broken signature is rejected; role
  headers do not elevate
- a signed-out token stops working
- both users are deleted and their deletion verified, in a `finally` that cannot mask the original
  failure

### Corrections after Director review of 8 November 2026

The first version of this harness had four defects. All are fixed in one source-only commit,
`5731c29`, with no key required to land it.

**DR1, the sign-out assertion was factually wrong.** It asserted that an access token minted
before `/auth/v1/logout` stops authorizing PostgREST immediately. Supabase revokes the **refresh**
token; an already minted access token stays valid until its own `exp`. The old assertion would
have failed against correct platform behaviour, and reading that as an app defect would have been
worse than not testing it. Replaced with: sign-out is accepted; the refresh token mints nothing,
asserted on both the status and the absence of a new `access_token`; and the access token's
lifetime is required to be finite and within 24 hours. Expiry to exhaustion is **not claimed** —
it would mean idling out the token's remaining life — so the remaining seconds are printed as a
NOTE and the omission is named in the job output rather than left for a reader to find.

**DR2, the tamper checks were vacuous.** `!(200 && isArray && length>0)` is satisfied by a 500, a
404, a rate limit, and a 200 carrying rows under another key. The decision rules now live in
`backend/fixture-delivery/acceptance-predicates.mjs` and classify a response before anything is
called a denial: `refused_auth`, `empty`, `rows`, `malformed`, `server_error`, `other_4xx`,
`unusable`. A denial is only `refused_auth` or `empty`. A forged token must be refused
**explicitly** with 401 or 403 — an empty 200 there would mean the token was accepted and merely
filtered, which the old assertion counted as a pass. A forged role **header** rides a valid token,
so it is written as a different contract: answered normally, yielding no privileged rows, with an
error not accepted as success.

**The negative controls the review required**, in `test/auth-acceptance-predicates.test.mjs`:
8 offline tests feeding a 200 with a non-array body, 500/502/503/504, 400/404/405/429, undefined,
null, and an accepted-but-filtered 200, each required to be **rejected** as a denial. They need no
network and no key. The workflow runs them first, with no secret in scope, so the rules are proven
before the key exists:

```
ok 1..8   # tests 8  # pass 8  # fail 0
MM_STAGING_SERVICE_KEY is not configured in the staging-auth-acceptance environment.
```
([run `42454204170`](https://github.com/kennedychinazam/matchmind/actions/runs/42454204170))

**DR3, cleanup did not cover the rows.** Deleting the Auth user is not proof `public.app_state` is
clean, because that table has no verified `ON DELETE CASCADE`. Rows are now deleted by their own
owner where a token exists and by the authorized staging admin path otherwise, their absence is
verified, then the users are deleted and their absence verified. Either survivor fails the job and
emits a warning naming the id. The original failure is preserved: the body records its error,
cleanup runs unconditionally and collects its own problems, and the original is reported first.
Each created user id is validated as a UUID before the next user is created.

**DR4, secret routing.** This repository is **public**. The key now comes from a GitHub
**Environment** secret in `staging-auth-acceptance`, with `environment:` on the job, rather than a
repository-wide secret. An environment can be restricted to one branch and can require a named
reviewer before any secret is materialised; a repository secret has neither control.

**One further tightening, from auditing my own corrections:** the publisher assertion matched any
string containing "publisher", which a permission error naming `publisher_allowed` would satisfy.
It now requires the gate's own message, `Scoped publisher required`.

**A factual limit on DR4.** I cannot create or inspect GitHub environments or secrets from here;
those API paths return 403 through this session's proxy. That step is the operator's. Environments
with branch restrictions and required reviewers are available on public repositories, so the
control the review asked for does exist.

### The exact access requirement

> **One ENVIRONMENT secret: `MM_STAGING_SERVICE_KEY`, the `service_role` (secret) API key of the
> STAGING project `rdcbnvfnxenrpnnwxszs` only. Never the production key.**
>
> 1. GitHub → Settings → Environments → New environment → name it exactly
>    `staging-auth-acceptance`
> 2. Deployment branches: Selected branches → `claude/staging-s1-s2-20261107`
> 3. Required reviewers: add yourself, so each run pauses for approval before the secret exists
>    in the job
> 4. Environment secrets → Add secret → `MM_STAGING_SERVICE_KEY`
> 5. Value from Supabase → `matchmind-staging-357` → Settings → API → `service_role`
>
> Enter it in that settings page and nowhere else: not in chat, not in source, not in a PR
> comment, not in a log. A one-time staging key rotated after acceptance is safer than a standing
> one.

The value never passes through chat, a commit, a file or a log: the script masks it before first
use and GitHub redacts secrets from logs. The only key committed is the staging **publishable**
key, which the browser already ships and which was verified against the project.

The job is **red until that secret exists**, deliberately. A green tick with no signed-in evidence
would be a lie.

It has been run, so the blocker is recorded rather than described:
[run `42450988264`](https://github.com/kennedychinazam/matchmind/actions/runs/42450988264),
conclusion **failure**, on `b8b1744`:

```
MM_STAGING_SERVICE_KEY is not configured. The authenticated acceptance cannot run.
NOT RUN: MM_STAGING_SERVICE_KEY is absent.
This job is the only source of genuine signed-in evidence; treat its absence as
the Auth gate still being open, not as a pass.
```

The harness is therefore wired and reachable from a runner; the single missing input is the key.
A first attempt to trigger it by `gh workflow run` returned 404, because GitHub will not dispatch
a workflow that is not yet on the default branch; a push trigger scoped to this branch and these
two files was added so a result could be recorded before merge.

### If you would rather not put a key in GitHub

The alternative is the minimal dashboard path the work order allows: create two users by hand in
the staging dashboard with **Auto Confirm User**, then supply only their passwords as secrets. It
is worse — manual, no programmatic cleanup, and a standing test account — which is why the Admin
API is preferred. A third option exists: this session can request the key through a secure
credential prompt that stores it on the environment rather than in GitHub, but the container would
still need its network policy opened to the staging host, so it is two changes instead of one.

---

## 2. Priority 2 — authenticated isolation and JWT security: **PENDING on Priority 1**

The assertions are written and reviewed; they cannot run without the key. What IS already
established, by the Director and not repeated here:

- Anonymous live HTTP, 16/16 PASS, run `42416671006`
- Hosted database role-context tests: A sees only A, B only B, ordinary users cannot raw-read or
  publish, `service_role` reads all 148 fixtures
- No unauthorised `PUBLIC EXECUTE` on any private function; no temporary `CREATE` retained

### Independent security review

A reviewer was given the harness with a brief to break it. **It terminated early on the account's
5-hour usage limit**, so this round's review is **partial** and I am not presenting it as complete.
It produced one real finding before stopping, and that finding is fixed:

> `PROPOSAL-up.sql:418` grants EXECUTE on the publish entry point to `authenticated`. An assertion
> named `authenticated_cannot_publish` therefore overstated what it proved — the refusal comes
> from the runtime gate, not from a missing privilege.

Renamed and split into two assertions: the call is refused, **and** it is refused by the gate.

I then audited the class the reviewer was heading for and closed it myself: denial assertions
written as `!(200 && isArray && length>0)` pass when the body is not an array at all, so the seven
raw-feed checks and the cross-account read now require *refused, or an empty array*, nothing else.
The related worry — that a "denied" result might merely be an unauthenticated request being
denied — is closed by construction: every denial assertion carries a token that exists only
because the sign-in check passed, and that check throws.

**A full independent review of the harness, and of the run output once it exists, is still owed.**

### Two pre-existing items carried forward, still undecided

Both were reported in PR #26 and neither is mine to change:

1. `publisher_allowed()` also accepts `current_setting('role') = 'service_role'`, and `set role
   service_role` sets that GUC. Anyone who can run SQL on the authenticator connection publishes
   with no enrolled principal. **A cheaper bypass than spoofing a subject.**
2. `display('history')` returns 145 predictions to an unauthenticated caller — 146 cards including
   one slip-linked card, per the Director's run.

---

## 3. Priority 3 — physical devices: **REQUIRES AN OPERATOR**

`audits/release-acceptance/DEVICE-ACCEPTANCE-CHECKLIST.md`: 22 items across install and launch,
touch, offline and network transitions, notifications, storage pressure, readability, and the two
Build 357 corrections on real hardware. Pinned to the candidate by sha256, with the emulated
results stated so the operator does not repeat them.

**Nothing in it has been performed.** No emulator, headless browser or CI runner establishes iOS
WebKit install behaviour, a real OS notification prompt, a delivered push, genuine touch, a real
radio, or whether the text is comfortable. Two devices are needed: a physical Samsung Android, and
a physical iPhone tested in **Safari** specifically.

---

## 4. Priority 4 — publication rights: **DECISION-READY, NOT DECIDED**

This is a rights decision, not an engineering one. What engineering can do is make the question
exact. The facts, all verified:

| What is published | To whom | Form |
|---|---|---|
| 146 history cards, **145 carrying an issued prediction** | **anonymous**, no account | JSON over HTTPS from a fixed RPC |
| fixture identity: competition, country, date, time, teams, status | anonymous | same |
| 90-minute and full-time scores | anonymous | same |
| MatchMind's own probabilities, pick, market, expected goals | anonymous | same |
| one edition's board and slips | anonymous | same |

And what is **not** published: no raw provider table, no provider blob or marker, no odds history,
no third-party imagery, no provider branding. Club and competition logos are suppressed everywhere
and initials are drawn instead; the share canvas draws no third-party image. Neutral branding
holds.

**The question for decision, in one sentence:** is a finite, inspectable, anonymously-readable
JSON edition containing 145 issued predictions plus the underlying fixture identities and scores a
permitted in-app display of provider-derived facts, or a redistributable dataset that needs
publication rights?

Three outcomes, with what each costs:

1. **Permitted as published.** Nothing changes. Carries the risk that a bounded edition is still a
   dataset someone can record and republish, because bounding fields reduces extractability and
   does not confer a right.
2. **Permitted only to signed-in users.** Move the `history` screen behind authentication. Small
   change, and it ends anonymous bulk reading of 145 predictions. It also changes the product: the
   public record of what was predicted becomes private.
3. **Permitted only for MatchMind's own output.** Publish the picks and probabilities, withhold
   provider-derived fixture identity and scores from the anonymous surface. The largest change,
   and it would make the history screen much less useful.

My engineering recommendation, offered as input and not as the decision: option 1 is defensible
for the predictions themselves, which are MatchMind's own work, and weakest for the fixture
identities and scores, which are the provider's facts. If the rights review is uncomfortable, 2 is
the cheapest fix and leaves the product intact for users who have accounts.

**No provider was contacted and none should be without authorization.**

---

## 5. Evidence not repeated

Per the work order, these are carried forward from PR #26 and were not re-run, because nothing in
this round changed the code they cover:

| | |
|---|---|
| Node 20.20.2 / 24.19.0 browser suite | 223 / 223, 0 fail, 0 skipped, 0 cancelled |
| PostgREST synthetic acceptance | 95 checks, 0 failures |
| PostgreSQL 16 fence | 10 probes, negative control held |
| PostgreSQL 17.11 hosted-shape | 26 probes + 10 fence probes, negative control held |
| Director's anonymous live HTTP | 16 / 16, run `42416671006` |
| Director's hosted DB role-context, revert rehearsal, inventory | PASS |

---

## 6. Outstanding approvals and gates

| # | Gate | Owner | Blocks release? |
|---|---|---|---|
| 1 | `MM_STAGING_SERVICE_KEY` repository secret | Director / operator | **Yes** — Priorities 1 and 2 |
| 2 | Physical Samsung + iPhone Safari acceptance | Operator | **Yes** |
| 3 | Publication-rights decision, §4 | Director | **Yes** |
| 4 | Full independent review of the Auth harness and its run | Reviewer | **Yes** |
| 5 | `service_role` GUC publisher bypass, §2 | Director | Decision |
| 6 | Anonymous access to 145 predictions, §2 | Director | Decision, overlaps §4 |
| 7 | Production install of the migration | Director | Separate authorization |

---

## 7. GO / NO-GO

**NO-GO for production merge, deployment and public release.**

Four gates are open: no genuine signed-in evidence exists yet, no human has held the app on a
phone, the publication-rights boundary is undecided, and this round's independent review was cut
short.

**The engineering candidate itself is sound and unchanged.** The migration installed unmodified on
staging and passed the Director's own verification; the app files have not moved since review;
every suite that could run offline is green; and the one remaining engineering task is wired and
waiting on a single secret.

**Nothing here authorizes installing this migration on production.**
