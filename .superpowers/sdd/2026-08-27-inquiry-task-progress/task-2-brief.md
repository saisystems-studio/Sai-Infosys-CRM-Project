# Task 2: Task Authorization And Transactional Service

Task 1 has produced `InquiryTaskProgress` and `TaskStatus` in `backend/Inquiry/models.py`. Do not implement API actions or frontend work.

## Requirements

- Create `backend/Inquiry/task_progress.py` and `backend/Inquiry/test_task_progress_service.py`.
- Modify `backend/Inquiry/serializers.py` only if a clean shared validation type is genuinely needed; avoid unrelated serializer changes.
- Produce `get_task_actor(user)`, `can_read_inquiry_task(user, inquiry)`, `can_update_inquiry_task(user, inquiry)`, `start_inquiry_task(*, inquiry, user)`, and `save_inquiry_progress(*, inquiry, user, progress_notes, outcome)`.
- Admin/super-admin can read but must receive DRF `PermissionDenied` on start/save. Only the inquiry's assigned active resource can write. Other staff cannot read or write.
- Start and save run in transactions. Start must lock the resource, reject any active row for that resource across inquiries, use `timezone.now()`, derive Work_Date with `ZoneInfo("Asia/Kolkata")`, create Active row, and set inquiry status using case-insensitive exact master name `In Progress`.
- Save trims and requires notes, permits only `TaskStatus.PROGRESS_SAVED` or `TaskStatus.PAYMENT_PENDING`, locks/fetches the authenticated resource's active row for the selected inquiry, sets server End_Time and row status/notes, and updates inquiry to master `Payment Pending` only for that outcome.
- Missing master statuses must produce stable DRF ValidationError and leave no partial writes.
- Convert database concurrency conflicts to stable ValidationError where needed.
- Strict TDD with real database fixtures and frozen backend time. Cover assigned success, admin rejection, other staff rejection, inactive staff, missing status masters, second active task on another inquiry, blank notes, invalid outcome, no active row, ordinary save, Payment Pending save, and atomicity.
- Run focused Task 1+2 tests. No migration against the development database. No subagents or commits.

## Report

Write `.superpowers/sdd/2026-08-27-inquiry-task-progress/task-2-report.md` with files changed, red/green evidence, commands/output summary, self-review, and concerns. Return only status, one-line test summary, and concerns.
