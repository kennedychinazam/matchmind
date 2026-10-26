# Offline canonical bookmaker observations — Stage 2A/2B

This is **working offline research infrastructure**, not a live bookmaker integration. No module fetches odds, writes a database, issues a model request, chooses a value pick or changes production publication. Every classification returns `actionable: false`. There is no enablement flag or trusted source verifier. A fully populated object contains claims, not verified facts.

## Interfaces

- `bounded-json.mjs`: bounded raw JSON parser, duplicate/prototype-key rejection, inert plain-data cloning, canonical content hashes and deep freezing.
- `markets.mjs`: fourteen **nominal legacy-code** mappings. Provider catalog identities and settlement remain unverified. No bookmaker aliases or composite/average prices.
- `quote.schema.json`: versioned closed Draft 2020-12 observation schema.
- `contract.mjs`: `validateQuote(input,{expectedFixture}={})`, `quoteHash(quote)`, exact decimal and timestamp validation. Supports JSON text or inert plain data. Schema checking uses only the bundled schema's explicitly supported keywords and refuses unknown keywords at load. `expectedFixture` binds the caller's exact fixture/orientation/context; it is not independent source authentication.
- `legacy.mjs`: `normalizeLegacySnapshot(rawJSON,{sourceRef,reconnaissanceReceipt?,fixtureContext?})`. Returns a frozen raw source envelope, individually validated quotes and individual entry rejection records. Snapshot IDs/fixture association/book display/code/numeric token/capture label survive. Unsupported DNB/HTFT/CS are not reclassified. Null price fields are preserved in the original source and rejected individually, never treated as zero odds.
- `replay.mjs`: `classifyQuote(quote,{decisionAt?,maxSeenAgeMs?})`, `replayQuotes(records,options)`. No implicit current clock or freshness default. The age argument is an **offline scenario**, not an approved production TTL. Unknown/invalid freshness means quarantine. Input sequence is retained; claimed source sequence and receipts are checked for contradictions, not authenticated.
- `independence.mjs`: small strict football-only boundary demonstrator, **not** a complete A4 packet builder or an integration with the existing models. Only numeric/null allowlisted football metrics and cited pre-cutoff observations enter its output. Unknown fields, market metrics and obvious textual contamination fail closed. This cannot prove a mislabeled statistic's truth; source verification and complete A4 packet design remain separate gates.

Example (synthetic only):

```js
const result = normalizeLegacySnapshot(rawRetainedJSON, {sourceRef:'synthetic:read-1'});
const audit = replayQuotes(result.quotes, {
  decisionAt:'2026-10-25T12:01:00Z', maxSeenAgeMs:120000
});
// audit.actionable === false; historical quotes stay research-only.
```

## Classification and trust boundary

| Category | Meaning |
|---|---|
| `historical_observation` (origin class) | Retained legacy database data; no proven original upstream/first-receipt provenance |
| `research_only_normalized_quote` | Valid legacy observation with explicit unknown metadata; never promoted by a new database read |
| `rejected` | Contract/schema/semantic failure; no quote can be admitted |
| `quarantined` | Missing/contradictory/stale/unsafe claims or revision/inventory barrier |
| `future_source_verifiable_candidate` | Structurally complete, internally consistent claims that a future separately approved verifier could examine; **not verified**, never actionable |
| Potentially actionable / actionable | **Disabled and unreachable.** Requires future source verification, identity/status/clocks/rules/access/rights plus independent probability calibration, uncertainty and approved selection policy |

`verification` always says `unverified_claims`; evidence reference strings, `active`, `verified` or `offered` cannot confer trust. `source_verifier_unavailable` and `actionable_admission_disabled` remain explicit blockers even on complete candidates. Invalid option/enablement flags throw. Hashes bind retained bytes/content; they do not authenticate bookmakers, prove historical first receipt, or certify immutable storage.

## Operational clocks and exact decimal representation

