# Stage 2A/2B Offline Quote Framework Implementation Plan

> **For agentic workers:** Execute in this session with test-driven-development. The Director has explicitly authorized implementation; no additional plan approval is needed.

**Goal:** Preserve and normalize retained bookmaker observations without certifying actionable prices.

**Architecture:** Pure bounded parser/schema/semantic validator, exact fourteen-market identity map, lossless legacy adapter and immutable replay/classification. No network, database or inference transport. Evidence claims never become verified authority.

**Tech Stack:** Node 20/24 ESM, built-in crypto/test; strict JSON Schema subset evaluator and independent Python schema reference for verification.

**Spec:** Director Stage 2A/2B authorization in this task; approved Stage 2 schema copied with documented versioned refinements into `audits/quotes/quote.schema.json`.

## Global Constraints

- No paid calls, new source integration, hosted writes, production or Build 356 changes.
- Preserve Stage 1, engine, all A1/A2/A3/history/reservations/guards; existing continuation branch and draft PR #6 only.
- Actionable admission is unconditionally disabled; input flags or status strings confer no trust.
- Unknown clocks/status/rules/access/rights remain unknown. Legacy capture is never a first receipt.
- Private real data and receipts remain outside Git; use synthetic public test fixtures.

## Review Focus

1. Duplicate JSON keys, accessors, prototype keys, resource exhaustion: reject before traversal/normalization.
2. Same display name is not a verified bookmaker ID; swapped teams/market aliases must not silently join.
3. Legacy tokens and source bytes must survive normalization without backdating.
4. Clock/state claims cannot confer source verification; latest adverse/incomplete observation cannot revive older odds.
5. Revisions/duplicates must preserve original ancestry and fail closed on contradictions.

## Tasks

### 1. Contract, parser and mapping

Files: `audits/quotes/{bounded-json,markets,contract}.mjs`, `quote.schema.json`; `audits/test/quote-contract.test.mjs`.
Interfaces: `parseBoundedJSON(text)`, `canonicalMarket(code)`, `validateQuote(input,{expectedFixture}={})`, `quoteHash(quote)`; immutable validated objects. Validate schema structure plus exact semantic identity/decimal/clocks.
- [ ] Write tests for fourteen exact mappings, strict decimal, size/depth/prototype/duplicate rejection, identity/period/line and clock distinctions. Run RED.
- [ ] Implement smallest bounded pure modules and versioned schema; run GREEN.

### 2. Legacy normalization and classification/replay

Files: `audits/quotes/{legacy,replay}.mjs`; `audits/test/quote-legacy.test.mjs`, `quote-replay.test.mjs`.
Interfaces: `normalizeLegacySnapshot(rawJSON,{sourceRef,reconnaissanceReceipt,fixtureContext}={})` returns immutable source+quotes+rejections; `classifyQuote(quote,{decisionAt,maxSeenAgeMs}={})`; `replayQuotes(records,{decisionAt,maxSeenAgeMs}={})` returns audit history/stream state, always actionable false.
- [ ] Write failing preservation, legacy no-promotion, fake-active, stale/partial/revision/duplicate/order and no-network/leakage tests.
- [ ] Implement with no verifier/config flag capable of enabling actionable recommendations. Run GREEN and Stage 1 compatibility tests.

### 3. Source inspection, whole-suite verification and report

Files: `audits/quotes/{README,SOURCE-INSPECTION,MISSING-EVIDENCE,STAGE2AB-REPORT}.md`, `audits/value-intelligence/ROADMAP.md`; optional test helper only if required.
- [ ] Inspect local collector/schema/mappings/retained response shapes under current read permissions; report unavailable deployment/raw provider evidence.
- [ ] Normalize accepted private census offline, verify raw input unchanged, publish aggregate results only.
- [ ] Run all existing regression tests on exact CI Node 20.20.2 and 24.19.0 with local PostgreSQL/browser; inspect every failure, no unexplained skips.
- [ ] Independent final review, commit work on continuation branch, push only this authorized research continuation for CI; verify draft PR unchanged and report exact CI results.

## Verification and stop

Do not activate real price admission, A4 inference, learned mappings or value recommendations. Stop after Director review package. Synthetic tests establish software behavior, not bookmaker authenticity or profitability.
