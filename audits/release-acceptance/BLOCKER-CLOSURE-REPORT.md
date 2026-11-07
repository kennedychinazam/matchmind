# Build 357 — final blocker closure report

Continuation of draft PR #24 from its accepted head `20884c8774bdff44ddb5872eb5c2d3e9ed929fed`.
No production write, merge, deployment, payment, provider contact, paid inference, historical
regrading or destructive operation was performed.

---

## 1. Exact commit and draft PR

| | |
|---|---|
| Base, accepted by the Director | `20884c8774bdff44ddb5872eb5c2d3e9ed929fed` |
| Branch | `claude/blocker-closure-20261106` |
| Head | `32ec840` |
| CI, all four jobs green | [`42371166394`](https://github.com/kennedychinazam/matchmind/actions/runs/42371166394) |

Commits, oldest first:

| SHA | Subject |
|---|---|
| `1165522` | the public Analysis feed was empty, and a played match was given a hindsight headline |
| `fd3ce61` | collector preflight, proven by a probe that distinguishes explicit from inherited |
| `9ee7b6b` | PostgREST acceptance runs in CI, with a negative control |
| `32ec840` | edition ordering verified, and the fence negative control fixed |

Nothing from the accepted work was reopened. The corrections the Director listed as accepted are
untouched and still pass.

---

## 2. Newly reproduced defects and their causes

Five, every one reproduced before it was touched. Two were user-facing, and both were invisible to
the existing suite because no test opened the screen.

### ERROR A — the public Analysis feed was empty for ordinary users

- **ROOT CAUSE** `visibleLeagues()` required `(l.matches||[]).length >= 15`. That floor exists
  because the device cannot FIT a model on a thinner corpus. `loadFixturePresentation()` builds
  every bounded public league with `matches: []` by design, because the prediction was already made
  and published by the collector and the device must never refit it. A fitting precondition was
  therefore applied to rows that are never fitted.
- **EVIDENCE** `index.html:17029` against `index.html:3018`. Reproduced by a rendered test: with a
  valid bounded edition of two competitions and three fixtures delivered to an ordinary caller with
  raw access denied, `afState` held all of it and `#fixturesWrap` carried the `hidden` class.
  `the whole fixture feed is hidden from an ordinary caller / true !== false`.
- **PROPOSED SOLUTION** apply the history floor only to leagues this device fits locally.
- **ALTERNATIVE** give presentation leagues a synthetic corpus to clear the floor. Rejected on the
  Director's instruction and on the merits: it would fabricate history. A second alternative,
  dropping the floor entirely, was rejected because it is correct for every locally fitted league.
- **IMPACT** launch-blocking. After the bounded-delivery change every ordinary user is a caller
  without raw access, so the Analysis tab was blank for all of them while the data was present and
  correct. The two existing bounded-delivery suites passed throughout.
- **VERIFICATION** `test/public-analysis-visibility.test.mjs`, written failing-first. It asserts the
  payload is right, then that both competitions and all six team names are on screen, that opening a
  fixture shows its published pick and stored probabilities, that no model is refitted, and that no
  raw table is read.
- **STATUS** FIXED. No history fabricated, no raw access relaxed, floor unchanged for fitted leagues.

### ERROR B — a played fixture with no snapshot was given a hindsight headline

- **ROOT CAUSE** `index.html:9746` states the rule: a match already played shows the pick AS IT WAS
  MADE, because recomputing trains on data that now contains this very match. The code honoured it
  only when an archived pick existed. With no snapshot it fell through to a fresh
  `headlinePick(pred, …)` and the hero printed it as "The engine's headline call for this match"
  with a confidence percentage.
- **EVIDENCE** reproduced on the real page: `actual: "The engine's headline call for this match"`,
  and on a second render of the SAME finished fixture under a grown corpus the confidence moved
  (`45.8% confidence`). This matches the owner's screenshots of Liverpool 0–1 Arsenal showing
  DRAW 34.9% and then Liverpool or DRAW 64.3%, with expected goals moving 0.92/0.89 to 1.42/1.39.
  The note under the same bars already said the figures were recalculated today with the result in
  the data, so the screen contradicted itself.
- **PROPOSED SOLUTION** with no stored forecast, say no prediction was published for this match and
  show no confidence. Keep the bars and their existing illustrative note.
- **ALTERNATIVE** freeze the recomputed numbers on first view so at least they stop moving.
  Rejected: it makes a hindsight estimate look like a forecast more convincingly, which is worse.
- **IMPACT** the product asserted a prediction it never made, on a match whose result it already
  knew, with a confidence figure attached. The share card was already suppressed for exactly this
  case in build 156, so the screen was contradicting the app's own rule.
- **VERIFICATION** `test/played-no-snapshot-headline.test.mjs`, two tests, written failing-first:
  no headline call and no confidence figure, and two renders under a changing corpus agree.
- **STATUS** FIXED. A played fixture that HAS its archived pick is unaffected. No probability,
  threshold, ladder, settlement rule or grading rule changed.

### ERROR C — the migration could have stopped the collector

- **ROOT CAUSE** `PROPOSAL-up.sql` runs `revoke select on <table> from public,anon,authenticated`
  with no check that the collector's read survives it.
- **EVIDENCE** the owner's own read-only inspection answered the question for today's production,
  but the migration encoded no check, so it depended on that report still being true when it ran.
- **PROPOSED SOLUTION** a preflight, before any revoke, requiring for each of the ten base tables:
  `service_role` exists, `has_table_privilege('service_role', <table>, 'SELECT')` is true, and an
  **explicit direct** SELECT grant to `service_role` appears in the ACL. Abort transactionally,
  naming the table and the remedy.
- **ALTERNATIVE** assert the owner's observed configuration directly. Rejected on the Director's
  instruction not to hardcode it, and because the property is what the migration depends on.
- **IMPACT** an installation whose collector read came only through `PUBLIC` would have had
  ingestion stopped silently, with nothing in the catalogue to show why.
- **VERIFICATION** probes 9 and 10 in `local-fence-regression.sql`. Probe 10 is the one that
  matters: it leaves the collector reading only through `PUBLIC`, confirms it STILL READS — so a
  naive effective-privilege check would wave the migration through — and requires the direct-grant
  test to be false. A CI drift guard greps both files for the same predicate pair.
- **STATUS** FIXED in the proposal file. **Not installed anywhere.**

### ERROR D — the fence negative control proved nothing in CI

- **ROOT CAUSE** PostgreSQL roles are cluster-wide, not per database. The control re-runs the
  regression in a second database of the same cluster and renames the roles to avoid a collision;
  probe 9 introduced `service_role` and it was not added to the rename list.
- **EVIDENCE** run `42370902950`, job `fence`: the 10 probes passed, then
  `ERROR: role "service_role" already exists` before the control reached probe 3.
- **PROPOSED SOLUTION** rename every role the regression creates.
- **ALTERNATIVE** run the control on a second cluster. Rejected as heavier for the same result.
- **IMPACT** CI-only, but exactly the failure mode the control exists to prevent: a check that looks
  like evidence and is not.
- **VERIFICATION** rehearsed locally before pushing this time, then green in CI.
- **STATUS** FIXED.

### ERROR E — the PostgREST layer was never exercised

- **ROOT CAUSE** no workflow ran `local-integration.mjs`, and this container has no Docker daemon,
  so the whole HTTP layer above the RLS fence was unproven.
- **EVIDENCE** `/var/run/docker.sock` does not exist here. The repository already carried a complete
  synthetic harness that was simply never wired to CI.
- **PROPOSED SOLUTION** a `postgrest` job on `ubuntu-latest`.
- **ALTERNATIVE** a hosted staging project. Rejected: it costs money and authorizations for
  something a runner does for nothing.
- **IMPACT** the largest remaining evidence gap in the backend acceptance.
- **VERIFICATION** see part 7.
- **STATUS** FIXED and green.

### ERROR F — refusing a stale edition emptied the public feed, and my own test could not see it

Found by the independent review, against my claim that this behaviour was fine. The claim was
wrong and is withdrawn.

- **ROOT CAUSE** `fixtureDisplayLoad` correctly refuses an edition whose `as_of` is older than the
  one already accepted, by throwing `Obsolete display edition`. That exception reached
  `loadFixturePresentation`'s catch, which cleared `afState.leagues` on **any** failure. So
  refusing a stale edition emptied the public Analysis feed — and kept it empty on every later
  refresh for as long as a replica lagged, because the newer payload stays the one to beat.
- **EVIDENCE** the reviewer's probe: `fresh: leagues 3, wrapHidden false` then
  `afterStale: leagues 0, wrapHidden true` and `afterStale2: leagues 0, wrapHidden true`.
  My assertion was `assert.notDeepEqual(afterStale,['Alpha Cup'])`, which an EMPTY slate satisfies,
  so a total blanking read as correct behaviour and the test passed. The catch-wipe predates this
  branch; fixing `visibleLeagues` is what made it reachable, so ERROR A uncovered it.
- **PROPOSED SOLUTION** keep the slate already on screen when it is a published edition that has
  not itself expired, and say the refresh failed. Nothing stale is adopted: the kept slate IS the
  newest edition ever accepted. Once its own `expires_at` passes, the screen is cleared as before.
- **ALTERNATIVE** keep the fail-closed wipe but render the message where the feed was. Rejected:
  it accepts the empty-feed symptom, which is the very thing this build exists to remove. Worth
  recording that there is no `#fixturesMeta` element in the page at all, so that message has been
  landing in the Discover card.
- **IMPACT** the same user-visible failure as ERROR A, reached by another road, and persistent
  across refreshes rather than transient.
- **VERIFICATION** the assertion is now `deepEqual(afterStale, fresh)`, plus the feed must not be
  hidden, plus a second refresh against the still-lagging replica must also hold.
- **STATUS** FIXED.

### Verified absence of a defect — partial loads

A partly loaded edition is never put on screen: while a second, larger edition is held mid-flight
the screen keeps the first in full, and the larger slate appears only once it has fully arrived.
That half of Observation A does hold.

One honest note on how the stale half was first written. A first version swapped the client object
between loads and appeared to show a defect; it did not, because changing the client is an account
change and `fixtureDeliveryReset` clears the retained edition. I corrected that, concluded the
behaviour was sound, and was wrong a second time in the other direction — the real defect was
behind an assertion too weak to see it. The reviewer found what two of my own passes missed.

On which build was photographed: the screenshots cannot be pinned to a build from their pixels and
I do not claim otherwise.

---

## 3. Corrections completed

| Area | Change |
|---|---|
| `index.html` | the history floor applies only to locally fitted leagues; a played fixture with no stored forecast gets no headline call and no confidence |
| `backend/fixture-delivery/PROPOSAL-up.sql` | collector preflight before any revoke |
| `backend/fixture-delivery/local-fence-regression.sql` | probes 9 and 10; `service_role` with its explicit grant |
| `.github/workflows/build357-integration.yml` | `postgrest` job with a negative control and cleanup; fence expects 10 probes; preflight drift guard; control renames every role; branch on the trigger |
| `test/` | three new test files, six new tests |

`sw.js`, `manifest.webmanifest` and `robot/publish.mjs` are byte-identical to the accepted head. No
engine constant, market table, threshold, settlement rule or grading rule is in the diff.

---

## 4. Public Analysis end-to-end evidence

`test/public-analysis-visibility.test.mjs`, ordinary caller, raw access denied, bounded edition of
two competitions and three fixtures:

- two competitions and three fixtures in `afState`, zero raw table reads
- `#fixturesWrap` visible; `visibleLeagues()` returns both competitions
- both competition names and all six team names present in the rendered feed
- opening a published fixture shows its pick and its stored 60.0 / 25.0 / 15.0 bars, carries
  "not a device re-estimate", refits no model and reads no raw table

Before the fix the feed was hidden; after it, every assertion holds.

---

## 5. Historical prediction consistency evidence

- A played fixture with no stored forecast shows no headline pick and no confidence, and two renders
  under a changing corpus agree.
- A played fixture WITH its archived pick still shows that pick, unchanged.
- The stored prediction row is byte-identical after a failed read, asserted in the Build 357
  truthfulness tests carried over from the accepted work.
- `settlement-provenance` (10) and `settlement-consumers` (17) pass unchanged.

---

## 6. Migration preflight and collector access

Verified in CI, job `fence`, engine `16.15 (Debian 16.15-1.pgdg13+2)`:

```
ALL 10 FENCE PROBES PASSED
Preflight predicate matches between the migration and the regression.
Negative control held: probe 3 fails without the policy; protections 1 and 2 still pass.
```

Probes 9 and 10 are the collector pair. Probe 10 proves the preflight distinguishes an explicit
grant from an inherited one, which is the whole reason it exists.

---

## 7. PostgREST results

Job `postgrest`, Docker server 29.4.2, **measured runtime 24s**, well inside the 25-minute budget on
a 4-vCPU runner.

**95 checks, 0 failures.** They include: generic raw access denied for `anon` and for an ordinary
authenticated account across all ten tables plus `fixtures_lean`, `competitions`, `odds_latest` and
`provider_alias`; the raw capability reported false for both; publisher RPC denied to anon, to two
ordinary accounts and to a spoofed token; an unknown inherited anonymous SELECT aborting the
installation atomically; the empty registry denying even a proposed publisher; cross-account rows
remaining isolated; the publisher materializing from unchanged original records; and
`PROPOSAL-revert.sql` restoring the original ACLs and disabling every new entry point
transactionally.

**Negative control held:** with the RESTRICTIVE policy stripped out of the migration, the acceptance
run fails. The file is restored from git afterwards and the tree asserted clean.

Containers, network and volume are removed in an `always()` step. Invented users, invented rows,
internal-only network, images pinned by digest, no hosted URL, no real key, no charge.

---

## 8. Node 20 and 24 CI links and exact counts

| Where | Node | Tests | Pass | Fail | Skipped | Cancelled |
|---|---|---|---|---|---|---|
| Local | 20.20.0 | 223 | 223 | 0 | 0 | 0 |
| Local | 24.19.0 | 223 | 223 | 0 | 0 | 0 |
| [`42371166394`](https://github.com/kennedychinazam/matchmind/actions/runs/42371166394) | 20.20.2 | 223 | 223 | 0 | 0 | 0 |
| [`42371166394`](https://github.com/kennedychinazam/matchmind/actions/runs/42371166394) | 24.19.0 | 223 | 223 | 0 | 0 | 0 |

Four jobs green in that run: `combined (20.20.2)`, `combined (24.19.0)`, `fence`, `postgrest`.
223 browser tests, 10 SQL probes, 95 PostgREST checks. No test weakened, skipped, quarantined or
excluded.

---

## 9. Independent security and QA findings

The first two specialist agents terminated early on the account's usage limit. Once capacity
returned, an independent QA and security reviewer ran against this head with a brief to break four
specific claims. It did break two of them, and found a defect I had certified as absent.

**Six findings, all acted on.**

| | Finding | Outcome |
|---|---|---|
| F1 | refusing a stale edition empties the public feed; my test could not see it | **FIXED** — ERROR F above |
| F2 | the preflight blamed PUBLIC for a read inherited through a group role the migration never revokes from | **FIXED** — three distinct causes, each verified |
| F3 | the preflight checked 10 objects while the revoke loop reached 13 roots plus every dependent view | **FIXED** — both now driven from the same recursive CTE |
| F4 | the visibility test passed with every fixture filed under the wrong competition | **FIXED** — asserts structure, not substring |
| F5 | the hindsight tests passed against a reworded claim still carrying a moving percentage | **FIXED** — asserts the whole hero region |
| F6 | comment and count drift | **FIXED** |

Each fix was verified by reproducing the reviewer's own mutation and watching it fail:

- F4: filing every fixture under the other competition's heading previously passed green; it now
  fails.
- F5: replacing the hero text with `Odds unavailable` and moving the claim into the explanation
  line as "The engine's call for this match is DRAW at 45.8% confidence" previously passed green;
  it now fails on the percentage.
- F2: the rewritten preflight was run as the migration's own do-block against five privilege
  shapes on a synthetic cluster. Explicit direct grant passes. PUBLIC-only, membership in
  `authenticated`, membership in an untouched group, and no access at all each abort with a
  message naming that specific cause. The untouched-group case now says plainly that the read
  would survive the revoke but the invariant is not met, instead of blaming PUBLIC.
- F3: the preflight loop is driven from the same CTE as the revoke loop and still completes for
  every object before the first source revoke.

Writing F2's fix surfaced a defect of my own that only running it could find: the dynamic
`relkind` expression produced `text` where `acldefault` wants `"char"`, so the whole preflight
errored. Caught and fixed before pushing.

**What the review confirmed as sound**, after trying to break it: the visibility fix is
load-bearing (reverting only that line reproduces the failure); the hindsight fix is genuine and
its second test fails pre-change for the right reason (the numbers moved, 45.8% against 48.4%);
the 10 fence probes and the negative control both stand up, and the `service_role` rename is
load-bearing; no legitimate published pick is hidden, probed across played-with-archive,
un-started with a board row, in-play with a pick, and played-with-no-archive-but-board-present; and
no security regression in the diff, with raw access denied measured as zero private-table reads and
only the two permitted RPCs.

One new surface it noted, not a defect: a zero-corpus competition created from the Scores feed now
clears the relaxed filter and appears on Analysis with "No pick". That is the same bounded data the
Scores tab already shows the same caller. Recorded here for the release notes.

One operational caveat for anyone reproducing this work: copying the worktree with `cp -a` copies
its `.git` pointer file, so a `git checkout` inside the copy writes to the shared index. The
reviewer hit it, restored it, and the worktree is verified clean at the recorded head.

## 10. Remaining external release blockers

1. **Publication rights.** A bounded edition is still a finite, inspectable projection of provider
   facts served to the public. Bounding fields and denying generic SQL reduce extractability;
   neither confers a publication right. Still open alongside imagery and third-party rights, issued
   bookmaker-price display, share images and retention. No engineering closes this.
2. **Physical-device acceptance.** iOS Safari/WebKit, Add to Home Screen and standalone launch, real
   touch, the real notification permission and a delivered push, network transitions, storage
   pressure against the ~5 MB quota, and comfort at 320 px. Emulated results are recorded; they are
   emulation.
3. **Production-equivalent deployment.** The synthetic stack proves the contract. It is not the
   production schema, inventory or cadence.

Not blockers, per the Director: subscription renewal and further subscription-proof demands, and the
10 November date, which is an internal evidence check. Nothing was deleted. No provider contact was
made or is proposed. Branding stays neutral.

---

## 11. Director authorizations needed

| # | Request | Cost |
|---|---|---|
| 1 | A confirming review pass over the six fixes made in response to the first review | none |
| 2 | An operator session on one iOS and one Android device | operator time |
| 3 | The remaining staging authorizations, if a production-equivalent deployment is still wanted | expected 0.00 USD, worst case 10 USD/month |

Requests 1 and 8 from the previous round are now closed: the Docker gap is solved by the CI runner,
and the grants question was answered by the owner and is now enforced by the preflight.

One licensing question remains for the rights review, not for the provider, and it is stated in
part 10. No provider contact is proposed.

---

## 12. GO / NO-GO

**NO-GO for production merge, deployment and public release.** Publication rights are unresolved
and there has been no physical-device acceptance. Independent review HAS now run against this
head, found six issues including one defect I had certified as absent, and all six are fixed.

**GO on this branch as the engineering candidate.** Two user-facing defects are closed, one of them
launch-blocking: ordinary users could not see any fixtures on the Analysis screen, and a finished
match was being given a confident headline the engine never issued. The backend gap the previous
report named as the largest is closed too, in CI, with 95 PostgREST checks and a negative control.
The migration no longer trusts a report about production; it checks the property itself and refuses
to install if it does not hold.

What would move it to GO for release, in order of value per unit of work: a confirming review pass
over the six fixes; the operator's device session; then the rights review, which decides public
release and is independent of all the engineering.
