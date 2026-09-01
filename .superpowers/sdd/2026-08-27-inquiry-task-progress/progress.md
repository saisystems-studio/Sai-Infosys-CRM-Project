# SDD ledger — plan: docs/superpowers/plans/2026-08-27-inquiry-task-progress.md

## Preflight rulings

Ruling: Execute in the shared workspace because no Git repository exists at the root, backend, or frontend — use task-scoped reports, direct file inspection, and fresh test runs in place of worktrees, commits, and Git review packages — cost if wrong: changes are not isolated and must be reviewed carefully against concurrent user edits.

Ruling: Derive `Work_Date` in `Asia/Kolkata` while retaining timezone-aware start/end timestamps — this matches the CRM's operating timezone without changing the project-wide UTC setting — cost if wrong: another deployment timezone would require making the business timezone configurable.

## Interface scan

| Tasks | Producer / consumer | Finding |
|---|---|---|
| 1 | Model produces `InquiryTaskProgress`, `TaskStatus`, reverse relations for Tasks 2-4 | Consistent; Task 1 must preserve existing inquiry schema. |
| 2 | Service consumes Task 1 model and produces auth/read/write functions for Tasks 3-4 | Consistent; use DRF `PermissionDenied`, not serializer namespace. |
| 3 | Read API consumes Task 2 read/update permission helpers and exposes Task 5 JSON | Consistent; exact `snake_case` fields will be mapped in Task 5. |
| 4 | Write API consumes Task 2 services and Task 3 output serializer | Consistent; only notes and outcome are client-controlled. |
| 5 | State helpers consume Tasks 3-4 JSON and produce contracts for Task 6 | Consistent; permission derives only from API `can_update_task`. |
| 6 | Detail UI consumes Task 5 helpers and API endpoints from Tasks 3-4 | Consistent; successful save returns to Schedule and refreshes list. |
| 7 | Verification consumes all prior tasks | Consistent; migration is the only development-database mutation and requires exact target review. |
| 1 self | Tests expect conditional uniqueness and model implements it | Consistent; SQL Server filtered-index support must be confirmed by migration/check evidence. |
| 2 self | Tests freeze server time and service owns timestamps | Consistent. |
| 3 self | Tests require admin read and non-assigned denial | Consistent with spec. |
| 4 self | Tests require transactional error behavior | Consistent with Task 2 service boundary. |
| 5 self | Pure tests cover mapping, payload, permission, and duration | Consistent. |
| 6 self | UI file boundaries and scoped CSS match plan | Consistent. |
| 7 self | Automated and manual verification cover status/session flow | Consistent; browser automation availability may limit manual evidence. |

Task 1: complete (shared-workspace review clean; focused tests 2/2, migration check and Django check passed)

Task 2: fix round 1/5 (2 addressed, 0 open — role-based admin authorization; stable resource-lock errors; focused tests 17/17)
Task 2: complete (shared-workspace scoped re-review clean)

