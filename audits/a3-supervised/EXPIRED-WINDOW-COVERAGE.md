# Expired-window coverage: the two skipped continuation regressions

Investigation only. **Nothing here changes `continuation.sql`, an accepted
timestamp, a financial hold, a guard or any live state.** No coverage was
fabricated.

## What is skipped, and since when

`audits/test/a3-continuation-local.test.mjs` runs two cases, `additive
verified_bound SQL` and `additive capacity_risk SQL`. Both reach line 23 and
skip once the scoped fixture window has passed.

CI recorded zero skips on commit `cf7d3ea`, run on 2026-10-29, and two skips on
`b8f5ab6`, run on 2026-10-30. Nothing in `b8f5ab6` touches this suite. The
window simply closed.

## Why, exactly

The gate is not in the test. It is in the accepted production SQL, in three
places, and it is deliberate.

`shadow_eval.a3_continuation_check` (`continuation.sql:37`) requires the
issuance date to be **both** one of two fixed dates **and** equal to the date
the database itself reads:

```sql
coalesce(b->>'issuance_date_utc','') NOT IN ('2026-10-28','2026-10-29')
OR b->>'issuance_date_utc' IS DISTINCT FROM to_char(at AT TIME ZONE 'UTC','YYYY-MM-DD')
```

The same function then refuses once the clock passes a hard wall:

```sql
OR at >= least(..., '2026-10-29T19:37:30Z'::timestamptz)
```

`a3_continuation_reserve` (`continuation.sql:84`) carries that wall into the
reservation deadline and demands six minutes of headroom before it:

```sql
hard := least(..., '2026-10-29T19:37:30Z'::timestamptz, ...);
IF clock_timestamp() + interval '6 minutes' >= hard THEN RAISE EXCEPTION 'insufficient continuation pre HTTP window';
```

So the positive path is satisfiable only while the database's own
`clock_timestamp()` falls on 2026-10-28 or 2026-10-29 UTC and before
2026-10-29T19:31:30Z. That is the original real-execution date restriction, and
it is working as designed. It expired on 2026-10-29.

## Every restoration route, and why each is refused

### 1. Widen the date literals in `continuation.sql`

Refused. That extends an expired production authorization and changes accepted
historical timestamps, both of which are out of bounds. It would also destroy
the property the literals exist to hold: that one scoped study could be
executed on two named days and never again.

### 2. Fake the clock the database reads

Refused as unsound, not merely out of bounds.

- `clock_timestamp()` reads `CLOCK_REALTIME`. Linux time namespaces shift only
  `CLOCK_MONOTONIC` and `CLOCK_BOOTTIME`, so `unshare --time` cannot move it.
- `libfaketime` would need a package installed into an image pinned by digest
  (`postgres:17-bookworm@sha256:858bb5e9…`), and a regression that passes under
  a time-faking shim no longer demonstrates behaviour under a real clock. It
  would prove the shim.
- Moving the runner's clock corrupts every other date-dependent test in the
  suite, and the git working tree with it.

### 3. Call `a3_continuation_check` directly with a historical `at`

This looked like the one clean route: the function already takes `at` as a
parameter, so a historical value needs no SQL change and no clock faking.

Refused, for two independent reasons.

**It is not callable.** `continuation.sql:95` revokes EXECUTE on it from
`PUBLIC`, `anon`, `authenticated`, `shadow_runner` and `shadow_operator`, and
line 96 grants EXECUTE only on `a3_continuation_record` and
`a3_continuation_reserve`, only to `shadow_operator`. Reaching the checker
directly means connecting as the owning superuser and stepping outside every
role boundary this suite exists to prove. A test that bypasses the permission
model to reach the logic is worse evidence than an honest skip.

**It would not be equivalent anyway.** `a3_continuation_record` reads
`clock_timestamp()` itself (line 59), and `a3_continuation_reserve` reads it at
lines 65, 84 and 85. The reservation, race and budget paths Task 3 names all sit
behind those reads. The checker is the validation surface, not the atomicity
surface.

### 4. A test-only replica of the functions with an injectable clock

Refused. It would exercise a fork, not the accepted artifact, and report a pass
for code that is not deployed. That is fabricated coverage.

## What is still covered on every run

Clock-independent, and reached before line 23 on every run:

- the whole additive-install guarantee: every pre-existing `shadow_eval`
  function definition is captured before `installContinuation()` and compared
  definition for definition after it (lines 8 to 10);
- the immutable halt and hold history, seeded and hashed (lines 14 to 18);
- `readContinuation` returning null for an absent receipt (line 11);
- the role refusals for `anon`, `authenticated` and `shadow_runner` calling
  `a3_continuation_record`, which fire on the EXECUTE grant ahead of any clock
  logic (line 22);
- the negative admission itself: a source review offered past the window is
  refused, and the reserved total stays at 3,059,008 micros (line 23).

## What is not covered any more

Lines 24 to 58. Named plainly, because the loss is real:

positive `source_review` and `continuation` recording; the four review mutation
refusals and the six approval mutation refusals; the duplicate-approval refusal;
the receipt UPDATE, DELETE and TRUNCATE immutability triggers; the RLS read
refusals for `anon` and `authenticated`; `capacity_risk` recording and its four
mutation refusals; operator readiness and authorization; the seven reservation
mutation refusals; the `insufficient continuation pre HTTP window` refusal; the
cross-study refusal; the atomic budget-exhaustion rollback; the atomic
unreviewed-halt rollback; the two-process reservation race; the attempt-count
assertions; and the attempt-table immutability triggers.

## Recommendation

**Retain the explicit skip.** It is honest, the negative path still runs, and
every alternative either extends an expired authorization, proves a shim, breaks
the role model or tests a fork.

If the Director wants this coverage back, the only coherent route is a
separately reviewed change that reads the scoped window from a row rather than a
literal, so a test can seed a historical window in an isolated database without
touching the deployed authorization. That is a change to accepted production SQL
and needs its own approval, its own review and its own regression. **It is not
done here, and it is not recommended on cost grounds alone**: the study it
guards was a one-time scoped execution that is over.

## Verification limit in this environment

The postgres-backed suite could not be executed while writing this. The cloud
container has the docker client but no daemon
(`dial unix /var/run/docker.sock: connect: no such file or directory`), so
`localDatabase` cannot start. The analysis above is read from
`continuation.sql`, `capacity-exception.sql`, `attempts.sql`, `local.mjs` and
the test itself, and no change was made to any code path in that suite. The one
edit to `a3-continuation-local.test.mjs` is the text of the `t.skip` message in
the branch that is already the one CI executes, so it cannot alter which tests
run or pass.
