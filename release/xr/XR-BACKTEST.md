# XR walk-forward backtest (build 364)

Harness: `xr-run.mjs` loads the live `index.html` in Chromium and runs `xr-page.js` over every finished match in `public.fixtures` (55 collected competitions over 60 months, plus the new ids; national-team seasons 2014 to 2026, youth and women's sides removed). XR ratings are built in date order and each match is priced from the state before it. `today` is the per-competition engine (`footballEngine.predict` with `xcAdjust`), counted only where it prices and both sides are known, which is the live publish rule. Windows: clubs from 2024-07-01, national teams from 2022-01-01. Poisson constants fitted before each window: club a 0.23 b 0.90, national a 0.14 b 0.92.

Strong = first rung at or above 0.75. Lean = first rung from 0.65 below that. Gate: Strong publishes only where XR Strong hit rate is within 2 points of stated probability.

| Segment | model | n | coverage | log loss | Strong n | Strong hit | stated | Lean n | Lean hit | stated |
|---|---|---|---|---|---|---|---|---|---|---|
| Club continental | today | 3359 | 0.88 | 0.9928 | 2026 | 0.774 | 0.805 | 878 | 0.646 | 0.694 |
| Club continental | xr | 3359 | 1 | 0.9814 | 1862 | 0.786 | 0.8 | 1497 | 0.691 | 0.703 |
| NT competitive | today | 2021 | 0.973 | 0.9323 | 1700 | 0.816 | 0.809 | 260 | 0.702 | 0.696 |
| NT competitive | xr | 2021 | 1 | 0.8944 | 2021 | 0.806 | 0.817 | 0 | None | None |
| NT friendlies | today | 1590 | 0.979 | 0.9471 | 1344 | 0.793 | 0.809 | 210 | 0.714 | 0.695 |
| NT friendlies | xr | 1590 | 1 | 0.9771 | 1590 | 0.758 | 0.806 | 0 | None | None |
| UEFA Champions League | today | 722 | 0.916 | 0.9797 | 357 | 0.76 | 0.802 | 282 | 0.644 | 0.691 |
| UEFA Champions League | xr | 722 | 1 | 0.9713 | 432 | 0.756 | 0.802 | 290 | 0.66 | 0.698 |
| UEFA Europa League | today | 692 | 0.873 | 1.0293 | 348 | 0.737 | 0.789 | 244 | 0.607 | 0.695 |
| UEFA Europa League | xr | 692 | 1 | 0.9912 | 378 | 0.792 | 0.8 | 314 | 0.627 | 0.7 |
| UEFA Conference League | today | 1130 | 0.906 | 1.0261 | 675 | 0.753 | 0.795 | 333 | 0.672 | 0.694 |
| UEFA Conference League | xr | 1130 | 1 | 1.0221 | 565 | 0.755 | 0.789 | 565 | 0.704 | 0.705 |
| UEFA Super Cup | today | 3 | 0 | None | 0 | None | None | 0 | None | None |
| UEFA Super Cup | xr | 3 | 1 | 1.0202 | 3 | 0.667 | 0.78 | 0 | None | None |
| FIFA Club World Cup | today | 63 | 0.778 | 0.9894 | 30 | 0.724 | 0.795 | 19 | 0.611 | 0.701 |
| FIFA Club World Cup | xr | 63 | 1 | 0.9449 | 50 | 0.778 | 0.812 | 13 | 0.769 | 0.702 |
| CAF Champions League | today | 391 | 0.844 | 0.8891 | 329 | 0.852 | 0.825 | 1 | 1 | 0.668 |
| CAF Champions League | xr | 391 | 1 | 0.9086 | 241 | 0.837 | 0.814 | 150 | 0.812 | 0.707 |
| CAF Confederation Cup | today | 355 | 0.808 | 0.9472 | 286 | 0.799 | 0.825 | 1 | 1 | 0.654 |
| CAF Confederation Cup | xr | 355 | 1 | 0.9343 | 190 | 0.879 | 0.802 | 165 | 0.703 | 0.707 |
| CAF Super Cup | today | 3 | 0 | None | 0 | None | None | 0 | None | None |
| CAF Super Cup | xr | 3 | 1 | 1.5597 | 3 | 0.5 | 0.821 | 0 | None | None |
| World Cup | today | 168 | 0.911 | 0.9898 | 113 | 0.808 | 0.793 | 39 | 0.737 | 0.695 |
| World Cup | xr | 168 | 1 | 0.9503 | 168 | 0.821 | 0.805 | 0 | None | None |
| Euro Championship | today | 51 | 1 | 1.113 | 32 | 0.708 | 0.79 | 19 | 0.722 | 0.7 |
| Euro Championship | xr | 51 | 1 | 1.0595 | 51 | 0.818 | 0.797 | 0 | None | None |
| Africa Cup of Nations | today | 155 | 1 | 0.9951 | 154 | 0.809 | 0.812 | 1 | 1 | 0.741 |
| Africa Cup of Nations | xr | 155 | 1 | 1 | 155 | 0.818 | 0.798 | 0 | None | None |
| CHAN | today | 73 | 1 | 1.0944 | 71 | 0.81 | 0.799 | 2 | 0.5 | 0.715 |
| CHAN | xr | 73 | 1 | 1.047 | 73 | 0.727 | 0.801 | 0 | None | None |
| WC qualification Europe | today | 212 | 0.995 | 0.7298 | 181 | 0.865 | 0.837 | 28 | 0.667 | 0.695 |
| WC qualification Europe | xr | 212 | 1 | 0.6906 | 212 | 0.806 | 0.851 | 0 | None | None |
| WC qualification Africa | today | 266 | 1 | 0.8175 | 254 | 0.861 | 0.825 | 12 | 0.667 | 0.689 |
| WC qualification Africa | xr | 266 | 1 | 0.8546 | 266 | 0.801 | 0.815 | 0 | None | None |
| Euro qualification | today | 239 | 0.874 | 0.8589 | 154 | 0.852 | 0.806 | 55 | 0.717 | 0.699 |
| Euro qualification | xr | 239 | 1 | 0.7407 | 239 | 0.846 | 0.838 | 0 | None | None |
| AFCON qualification | today | 341 | 0.994 | 0.9675 | 314 | 0.804 | 0.806 | 25 | 0.667 | 0.707 |
| AFCON qualification | xr | 341 | 1 | 0.9299 | 341 | 0.826 | 0.81 | 0 | None | None |
| Nations League | today | 510 | 0.998 | 1.0051 | 425 | 0.776 | 0.796 | 81 | 0.716 | 0.693 |
| Nations League | xr | 510 | 1 | 0.9573 | 510 | 0.776 | 0.811 | 0 | None | None |
| Friendlies | today | 1590 | 0.979 | 0.9471 | 1343 | 0.794 | 0.808 | 211 | 0.71 | 0.695 |
| Friendlies | xr | 1590 | 1 | 0.9771 | 1590 | 0.758 | 0.806 | 0 | None | None |
| WC qualification play-offs | today | 6 | 0 | None | 0 | None | None | 0 | None | None |
| WC qualification play-offs | xr | 6 | 1 | 1.0558 | 6 | 1 | 0.784 | 0 | None | None |

Strong allowed (XR_STRONG_OK): Europa League, World Cup, AFCON, WC qualification Africa, Euro qualification, AFCON qualification. Every other XR competition, and all friendlies, are capped at Lean.
