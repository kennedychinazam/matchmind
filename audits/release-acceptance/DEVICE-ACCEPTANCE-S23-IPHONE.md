# Physical device acceptance — Galaxy S23 Ultra and iPhone (Safari)

**Read this first. Nothing in this file has been performed. Every result in it must be produced by
a human holding real hardware.**

Emulated results do not substitute for physical device testing. Chromium device emulation — which is
what `test/mobile-pwa-acceptance.test.mjs`, `test/mobile-viewport-scaling.test.mjs` and
`test/mobile-text-scaling-layout-defect.test.mjs` produce — runs a desktop browser engine at a
phone's CSS-pixel metrics on a local origin. It cannot establish Chrome Android's own font boosting
or text-scaling behaviour, Firefox Android's behaviour, **anything at all about iOS Safari or
WebKit**, a real install, a real touch, a real notification permission, a real network transition,
a real gesture bar or notch, thermal throttling, or how a reader actually perceives the screen.
There is no Firefox or WebKit binary in the test container at all, so every claim about Firefox and
every claim about Safari in this release is unverified until an operator records it here.

Write the observed result next to each item. An item with no recorded observation is **not a pass**.
Do not infer one item from another.

This file covers the two questions the Director raised on 8 November 2026 (browser text scaling and
layout, and match-list completeness) plus the standing release coverage.
`audits/release-acceptance/DEVICE-ACCEPTANCE-CHECKLIST.md` covers the rest of the release; run both.

---

## 0. The exact candidate, before anything else

| | |
|---|---|
| Build | `APP_BUILD = 357`, service-worker cache `matchmind-v357` |
| `index.html` | sha256 `a3e27362ac0e19710a8d34734223ab5b71188afaad8189ff1187063dcf5ccc9a` |
| `sw.js` | sha256 `67640f8c46be5635b6efe536f33564ec08530c84e8b79ca5b527c79ee15d430a` |
| `manifest.webmanifest` | sha256 `735d6251109328bf6ebab28028eda5673cbcafe08f7e6151e7551dd08c8c7727` |
| Backend | staging only. **Never production.** |

**0.1** On the host serving the candidate, run `sha256sum index.html sw.js manifest.webmanifest` and
confirm all three match the table.
**PASS** = three exact matches. **FAIL** = any mismatch; stop, you are not testing the candidate.

**0.2** On each phone, open the app, tap **More** (bottom-right gear), scroll to the **About** row.
**PASS** = it reads `MatchMind PRO · v0.9 · build 357`. **FAIL** = any other build number, or the
row is unreadable; stop.

> The Director's two screenshots were taken on the **installed Build 355**, not this candidate.
> Section 1 and section 2 are therefore re-tests, not confirmations. If a symptom does not
> reproduce on 357, record that plainly — it is a result, not a non-event.

---

## 1. Browser text scaling, layout and viewport — Galaxy S23 Ultra

Do the whole of section 1 three times over, once per column, and record three results per item:
**(a)** Chrome (browser tab), **(b)** the installed Chrome PWA (home-screen icon), **(c)** Firefox.

**1.1 Record the baseline numbers before touching any setting.** In each browser, open the app, go
to **More → About** and photograph the row. Then write down five numbers, without changing any of
them: Chrome → ⋮ → **Settings → Accessibility → Text scaling** (the percentage); Chrome's page-zoom
setting on the same screen; Firefox → ⋮ → **Settings → Accessibility → Font size**; and in Android
**Settings → Display → Display size and text**, both **Font size** and **Display size**.
**PASS** = all five numbers written down for each browser. **FAIL** = any left blank. These five
numbers are the whole explanation of any Chrome-vs-Firefox difference, because the source contains
no rule that is conditional on the browser (no `text-size-adjust`, no safe-area inset, no
`@media (display-mode: standalone)`, no user-agent check that affects layout).

**1.2 The About row must not wrap.** More → About, photograph the row.
**PASS** = `MatchMind PRO · v0.9 · build 357` reads on **one line** with the number next to the word
"build", and the right-hand descriptor reads on **one line**.
**FAIL** = the version string breaks anywhere, in particular between "build" and "357"; or the
descriptor takes two or more lines. Photograph either outcome. (Emulated at 360 CSS px, this wraps
to two lines on the unpatched candidate.)

