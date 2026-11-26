# MatchMind phone comparison — pending device input

User correction: both phones installed from `https://kennedychinazam.github.io/matchmind/`. Only S20 Ultra reports the storage errors; S23 does not. S20 previously used preview, which the user suspects may contribute. This supersedes the earlier different-URL account. Prior preview use is a hypothesis to investigate, not a confirmed cause or hardware fault.

| Observation | S20 Ultra | S23 | Codex desktop observation |
| - | - | - | - |
| Install URL | Production, confirmed by user | Same production URL, confirmed by user | Production and preview URLs inspected directly |
| Previous preview use | User reports prior preview use | Not reported | Current preview prefixes localStorage/IndexedDB names |
| Browser and version | Chrome installation confirmed; exact version unknown | Chrome installation confirmed; exact version unknown | In-app browser; synthetic acceptance also uses configured Chromium |
| Browser tab or installed home-screen/PWA | User reports installed app; standalone context unmeasured | User reports installed app; standalone context unmeasured | Browser tabs, standalone false |
| Visible app build on device | 368, confirmed by user | 368, confirmed by user | Production 368, preview 358 |
| Installed worker bytes/scope on device | Unknown | Unknown | Matching activated worker paths for each app; no waiting/installing worker |
| Local storage exception and stage | Not directly measured | No reported error; stage unknown | Deterministic injected quota/blocked/corrupt cases are covered in isolated tests |
| Personal favourites/records | Do not clear or export during diagnosis | Do not clear or export during diagnosis | Synthetic data only in tests |

## Safe comparison sequence

1. Both install URLs, Chrome installations and visible Build 368 are confirmed. Do not ask again for those facts. Exact Chrome versions, active worker bytes and device storage state remain unmeasured.
2. Both phones already show 368 under More → About. If further comparison is needed, read whether More shows an account service, without collecting email addresses, passwords, tokens, favourite names or record contents.
3. Compare the public HTML/manifest/worker served at the exact allowed URLs. These hashes identify served assets; they do not prove the active worker bytes already installed on a phone. Record worker scope/controller/update state only within the specific MatchMind context when available.
4. Collect only safe MatchMind-specific diagnostic metadata: exception name, operation stage, schema/migration version, key-category byte counts, local-save success and cloud-read status. Do not list unrelated origin keys, dump credentials or transmit personal contents. Production Build 368 does not yet include the candidate's new diagnostic function.
5. Keep local persistence, cloud synchronization, cached public data and hosted database capacity separate. The shared origin means preview-prefixed keys still share the localStorage quota with production when opened in the same browser/profile. Current preview prefixes prevent direct key-name collisions; they do not create a separate localStorage quota. Historical preview versions and S20 key sizes remain unknown. Different browser profiles/PWA containers, legacy data, installed workers or account/cache history can still explain different behavior at the same URL.
6. Do not clear storage, unregister workers, uninstall the PWA, sign out, force an update or change phone settings during comparison. Preserve unsynced data before any later recovery action.

The public served assets and this chat's worker observations are recorded in `MatchMind-deployment-comparison-v3.json`. Both physical-phone checks remain open.
