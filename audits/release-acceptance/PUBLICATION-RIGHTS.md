# Publication rights of the public bounded presentation payload

Assessed 8 November 2026 against `claude/staging-s1-s2-20261107`. Source-only review. No provider
was contacted. This is an engineering assessment of what the product actually publishes, written so
a lawyer can act on it. It is not legal advice.

## What the public payload contains, field by field

The bounded display edition is built by `public.matchmind_publish_display_v1()` in
`backend/fixture-delivery/PROPOSAL-up.sql:397-413`. Each card carries exactly these fields, and a
reader cannot ask for others: the projection is fixed in the function, and the raw tables stay
denied (proved by the 10 fence probes and the 95 PostgREST checks in CI).

**Provider-origin facts** (from API-Football, stored in `public.fixtures`):

| Field | What it is |
|---|---|
| `fxid` | the provider's fixture identifier |
| `lid`, `lname`, `lcountry` | competition id, name, country |
| `date`, `time` | scheduled kickoff |
| `status`, `elapsed` | match state |
| `home`, `away` | team names |
| `gh`, `ga`, `ft_h`, `ft_a`, `ht_h`, `ht_a` | scores, full time and half time |
| `updated_at`, `provider` | provenance of the record |

**MatchMind-derived content** (computed by the Build 355 engine, stored in `public.predictions`
and `public.shared_records`):

| Field | What it is |
|---|---|
| `pick`, `final_pick`, `market` | the issued forecast |
| `pick_prob`, `p_home`, `p_draw`, `p_away` | the model's probabilities |
| `xg_home`, `xg_away` | the model's expected goals |
| `made_at`, `withheld_at` | when the forecast was issued or withheld |
| `build` | the engine build that produced it |
| `board`, `records.engine`, `records.clv`, `slips` | derived aggregates |

The split is clean. Every row of the second table is MatchMind's own output. Nothing in it is
provider output: the provider's own prediction endpoint is used elsewhere in the app, under the
user's own key, and is **not** part of this payload.

## Imagery: none is published, and none is rendered anywhere

This is the clearest finding, and it is already enforced in source rather than by policy.

1. **The payload has no imagery field at all.** No `logo`, `flag`, `crest`, `photo`, `image`,
   `badge` or `avatar` appears anywhere in the published projection
   (`PROPOSAL-up.sql:397-404`).
2. **The payload carries no numeric team or competition id** from which an image URL could be
   rebuilt. Team identity in a card is the team *name*.
3. **Presentation leagues are constructed with empty imagery.** `index.html:3022` sets
   `logo:''`, `flag:''` for every league built from a published edition.
4. **A global switch disables third-party branding product-wide**, with a comment recording the
   reasoning rather than leaving it to be rediscovered. `index.html:16954-16957`:

   ```js
   /* Release default: provider correspondence does not clear third-party visual rights.
      This source-only option has no URL/localStorage override. Keep logo metadata for
      numeric team-id model inputs; never pass its cached URLs to a rendering sink. */
   const THIRD_PARTY_BRANDING_ENABLED = false;
   ```

   With it false, `competitionBadge()` returns a plain trophy glyph and `crest()` returns two
   letters of the team's name as text (`index.html:16958-16970`). There is no URL or
   `localStorage` override, so a reader cannot turn it on.
5. **Cached provider logo URLs survive only as model input, never as a rendering sink.**
   `home_logo` is parsed by `teamId()` purely to recover the numeric team id for per-side features
   (`index.html:18724`, reasoning at `18690-18700`). Grep finds no `img src` built from any logo
   variable.
6. **A browser-level test already enforces it.** `test/branding-rights.test.mjs` loads the app in
   Chromium with every non-document request intercepted and asserts that **no third-party image
   request is attempted at all**, while the raw model inputs still survive. It runs in the Node
   20 and 24 CI matrix.

**Conclusion on imagery: MatchMind publishes and renders no third-party club or competition
imagery.** The common rights exposure for a football product does not apply here, and the absence
is testable rather than asserted.

## The question that remains

MatchMind republishes **provider-origin factual data** (fixture identity, kickoff times, team and
competition names, scores) to its own readers inside a bounded, time-expiring edition. Two
properties limit the exposure, and neither removes it:

- The edition is bounded and expires. It is not a bulk feed: the projection covers a window of
  roughly `day-6` to `day+7`, plus whatever fixtures a prediction, the board or a recent slip
  references (`PROPOSAL-up.sql:403-405`), and the raw tables remain denied to every reader.
- Scores and fixture identity are widely available facts rather than creative work.

**The genuine question for the licence, in one sentence:** does the API-Football subscription
permit redistribution of fixture identity, kickoff times, team and competition names, and scores
to MatchMind's own end users through the app, as opposed to internal use only?

That is a licence-terms question, not an engineering one. It should be answered by reading the
current subscription terms. It does **not** need a provider enquiry to answer, and none is
authorized.

### If the terms turn out to restrict redistribution

Options, cheapest first, recorded now so the decision is not reopened from scratch:

1. Attribute the provider visibly on the screens that show its facts. The app already names
   API-Football in its own text in several places.
2. Narrow the published window further. The projection is a single `where` clause.
3. Publish only the derived forecast plus a fixture identifier, and let each installed client fill
   fixture facts with its own credential. This is a real change to the public feed and would undo
   part of the bounded-delivery design, so it is a last resort.

## Facts that bear on timing, and are not launch blockers

The Director has recorded that the API-Football subscription is **active**, and that routine
renewal and the 10 November internal pilot are **not** automatic launch blockers. Nothing in this
assessment reopens either. An internal pilot also does not raise the same redistribution question
as a public launch, because the audience is the operator's own testers.

## Unresolved, for the Director

1. **The licence reading itself.** Whether end-user redistribution of provider factual data is
   permitted. Needs the subscription terms in front of a reader. Engineering cannot settle it.
2. **Anonymous versus signed-in reach.** Whether the bounded edition should be readable by
   anonymous visitors at all, or only by signed-in accounts, is a product and rights decision the
   Director has not yet recorded. The mechanism exists either way.
3. **Whether to add visible provider attribution** to the Scores and Analysis screens as a
   precaution, independent of what the terms say.

No rights clarification request has been drafted or sent. None is needed to answer question 1.
