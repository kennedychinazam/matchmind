# Stage 2A existing source and provenance inspection

Inspection is limited to the existing checkout at Stage 1 ancestry, retained Stage 2 read responses and source documentation. No new upstream/hosted requests, management login, credential discovery, permission changes or paid calls were made. Read-only source inspection does not establish actual deployed writer behavior.

| Available evidence / exact path | Observed behavior | Can recover from it | Cannot recover / current classification |
|---|---|---|---|
| `index.html`, `dailyOddsLoad`, `ODDS_LATEST_VIEW` | Reads scalar markets from `odds_latest`; comments describe closest pre-KO capture | Intended client price fields and aliases | View DDL, writer, raw provider IDs, actual active prices: **EXISTING BUT INCOMPLETE** |
| `index.html`, `stampPublicationPrices` | Reads latest capture in 36-hour window before publication; nonnegative lead; optional snapshot ID/time/scalar price | Original client snapshot association if retained | Named bookmaker executable quote, server-first receipt, availability/rules; missing price does not block old publication |
| `index.html`, `M15_SEL`, `m15Fair` | Old product mapping/CLV benchmark, including DNB; missing DC12 and O35 aliases | Legacy vocabulary and diagnostic semantics | Approved upstream numeric market/selection IDs or settlement. New module maps all14 without changing the old map |
| `audits/phase8/source.mjs` | Existing GET allowlist; selected odds fields/paging and timestamp conditions | Read receipts/body hashes when already retained | No direct bookmaker fetch or source authority; a new database receipt cannot backdate upstream data |
| `audits/staging/collector-adapter.mjs`, `appendObservedFields` | Staging adapter allows `odds_1x2` only; no HTTP/provider SDK; writer is injected | Contract boundary and collector-run/source references for those observations | Provider raw response, multi-market per-book identifiers/status/clock semantics |
| `audits/staging/snapshot-schema.sql`, `research.append_observations` | Local SQL checks fixed 1X2 fields/fixture/capture chronology; assigns `clock_timestamp()` receipt; immutable triggers | True local writer receipt **if this exact path actually received the source then** | Cannot recover earlier availability of legacy imports; local receipt is not provider update. Not proof deployed |
| `audits/staging/capture-hooks.sql` | Requires already-recorded pre-issue research receipt for original price evidence; no legacy capture backdating | Prospective source-integrity pattern | No fourteen-market named-book ingestion, active status, raw provider catalog or rules |
| `audits/staging/evidence-manifests.sql`, `permissions.sql` | Immutable local evidence linking and narrow role grants in test setup | Reviewed staging permission/capture design | Actual hosted deployment/owners/grants/DDL not accessible here; no hosted migration applied |
| `audits/phase5/REPORT.md`, `audits/phase7/DATA_CONTRACT.md` | Earlier work explicitly rejects mutable legacy timestamps as proven first receipt | Established limits and isolation rules | Does not certify today's source or raw-book executable prices |
| Retained `S2-READ-01` snapshot/roster responses | Named `prices` numeric maps, original snapshot IDs/capture labels; 838 bounded rows | Exact retained database representation; current stored fixture context if present | No per-quote upstream clock/status/rules/access; provider bytes/string formatting discarded before storage cannot be recovered |

## Original collector and provider evidence

Repository file inventory contains the staging research adapter, SQL, client readers and historical audit code. The actual deployed API-Football odds collector/Edge Function, deployment definition, authoritative upstream market/bookmaker catalog and original per-book provider JSON archive were not found in the approved available artifacts. No function-management permission or privileged database export was used to retrieve them. Existing application comments suggesting collector cadence are documentation, not verified deployed behavior.

The current managed environment reports restricted networking enforced with matching desired/observed revisions. The API-Football v3 host is not an allowed destination and no API-Football binding is configured. OpenRouter readiness is irrelevant to offline quote work; its key is not accessed. No restriction was widened and no direct provider probe was attempted.

## Field recovery decisions

**EXISTING AND VERIFIED:** retained snapshot ID/fixture ID, raw database-row slice, numeric JSON token, bookmaker display string, nominal code, stored capture label and retained read receipt references. Association is to the stored snapshot; no claim of concurrent upstream bookmaker offers.

**EXISTING BUT INCOMPLETE:** current roster team/competition/kickoff context, source strings, old opening/latest/closing labels, staging source integrity. No canonical upstream bookmaker ID is manufactured from a display name.

**REQUIRES ADDITIONAL EVIDENCE:** original collector code/config and catalog version; upstream raw responses; documented update vs last-seen semantics; per-book state and inventory removal semantics; original receipts; fixture revisions; rights, bookmaker product/settlement and operator access. If an original response contains a group timestamp, its per-book scope still needs proof. If code shows it discarded fields, that can support future retention design, but cannot recreate historical values that were not saved.

**NOT CURRENTLY SUPPORTABLE:** certifying real active offers, exact historical first receipt, current accessibility or price freshness, executable best-price shopping, accurate closing-line comparisons, or real value recommendations. None is restored by schema conversion or a newly generated checksum.

Public provider references already inspected in Stage 2 remain useful (not new account-specific evidence): API-Football documentation/pricing/terms; The Odds API v4 update/status semantics and market catalog; Sportmonks Premium Odds specifications. See the accepted reconnaissance report for links and dated list prices. No new provider option was activated or subscription cost incurred in Stage 2A/2B.
