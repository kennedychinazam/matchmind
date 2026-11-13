# Original Build 355 imagery restoration — staging only

Director instruction, 13 November 2026: restore the existing Build 355 crests, competition images and right-hand published-pick badges. No generated logos or replacement initials are introduced.

## Exact existing rights restriction

`audit/releases/FIXTURE-DELIVERY-RIGHTS-20261102.md` states: **“Logos/trademarks/competition branding remain subject to separate rights.”** `audit/releases/RELEASE-FINAL-20261102.md` records that **“Re-enabling imagery needs separately documented rights.”** The supplied provider correspondence supports the stated ordinary application/data uses, but does not by itself clear third-party club/competition imagery. No separately cleared, owned logo bundle was found in the inspected repository. Existing production use is not independent proof of a licence.

This change implements the Director's staging restoration instruction. It does **not** declare the outstanding third-party imagery/public-release rights review closed. No provider contact, new licence purchase or production deployment is performed. The release/master source still defaults `THIRD_PARTY_BRANDING_ENABLED=false`; the explicit preview asset adapter is separate.

## Original assets, not new artwork

Build 355 reads existing `home_logo`, `away_logo` and competition `llogo` mappings and uses `https://media.api-sports.io/football/teams/<id>.png` and `/football/leagues/<id>.png`. The preview reuses those exact stored URLs for the approved staging fixture identities. Normal team images are 20×20px, match-detail images 42×42px and competition images 18×18px, matching the original rendering code. Missing/failed original images are unavailable; they are not replaced with invented marks or initials.

The protected refresh job reads only image URL metadata for fixture IDs already present in the bounded staging Scores/Predictions/History readers. It validates fixture ID, competition ID and both team names, requires complete bounded batches, and permits only the original numeric PNG paths. It does not read accounts, raw provider payloads or entire tables. These are anonymous GETs to existing stored records, not paid provider requests.

The catalog travels through the existing workflow artifact mechanism. The real build requires it and embeds it; browsers do not connect to production. CSP adds the original media host only to image loading, not to `connect-src`. Personal provider controls, auth/Edge/mutation guards, private master separation, publication and settlement logic are unchanged.

No SQL migrations or football payload/schema changes are made. The existing 15-minute workflow schedule and protected writer remain; a changed image catalog also triggers a build so new fixture identities can obtain their actual images without waiting for another source commit. A timestamp-only catalog change does not trigger a rebuild.

Analysis uses Build 355's original inline layout, favourite stars, kickoff column and green-outlined pick badge on the right. EDGE/ranking decorations are omitted at their renderer only; model measures, eligibility and prediction values are not changed. At 320px, names may wrap and only narrowly scoped spacing adjustments apply to prevent overflow. Earlier retained forecasts keep their neutral status rather than acquiring an invented expiry reason or a new recommendation.
