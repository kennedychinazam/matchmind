# Provider rights inquiry, submission ready

**Status: not sent.** Submission requires the owner's explicit approval. No
source change and no test can substitute for the provider's written answer.

This supersedes the earlier draft of this file. It is the same inquiry, prepared
for direct submission, with the status and score-field definitions promoted from
an appendix to a first-class request.

## 1. Submission route

**Use the authenticated customer dashboard at `dashboard.api-football.com`, and
its own support or contact function once signed in.**

### Why that is the right counterparty, on local evidence

The rights answer has to come from the party holding the contract. Our own
production code shows which that is:

- `index.html:2596` sets `const AF_BASE = 'https://v3.football.api-sports.io';`
- `index.html:2640` sends `headers:{ 'x-apisports-key': afState.key }`

`x-apisports-key` against `v3.football.api-sports.io` is the **direct API-SPORTS
subscription**. A reseller subscription would use `x-rapidapi-key` against
`api-football-v1.p.rapidapi.com`, and **no `x-rapidapi` header or host appears
anywhere in this repository**. So the counterparty is API-SPORTS directly, and a
reseller's support desk would be the wrong place to ask: their answer would not
govern this contract.

### What could not be confirmed from here, and why

I could not independently verify a specific support email address or ticket URL.
On 29 October 2026:

- `www.api-football.com` returned a bot-protection interstitial
  ("Performing security verification") in the browser. I did not attempt to
  clear it.
- `www.api-football.com/documentation-v3` and
  `api-sports.io/documentation/football/v3` returned HTTP 403 to an automated
  read; `dashboard.api-football.com/documentation` returned 404.
- A public search returned no official API-Football support contact, only other
  providers.

**I am not inventing a support address.** The dashboard route above is the one
the owner already has access to, and the in-dashboard contact function reaches
the correct desk by construction.

### Do not confuse with

These appeared in searches or are commonly mistaken for this provider. None of
them governs this subscription:

| Not this provider | What it is |
|---|---|
| `football-data.org` | A different football data provider |
| `apifootball.com` | A different product with a similar name |
| Sportmonks (`docs.sportmonks.com`) | A different provider; its fixture "states" list is not ours |
| Enetpulse, TheStatsAPI | Different providers |
| `api-football-v1.p.rapidapi.com` | The same API resold through RapidAPI; support and terms there are RapidAPI's, and we are not on that channel |

## 2. Session availability

**No authenticated official support session exists in this environment.** Claude
Code Local holds no API-Football account session, and I have not requested and
will not request account credentials. Therefore, per the Director's instruction,
what follows is an exact ready-to-send message for the owner's own authenticated
browser session.

Nothing has been submitted. If the owner approves submission and sends it, the
response must be preserved under section 4.

## 3. Exact message to send

> Subject: Written confirmation of response retention and internal research rights
>
> Hello,
>
> I am a direct API-SPORTS subscriber using the football v3 API at
> `v3.football.api-sports.io` with an `x-apisports-key`. Before I retain any
> response data for internal research, I would like written confirmation on six
> points. I am asking in advance rather than retrospectively.
>
> To be explicit about intent: this is private internal research and audit on a
> very small scale. I am not redistributing your data, not reselling it, not
> publishing it, and not operating a competing data service.
>
> 1. **Private storage of exact bodies.** May I privately store the exact
>    original HTTP response body of a `/fixtures` request, byte for byte,
>    rather than only a normalized subset of the fields?
>
> 2. **Unsuccessful responses.** Does the same permission cover unsuccessful
>    responses, including error, rate-limit and authorization failures, which I
>    would retain as diagnostic evidence of what happened?
>
> 3. **Internal reproducibility research and reviewer access.** May I use
>    retained bodies for internal reproducibility research, and may an
>    independent technical reviewer who is not the subscriber read them, solely
>    to audit my own processing, under my control and without redistribution?
>
> 4. **Maximum retention period.** How long may retained bodies be kept? Is
>    there a maximum, and does it differ between exact bodies and values derived
>    from them?
>
> 5. **After subscription expiry.** If my subscription lapses or is cancelled,
>    what retention rights survive for data already retained, and what deletion
>    obligation applies, on what timetable?
>
> 6. **Internal model evaluation.** Is internal evaluation of my own
>    football-prediction models against retained data permitted, where no
>    prediction, score or derived output is published, sold or redistributed?
>
> I also have one documentation question, because the v3 documentation page is
> not reachable without a signed-in session:
>
> 7. **Official status and score definitions.** Please point me to, or state,
>    the official definitions of the `fixture.status.short` values **FT**,
>    **AET** and **PEN**, and of the `score.fulltime`, `score.extratime` and
>    `score.penalty` objects. Specifically: does `score.fulltime` always
>    represent the score at the end of 90 minutes of regulation play, excluding
>    extra time and penalties, for a fixture whose status is AET or PEN? I would
>    rather cite your definition than infer one from observed responses.
>
> A short written answer, or a pointer to the clause or documentation section
> governing each point, would be enough.
>
> Thank you,
> [name, account identifier]

