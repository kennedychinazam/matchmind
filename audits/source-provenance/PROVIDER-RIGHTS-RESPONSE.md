# Provider rights response

The answer to `PROVIDER-RIGHTS-INQUIRY.md`. Recorded under the preservation rule
written before the answer existed: wording quoted exactly, not summarized.

## Provenance

| | |
|---|---|
| Channel | Smartsupp chat widget on `dashboard.api-football.com`, the authenticated customer dashboard |
| Agent | "Kevin", shown as joining and resolving the conversation |
| Chat timestamp | shown as `12:08 PM` in the transcript. **The transcript states no timezone**, so this is recorded as displayed and not converted |
| Evidence captured | 2026-10-29T13:57:32Z (bundle name), files written 2026-10-29 |
| Counterparty | API-SPORTS direct, consistent with the `x-apisports-key` channel evidenced in the inquiry |
| Terms cited by the agent | `https://api-sports.io/terms` |

The full evidence bundle is held **privately** outside this repository, in the
owner's Codex project directory, as
`provider-rights-response-20261029T135732Z/`. It contains the verbatim text, the
reply DOM, three screenshots, the support transcript and its own `SHA256SUMS.json`.

| private file | sha256 |
|---|---|
| `PROVIDER-REPLY-VERBATIM.txt` | `f2b9fa069aef7305d23d8e700486968207a5c4f928a2a309d7fadd05c5cf9e42` |
| `SUPPORT-TRANSCRIPT.txt` | `2581fa16d04718347f1d4be5533607275f20aa1814d1a1e5b8ca7a795e6856e4` |
| `PROVIDER-REPLY-DOM.html` | `5c65ebde87834d9ca32bf38aff558547cfafa09c5f03f863648582e3e9df52f7` |
| `REPLY-OPENING.jpg` | `790de5ac91a0f26603fc63d401094f2a8b306e9c08dd1221725f651d67e9e486` |
| `REPLY-MIDDLE.jpg` | `73a95be2d060a04e58c2901e093bf0858140f43a9f15d72e63bb89d8b80873ec` |
| `REPLY-END.jpg` | `a9911bf15be8d9eeaeb8d3101fc05308f733ae6a22e4dd57e6af948caccc2a56` |

Screenshots and the full transcript stay private. The operative permission
sentences are quoted below because a retention policy that cites a paraphrase is
not auditable.

## Permissions, quoted exactly

> You may store the exact API response bodies you retrieve for your own internal
> use **while your subscription remains active**.

> The same applies to unsuccessful responses such as API errors, rate-limit
> responses and authorization errors when retained for diagnostic or audit
> purposes.

> Internal reproducibility research is permitted **while the subscription remains
> active**. If an independent external reviewer needs access, this must remain
> **strictly limited to your audit and must not involve redistribution or reuse
> of the raw API data**.

> There is no separate maximum retention period **during an active
> subscription**. Derived results, models and analyses may also be retained.

> **Continued use or retention of the raw API data after the subscription ends is
> not covered by the subscription terms.** Derived models, parameters, analyses
> and outputs may be retained as long as they do not reproduce or redistribute
> the raw API data.

> Internal evaluation of your own prediction models using retained data is
> permitted **while your subscription remains active**.

Emphasis added. The conditional phrase appears four times and is the governing
limit of every permission above.

## Field definitions, quoted exactly

> FT: match finished in regular time.

> AET: match finished after extra time, without a penalty shootout.

> PEN: match finished after a penalty shootout.

> score.fulltime: score at the end of regular time, excluding extra time and
> penalties.

> score.extratime: score after extra time, when applicable.

> score.penalty: penalty shootout score, when applicable.

> So for a fixture with status AET or PEN, score.fulltime represents the score at
> the end of regular time, while the subsequent stages are provided separately.

**This closes the settlement question.** MatchMind's 90-minute regulation rule
reads `score.fulltime` as the regular-time result for AET and PEN fixtures, and
the provider has now confirmed that reading in writing. Until today that rule
rested on Build 355's own code.

Note what this is and is not: it is the provider's description of their fields in
a support chat. It is not a change to the published documentation, which remains
unreachable without a signed-in session.

## What this does not grant

Stated plainly, because the permissions are easy to over-read:

1. **It is not a post-expiry right.** The agent is explicit that retention of raw
   API data after the subscription ends is not covered.
2. **It is not a redistribution right.** Reviewer access must stay strictly
   limited to the audit, with no redistribution or reuse of raw API data.
3. **It is not a publication right.** Internal model evaluation is permitted.
   Publishing derived results is not addressed, and must not be read into it.
4. **It is not an acquisition authorization.** It says what may be retained if
   retrieved. It does not authorize the three-fixture request, which remains
   subject to the owner's own execution gates.
5. **It is not a quota or entitlement statement.** Nothing here speaks to
   access, rate limits or historical entitlement to the three fixture IDs.

## Unresolved: normalized production data after expiry

This is the sharpest open issue and it reaches beyond the pilot.

The permission distinguishes **raw API data**, which may not be retained after
the subscription ends, from **derived models, parameters, analyses and outputs**,
which may be retained provided they do not reproduce the raw data.

MatchMind's production store and its research packets hold **normalized
field-for-field copies** of provider values: `fxid`, `date`, `time`, `status`,
`gh`, `ga`, `ft_h`, `ft_a`, `home`, `away`, `lid` and so on. Reshaping a field
into a column is not obviously the same as deriving a model or an analysis from
it. A field-for-field copy arguably **reproduces** the raw API data in the sense
the agent's sentence excludes.

So the position after 11 November 2026 is genuinely unresolved for:

- the production fixtures store that Build 355 reads and writes;
- the source packets held inside the private research checkpoints, which contain
  93,680 and 93,545 collected rows;
- any derived table whose columns are direct provider values rather than
  computed quantities.

**Nothing is deleted on the strength of this ambiguity.** The Director's
instruction not to delete production records or historical research archives
stands, and this document does not propose deleting them. What it does is record
that the question is open and was not answered.

Resolving it needs one of: continuous subscription renewal, so the condition
never lapses; or a follow-up question to the same support channel asking
specifically whether normalized field-level copies count as raw API data for the
post-expiry rule. The second is cheap and should be asked before 11 November.
