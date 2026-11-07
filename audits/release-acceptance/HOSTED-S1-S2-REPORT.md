# Hosted Supabase S1 and S2 — source remediation report

Continuation of draft PR #25 from `c63e6e603e231bdd123fc1990133d57d50e9f31d`, under the Director's
authorization of 7 November 2026 for source-only corrections, synthetic tests, independent review
and a new draft PR.

No production change, no hosted staging mutation, no Auth sign-in, no provider call, no paid
inference, no merge, no deployment.

---

## 1. Exact commit and CI

| | |
|---|---|
| Base | `c63e6e603e231bdd123fc1990133d57d50e9f31d` (PR #25) |
| Branch | `claude/staging-s1-s2-20261107` |
| Head | `cd12eb5` |
| CI, all five jobs green | [`42409533328`](https://github.com/kennedychinazam/matchmind/actions/runs/42409533328) |

| Job | Result |
|---|---|
| `combined (20.20.2)` | 223 tests, 223 pass, 0 fail, 0 skipped, 0 cancelled |
| `combined (24.19.0)` | 223 tests, 223 pass, 0 fail, 0 skipped, 0 cancelled |
| `fence` (PostgreSQL 16) | ALL 10 FENCE PROBES PASSED, negative control held |
| `postgrest` (Docker) | 95 checks, 0 failures, 21s, negative control held |
| `hosted17` (**new**) | PostgreSQL **17.11**, 10 fence probes, 20 hosted probes, negative control held |

`index.html` is not in the diff. The prediction engine, the frozen forecasts, the archives,
account isolation and the financial controls are untouched by construction, not by assertion.

---

## 2. Both defects reproduced before anything was changed

A cluster was built in the shape of hosted Supabase: `supabase_admin` owns the `auth` schema, and
the installer is a non-superuser role administrator holding USAGE on `auth` **without grant
option**. Running the unmodified, source-controlled migration there produced exactly what Director
staging reported on 17.11:

```
psql:PROPOSAL-up.sql:9:   WARNING:  no privileges were granted for "auth"
psql:PROPOSAL-up.sql:10:  WARNING:  no privileges were granted for "uid"
psql:PROPOSAL-up.sql:126: ERROR:    must be able to SET ROLE "mm_display_reader"
```

That is S2 and S1 in one run, on the repository's own files, with no hosted contact.

---

## 3. S1 — ownership under a non-superuser role administrator

### ERROR
`alter function … owner to mm_display_reader` aborts the whole migration.

### ROOT CAUSE
Since PostgreSQL 16 a role created by a CREATEROLE non-superuser gives its creator an ADMIN
membership with SET FALSE, and ownership transfer requires being able to SET ROLE to the new
owner. It additionally requires CREATE on the schema holding the object. A superuser install never
meets either condition, which is why this survived every previous test.

### PROPOSED SOLUTION
Borrow exactly those two rights and give them back before the transaction commits:
`grant <role> to <installer> with set true` only when `pg_has_role(…,'SET')` is false, and
`grant create on schema mm_fixture_delivery` to each owner role, both revoked in a cleanup block
before `commit`. Abort with a named message if the grant is refused.

### The cleanup, which is where the care went
The Director asked specifically about the duplicate membership edges. Revoking only the SET option
is not enough, and the measurement says why:

```
 role              | grantor         | admin | inherit | set
 mm_display_reader | hosted_postgres | f     | t       | f     <- left behind by a SET-only revoke
 mm_display_reader | postgres        | t     | f       | f     <- the platform's own edge
```

The residual edge carries **INHERIT**, so the installer would have kept the owner role's
privileges outright — not a tidiness problem, a standing privilege. The cleanup therefore revokes
the whole membership, identified by `GRANTED BY current_user`, which names the edge this migration
created and leaves the administratively granted one alone. After install only the platform edge
remains, and the harness asserts both halves of that.

Stated rather than implied: the installer keeps ADMIN on roles it created and could grant itself
SET again at will. This is least-privilege hygiene, not a boundary against whoever already holds
the installing role.

### ALTERNATIVE
Leave the installer a standing SET membership. Rejected: it is a permanent path to acting as the
owner of every SECURITY DEFINER function in the design, for a convenience worth nothing.

### IMPACT
Without this the migration cannot be installed on hosted Supabase at all.

### VERIFICATION
Probes 1 to 4 and 16 to 17 of `hosted-compat-regression.mjs`, on PostgreSQL 17.11 in CI and 16.15
locally, plus the negative control.

### STATUS
FIXED. Not installed anywhere.

---

## 4. S2 — the auth schema belongs to someone else

### ERROR
`grant usage on schema auth to mm_display_reader` grants nothing, and the SECURITY DEFINER
functions then fail at run time with `42501 permission denied for schema auth`.

### ROOT CAUSE
Hosted `auth` belongs to `supabase_admin`. The installing `postgres` holds USAGE without grant
option, so the grant emits a warning and is a no-op. A SECURITY DEFINER function runs as its
owner, and that owner cannot reach `auth.uid()`.

### PROPOSED SOLUTION
Stop asking for the auth schema. The two grants are removed, and the three functions read the
request subject through one private helper, `mm_fixture_delivery.request_uid()`, which reads
exactly the GUCs the hosted `auth.uid()` reads:

```
coalesce(nullif(current_setting('request.jwt.claim.sub',true),''),
         nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')
```

The trust model is therefore the platform's own and is **not widened**: the same GUCs, set by
PostgREST from a JWT it has already verified. Three deliberate narrowings against a bare copy:

1. **SECURITY INVOKER**, so the helper adds no definer surface of its own.
2. A malformed `request.jwt.claims` document returns NULL instead of raising inside a capability
   check.
3. A value that is not a UUID returns NULL instead of raising `22P02`.

NULL is the safe answer because every caller compares it with `=` against `principals.user_id`,
which yields NULL and therefore no row. An absent or malformed subject is refused, never admitted.
The helper takes **no argument**, so no caller can name a `user_id`, and EXECUTE is revoked from
`public`, `anon` and `authenticated`.

### ALTERNATIVE
Branch at install time: keep calling `auth.uid()` where the owner can reach it, and install the
helper only where it cannot. Rejected: two code paths, one of which would be exercised only on
self-hosted clusters, for no security gain — the helper reads the same values either way.

### IMPACT
Without this, no capability check works on hosted Supabase, so no publisher can materialize and no
enrolled principal can read.

### VERIFICATION
Probes 5 to 11 and 13, covering an absent subject, a malformed subject, a malformed claims
document, the claims fallback, a well-formed but unenrolled subject, the enrolled subject, and the
helper's inaccessibility to `anon` and `authenticated`.

### STATUS
FIXED. Not installed anywhere.

---

## 5. S3 — a third defect, found by running the revert rather than reading it

### ERROR
`PROPOSAL-revert.sql` aborts with `42501 permission denied for function display`.

### ROOT CAUSE
The revert revokes privileges on functions **owned by** the two display roles, which requires
acting as their owner. The S1 fix correctly hands that membership back at the end of the install,
so the installer arrives at the revert without it. The fix for one defect created the next.

### PROPOSED SOLUTION
The same borrow-and-return, symmetrically: the revert takes the membership only if it lacks it,
and asserts it left none behind.

### ALTERNATIVE
Keep the membership after install so the revert still works. Rejected for the reason in §3.

### IMPACT
Rollback would have been impossible for the role that performed the install — discovered only
because the revert was executed, not read.

### VERIFICATION
Probes 18 to 20: the revert runs under the same non-superuser, restores the original broad
exposure, and leaves no membership of its own.

### STATUS
FIXED.

---

## 6. S4 — my own CI step read its exit code backwards

### ERROR
`hosted17` red on `f378a24` while the migration and harness were both correct.

### ROOT CAUSE
The step was `if node … --negative-control; then echo 'NEGATIVE CONTROL FAILED'; exit 1; fi`. The
harness exits 0 when the control **holds**. The same log carried
`ERROR: must be able to SET ROLE` and `PASS negative control: the install FAILS without the S1 fix`
directly beneath the line claiming it had failed.

### PROPOSED SOLUTION
Success is exit 0 **and** the `NEGATIVE CONTROL HELD` marker **and** both staging error strings, so
neither a crash nor a silent change of meaning can pass.

### IMPACT
CI-only, and the useful kind of failure: a control that reports the wrong answer is worse than no
control.

### VERIFICATION
Rehearsed as the exact shell the step runs, then green in CI.

### STATUS
FIXED.