**1.3 Text scaling at the Android maximum.** Chrome → ⋮ → Settings → Accessibility → **Text
scaling**, drag to the maximum. Return to the app, go to **Scores**.
**PASS** = no part of any screen can be dragged sideways (swipe left and right across the match
list, the date rail, the top bar and the bottom tabs — the date rail is a deliberate horizontal
scroller and *is allowed* to scroll; the page behind it is not); every team name is either fully
visible or cleanly truncated with an ellipsis, never overlapping another element; the five bottom
tabs are all still reachable and labelled.
**FAIL** = the whole page slides sideways; text overlaps; a tab is clipped off the bar.
Then **set text scaling back to where 1.1 recorded it** before continuing.

**1.4 Pinch zoom must still work.** On Scores, pinch out, then pinch back in.
**PASS** = the page magnifies and returns. **FAIL** = pinch does nothing. (A build that fixes a
layout problem by disabling the reader's zoom has failed this release, whatever else it passes.)

**1.5 Chrome page zoom.** Chrome → ⋮ → Settings → **Accessibility → Zoom on all sites** / page zoom
→ 110%, return to the app, look at Scores and at More → About; then set it back to 100% and look
again.
**PASS** = both screens are complete and legible at 110% and at 100%, and whatever you see at 100%
after the round trip is identical to what you saw at 100% before it.
**FAIL** = the 100% screen after the round trip differs from the 100% screen before it. Photograph
both. (The Director reported that a 100 → 110 → 100 round trip did not restore the screen; this item
is the test of that specific claim.)

**1.6 Vertical space, Chrome against Firefox, side by side.** Put both phones' browsers on the same
tab (Scores) at the same recorded text scaling, and photograph both.
**PASS** = both show the same number of match rows above the fold, ±1.
**FAIL** = one shows materially fewer. If it fails, record each browser's own reported viewport width
— in Chrome and in Firefox, open a new tab, visit `data:text/html,<body onload="document.write(inne
rWidth+' x '+innerHeight)">` and read the number. Emulation measured the top bar at **106 CSS px**
when the browser reports 360 px wide and **72 CSS px** when it reports 412 px, because the single
media query in the sheet is `max-width:360px`; if the two browsers report different widths on the
same handset, that 34 px is the difference and it is not a Chrome bug.

**1.7 Rotate.** Turn each phone to landscape on Scores and on More, then back.
**PASS** = no sideways page scroll in either orientation, nothing clipped, and returning to portrait
restores the portrait layout. **FAIL** = otherwise.

**1.8 Touch targets, by thumb and not by eye.** On Scores, with text scaling at the value 1.1
recorded, tap each of: the five bottom tabs; the magnifier in the top bar; the **🏆 All competitions**
chip; each of **All / 🔴 Live / Upcoming / Finished**; the **‹** and **›** arrows on the date rail;
and the ☆ on a match row.
**PASS** = every one of them responds to a normal thumb tap, first time, five times out of five, and
tapping the ☆ does **not** also open the match. **FAIL** = any control needs a second attempt or a
fingernail, or the ☆ opens the match. Name the control. (The ☆ measured 15 × 18 CSS px in emulation
— the smallest target in the view — so test it hardest.)

**1.9 Readability, stated as a judgement.** Hold each phone at normal reading distance on Scores at
the text scaling 1.1 recorded. Read out the uppercase section heading above the match list, the
"Updated … ago" line, and a match's kick-off time.
**PASS** = all three read without squinting or moving the phone closer. **FAIL** = any of them
does not; say which. (The heading is the smallest type in the view, 10.9 CSS px at the browser
default text size.)

---

## 2. Match-list completeness, filtering and retained state — the higher-severity question

Run the whole of section 2 on **both** phones, and on the S23 Ultra run it in **both** Chrome and the
installed PWA. Before each run, note the date and the number the header reports.

**2.1 The header count must equal the rows.** Scores → **All** status chip → **🏆 All competitions**.
Read the header ("Updated … · **N** matches") and then count the match rows by scrolling the whole
list to the bottom.
**PASS** = the counted rows equal N exactly. **FAIL** = any difference; record N and the count.

**2.2 Narrowing to one competition says so.** Tap the **🏆** chip, choose one competition that has
matches today, and look at the screen without scrolling.
**PASS** = the chip now names that competition (not "All competitions"); the header's count matches
the rows now on screen; and the screen makes clear that the feed is narrowed.
**FAIL** = the chip still says "All competitions", or the header keeps the old larger number.

**2.3 Getting back out, from the Scores tab only.** Still narrowed, and **without leaving Scores**,
tap the **🏆** chip again.
**PASS** = the control opens with a visible **🌍 All competitions** item; tapping it restores the
full list and the chip reads "All competitions" again.
**FAIL** = the control opens empty, or has no "All competitions" item, or you have to visit the
Analysis tab to get back. Record which. (Emulation reproduced all three of those failures on the
unpatched candidate.)

**2.4 Narrowing to a competition with nothing on today.** Tap **🏆**, choose a competition, then move
the date rail to a day that competition has no fixtures on.
**PASS** = the screen says in words that there are no matches for the current filter, and offers a
way to see the whole day. **FAIL** = the list is blank with no explanation while the header still
reports a number of matches. Photograph it.

**2.5 Dates.** Set **All** and **All competitions**. Walk the date rail from six days back to seven
days ahead, one tile at a time, and write down the header count for each day. Walk back to today.
**PASS** = every day's count equals its rows, no day is unexpectedly empty, and today's count on the
way back equals today's count on the way out. **FAIL** = any day's rows and count disagree, or
today's number changed.

**2.6 Tab round trips.** From a complete Scores list, go **Scores → Analysis → Scores**, then
**→ Tips → Scores**, then **→ Favs → Scores**, then **→ More → Scores**.
**PASS** = after every return the list is as complete as it was and the header count is unchanged.
**FAIL** = any row missing after any return; name the tab.

**2.7 Choosing a competition from Search, then going to Scores.** Tap the magnifier, type a
competition name, tap the competition in the results (this lands you on Analysis), then tap
**Scores**.
**PASS** = Scores either shows the whole day, or shows the narrowed list **and** says so with the
chip naming that competition and the header giving both numbers. **FAIL** = Scores shows fewer
matches while the chip reads "All competitions". This is the exact route the Director's symptom
takes; photograph whatever you see.

**2.8 Refresh with state retained.** With the feed narrowed as in 2.7, pull to refresh or reload the
page (Chrome: ⋮ → reload; PWA: swipe down).
**PASS** = you come back to Scores and either see the whole day, or see the narrowed list with the
chip naming the competition and a way to clear it. **FAIL** = a short list with the chip claiming
"All competitions".

**2.9 Force-quit and reopen.** Swipe the app away from the recents list, reopen it.
**PASS** = Scores opens on today with the whole day's matches, or with the filter plainly stated.
**FAIL** = otherwise.

**2.10 A genuinely new browser session.** Chrome → ⋮ → **New Incognito tab** → open the app.
**PASS** = Scores shows the whole of today, the chip reads "All competitions", the header count
equals the rows. **FAIL** = anything less.

**2.11 Favourites must not remove rows.** On Scores, star three matches with the ☆. Go **Favs →
⭐ Matches**, confirm all three are listed, switch to **🏆 Leagues & teams** and back, return to
Scores, un-star all three.
**PASS** = the Scores list has exactly the same rows before starring, while starred, after the Favs
round trip and after un-starring; and the three matches appeared under Favs → Matches.
**FAIL** = any row appears or disappears, or a starred match is missing from Favs.

**2.12 Scores and Analysis must agree.** Pick one match that is listed on Scores today. Tap it, read
the heading, the pick and the score line. Go back, go to **Analysis**, find the same match, open it.
**PASS** = same two team names, same competition, same kick-off time, same pick and same
probabilities on both routes. **FAIL** = any disagreement; write both.

**2.13 A played match tells the truth.** Move the date rail back one day and open a finished match
from Scores.
**PASS** = the score shown on the row equals the score on the match page; a match whose 90-minute
score is not available says so in words rather than showing a dash or a blank.
**FAIL** = a dash, a blank, "null", "undefined", or two different scores.

**2.14 Live, if any match is live.** With at least one live match on screen, leave Scores open for
four minutes without touching it.
**PASS** = the "Updated … ago" line stays under about three minutes and the live minute advances; no
row disappears while you watch. **FAIL** = the age climbs past five minutes, or rows vanish.

---

## 3. Installed PWA behaviour

**3.1 Android install.** Chrome → ⋮ → **Add to Home screen / Install app**. Open from the icon.
**PASS** = it opens with no browser address bar; **More → About** reads build 357; the five tabs are
present; the top bar is not under the status bar and the bottom tabs are not under the gesture bar.
**FAIL** = an address bar is visible, any bar overlaps the app, or the build differs.

**3.2 iPhone install.** Safari → Share → **Add to Home Screen**. Open from the icon.
**PASS** = as 3.1. **FAIL** = as 3.1, and record it separately from Android — iOS is a different
engine and nothing in this release has tested it.

**3.3 The PWA and the tab must agree.** With the same account signed in, compare Scores in the
installed PWA and in a browser tab, same date, same filters.
**PASS** = the same matches in the same order and the same header count. **FAIL** = any difference.

**3.4 Update on relaunch.** With the PWA open, deploy no change; close it and reopen it twice.
**PASS** = build 357 both times, no blank screen, no stale "Loading matches…" that never resolves.
**FAIL** = otherwise.

---

## 4. Login

**4.1** From signed out, sign in with the staging test account on the S23 Ultra.
**PASS** = the Account card shows that account; favourites and the record appear; **no other
account's data is visible anywhere**. **FAIL** = otherwise; stop and report immediately.

**4.2** Sign out.
**PASS** = the signed-in account's favourites, record and starred matches are gone from every tab,
and Scores still shows the full public match list. **FAIL** = any personal row survives, or Scores
empties.

**4.3** Sign in as a **second** staging account on the same phone.
**PASS** = only the second account's personal data is present. **FAIL** = any trace of the first.

**4.4** Sign in as the same account on the iPhone while it is signed in on the S23 Ultra.
**PASS** = both devices usable, the same favourites on each after a refresh. **FAIL** = either
device is signed out unexpectedly or shows the other's state.

---

## 5. Offline

**5.1** With the app open on Scores and the list loaded, turn on **aeroplane mode**, then reload.
**PASS** = the app still opens, shows build 357, keeps its five tabs, and either shows the last
known matches **with their age stated** or says plainly that it cannot refresh. **FAIL** = a blank
page, a browser error page, or a screen that claims there are no matches.

**5.2** Still offline, tap through all five tabs and open one match.
**PASS** = nothing crashes; anything unavailable says so. **FAIL** = a blank panel, "null",
"undefined", or a spinner that never ends.

**5.3** Turn aeroplane mode off and wait two minutes on Scores.
**PASS** = the "Updated … ago" figure comes back down on its own and the list repopulates.
**FAIL** = it stays stale until you reload by hand.

**5.4** Repeat 5.1–5.3 on the iPhone in Safari and in the installed iPhone PWA, separately.
**PASS/FAIL** as above, recorded per context.

---

## 6. Navigation

**6.1** Tap each of the five tabs in turn, twice round.
**PASS** = the right view appears each time, the tapped tab is highlighted, and no view keeps the
previous one's content. **FAIL** = otherwise.

**6.2** Open a match from Scores, then use the **Android system back gesture** (and on iPhone, the
back affordance in the app).
**PASS** = you return to Scores at the row you tapped, with the list unchanged.
**FAIL** = you land on another tab, at the top of a changed list, or the app closes.

**6.3** Open **More → Terms of Use**, then come back.
**PASS** = you return to the tab you were on before opening More. **FAIL** = otherwise.

**6.4** Scroll the Scores list halfway down, switch to Analysis, come back.
**PASS** = you return to roughly the same scroll position with the same rows. **FAIL** = otherwise.

---

## 7. Sign-off

| | |
|---|---|
| Operator | |
| Date and time, with time zone | |
| Android handset, Android version, Chrome version, Firefox version | |
| iPhone model, iOS version | |
| Text scaling / font size / display size recorded in 1.1 | |
| Backend used (must be staging) | |
| Items recorded PASS | |
| Items recorded FAIL, with photographs | |
| Items not attempted, and why | |

An item left blank is not a pass. A screenshot from an emulator may not be attached to any item in
this file.
