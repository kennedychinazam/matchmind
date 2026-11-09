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
- both users are deleted and their deletion verified, in a cleanup pass that runs unconditionally
  and cannot mask the original failure

### Corrections after Director review of 8 November 2026

The first version of this harness had four defects. All are fixed in one source-only commit,
`5731c29`, with no key required to land it.

**DR1, the sign-out assertion was factually wrong.** It asserted that an access token minted
before `/auth/v1/logout` stops authorizing PostgREST immediately. Supabase revokes the **refresh**
token; an already minted access token stays valid until its own `exp`. The old assertion would
have failed against correct platform behaviour, and reading that as an app defect would have been
worse than not testing it. Replaced with: the refresh token is **exchanged once while the session
is live**, as a positive control, so a refusal afterwards can only mean revocation; sign-out is
accepted; the exchange afterwards must return exactly 400, with a body naming the token, and no
new `access_token`. The access token is bounded against the **wall clock** (`exp - now` within 24
hours, `iat` within ten minutes of now), not against its own `iat`. Expiry to exhaustion is
**not claimed** — it would mean idling out the token's remaining life — so the remaining seconds
are printed as a NOTE and the omission is named in the job output rather than left for a reader
to find.

The first two of those were corrections after independent review, not part of DR1 as first
written; the section below says what the earlier wording claimed and why it was wrong.

**DR2, the tamper checks were vacuous.** `!(200 && isArray && length>0)` is satisfied by a 500, a
404, a rate limit, and a 200 carrying rows under another key. The decision rules now live in
`backend/fixture-delivery/acceptance-predicates.mjs` and classify a response before anything is
called a denial: `refused_auth`, `empty`, `rows`, `malformed`, `server_error`, `other_4xx`,
`unusable`. A denial is only `refused_auth` or `empty`, at **every** denial site — including the
cross-owner INSERT, which independent review found was still a bare 4xx range. A forged token must
be refused **explicitly** with 401 or 403 — an empty 200 there would mean the token was accepted
and merely filtered, which the old assertion counted as a pass. A forged role **header** rides a
valid token, so it is written as a different contract: answered normally, yielding no privileged
rows, and classifying **identically to the same request without the headers**, which is what makes
it falsifiable.

**The negative controls the review required**, in `test/auth-acceptance-predicates.test.mjs`:
10 offline tests feeding a 200 with a non-array body, 500/502/503/504, 400/404/405/429, undefined,
null, an accepted-but-filtered 200, a circular and a BigInt body, and a token response whose
credentials must be redacted, each required to be **rejected** as a denial or survived without a
throw. They need no
network and no key. The workflow runs them first, with no secret in scope, so the rules are proven
before the key exists:

