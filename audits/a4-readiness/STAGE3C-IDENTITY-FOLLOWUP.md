# Stage 3C identity-price follow-up

Reviewed base: `5741c81a572ab433fe639be502e476f996cad2a9`.
Scope: only the Director-authorized football identity contamination correction,
offline regression tests and this report. No Stage 3D work.

## Reproduction through the complete admission path

Each candidate was put into a schema-valid source fixture, hashed and signed
with the existing synthetic test authority, passed through `verifyBundle`, then
through `buildEvidencePacket`. No real source was signed or certified.

| Identity text | Synthetic source capability before fix | Evidence packet before fix | Evidence packet after fix |
|---|---|---|---|
| Odds BK at 1.90 | Verified synthetic signature | Admitted, synthetic only | Rejected |
| Odds BK @ 1.90 | Verified synthetic signature | Admitted, synthetic only | Rejected |
| Odds BK (2.50) | Verified synthetic signature | Admitted, synthetic only | Rejected |
| Odds BK 5/2 | Verified synthetic signature | Admitted, synthetic only | Rejected |
| Odds BK price 2.50 | Verified synthetic signature | Rejected by existing data rule | Rejected |

The matrix is identical for `home`, `away`, `competition`, `country` and
`venue`: 20 unwanted packet admissions and 5 existing rejections. Source-envelope
validation verifies a closed shape and content binding; it does not establish
identity truth or bypass the packet's semantic checks. Genuine source authority
remains unconfigured and prospective mode still rejects.

## Narrow correction

Implementation policy is now **a4-text-policy-v0.2.2**. The identity-label branch
rejects decimal-shaped numeric annotations (dot or comma) and ambiguous numeric
slash fractions. It checks the original string and the already inspected decoded
views before identity masking could exempt any label in commentary. It does not
strip suffixes, rewrite source names, mint IDs or consult an invented registry.

The fraction check has no arbitrary numerator/denominator width exemption.
Explicit season syntax remains representable: a four-digit starting year in
1000–2999 followed by its consecutive ending year, in full or last-two-digit
form, such as `2026/2027` or `2026/27`. This is a representation allowance,
not a claim that an arbitrary supplied season/name is genuine. Integer names,
ordinary period ordinals, age groups, punctuation and integer venue numbers are
preserved. Tests retain `Odds BK`, `Roi Et United`, `Engineers FC`, `Real Betis`,
`1. FC Köln`, `1860 Munich`, `FC 08 Homburg`, `Ligue 1`, `1. Liga`,
`2. Bundesliga`, full season labels, U21 competition names and venue numbers.

No commentary rule, identifier rule, closed schema, source allowlist, signature,
timestamp, field dictionary or capability requirement was relaxed. Frozen A4
prompt v0.2.0, baseline v0.1.0 and all seven manifest artifacts stay byte-identical.
Only the text-policy module, a new regression file and this report change.

## Regression evidence and limitations

The first confirmed failing-first run had 74 tests: 24 failed for missing
rejections and 50 passed. These failures comprised the 20 Director examples
across five fields plus attached/no-space, comma-decimal and spaced-fraction
variants. The initial green implementation exposed a width limitation during
review; three further failing-first cases (`1000/1`, `5/2026`, `2026/1`) failed
before the fraction check was corrected. The final file has 77 tests.

All 204 focused A4 tests pass under Node 20.20.2 and Node 24.19.0, with no failures,
cancellations or skips. The Director delivery receipt identifies the final commit,
changed-file hashes and full Node 20/24 GitHub CI jobs after this report is committed.
It also includes the offline before/after matrix and red/green logs.

An early exploratory test also confirmed that `1º de Agosto` already fails the
accepted NFKC-ambiguity guard. This follow-up preserves that guard instead of
silently normalizing or broadening it; the final test explicitly records its
continued rejection. The exploratory failure is separate from the 24 confirmed
price-regression failures above.

Decimal-looking identity spellings, abbreviated slash seasons such as `23/24`,
dates and other ambiguous fraction spellings may be authentic football naming
conventions or appended non-football information. Without source-backed identity
authority this implementation cannot resolve that ambiguity, and it fails closed
rather than stripping or guessing. Full year season syntax is preserved, but its
mere presence cannot establish authenticity. Negative syntax checks cannot prove
the semantics of every arbitrary integer/name or defeat every covert channel.
No valid test name is a canonical registry entry, and a successful synthetic test
never grants prospective status. Genuine source admission stays blocked.

## Preserved safeguards and stop

No accepted statistical engine, E-MARKET, quote framework, A1/A2/A3 record,
historical source/forecast, financial reservation, checkpoint, recovery archive,
execution-date guard, BYOK rule or provider restriction is changed. No source
collection, provider/inference call, hosted write, new reservation, semantic
feature admission, numerical mapping, value recommendation, integration,
production/Build356 change, merge or deployment is performed. PR #6 remains draft.

Stop for final Stage 3C Director acceptance. No Stage 3D implementation is authorized.
