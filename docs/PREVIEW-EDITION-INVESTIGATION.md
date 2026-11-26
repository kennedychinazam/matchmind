# AUD-08 — preview Scores detail edition identity

Historical investigation from 25 November 2026. AUD-08 has since been reproduced deterministically and fixed locally; see MM03-PREVIEW-REVIEW.md. Hosted acceptance remains open. No hosted mutation occurred during this investigation.

The wider synthetic detail run failed `real-preview: Scores refuses cross-edition issued identity while retaining source analysis`: the expected headline was `Published pick unavailable`, but the displayed headline was `1 DNB · 75%`. Its source equivalent passed. The same preview test passed when run alone. The isolated pass does not resolve the inconsistent identity handling. The source and generated preview were both tested with external requests blocked and invented teams.

The test supplies a Scores card without a prediction under one edition and a history card with a prediction under another edition. The selected Scores identity must remain the anchor; changing delivery cache state must not admit a history claim from another edition. Both the original 51% informational vector and the 60% issued vector are deliberately distinct, so the test can detect substitution.

Current code paths to investigate:

- `matchDetail()` captures `_fixtureDelivery.screens.get('scores')` and checks history identity only when that optional cache entry exists.
- `fixtureDisplayAttempt()` clears the screen map when an accepted edition changes. Other screen operations may overlap navigation.
- `ensureLeagueFromScore()` may find an existing presentation row. Verify whether it already carries a prediction and which edition supplied it.

These observations suggest an investigation route, not a confirmed causal explanation. Next local work should force the screen map to change between Scores rendering and a row click, and between the history request and its completion. Record only synthetic edition IDs, request ordering and selected fixture IDs. Bind admission to the selected row's edition rather than whichever cache entry happens to remain. Preserve approved analysis while making an unmatched issued claim unavailable. Test both source and generated preview, late navigation, account changes and repeated clicks. Keep this check enabled in CI; do not weaken its expectation or certify staging acceptance based on an isolated rerun.

Evidence is retained in `MatchMind-detail-run-v5.log` and `MatchMind-preview-edition-rerun-v5.log` in the local deliverables. This investigation is independent of either phone's storage exception. No phone personal data was read or cleared.
