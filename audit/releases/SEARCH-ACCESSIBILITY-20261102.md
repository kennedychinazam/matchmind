# Search keyboard accessibility correction — Director review

Isolated from the account-ownership correction; baseline `8acf62144c8a5df759ab95c98d813d7de4e171e5`. This patch changes Search markup/focus handling, adds ten offline browser regressions, and enables the existing CI matrix for its branch. It does not change account data, statistical formulas, frozen forecasts, source collection or research/financial controls.

Search now has an accessible dialog/searchbox name, handles Escape, contains Tab/Shift+Tab among current visible controls and dynamic results, and restores a connected legitimate opener on close. Background siblings retain their prior inert states; pending autofocus is cancelled and guarded against closing/reopening. Search results gain button semantics and Enter/Space activation through their existing click handlers. Layout, search matching/order and result actions are preserved.

Failing-first evidence: ten expected assertion failures at the baseline. Focused green: ten passes. Independent full Node20.20.2 and Node24.19.0 suites each passed81/81 (the original71 plus10), zero failures/skips/cancellations; source/test hashes were unchanged during testing. Exact final-commit GitHub CI belongs to the draft PR Checks. All browser data is synthetic, non-document requests are blocked and service workers disabled; this does not establish real Android/iOS/Safari/PWA/screen-reader acceptance. Independent review and detailed evidence are delivered privately to the Director.

Keep this PR draft/unmerged. The account-isolation correction is a separate patch; this branch does not contain it. Publication remains NO-GO pending all release gates. No hosted writes, inference, production operation, merge or deployment occurred.

Rollback before deployment: leave the draft unapplied. Any later approved integration rollback must be a separately reviewed revert with full CI and appropriate cache/version handling, never deletion or rewriting of forecasts or user data.
