# Task 3: Read-Only Task Detail API

Tasks 1-2 are complete. Consume `can_read_inquiry_task` and `can_update_inquiry_task` from `backend/Inquiry/task_progress.py`. Do not implement start/save actions yet.

## Requirements

- Modify `backend/Inquiry/serializers.py` and `backend/Inquiry/views.py`.
- Create `backend/Inquiry/test_task_detail_api.py`.
- Add read-only `InquiryTaskProgressSerializer` with snake_case fields: id, work_date, start_time, end_time, progress_notes, task_status, task_status_label, resource_id, resource_name.
- Add an inquiry task-detail representation containing the existing complete inquiry detail/list fields plus `task_progress` newest-first, `active_session`, and `can_update_task`.
- Add `GET /api/inquiries/{id}/task-detail/` as a detail action.
- Admin/Super Admin roles can read every inquiry with `can_update_task=false`. Assigned staff can read with `can_update_task=true`. Other staff receive 403.
- Add `Resource_Id` to select_related and efficiently prefetch `task_progress__Resource_Id`; avoid N+1 queries from the new representation.
- Use existing DRF auth/menu patterns without weakening permissions.
- Strict TDD with APIClient and real DB fixtures. Cover admin read-only, assigned resource, other staff denial, active session representation, empty history, and newest-first order.
- Run focused Task 1-3 tests and Django check. No development DB migration, frontend work, subagents, or commits.

## Report

Write `.superpowers/sdd/2026-08-27-inquiry-task-progress/task-3-report.md` with files changed, red/green evidence, commands/output summary, self-review, and concerns. Return only status, test summary, concerns.
