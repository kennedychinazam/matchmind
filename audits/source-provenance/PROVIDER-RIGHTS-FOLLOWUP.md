# Provider rights follow-up, one question

**Status: not sent.** Submission requires the owner's approval. Work holds the
authenticated dashboard access and can submit it; Claude Code cannot and has not.

Same channel as the answered inquiry: the support chat inside
`dashboard.api-football.com`, signed in. Not a reseller desk, not a similarly
named provider. The reasoning for that route is in
`PROVIDER-RIGHTS-INQUIRY.md`.

## Why one question and not six

The 29 October reply answered everything asked about raw response bodies. It
left exactly one thing open, and that one thing reaches production rather than
the pilot.

Kevin drew the line between **raw API data**, which may not be retained after
the subscription ends, and **derived models, parameters, analyses and outputs**,
which may be, provided they do not reproduce or redistribute the raw data.
MatchMind's production tables and research archives hold normalized,
field-for-field copies of provider values: fixture id, status, kickoff time,
goals, halftime and fulltime scores. Reshaping a field into a column is not
obviously deriving an analysis from it, and a field-for-field copy arguably
reproduces the raw data in the sense that sentence excludes.

A short written answer settles it. Guessing does not, and the answer decides
whether anything in production is affected on 11 November.

## Message to send

> Subject: Follow-up on retention, normalized field-level copies
>
> Hello,
>
> Thank you for the clear answer on 29 October about retaining response bodies.
> One point remains unclear to me and it affects my database rather than my
> stored responses.
>
> You said that continued use or retention of the raw API data after the
> subscription ends is not covered, while derived models, parameters, analyses
> and outputs may be retained as long as they do not reproduce or redistribute
> the raw API data.
>
> My application stores normalized field-level copies of your values in its own
> database tables rather than the original JSON bodies: fixture id, kickoff
> date and time, status, goals, and halftime and fulltime scores, one column per
> field. This is for my own internal use only. I am not redistributing,
> reselling or publishing it, and I do not operate a competing data service.
>
> For the post-subscription rule, do those normalized field-level copies count
> as raw API data that must stop being used and retained, or as derived data I
> may retain?
>
> If they count as raw API data, I would also like to know whether there is any
> permitted alternative, for example retaining only aggregates or model
> parameters computed from them.
>
> A short written answer, or a pointer to the governing clause, would be enough.
>
> Thank you,
> [name, account identifier]

## Recording the answer

Same protocol as before, and it is not optional: record it verbatim in this
repository, with the UTC receipt time, the exact channel and sender as shown,
the wording quoted rather than summarized including any hedge, and which part of
the question it leaves open.

Two interpretation rules carry over. **Silence is not permission**: no answer
grants nothing, and the conservative reading stands. **A pointer to a generic
caching clause is not an answer**: a clause about caching responses to operate
an application does not address whether a normalized copy survives expiry.

## Until it is answered

The question is open and is recorded as open. Nothing is deleted on the strength
of the ambiguity, no production record or historical research archive is touched,
and continuous renewal would make the question moot by never letting the
condition lapse.

Worth asking before 11 November, which is the only reason this is prepared now.
