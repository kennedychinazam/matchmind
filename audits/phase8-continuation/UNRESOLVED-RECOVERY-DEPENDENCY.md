# Unresolved recovery dependency

Recorded 25 October 2026. This is the single authoritative note on what is
missing from the private recovery chain. It is an open dependency, not a defect
list, and it blocks all paid work until it is resolved.

## What is held

The owner holds one Saturday archive and its checksum, downloaded on 24 October
2026 and transferred into the second Codex session. They are the **verified
Saturday recovery baseline**: 3 chained SQL checkpoints, 93,680 source rows, 145
frozen E-Refreshed forecasts, engine parity and zero prior AI liability.

They were saved **before** Sunday's experiment.

## What is missing

- The complete Sunday checkpoint chain, including the three parent-linked Sunday
  checkpoints made in the Codex workspace.
- The post-failure checkpoint that retains the **US$0.306000** worst-case OpenAI
  reservation from the failed pre-dispatch attempt.
- The private event count after that failed attempt. The earlier 2,514-event
  figure predates it and does not describe current state.
- The filename and hash of the last checkpoint.

The paused Codex task held these and is no longer reachable: the owner's Codex
allowance is exhausted and development continues locally. There is no route to
retrieve them from that task, so they must be treated as unavailable rather than
pending.

## Prohibitions this creates

- Never recreate, synthesize or backfill the missing Sunday events.
- Never clear, release, refund or recreate the retained US$0.306000 reservation.
- Never restore the Saturday baseline and present it as the latest financial
  state. Its zero liability is true of Saturday only.
- Never start a new ledger. One global, nonresetting US$5.00 ceiling covers both
  providers, every request and every study day.
- No paid OpenRouter inference is authorized at this stage.

## What is consequently blocked

- **Real evaluation of the Sunday study.** `audits/phase8/collect-results.mjs`
  restores a private backup and reads `study.json` from a private directory.
  Without the Sunday chain there is nothing genuine to restore, so no Monday
  outcome evaluation of Sunday's 90 targets can be produced. Evaluation code and
  its tests can be, and are, exercised on synthetic fixtures instead. That proves
  the code, never the study.
- **Any further paid experiment.** It requires the latest reconciled journal
  first, then renewed authorization, then the full preflight chain.

## What would unblock it

Either the complete Sunday chain and its outer checksum become available through
an approved private transfer, verified by an isolated cold restore that confirms
the event set, the retained liability and the private grants; or the owner
authorizes a new, separately scoped prospective study with its own dates, its own
roster and its own reconciliation against the existing US$5 ceiling and the
retained US$0.306000 hold. Sunday 25 October fixtures cannot be predicted after
their kickoffs, and nothing may be backdated to appear otherwise.

## Current verified state

Branch `codex/phase8-openrouter-continuation`, draft PR #6, targeting
`codex/phase8-weekend-testing-ai`. No merge, deployment, public publication or
hosted Supabase change is authorized. No AI prediction exists in any arm: A1, A2
and A3 are empty.