## 4. Preserving the response

If a response arrives, record it verbatim and unparaphrased in this repository
as `PROVIDER-RIGHTS-RESPONSE.md`, with:

- the **date and time received**, in UTC;
- the **exact channel** it came through (dashboard ticket, email address, chat),
  and the sender identity as shown;
- the **wording quoted exactly**, not summarized, including any hedge or
  conditional;
- which of the seven questions it answers and which it leaves open.

Two rules on interpretation:

- **Silence is not permission.** No answer, or no answer within any period,
  grants nothing.
- **Generic application-caching guidance is not research-retention permission.**
  Terms allowing a client to cache responses to serve an application are about
  operating the application. They do not by themselves authorize indefinite
  retention of exact bodies for research, nor third-party reviewer access. If
  the answer only points at a caching clause, questions 1 to 6 remain open and
  must be recorded as such.

## 5. Conditional GO / NO-GO for a single-batch three-fixture pilot

Scope under consideration, and nothing wider: **one** batch, fixture IDs
**788036, 788048, 788038**, one `/fixtures?ids=` request, at most one separately
capped `/status` metadata request, no retry, no redirect, no fallback.

**Every row must be GO. Any single NO-GO is a stop.** This matrix authorizes
nothing by itself; it is the checklist the owner applies after the provider
answers.

| # | Condition | GO requires | NO-GO if |
|---|---|---|---|
| 1 | Exact-body retention | Written yes to question 1 | No answer, a no, or only a caching clause |
| 2 | Error-body retention | Written yes to question 2 | Unanswered or restricted to successful responses |
| 3 | Reviewer access | Written yes to question 3 | Subscriber-only access, or unanswered |
| 4 | Retention period | A stated maximum the research can live within | No stated period, or shorter than the evaluation needs |
| 5 | Post-expiry obligation | A stated obligation that can actually be honoured | Unstated, or requires deletion we cannot verify |
| 6 | Model evaluation | Written yes to question 6 | Unanswered or prohibited |
| 7 | Status and score semantics | Official definitions received, or the pilot's conclusions explicitly do not depend on them | Definitions absent **and** conclusions would depend on them |
| 8 | Access and quota | Current entitlement and separate daily and per-minute headroom confirmed from the dashboard | Inferred from a response header rather than confirmed |
| 9 | Approved storage location | Owner names the location, administrator and encryption posture | Undecided |
| 10 | Retention schedule in place | Duration per evidence class, deletion procedure, named verifier | Cannot be set, because it depends on rows 4 and 5 |
| 11 | Execution authority | Separately reviewed real transport binding, execution window, approved credential and network boundary, explicit owner permission | Any part missing |
| 12 | Durable latch provisioned | A latch directory created at the approved location, with its one fixture and one metadata attempt unconsumed | Not created, or already consumed |

Rows 1 to 7 are the provider's to answer. Rows 8 to 12 are the owner's
decisions. **Row 1 gates everything**: if exact-body retention is refused, rows
2 to 12 are moot and the pilot does not happen in this form.

## 6. Standing position

No real request is made, no body is retained, the adapter's real transport stays
disabled and the durable latch grants no authority. A permissive answer closes
one external gate; it does not by itself authorize a pilot.
