# Physical device acceptance — operator checklist

For a human with real hardware. **Nothing in this file has been performed.** Emulation cannot
stand in for any of it, and a simulated result must never be recorded here as a physical one.

## The exact release candidate

Test this build and no other.

| | |
|---|---|
| Build | `APP_BUILD = 357`, service worker cache `matchmind-v357` |
| `index.html` | sha256 `a3e27362ac0e19710a8d34734223ab5b71188afaad8189ff1187063dcf5ccc9a` |
| `sw.js` | sha256 `67640f8c46be5635b6efe536f33564ec08530c84e8b79ca5b527c79ee15d430a` |
| Source | branch `claude/staging-s1-s2-20261107`; app files byte-identical to PR #25 head `c63e6e6` |
| Backend | the staging project only, `rdcbnvfnxenrpnnwxszs`. **Never production.** |

Confirm the hashes before starting:

```bash
sha256sum index.html sw.js
```

In the app, **More → About** must read build 357. If it does not, you are not testing the
candidate and nothing below counts.

## Devices required

Two, minimum. Emulation covered neither.

- One **physical Android**, Samsung as the Director specified, Chrome current.
- One **physical iPhone**, **Safari**, current iOS. Chrome on iOS is the same WebKit engine and
  does **not** substitute for Safari for install behaviour.

## What emulation already established, so you do not repeat it

Chromium device emulation, recorded in `test/mobile-pwa-acceptance.test.mjs`, passed on iPhone 14,
iPhone SE, Pixel 7 and iPad Mini: no sideways scroll at any width, every navigation tab at least
44 CSS px, the service worker active and controlling the page, the five-entry offline shell
cached, and an offline reload serving the same document and build. Take those as given and spend
your time on what follows, which emulation cannot reach.

## The checklist

Record for each: PASS, FAIL or BLOCKED, the device and OS version, and a screenshot or short clip
where the result is visual. A FAIL needs the steps to reproduce.

### A. Install and launch

1. **Android, Add to Home Screen.** Open the candidate in Chrome, install it. Does the install
   prompt appear by itself, or only through the browser menu? Record which.
2. Launch from the home-screen icon. Confirm it opens **standalone**, with no browser address bar,
   the correct icon and name, and the dark splash (`background_color` `#070c18`).
3. **iOS Safari, Add to Home Screen.** Share → Add to Home Screen. iOS shows no automatic prompt;
   confirm the manual path works and the icon is the maskable 512px one, not a screenshot.
4. Launch from the iOS icon. Confirm standalone, correct status-bar treatment, and that the app
   does not reopen in Safari.
5. On both, background the app for five minutes, reopen, and confirm it returns to the view you
   left rather than reloading to the top.

### B. Touch, reachable one-handed

6. Tap each of the five navigation tabs ten times at natural speed. Record any mis-tap.
7. Scroll the Analysis feed hard and confirm momentum and no stuck overscroll.
8. Operate the date strip with one thumb. Can you reach the previous and next controls without
   shifting grip? Note the device size.
9. Open a fixture, open and close each accordion, and confirm no control sits under the home
   indicator or a notch.

### C. Offline and network transitions

10. Load the app, then enable airplane mode and reload. The shell must appear with the data it had,
    not a browser error page.
11. Cold start in airplane mode, from the home-screen icon. Record what appears.
12. Begin a read, then disable the network mid-read. Confirm the app says the read failed and does
    **not** present emptiness as "no predictions" or "no result on record". This is the Build 357
    truthfulness fix; it has never run on hardware.
13. Reconnect and confirm it recovers without a manual reload.
14. On a real 3G-grade connection or a throttled mobile network, record time to first usable
    screen.
15. Walk through a captive portal if you can reach one, for example public wifi with a login page.
    Record what the app does.

### D. Notifications

16. Trigger the notification permission prompt. Confirm the real OS dialog appears, on both
    platforms.
17. Grant it, then deliver a push. **The worker's push handler has never run against a real push
    service.** Record whether the notification arrives with the app foregrounded, backgrounded and
    fully closed.
18. Deny it on a second device and confirm the app continues working and does not nag.

### E. Storage pressure

19. Fill the browser store, or use a device that is already near its storage limit, then use the
    app normally. `saveState` writes against roughly a 5 MB quota and its catch block is empty, so
    this is the only place a quota failure surfaces. Record whether anything is silently lost.

### F. Reading it in the hand

20. At 320 px equivalent and at your phone's real width, is the body text comfortable without
    zooming? Is the confidence figure legible at arm's length? This is a judgement only a person
    can make, and it is the reason this section exists.

### G. The two Build 357 corrections, on hardware

21. Open a competition on the public Analysis feed and confirm fixtures are listed. Before the fix,
    ordinary users saw an empty feed. Emulation proved the fix; confirm it on a real device against
    the staging backend.
22. Open a finished match that has no stored forecast. The headline must say no prediction was
    published, with **no confidence percentage**, and the bars must carry their illustrative note.
    Open it twice and confirm the figures do not change between views.

## What to send back

The filled checklist, device and OS versions, screenshots for items 2, 4, 11, 17 and 22, and any
reproduction steps for a FAIL. Anything marked BLOCKED needs a reason.

## This needs an operator

Nothing here can be closed from a cloud session. There is no emulator, headless browser or CI
runner that establishes iOS WebKit install behaviour, a real OS notification prompt, a delivered
push, genuine touch, a real radio, or whether text is comfortable to read. The release is not
complete until a person has done this and reported it.
