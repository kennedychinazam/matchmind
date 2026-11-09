# Operator acceptance: rolling edition window and League Table copy

Short checklist for the two changes in this round. Nothing here has been performed. Emulated
results do not substitute for any of it. Every item is observable by a person with a phone.

The code change is **source-only**. None of the hosted checks below can pass until the migration is
installed, which needs separate Director authorization at the release gate.

## A. Rolling publication window, on a real device

The old rule tied availability to the UTC calendar date and expired every edition at UTC midnight,
so the public feed went dark from 00:00 UTC until the 05:17 UTC publisher run finished. The new
rule serves the most recent edition while it is under 24 hours old.

| # | Do this | Pass |
|---|---|---|
| A1 | Between **00:30 and 05:00 UTC**, open the app on a phone that has never been signed in, and go to Analysis. | Forecasts are shown. **Not** "Published fixtures unavailable". This is the blackout, and it is the whole point of the change. |
| A2 | Same window, pull to refresh twice, one minute apart. | The slate stays. No flicker to an empty screen between refreshes. |
| A3 | Note the kick-off time of one fixture two or three days ahead, with a pick. Close the app fully. Reopen it after the next publisher run. | Same pick, same probability, same timestamp. A forecast is issued before kickoff and does not change because you opened the app. |
| A4 | Pick a fixture that has already been played and carries a pick. Force-quit, reopen, and look again after midnight UTC. | The pick, its probability and its tick or cross are unchanged. No played fixture gains a pick it did not have. |
| A5 | Open Analysis when the newest edition is more than 7 hours old (the scheduled publisher stays on, no outage is staged). Read the header chip. | The chip reads `Updated Nh ago`, not `Live`. Its long-press or hover title names the publication time in UTC. Right after a publisher run it reads `Live` again. Do **not** disable the publisher to test this: the expired-edition case already passed offline. |
| A6 | On the run after re-enabling, check the Actions tab. | The publisher ran and a new edition exists. A6 confirms recovery is automatic and needs no reader action. |

## B. League Table copy, on a real device

The table previously told every reader about three English Championship point deductions, including
readers looking at the Bundesliga.

| # | Do this | Pass |
|---|---|---|
| B1 | Open a **Bundesliga** match, e.g. Bayern against Dortmund, and expand the League Table. | The note under the table mentions **no** English club and **no** other competition. "Sheffield Wednesday", "Leicester", "West Brom" and "Championship" appear nowhere. |
| B2 | Open an **English Championship** match and expand the League Table. | Any deduction detail shown here is about this competition, and it is brief. |
| B3 | Compare the points, played and goal difference columns in B1 against a public table for the same date. | The numbers match. The copy changed; the arithmetic did not. |
| B4 | Open a third competition, e.g. La Liga or Serie A. | Same as B1: no other league's disciplinary history. |

## C. The two items still open from the previous round

| # | Do this | Pass |
|---|---|---|
| C1 | Samsung Galaxy S23 Ultra, Chrome, Settings → About, at default text size and again at the largest Accessibility text scaling. | The version string reads on one line, the PRO badge in the top bar is fully visible and not covered by the status chip, and no screen scrolls sideways. |
| C2 | A real iPhone on Safari, and the same device with the app installed to the home screen. | Scores and Analysis agree, login works, favourites persist, and the app opens offline with the last published slate. |

## What is not covered here

- Firefox Android and iOS Safari remain **unverified by any automated run**: this project's CI has
  only Chromium.
- `BUTTON.nav-btn` and `DIV.bottomnav` overflow the viewport at text scaling above about 180% on a
  320 px screen. Pre-existing, outside this round's changes, and worth a look during C1.
- `APP_BUILD` and the `sw.js` cache name must both be bumped before release. They currently read
  357 for a document that has changed many times since 357 was set, so no "Build N is available"
  banner will fire and About will report the same number for two different builds.