Upstream update, upstream seen, collector receipt, database commit, this reconnaissance read and legacy capture labels are distinct nullable fields. No field is filled from another; no `Date.now()` is called. Canonical timestamps are explicit UTC `Z`, calendar-checked to six fractional digits and compared using integer microseconds. Legacy explicit offsets normalize to UTC while the original string remains available. Future rules/access evidence also fails the decision cutoff. Legacy capture never becomes a first receipt.

Ordinary decimal odds are exact decimal text with 1–18 integer digits and optionally 1–18 fractional digits; value must exceed 1 using BigInt rational comparison. This finite representation bound is a parser/resource domain, **not a preferred odds range**. Whitespace, signs, NaN/Infinity, exponent-form canonical decimals and leading zeroes are rejected. Retained numeric JSON exponent tokens can be expanded exactly within that domain while retaining their original token. A vendor representation discarded before database storage cannot be recovered. The adapter rejects stored text odds rather than guessing that they were numeric provider quotes.

## Immutable replay and barriers

Replay returns frozen copies/history without changing its inputs; it is not a deployed append-only database. Observation hashes identify exact canonical content. Exact same ID/content is a duplicate; different IDs with equal rational prices are unchanged observations, not a price move. New price/status/correction/retraction observations preserve prior records. Corrections need a parent, superseded reference and reason. This version supports a conservative linear prior chain; missing/out-of-order parents, sequence regressions, identity changes, conflicting IDs and split-stream references quarantine the affected streams. Conflicts latch; they never rehabilitate an older price.

A suspension/withdrawal/retraction blocks the newest state even though its claimed evidence remains unauthenticated. Fail-closed rejection does not require trusting a positive offer assertion. The latest state is never replaced by an earlier attractive price.

Empty, failed and partial responses can be retained without invented prices:

```js
{type:'inventory_barrier', source_ref:'synthetic:page-failure',
 status:'unavailable', received_utc:'2026-10-25T12:00:04Z'}
```

Any `partial`/`unavailable` quote inventory or barrier conservatively quarantines **all streams in that replay batch**, including omitted selections. This is deliberately broader than feed-scoped invalidation until authenticated source scope exists. Barriers and conflicts latch for the batch, and `fallback_allowed` is always false. Do not rerun a truncated history to erase a barrier. Future persistence/completeness and controlled recovery need separate approval; a full later quote alone does not clear the barrier here.

## Fixed safety limits

Raw JSON ≤128 KiB; canonical quote ≤32 KiB; nesting ≤8; visited nodes ≤12,000; each object ≤128 own keys; each array ≤1,024 elements; JSON strings ≤4,096 characters; references ≤256 characters; identifiers ≤128; book names ≤128; ≤64 bookmakers and ≤64 market entries/book/snapshot; replay ≤1,024 records. Schema further restricts identifiers/strings, timestamps and limitations (≤32). Input accessors, symbols, cycles, custom prototypes, sparse arrays, hidden fields and duplicate or dangerous prototype names are rejected. These are immutable implementation constants, not caller overrides. Larger sources require an explicitly reviewed format/resource change, not truncation.

## Changes from the Stage 2 proposal

Version is now `matchmind-observed-quote-v1`. Added explicit market context, source inventory/sequence and a `legacy` provenance block. Unknown team names are nullable rather than invented. Added hard bounds, exact decimal syntax, UTC semantics and cross-field identity checks. Legacy provider IDs/status/receipt/rules/access remain null/unknown, regardless of supplied enrichment claims. No public schema deployment, migration, collector or publisher change accompanies this version.

See `SOURCE-INSPECTION.md`, `MISSING-EVIDENCE.md`, `STAGE2AB-REPORT.md` and the focused `quote-*.test.mjs` tests. Run all regressions with `node --test audits/test/*.test.mjs` using the existing local PostgreSQL/browser setup. Synthetic success establishes software behavior only.
