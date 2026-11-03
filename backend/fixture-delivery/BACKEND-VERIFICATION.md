# Offline backend implementation and verification

Scope: Director approval on PR #22, comment6589779458; base `ea7e94de3a76487e3dd81c810b64627efd97ab0a`. These are **proposal files**, not enrolled or applied production migrations. All executed SQL belongs to a new isolated synthetic stack. No production fixture row was read, no production state changed, no football/provider/generation request made, and no financial action performed.

## Implemented boundary

- `PROPOSAL-up.sql` snapshots existing relation/table and column SELECT ACLs, closes anonymous SELECT and fences ordinary authenticated SELECT with a restrictive current-principal policy. An empty private registry is the default; neither a client flag nor user-editable metadata grants raw access. Explicit publisher/research scopes preserve complete private history; service collector privileges and existing write policies are retained.
- Protected roots: fixtures, fixtures_lean, competitions, predictions, daily_slips, shared_records, odds_snapshots, odds_latest, injuries, match_context, predictions_retired, match_analysis and venues. Dependent views are included, use invoker semantics, and unreviewed inherited anonymous ACLs, dependent schemas/materialized views, bypass-RLS caller roles or raw-returning exposed definer routines abort installation. This is not a claim that every possible remote integration/Realtime/GraphQL path is already accepted.
- `matchmind_fixture_access_v1({})` returns a current owner-scoped capability and a server expiry of at most60seconds. `matchmind_display_v1({screen})` accepts only a fixed screen enum, selects the current server-owned edition and exposes closed, bounded projections. Caller IDs, dates, offsets, arbitrary fields and pages are not parameters.
- The public facade is security-invoker. Private helpers have fixed search paths and dedicated NOLOGIN/NOBYPASSRLS owners. The display reader has no raw fixture grants. Private materialization projects existing board results, unchanged immutable forecasts, required fixture facts, issued slip members and aggregate records; it does not fit a model, adjust probabilities, truncate inventory or accept caller-supplied publication JSON.
- `matchmind_publish_display_v1({})` requires an explicitly approved current publisher principal or the actual active service role. A research reader cannot publish. No actual owner principal or operational approval is enrolled in this repository.
- `PROPOSAL-revert.sql` restores captured permission/view state and disables new entry points without deleting source records, editions, registry or archives. It restores the former broad exposure, so it requires a separate Director decision; a forward fix is preferable where practical.

## Retained actual evidence

The isolated stack uses PostgreSQL17.11 and PostgREST14.18, pinned images, an internal Docker network and no public published ports. The explicit runner is:

```sh
node backend/fixture-delivery/local-integration.mjs --run-local-synthetic /absolute/private/evidence-directory
```

It creates new synthetic containers/volume; do not point it at hosted services or reuse a research/production database. Credentials are generated locally and saved only in the private runtime fixture, never in GitHub/evidence reports. Existing stopped proof containers/volumes are retained. This runner is separate from ordinary pure/browser `test/*.test.mjs` regression tests.

The retained complete execution passed **95/95** checks at2026-11-03T07:40:15.932Z. These cover anonymous denial, ordinary/spoofed-account RLS empty results, dynamic view aliases, explicit private scopes, finite screen access and rejected selectors, inherited-ACL atomic refusal, service/publisher compatibility, research publish denial, A/B isolation, schema rejection and a transactional revert rehearsal. Anonymous raw requests fail HTTP authorization; ordinary authenticated raw requests are200 with `[]` under RLS—these are distinct verified observations, not a fabricated universal403.

The synthetic corpus has148 source cards,145 original forecast records and one issued-slip-only historical result. Scores shows only2 fixed-window cards, Predictions1 current card, and History146 original-prediction/slip-linked cards. The number145 is a synthetic preservation control, not a fresh recount or certification of the protected production forecasts.

Original and final fixture/prediction digests were identical:
`c7872fdd894eec35842f9a45eee4d4ce:1a0fd458c59db305809af93a6f664ba2`.

After a managed environment restart, the same two synthetic containers, image identities, internal network and persistent volume were verified and restarted. Only expired synthetic JWT fixtures, explicit synthetic approvals and the current synthetic display edition were refreshed for subsequent browser QA. Original source/forecast digests remained equal; no real authorization timestamp was renewed.

## Timestamp compatibility correction

Actual SDK/REST integration then exposed a narrower contract defect: PostgreSQL emits explicit `+00:00` timestamps, whereas the initial JavaScript/SQL validator required `Z`. The correction accepts a documented RFC3339 subset with `Z` or explicit numeric offset within PostgreSQL's±15:59 domain; requires actual calendar dates, hours00–23, minutes/seconds00–59 and explicit timezone; excludes year0000/leap-second text. Original strings, offsets and precision are retained, never rewritten.

Two failing-first JavaScript regressions were added; the contract suite now passes **15/15**. **12/12 actual SQL timestamp parity checks** passed on the same isolated stack after replacing only its pure validator function. The previous95-pass record is preserved, not misrepresented as a rerun after this correction. Independent source proof confirms all11 installed function bodies match the current SQL proposal and records unchanged source/forecast digests. Full final application Node20/24 and actual browser/SDK proof are reported by QA against the final integrated artifact.

Private evidence package: `backend/local-results.json`, `timestamp-{red,green}.tap`, `timestamp-sql-parity.json`, `resume-receipt.json`, `source-freeze.json`, and `ERRORS.md` under the Director's private review-deliverables directory. Never publish `runtime.json` or original provider/function source captures.

## Operational acceptance still required

1. Secret-free export/review of the exact target schema, grants, policies, dependencies, functions, exposed schemas and subscriptions; compare proposal prerequisites with the actual deployment. The retained bounded production metadata/source review does not certify all runtime paths.
2. Actual inventory, column/nullability compatibility and payload-size evidence. Limits are1000cards and512KiB; excess or missing required predictions fails closed, never truncates. The local148-card proof cannot establish production capacity.
3. Specific Director authorization for nonproduction schema installation, principal enrollment and each hosted account/write/denied-operation probe. A new charged environment requires a cost quote and explicit approval first.
4. Reviewed public-field rights decision. Bounded browser JSON remains inspectable; rate limits/CORS do not confer rights or prevent recording successive editions. The provider's supported application/in-app/private-active-subscription/derived uses remain acknowledged; the exact transport and mixed/raw scope remain a separate decision.
5. Specific deployment authority for SQL, the publisher hook, `refresh-af` post-collection refresh hook, and the `ai-analyze` cache guard patch as one compatible rollout. Neither Edge patch has been deployed. Collector transformation and statistical formulas are unchanged; a failed post-write presentation refresh must remain explicit and must not retry or undo committed ingestion.
6. Actual hosted recovery, scheduler wiring, refresh cadence and physical-device acceptance. No local synthetic success substitutes for these gates.
