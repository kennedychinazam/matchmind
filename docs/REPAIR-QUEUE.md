# Sequential repair queue — 26 November 2026

The user's latest direction is to follow the original handover's hierarchy. One agent owns one job at a time. The primary agent reviews the result and runs appropriate verification before accepting it and starting the next agent. Every completed job report must name the next job. Avoid repeated work or agent loops without new evidence.

The original 29-item order and acceptance requirements remain in ISSUE-REGISTER.md. Later discoveries attach to their owning item; they do not silently reorder the handover. In particular, preview edition-identity finding AUD-08 belongs under MM-03/MM-11 and does not supersede unfinished MM-01 storage work.

| Order | Job | Current gate |
| - | - | - |
| 1 | MM-01 personal storage, legacy migration and sync recovery | Local reconciliation accepted after primary code/visual review and 21/21 final recovery checks; see MM01-RECOVERY-REVIEW.md. Physical S20/S23 checks and controlled legacy cleanup remain open. |
| 2 | MM-02 publisher browser-profile/session containment | Local audit and behavioral tests accepted; primary independently passed 14/14. See MM02-CONTAINMENT-REVIEW.md. Existing hosted caches/sessions remain untouched. |
| 3 | MM-03 preview reader, artifact-bound acceptance and staging | Local identity/harness repair accepted: 219/219 cumulative, 19/19 UI, 8/8 mirror browser/build checks. See MM03-PREVIEW-REVIEW.md. Hosted staging remains open; two local Docker SQL cases now pass. |
| 4 | MM-04 capacity prevention | Read-only evidence and prevention proposal accepted after primary query/arithmetic review. See MM04-CAPACITY-REVIEW.md. Retention implementation, verified billing headroom and archive/restore gates remain open. No cleanup/upgrade ran. |
| 5–29 | Remaining original jobs, in their recorded order | Next is MM-05 AI fixture prompt/cache provenance and atomic quota reservation, after fresh hosted staging acceptance. No later agent has started. |

Local implementation acceptance is separate from physical-phone, hosted and release acceptance. External gates remain explicitly open; a local pass does not mean a fix is deployed. Do not clear personal data during diagnosis. Both phones are already confirmed as Chrome installations from the production URL, visible Build 368; exact Chrome versions and storage exceptions are still unmeasured.

Only the two MatchMind projects are in scope. EDUVANTA must never be accessed. The user subsequently authorized necessary commits, pushes and merges after the initial job is verified fully done. Apply that conditional authorization when its acceptance conditions and the need for the action are established; report the action taken. Deployment and other hosted mutations are not included in that permission. Preserve this chat's completed work and immutable candidate/evidence artifacts.

26 November Docker follow-up: the local desktop-linux context uses the Docker Desktop named pipe. The two synthetic SQL mirror cases passed independently after replacing the test-only hard-coded Unix socket. The selected verification total is 273 across source/UI/PWA 271 and SQL 2; hosted staging/physical gates remain separate.
