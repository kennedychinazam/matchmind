# Issue #7 engine and cup-calibration forensic audit — offline probes

Read-only research artifacts, 31 October 2026. Branched from `main` `036f09b`, Build 355.

**These probes change nothing.** They load the unmodified `index.html` in Chromium and call its
own engine functions on synthetic, deterministic corpora. No network, no provider request, no
Supabase, no archive read, no paid call. Every input is invented and is labelled as such.

**Nothing here is a reconstruction of any real forecast.** The three 27 October DFB Pokal
screenshots cited in Issue #7 are NOT REPRODUCIBLE FROM AVAILABLE EVIDENCE; see the report.
Every number these probes print is a counterfactual about the mechanism, not about a match.

## Running them

```sh
node audit/issue7/t1-minsrc.mjs    .
node audit/issue7/t2-division.mjs  .
node audit/issue7/t4-mechanisms.mjs .
node audit/issue7/t8-final.mjs     .
```

The argument is the directory holding `index.html`. Chromium comes from `playwright` or
`playwright-core`, whichever the host already has; nothing is downloaded.

## What each probe establishes

| Probe | Question |
|---|---|
| `t1-minsrc.mjs` | the grain of `XC_SHAPE.MIN_SRC = 10`, the `RECENT_DAYS` gate, whether a cup can be a source, and what happens downstream when one side fails the threshold |
| `t2-division.mjs` | whether `xcAttack` carries any absolute division level, whether a strong lower-tier side can outrank a weak top-tier side, and whether a cup's own `avgH`/`avgA` absorbs a seeding rule |
| `t4-mechanisms.mjs` | the same with a corrected league id, the newcomer floor's inputs, home/away orientation, a realistic seeding mix, and opponent-quality discrimination |
| `t8-final.mjs` | cup versus league shrink as a control, the Build 320 ninety-minute fallback across nine score shapes, the archive's shape, and whether the rung ladder is implicated |

## One correction recorded against my own work

An earlier version of `t2-division.mjs` used competition id 96 as a "fourth tier". Id 96 is in
`CUP_COMPS`, so it can never be an `xcSource`, and that probe was invalid. It is redone in
`t4-mechanisms.mjs` with ids 79 and 88, which are genuine loaded leagues. The invalid result is
not relied on anywhere in the report.
