# Stage 1 Coherent Market Mathematics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement isolated offline scoreline mathematics and a separately identified E-MARKET research baseline, preserving every existing engine, forecast and operational safeguard.

**Architecture:** Pure dependency-free numerical modules construct an adaptively bounded Poisson or admissible Dixon–Coles score distribution and aggregate fourteen regulation-time markets. A separate adapter accepts a pinned Build 355 offline-run artifact and derives E-MARKET from its frozen rates, retaining the original probabilities separately. No transport, odds integration, learned AI weights, value ranking or actionable selection is introduced.

**Tech Stack:** Node ESM, node:test, seeded property generators, independently computed reference values and actual pinned Build 355 source oracle. No added dependency.

**Spec:** Director-approved Stage 1 scope and corrections A–F, recorded below; the complete private technical review is retained outside GitHub.

## Global Constraints

- Stage 1 offline mathematics only; no paid inference, odds integration, production/hosted writes or Build 356 access.
- Existing continuation branch and PR #6 remain draft; user explicitly authorizes verified commits/push to this branch.
- Preserve index.html, old A1/A2/A3/contracts/runtime/Sunday guards, ledger, all historical archives and forecasts byte-for-byte.
- New numerical parameters are research model inputs, not calibrated forecasts or approval to issue a value pick.
- Support finite rates 0–20 goals per side; reject unsupported rates, invalid dependence and resource/tolerance requests. Default omitted-mass target 1e-12; expose analytical truncation and separate floating-point allowance. No silent clipping or tail reassignment.
- Full Node 20.20.2 and Node 24.19.0 suites; no new libraries or model calls.
- Mandatory later corrections: measurable AI contribution versus baseline; point-in-time data acquisition before fitting; usable price provenance; preregistered model/uncertainty/ranking policy; actionable selector disabled until validated; no synthetic parameters as live defaults.

## Review Focus

- Degenerate zero rates and tiny positive rates must preserve possible events and coherent complements.
- High rates/strict tails/resource exhaustion must return explicit error or bounded approximation, never silently truncate required mass.
- Invalid Dixon–Coles parameters must reject rather than invoke the old clamp or silently fall back.
- E-MARKET must preserve source identity, real/synthetic lineage and original probabilities without pretending JSON alone authenticates a source or creating a new historical forecast.
- Floating-point normalization must not hide retained-mass loss or claim a formal interval guarantee for Math.exp.

## Task 1: Numerical distribution and market aggregation

**Files:** create `audits/value-intelligence/scoreline.mjs`, `audits/value-intelligence/markets.mjs`, `audits/test/value-scoreline.test.mjs`.

**Interfaces:** `scorelineDistribution({lambdaHome,lambdaAway,rho=0}, options)` returns frozen rates/model/normalized cells, retained mass, cutoffs, analytical tail upper bound, floating-point allowance and event error allowance. `marketProbabilities(distribution)` returns fourteen named probabilities, deriving complements and DC from the same distribution; independently validates supplied distribution structure and mass. No IO/network/database interface.

- [x] Write tests for known independent references, zero rates, all fourteen relations, seeded properties, exchange symmetry, DC low-cell effects, malformed inputs and tail/resource failure.
- [x] Run test file; expect assertion failure for missing module before implementation.
- [x] Implement adaptive Poisson recurrences, geometric tail majorant beyond the mode, compensated summation, strict four-cell DC positivity and normalized bounded grid; implement deterministic market aggregation.
- [x] Run the new tests; expect all pass. Independently compare analytic totals/BTTS and high-precision reference outputs, including high/tiny rates.
- [x] Commit numerical code and tests with the approved-scope specification/plan.

## Task 2: E-MARKET adapter and baseline distinction

**Files:** create `audits/value-intelligence/e-market.mjs`, `audits/test/value-e-market.test.mjs`.

**Interfaces:** `eMarketFromBuild355(engineResult, fixtureId, options)` selects one eligible pinned artifact row, validates provenance/timing, takes original frozen lambda pair and pinned source rho, calls Task 1 mathematics, returns an explicitly derived research result with original and E-MARKET values separate. Accepts no source/model/engine override. Rejects ambiguous/malformed/late artifacts.

- [x] Write failing tests using synthetic offline artifacts and the actual pinned source grid as an independent oracle. Check original input immutability, result parity where transforms coincide and documented differences in damped goals/BTTS and tails.
- [x] Run tests; expect missing-adapter assertion failure.
- [x] Implement adapter; keep all old modules unchanged.
- [x] Run numerical/adapter tests; expect pass, and execute at least one actual offline engine artifact through adapter.
- [x] Commit adapter and tests.

## Task 3: Evidence, corrections, full regressions and review

**Files:** create `audits/value-intelligence/README.md`, `audits/value-intelligence/ROADMAP.md`, safe aggregate verification artifact; update this plan's checklist after execution.

- [x] Document methodology/domains, fourteen markets, error assumptions, E-MARKET parity/distinction and disabled actionable status. Address all six lettered required corrections (the deliverable calls them five; preserve every item A–F).
- [ ] Run full suites separately under Node 20 and 24; inspect every failure, rerun only with justified diagnosis/new change. Preserve logs privately; include no credentials, real data or private financial state in Git.
- [x] Obtain one fresh whole-change technical review under executing-plans; fix important findings with failing regression first.
- [ ] Record final verification and exact limitations, commit safe research-only artifacts, push existing continuation branch without force, verify PR #6 draft and attach it.
- [ ] Stop at Stage 1 and request Director review; no later stage activation.
