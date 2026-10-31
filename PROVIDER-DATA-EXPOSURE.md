# Provider-origin data on user-facing screens

Read-only inventory of Build 356, 31 October 2026, for Issue #8 and Issue #9 item 3.
Nothing here changes production data, requests a licence, or proposes a workaround.

**Finding that gates the launch: API-Football's published terms do not grant a right to
publish the underlying sports data.** Kevin's reply of 31 October establishes that
normalized field-level copies stay raw API data. It says nothing about republishing them to
third parties, and silence is not permission. Every screen below publishes provider-origin
data to whoever opens the app.

**External invitations and public release are therefore BLOCKED** pending written
publication-rights verification. Owner-only testing is a different question and is treated
separately in the launch report.

## Where provider data reaches a user

Every row below is read from the public `fixtures` table, written by the `refresh-af`
collector from API-Football, and served to any visitor without authentication.

| Screen | Provider-origin fields shown |
|---|---|
| Scores, today and any date | fixture id, kick-off date and time, status, elapsed minute, competition id, name and country, season, home and away team names, goals |
| Scores, finished rows | goals plus `score.fulltime` as `ft_h`/`ft_a`, and the AET or PEN marker |
| Match detail, header | the same identity fields, plus the competition and the kick-off |
| Match detail, outcome bars | derived probabilities, but computed from the raw corpus at runtime |
| Match detail, extras | timeline, statistics, line-ups, injuries, top scorers, fetched live with the **user's own** API-Football key, never ours |
| Analysis feed and competition discovery | competition id, name, country, season, team names |
| Tips, Smart Bet, Slip Generator | fixture identity and kick-off beside each ranked selection |
| Favourites | stored fixture identity for starred matches |
| Past predictions, the published record | fixture identity, kick-off, final score, and the graded outcome |
| Share card PNG | team names, competition, date and the pick, rendered into an image the user can post anywhere |

## Images, which are a separate exposure

`index.html:18203` sets `TEAM_LOGO_BASE = 'https://media.api-sports.io/football/teams/'`, and
`crest()` renders `<img src="…/teams/<id>.png">` straight into the page. Competition logos
arrive the same way through `llogo`.

So club crests and competition badges are **hotlinked from the provider's own CDN** and
displayed in the app. Two distinct issues sit in that one line. The images are third-party
marks served under the provider's terms rather than ours, and every page view makes a request
to the provider's media host from the user's browser, which is traffic we neither authorize
nor count.

## What is genuinely derived

Retainable under the reply, provided raw rows cannot be reconstructed from them: the fitted
attack and defence ratings, the Dixon-Coles rho, the scoreline grid, the 1X2 and goals
probabilities, the ladder's selected rung, the calibration shift, the gate thresholds, the
published record's hit, miss and void counts, and the calibration figures in the Terms.

**A snapshot is not derived merely because it is ours.** The frozen forecast archives embed
raw fixture rows inside their packet metadata, so a copy of one is a copy of raw provider
data under a different name.

## The dependency that makes expiry structural

Build 355 and 356 refit the model **in the browser, from the raw fixture corpus, on every
load**. `loadCloudLeagues` builds `L.matches` from `fixtures` rows at `index.html:19139`, and
every forecast comes off that corpus.

So retaining only derived outputs, which the reply does permit, does not leave a working
application. The app consumes raw history at runtime. Keeping the product alive past
11 November needs either continuous renewal or a different architecture, and that is an
owner decision, not a cleanup task.

## Exposure that does not exist

- No bulk export. The only download is the share-card PNG. There is no CSV or JSON dump.
- No embedded provider credential. `afState.key` ships as `''` and the API-Football key is
  typed in by the user. The only shipped key is the `sb_publishable_` Supabase key, which is
  designed to ship and is RLS-gated.
- No server-side republication beyond the app itself.

## What the owner has to settle before an external invitation

1. Written confirmation from API-Football that displaying fixture identity, kick-off,
   status and scores to app users is permitted, and on what terms. Ask specifically about
   display to third parties, not only about storage.
2. Written confirmation covering the crests and competition badges, or replace them with
   our own assets, or drop them.
3. The renewal or cessation decision, in light of the runtime-refit dependency above.
4. Whether the public `fixtures` read path should be restricted to signed-in invitees while
   item 1 is open. That is a Supabase RLS change and it is not made here.

Until 1 and 2 are answered, the honest position is that the app may be shown to the owner
and to people acting for the owner, and not published.
