# Task 1: Task Progress Persistence

Read `docs/superpowers/specs/2026-08-27-inquiry-task-progress-design.md` only if a model detail is ambiguous. Do not implement later tasks.

## Requirements

- Modify `backend/Inquiry/models.py`.
- Create the next correctly numbered migration in `backend/Inquiry/migrations/`.
- Create `backend/Inquiry/test_task_progress_model.py`.
- Add `TaskStatus(models.TextChoices)` with exact stored values: `active`, `progress_saved`, `payment_pending` and labels Active, Progress Saved, Payment Pending.
- Add `InquiryTaskProgress` with inquiry CASCADE FK related name `task_progress`, resource PROTECT FK related name `task_progress`, Work_Date, Start_Time, nullable End_Time, blank Progress_Notes, Task_Status, Created_By PROTECT FK, Created_On, Updated_On.
- Use DB table `InquiryTaskProgress_tbl`, ordering newest Start_Time first, and a conditional unique constraint named `unique_active_task_per_resource` on Resource_Id where End_Time is null.
- Preserve existing inquiry and product fields.
- Tests must prove a resource cannot own two active sessions across inquiries and may own multiple completed same-day sessions.
- Follow strict TDD: tests first, observe correct failure, then implementation.
- Run focused tests, `makemigrations --check`, and Django `check`.
- Do not run `migrate` against the development database; Task 7 owns that mutation.
- No subagents and no commits because this workspace has no Git repository.

## Report

Write `.superpowers/sdd/2026-08-27-inquiry-task-progress/task-1-report.md` with files changed, red/green evidence, commands/output summary, self-review, and concerns. Return only DONE / DONE_WITH_CONCERNS / NEEDS_CONTEXT / BLOCKED plus a one-line test summary.
