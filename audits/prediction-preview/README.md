# MatchMind functional prediction comparison preview

An additive, static research interface. The existing app, engine, A3/A4 contracts,
controllers, SQL, financial ledger, halt and historical forecasts are untouched.
There is no provider connection, reservation control, betting control, service
worker, external font/CDN, hosted database access or live source collection.

From the repository root:

```sh
python3 -m http.server 8416 --bind 127.0.0.1 --directory audits/prediction-preview
```

Open `http://127.0.0.1:8416/`. This serves only the preview directory on loopback;
it is not a deployment. The ES modules require HTTP rather than a file:// URL.

## Genuine versus synthetic

The default Santos–Palmeiras example (fixture 1492438, October 28 2026 22:30 UTC)
reproduces the approved retained Build 355 artifact. Home/Draw/Away values remain
full precision: 0.23632970210877488 / 0.2832790536678142 / 0.48039124422341106.
The original engine selection is X2, stored probability 0.764. That selection
keeps the original engine rounding; it is not recalculated from displayed values.
The artifact was generated at 2026-10-28T05:19:00.304Z. Its generation time is
**not** a source receipt: unknown artifact receipt metadata remains null.
The complete-source collection timestamps are labeled separately and do not
establish current freshness. No historical record is changed or backdated.

Santos AI is **UNAVAILABLE**, with null probabilities, generation timestamp and
risk assessment. No model abstention or successful response is inferred from the
closed attempt. The genuine final AI-informed decision also remains unavailable.
The UI preserves the original statistical selection separately.

The fictional Harbour FC–Ridge Athletic example demonstrates available analysis,
pending, unavailable, failed and abstained states. All probabilities, football
statistics, reasoning, risk assessments and decisions are explicitly synthetic.
Pending does not mean a real request is running. Failure is not abstention.
Abstention has null probabilities and an insufficient-evidence risk assessment.
A prominent synthetic notice remains visible for every fictional state.

The synthetic success case displays seeded reasoning with links to its fictional
supporting evidence and an illustrative final decision. This decision is **not**
computed by a validated ranking policy. No averaging, probability adjustment,
value selection, current odds, profitability or predictive-improvement claim is
introduced. The ordinary final-decision policy remains unavailable.

## Presentation contract and boundaries

`model.mjs` validates a narrow, versioned presentation record and derives only
formatted comparison values and percentage-point differences. It rejects extra
fields, invalid probabilities, unsupported references and inconsistent missing
states. It preserves null versus zero and immutable bundled records. It is not
source-authority enrollment, model-response validation, semantic review or
forecast admission. Existing approved infrastructure remains authoritative.

`data.mjs` is a deliberately curated projection: one authorized retained engine
example and one fictional example. No private request body, credential, provider
response, database row inventory, financial record or backup is bundled. The UI
accepts no uploaded/API data and cannot promote an arbitrary record into a
verified forecast. A future genuine AI record would require a separately approved
read-only projection of an admitted immutable response, not a manual availability
flag or this presentation validator alone.

`app.mjs` renders text via DOM textContent and exposes example/state switching,
evidence disclosure and citation navigation. Missing AI values appear as gaps,
never zero probabilities or a fallback engine estimate. CSS uses the existing
MatchMind navy/gold palette with distinct labeled engine/AI series. Layout shifts
from two columns to one; keyboard focus, real labels, live-region updates, reduced
motion and semantic headings/regions support accessible use.

The page enforces connect-src 'none' and has no generation button. Its halt text
reflects the accepted research-preview state; no live runtime query is performed.
This UI cannot clear a halt or reuse an attempt latch.

## Verification

```sh
MM_TEST_CHROMIUM=/usr/bin/chromium node --test \
  audits/test/prediction-preview*.test.mjs audits/test/snapshot-browser.test.mjs
```

The browser regression fulfills only local static assets and aborts every other
request. It tests all states, citation disclosure, genuine/synthetic separation,
320/390/768/1280px widths, no horizontal overflow, no console/runtime errors and
no external requests. The existing browser regression independently proves that
the original app/engine/Smart Bet surface remains byte-for-byte equivalent.
Full Node20/24 CI runs through the unchanged existing audit workflow.

Keep PR #6 draft. No deployment, paid inference or new experiment is authorized.