```
ok 1..8   # tests 8  # pass 8  # fail 0
MM_STAGING_SERVICE_KEY is not configured in the staging-auth-acceptance environment.
(that run predates the two controls added after independent review; the suite is now 10)
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

### Independent security review of the corrections, and what it found

An independent reviewer rebuilt a fake Supabase (GoTrue admin, token and logout endpoints,
PostgREST, the RPCs), drove the real harness against it under 20 adversarial scenarios,
brute-forced the decision rules over 5,632 status-by-body combinations, and ran 12 mutants of the
predicates against the negative controls. It confirmed DR2 and DR3 hold under attack, and that
9 of the 12 mutants die — the controls are real tests. It also found that **three of the four
corrections still contained a vacuous assertion of exactly the class this round existed to
remove**, plus a command-injection sink in the workflow. Eight findings, each reproduced by
execution. All are fixed:

| # | What was wrong | Why it mattered | Fix |
|---|---|---|---|
| F1 | `refresh_token_revoked_by_sign_out` accepted any 4xx, with no proof the token ever worked | Passed 42/42 and exit 0 in a stub where **logout revoked nothing**, and under a 429 | Positive control before sign-out; exactly 400 after; body must name the token; sign-in must return a `refresh_token` |
| F2 | The cross-owner INSERT was a bare 4xx range | A stub that **wrote the forged row** and answered an unrelated 400 passed, leaving a row at an unowned id | Explicit 401/403, body must name row-level security, no row may exist at the forged id, and cleanup removes it |
| F3 | `test "${{ inputs.confirm }}" = "STAGING"` | Actions substitutes textually: a quote in the input closed the string and ran arbitrary shell **inside the approved job**, two steps from the key, while the gate returned 0 | Input read through `env:`, plus a `choice` input and a fail-closed branch assertion |
| F4 | The 24-hour bound measured `exp - iat` | A token valid for **ten years** passed a check whose name said 24 hours | Bounded against the wall clock, with an `iat` freshness check |
| F5 | The user record was captured after the checks that reject it | A created user survived the project unnamed when the response shape differed or a 500 followed the commit | Record pushed first; both response shapes read; recovery by email; row and user cleanup in separate `try` blocks |
| F6 | No control fed `explain()` an unserialisable body | A mutant removing its guard survived all 8 controls; a future simplification turns every failure message into a crash | Controls for circular, BigInt, throwing `toJSON` and hostile proxy bodies |
| F7 | `forged_role_header_answer_is_a_real_contract_not_an_error` | **Proven tautology** over 5,632 inputs: unfailable, and it inflated the pass count by one | Replaced with the comparison against the unforged request |
| F8 | `::add-mask::` printed unconditionally | That line **is** the admin key in clear text anywhere but Actions | Emitted only when `GITHUB_ACTIONS=true`; `explain()` now redacts token fields |

Two lower findings from the same review are also fixed: the failure printer lost the stack
(`String(primary.message)` surfaced the literal `undefined` for a non-`Error` throw), and the
now-stricter raw-feed loop would fail for a relation that is simply not exposed through PostgREST,
which would read like an Auth finding — an admin-keyed preflight now asserts exposure separately.

**Four sentences in an earlier version of this report were wrong**, and they are corrected above
rather than quietly edited: it claimed the refresh token "mints nothing, asserted on both the
status and the absence of a new `access_token`", that the access token's lifetime "is required to
be finite and within 24 hours", that "a denial is only `refused_auth` or `empty`", and that for
the role header "an error is not accepted as success". Per F1, F4, F2 and F7 the first two passed
on evidence consistent with no revocation and with a ten-year token, the third did not hold at the
cross-owner INSERT, and the fourth could not fail.

**Verification of the fixes**, each a stub scenario that must now end the job:

```
happy path                          PASS 54, exit 0, ROWS_LEFT=[] USERS_LEFT=[]
refresh_429                         FAILED refresh_token_WORKS_before_sign_out        exit 1
logout_noop                         FAILED refresh_after_sign_out_refused_400...      exit 1
no_refresh_in_signin                FAILED real_password_sign_in_a                    exit 1
hostile_exp (10-year token)         FAILED access_token_remaining_life_within_24h     exit 1
foreign_insert_allowed              FAILED owner_A_cannot_insert_for_another_owner    exit 1, ROWS_LEFT=[]
create_500_after_create             FAILED admin_created_user_a, user recovered by email, USERS_LEFT=[]
table_404                           FAILED relation_is_exposed_through_postgrest_...  exit 1
raw_feed_malformed / leaks / 500    FAILED authenticated_no_raw_feed_fixtures         exit 1
header_role_elevates                FAILED forged_role_header_yields_no_privileged... exit 1
crossread_leaks / crosswrite        FAILED owner_A_reads_only_its_own_row / ..._update exit 1
cleanup_socket_dies                 CLEANUP INCOMPLETE, every id and email named      exit 1
display_500,row_delete_noop         original failure first, cleanup problem second    exit 1
injection payload into confirm      refused, nothing executed                         exit 1
dispatch from another branch        refused by the in-job branch assertion            exit 1
no GITHUB_ACTIONS                   no ::add-mask:: line, no key on stdout
offline suite                       233 tests, 233 pass, 0 fail
```

**Two limits a person has to close**, named by the review and now written into the workflow
header. Referencing an environment that does not exist **auto-creates it with no protection
rules**, so the branch policy and the required reviewer exist only because somebody set them, and
nothing in the repository can verify that. And the branch policy names a feature branch: after
merge and branch deletion the push trigger stops firing and a dispatch from the default branch is
refused by that policy, so whoever merges updates it. Required reviewers are now stated as
**required**, not recommended, because the push trigger carries no confirmation input.

**One finding I did not fix.** The review suggested SHA-pinning `actions/checkout@v4` and
`actions/setup-node@v4`, which is sound for a job that holds an admin key. Resolving a trustworthy
commit SHA means reading a repository outside the access this session is scoped to, and guessing
one would break CI. Both tags are unchanged from the other workflows in this repository. It is the
operator's call, and a one-line edit.

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
