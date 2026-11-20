# PR #28: security preservation and focused mobile display corrections

Reviewed Director comment 6798254221 and the preceding hosted-review findings.
The existing security correction is preserved in commit `a9d8aa1` on
`codex/wo62b-public-release-20261110`.

## Security correction

The obsolete email-based publisher identifier was in the checked-in public
`index.html`, rather than injected by the staging builder. It has been removed.
`isPublisher()` always returns false in this public client, so legacy client
publication actions are disabled. Server-side publication authorization is
unchanged. No protected email, password or administrator-key value is included
in the corrected public source. Personal provider-key controls remain inactive.
Existing repository history is not rewritten.

## Verified display findings and corrections

- Published Analysis detail now uses two short paragraphs for a current issued
  prediction, normal left alignment and no automatic hyphenation. RTL text aligns
  right. Unavailable team history, league table and independent AI remain explicit;
  missing or withdrawn predictions retain their separate explanations. No
  probability is recalculated and no AI call is introduced.
- The public `loadCloudLeagues` branch returned before `loadSharedRecords`, while
  opening More did not start a pending read. Both entry paths now initiate the
  existing bounded Records read. Opening More retries a failed read. Loader promise
  cleanup also works when the client is initially unavailable, rather than retaining
  a completed failure forever. An unrelated Tips-render exception no longer blocks
  the Accuracy repaint. Empty and failed responses retain honest distinct states.
  The existing Records schema, projection and tally remain unchanged.
- The Scores timestamp was the latest fixture-source update among loaded rows,
  not edition publication time. Scores now explicitly labels **Source updated**
  and **Edition published**, using each accepted Scores response's own edition
  timestamps. A missing source timestamp is unknown, never replaced with device
  read time. Refresh failure preserves both age disclosures and match counts.
- A bounded edition is labelled **Published**, then **Edition · Nh old** after
  the existing seven-hour threshold. It does not claim live score coverage or
  completeness against the private collector's configured competition count.
  Expiry is labelled explicitly; a rejected expired refresh says **Unavailable**.
  Fixture statuses, live-status markers, admission and expiry rules are unchanged.
- About labels the existing release string **App v0.9 · build 358**. Legal pages
  and the legal summary identify **Legal text v1.0** and retain their existing
  update date. No version or legal revision is invented.
- Kick-off settings identify the selected IANA time zone, or device zone, rather
  than a one-time clock reading that could become stale. Kick-off arithmetic is
  unchanged.
- **No record** now reads **No published prediction** only for the verified
  missing-published-record state. Other provenance states and explanations remain
  distinct.
- Slip messages distinguish a listed prediction from a passed, upcoming board
  pick admitted by date, league, market and per-match risk settings. The risk label
  says **minimum published probability**, not that a leg must win. The cached
  anonymous response from the already-completed staging publication contains the
  64% fixture's prediction but no corresponding board entry. The unchanged slip
  selector requires such an entry. No new backend request or publication was
  needed to establish this distinction; the screenshot alone would not establish
  it. The banker empty-state text also avoids describing all fixtures as priced.

## Focused verification

24 focused offline regressions passed:

- 12 new mobile/display regressions: real bounded Records projection, delayed
  success, empty/failure/retry, initially unavailable client recovery, independent
  repaint, 320/390px Analysis and RTL alignment, separate source/edition ages,
  missing timestamps, app/legal versions, time-zone text, 64% slip eligibility,
  prediction preservation, and disabled public publisher/provider controls.
- 5 selected rolling-edition tests: expiry boundary and four header age/layout
  checks, including 320/390px widths and clock changes without reload.
- 2 selected provenance checks: distinct missing-record states and readable
  status chips under enlarged text.
- 2 existing prediction-immutability checks across reload and UTC midnight.
- 1 existing published-standings regression proving truthful unavailability and
  unchanged published probabilities.
- 2 immutable-engine SHA-256 guards.

Additionally, direct comparison to the security-only commit confirmed unchanged
football/basketball engine, slip selector/pool and aggregate-grading regions.
Exact protected-value scans passed. Diff whitespace validation passed with the
repository's existing CRLF endings recognized. No broad CI suite was requested
or rerun manually. The initially unavailable-client regression failed before its
loader cleanup correction and passed afterward.

## Remaining gates

These changes are source corrections for review; the existing manual staging
deployment and previously delivered ZIP predate the display patch. No new
staging artifact or Cloudflare upload was made. Director review and targeted
hosted/mobile acceptance of the revised source remain outstanding. Offline
Chromium and responsive widths do not establish Samsung Firefox acceptance.
The previously documented settlement-policy conflict in
`DIRECTOR5-CORRECTIONS.md` is not changed or resolved by this display patch.

No authentication repair, publisher enablement, database publication, production
deployment, merge, paid API request, archive rewrite or settlement-history change
was performed. PR #28 must remain draft.
