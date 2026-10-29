# Provider rights inquiry

**Not sent.** Sending requires separate owner approval. No source change and no
test can substitute for the provider's answer.

## What is already established

Nothing about retention rights. To be precise about the distinction the Director
asked for:

| Established | How |
|---|---|
| An active API-Football subscription exists and has been used by the production collector | Accepted operational state |
| The three pilot fixture IDs are addressable by the documented `/fixtures?ids=` form | Request shape only, never dispatched |
| The internal status vocabulary MatchMind recognizes | Build 355 `index.html:20367`, internal authority only |

| Unanswered, and the subject of this inquiry |
|---|
| Whether exact original HTTP response bodies may be retained privately at all |
| Whether unsuccessful responses may be retained on the same terms as successful ones |
| Who may access retained bodies, specifically an independent reviewer who is not the subscriber |
| For how long retention is permitted |
| What rights and deletion obligations survive subscription expiry |
| Whether internal model evaluation against retained data carries restrictions |
| The authoritative fixture status code list (optional, see the appendix) |

## Ready-to-send text

> Subject: Written confirmation of data retention and internal research rights
>
> Hello,
>
> I hold an active API-Football subscription and use the v3 `/fixtures` endpoint.
> Before retaining any response data for internal research, I would like written
> confirmation on six points. I am asking in advance rather than retrospectively,
> and I have retained nothing beyond what the live application needs.
>
> 1. **Exact bodies.** May I privately retain the exact original HTTP response
>    body of a `/fixtures` request, byte for byte, rather than only a normalized
>    projection of it?
> 2. **Unsuccessful responses.** Do the same terms cover error and non-success
>    responses, including rate-limit and authorization failures, which I would
>    retain as diagnostic evidence?
> 3. **Access.** May an independent technical reviewer who is not the subscriber
>    read retained bodies, solely to audit my own processing, under my control and
>    without redistribution?
> 4. **Duration.** For how long may retained bodies be kept? Is there a maximum,
>    and does it differ for exact bodies versus derived values?
> 5. **After expiry.** If my subscription lapses or is cancelled, what rights
>    survive for already-retained data, and what deletion obligation applies, on
>    what timetable?
> 6. **Internal evaluation.** Are there restrictions on using retained data to
>    evaluate my own statistical models internally, where no prediction, score or
>    derived output is published or redistributed?
>
> To be explicit about intent: this is private internal research and audit. I am
> not redistributing data, not reselling it, not publishing your data, and not
> offering a competing data service.
>
> A short written answer, or a pointer to the clause that governs each point,
> would be enough.
>
> Thank you,
> [name, account identifier]

## Appendix, optional and separable

If the Director wants it, one further question may be appended. It is kept
separate because it is a documentation request rather than a rights question, and
Ken may prefer to send the rights inquiry alone.

> 7. **Fixture status codes.** Is there a published, authoritative list of
>    `fixture.status.short` values and their meanings? The v3 documentation page
>    is not reachable without a session, and I would rather cite your list than
>    infer one from observed traffic.

Context for why this is asked: on 29 October 2026 `www.api-football.com/documentation-v3`
and `api-sports.io/documentation/football/v3` both returned HTTP 403 to an
automated read and `dashboard.api-football.com/documentation` returned 404, so no
authoritative status list could be cited. The adapter therefore quarantines
unrecognized codes instead of guessing, and preserves the raw bytes so an
authoritative list can be applied later without re-acquiring anything.

## Standing position until answered

No real request is made, no body is retained, and the adapter's real transport
stays disabled. A permission answered in the affirmative would still not by
itself authorize a pilot: the access and quota, durable latch, storage location
and execution-authority gates are separate and tracked in
`UNRESOLVED-GATES.md`.
