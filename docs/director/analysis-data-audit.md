# Analysis data audit and bounded staging projection

This is a partial restoration, not acceptance of the complete match-analysis experience. No production database, private master, historical forecast, settlement decision or provider key was changed. No AI, bookmaker or football-provider request was made. Source inspection used read-only database metadata, bounded existing source records and the deployed AI function source.

## Source findings

The source schema has immutable `predictions` (issued selection, issued probability, original 1X2 vector, original model expected goals and `made_at`), a publisher-owned `shared_records.board` (including informational model results and expected goals for fixtures without a qualifying pick), fixture results and a separate AI cache.

Actual shared-record RLS restricts INSERT/UPDATE to the publisher account's signed JWT email. The current board's writer matched that publisher. In contrast, deployed `ai-analyze` version17 accepts an authenticated caller's arbitrary prompt and fixture ID, then stores its generated text by that ID. The AI cache has only `fxid,text,model,updated_at`: it records no source list, approved prompt, identity snapshot or grounding approval. Its existence is not evidence of approved analysis.

The read-only November13 audit counted125,989 fixture records,21,236 observed fixture expected-goal values, **zero upcoming fixture expected-goal values**,430 cached AI texts (maximum2195 characters) and zero `match_context` rows. Fixture `xg_h/xg_a` are observed statistics and never substitute for forecast expected goals. These counts are dated observations, not current operational counts.

Historical results predominantly use `FINISHED`, alongside `FT`. The first new history reader missed that alias; the corrected query and projector explicitly accept both. Extra-time/penalty results use explicit90-minute `ft_h/ft_a`; missing90-minute scores remain unavailable.

## Panel field classification

| Panel | Required original inputs | Classification and implementation |
|---|---|---|
| Hero | Fixture ID, team identity, tournament, kickoff, crests; issued pick/probability | Already published; presentation work restores it. Original selection and its probability remain separate from result probabilities. |
| Match Result Predictions | Original `p_home/p_draw/p_away`; model expected goals | Issued values already published but hidden. Publisher board `pw/pd/pq/xh/xa` also already available, including withheld/no-pick fixtures. Optional `analysis.result/xg_home/xg_away` preserves those approved board values and its actual `builtAt`. UI must prefer original issued vectors when a qualifying immutable prediction exists. |
| Goals Markets | Approved model Over1.5/2.5/3.5 and BTTS | Existing approved engine can compute them, but current immutable/public source records do not persist these market outputs. No client regeneration or xG-to-market calculation is introduced. Await a separately authorized private publisher extension. |
| Combos | Original correlated score-grid sums | Existing engine output, not currently stored/published. No multiplication of marginal probabilities or invented grid. Await private publication. |
| Half-time / Full-time | Approved half/full outcome distribution | Existing engine output not present in current public records. Await approved private publication; observed halftime scores are not forecasts. |
| Correct Score | Original score distribution, original pick conditioning | Existing engine output not persisted. Rebuilding from rounded expected goals would create a new calculation and is not used. Await approved private publication. |
| Likely Scorers | Verified player goal/minute totals and approved model scorer output | No approved scorer forecast records found. Legacy demo tallies are explicitly ineligible. Provider/player coverage and model publication remain required. |
| Form & Head to Head | Prior genuine fixture identities/results | Trusted source records omitted from bounded public projection. Restored last5 known same-competition matches per side and last5 H2H within365days, strictly before fixture date, from AF records. Form is chronological oldest→latest; H2H is latest→oldest. This is a bounded history view, not all-time history or cross-competition national-team form. |
| League Table | Complete season table, ranking rules, deductions, group identity | No approved complete standing record is published. A rolling/relevant-team history subset cannot produce a truthful full table. Remains unavailable until an official/approved complete standing projection is supplied. |
| Professional AI Write-up | Approved source-grounded text, identity, timestamp |430 cached records exist but are **unapproved arbitrary-prompt cache**, not genuinely absent data. Default mirror does not read or publish that table. Pure future projection requires an independently reviewed exact content SHA256 plus fixture ID, league, home/away, date/time and source timestamp match. No operational approval-manifest reader or generation is activated. |

## Projection and provenance

`card.analysis` is optional and closed. Its typed bounds include8goals,12combos,9half/full outcomes,12correct scores,16scorers,5form outcomes per side,5H2H rows,64standing rows and32768characters for an independently approved write-up. Optional future fields are schema support, not a claim they are currently published.

