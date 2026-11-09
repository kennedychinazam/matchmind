# Build 358 staging, physical device quick checklist

Use only after the pages.dev URL is verified READY. Staging only. Synthetic data only. Use throwaway
accounts, never a real password. Do not stop any publisher. Edition valid until 2026-11-10 16:01 UTC.
Full lists: `DEVICE-ACCEPTANCE-S23-IPHONE.md` and `OPERATOR-CHECKLIST-ROLLING-EDITION.md`.

Devices: real Samsung S23 Ultra (Chrome, installed PWA, and Firefox) and a real iPhone (Safari, and
the Home Screen app). Write down OS and browser version for each.

1. Open the URL. An orange bar reads STAGING at the top. Tab title starts with STAGING. Pass or fail.
2. Header chip: reads `Live` under 7 hours after 16:01 UTC, and `Updated 7h ago` after 23:01 UTC.
3. Analysis: four QA fixtures show a pick (QA Harbor FC, QA Meadow Town, QA Cedar Park, QA Willow Vale).
   Four show no pick and say so plainly, not "No pick" in a way that blames the app.
4. Scores: nine matches for 8 to 12 November. The older Synthetic matches are reachable with the date picker.
5. History: about 150 cards. Open three. Nothing is regraded.
6. League Table: one general line only. No Championship text.
7. Layout at default text size, then at the largest text size: no clipped bottom navigation, no
   horizontal scroll, header chip on one line. Photograph any fault with the element visible.
   Known fault: bottom nav and nav buttons overflow at 320 px above root font 32 px.
8. Install: Chrome "Install app" or iOS "Add to Home Screen". The installed name is MatchMind STAGING.
9. Offline: open once online, switch to airplane mode, force close, reopen. The shell opens.
   Say what the Analysis screen shows offline.
10. Update: no reload bar appears (cache name matches build 358).
11. Push: do not enable notifications. If a prompt appears, tell us. The preview blocks subscription.
12. Account (optional): sign up with a throwaway email. Sign out. Nothing from production appears.

Record for each item: device, pass or fail, one line on what you saw. Do not paste any key or password.
Firefox Android and iOS Safari have never been verified by anyone. Say so in the results.
