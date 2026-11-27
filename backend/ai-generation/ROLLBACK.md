# MM-05 rollback/maintenance proposal

No hosted execution is authorized by these notes.

If the matched deployment fails, disable new provider generation while preserving validated read-only public data and existing records. Do not automatically publish v17 again: it reopens caller-prompt cache contamination and the quota race, and it cannot coordinate with outstanding new allocations.

Keep the new work, reconciliation, refund and monotonic usage evidence. Do not drop those tables, remove credits, lower counters or clear unknown work to make a rollback appear clean. Stop/drain both old and new provider work and examine the exact failure under a separately approved operator procedure. An absent response does not prove that a provider did no work or charged nothing.

Known-complete cache entries can expire normally. Reserved-before-dispatch recovery is token-fenced and refundable exactly once. Dispatched/uncertain work needs explicit reconciliation; only a new charged attempt may be authorized after cooldown, with the earlier allocation retained. This is not an exactly-once billing guarantee.

A future schema removal or restoration of legacy generation needs its own reviewed migration, usage-preservation mapping, evidence retention and explicit owner authorization. This packet intentionally supplies no destructive one-command down script.