The active collector emits only approved publisher-board model facts and source-result history. The board must match fixture ID, competition, both team names, date/time, a valid complete probability vector and an actual source timestamp no later than capture or kickoff. `analysis.source_at` preserves the board timestamp. `history_source_at` separately records the latest source update among eligible history rows; match dates remain in H2H. No source timestamp is relabelled as a capture/model/publication time.

History reads are GET-only, fixed source host, explicit columns, AF-only, relevant teams, same competition and at most365days before the earliest requested fixture. Each competition is bounded to1000rows with exact complete pagination; up to100competitions are admitted. Stable capture takes two passes, so the maximum successful history budget is1000GETs (100competitions×5pages×2passes), plus existing bounded fixture/prediction/record/slip reads. This is a deliberately finite upper bound, not an observed request count. No paid provider requests occur; ordinary database request/egress accounting still applies. This budget should be monitored before increasing refresh frequency.

Optional history read failures preserve the existing core refresh and emit `analysis_warnings`; they do not fabricate empty form as a measured zero. Changing optional availability between capture passes prevents publication. Excess overall inventory/byte size fails closed and retains the prior mirror; it is never truncated to fit.

## Actual source capture and size

A GET-only private local capture at `2026-11-13T22:03:33.298Z` contained752cards and238original issued predictions. Its SHA256 is `e4e2ac4af552461f3144b513665767cef13782d0557326de9b44e6f9760cb787`. The expanded wire payload was620887bytes, above the old524288byte budget. It included293board-result/expected-goal analyses,708form panels and367H2H panels. Of514fixtures without qualifying immutable picks,207had informational board result probabilities and478had form. No AI text or new market forecast was emitted.

Removing optional analysis yielded398213bytes for that same capture, within the old reader limit. Staging v2/storage therefore use a reviewed **1048576byte (1MiB)** limit; old v1 readers permanently strip only `analysis`. The source capture is dated evidence, not a claim of current freshness or hosted publication. Private snapshots are intentionally outside Git.

## Staging rollout and rollback

1. Independently review `STAGING-analysis-up.sql` and exact frontend artifact. It refuses a target without the existing isolated mirror's configuration/QA-backup tables.
2. Apply the reviewed up script to **rdcbnvfnxenrpnnwxszs only**. It expands the pure closed validator and private staging writer byte limit from524288to1048576. The writer's token gate, source/window checks and existing grants remain unchanged.
3. v1 keeps its original signature and permanently strips `card.analysis`; v2 is an additive security-invoker read facade over the same existing finite, expiring screen function. It has the same anon/authenticated/service-role read grants as v1 and no PUBLIC execute grant. No role gains raw-table or write authority.
4. Deploy the reviewed preview UI that calls v2, with its matching1MiB validator. Old open tabs/service workers continue using v1's original shape. The wire envelope contract remains `matchmind-display/1`; the transport endpoint negotiates the optional extension.
5. Publish the newly captured existing-data projection through the existing staging-only token writer. `verifyDestination` verifies every v2 original field, and separately verifies v1's exact stripped shape and matching edition ID.
6. Verify hosted UI/network acceptance before acceptance. None of these steps authorizes production deployment.

`STAGING-analysis-down.sql` makes v2 delegate to permanently compatible v1. It retains the additive schema and stored editions: restoring an old validator over unchanged expanded immutable editions would invalidate them. Rollback preserves all edition hashes and does not delete or rewrite data. A future full schema retirement needs a separate reviewed archival strategy.

## Focused verification

`node --test --test-isolation=none test/analysis-data-projection.test.mjs test/fixture-delivery-backend.test.mjs`:27tests passed. Node's default isolated runner in this environment reports file-level counts; isolation=none gives actual registered test counts.

`node --test --test-isolation=none test/analysis-data-sql.test.mjs`:1isolated PostgreSQL integration test,22focused SQL assertions passed. It uses the repository's pinned PostgreSQL16.6 image with `--network none` and removes its own synthetic container. Checks include installation refusal outside staging prerequisites, old/new closed schemas, vector/private-field rejection, repeat installation,1MiB admission/refusal, v1/v2 edition identity and privacy, raw-table denial and rollback with unchanged edition hashes. The private master, production publisher and forecast archives are not test targets.

The remaining supported-market publication gaps, complete standings and source-grounded AI approval prevent declaring the full Director request complete.
