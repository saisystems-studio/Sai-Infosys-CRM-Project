# Inquiry Task Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a read-only administrative Schedule detail view and an assigned-resource workflow for recording multiple server-timed inquiry progress sessions.

**Architecture:** Store each work session in a dedicated `InquiryTaskProgress` row and keep write rules in a transactional service module used by DRF detail actions. Keep Schedule list ownership in `Schedule.jsx`; render a focused `ScheduleDetail` child for inquiry data, history, and assigned-resource controls.

**Tech Stack:** Django 5, Django REST Framework, SQL Server, React 19, Axios, Vite, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-27-inquiry-task-progress-design.md`

## Global Constraints

- Backend date and timestamps are authoritative; clients cannot send work date, start time, end time, resource, or creator.
- Work date is derived in the `Asia/Kolkata` business timezone; stored timestamps remain timezone-aware.
- One resource may have only one active session across all inquiries.
- Multiple completed sessions on the same inquiry and date are allowed.
- Admin and super-admin users have read-only task access.
- Only the inquiry's assigned active resource may start or save progress.
- Ordinary saves leave the inquiry In Progress; Payment Pending saves change its master status.
- Existing Schedule list API behavior remains compatible.
- No new frontend or backend dependency is required.
- This workspace has no Git repository; use the stated review checkpoints in place of commit steps.

---

### Task 1: Task Progress Persistence

**Files:**
- Modify: `backend/Inquiry/models.py`
- Create: `backend/Inquiry/migrations/0003_inquirytaskprogress.py`
- Create: `backend/Inquiry/test_task_progress_model.py`

**Interfaces:**
- Produces: `InquiryTaskProgress`, `TaskStatus`, and the `InquiryDetails_tbl.task_progress` reverse relation.
- Consumes: existing `InquiryDetails_tbl`, `StaffDetails`, and Django `User` models.

- [ ] **Step 1: Write the failing model tests**

Create tests that build real user, staff, customer, status, and inquiry fixtures, then assert multiple completed rows can share a work date while a second row with `End_Time=None` for the same resource raises `IntegrityError`.

```python
class InquiryTaskProgressModelTests(TestCase):
    def test_resource_cannot_have_two_active_sessions(self):
        InquiryTaskProgress.objects.create(
            Inquiry_Id=self.inquiry,
            Resource_Id=self.staff,
            Work_Date=date(2026, 8, 27),
            Start_Time=timezone.now(),
            Task_Status=TaskStatus.ACTIVE,
            Created_By=self.user,
        )
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                InquiryTaskProgress.objects.create(
                    Inquiry_Id=self.other_inquiry,
                    Resource_Id=self.staff,
                    Work_Date=date(2026, 8, 27),
                    Start_Time=timezone.now(),
                    Task_Status=TaskStatus.ACTIVE,
                    Created_By=self.user,
                )

    def test_resource_can_save_multiple_completed_sessions_on_one_day(self):
        for hour in (9, 11):
            InquiryTaskProgress.objects.create(
                Inquiry_Id=self.inquiry,
                Resource_Id=self.staff,
                Work_Date=date(2026, 8, 27),
                Start_Time=timezone.make_aware(datetime(2026, 8, 27, hour)),
                End_Time=timezone.make_aware(datetime(2026, 8, 27, hour + 1)),
                Progress_Notes=f"Session {hour}",
                Task_Status=TaskStatus.PROGRESS_SAVED,
                Created_By=self.user,
            )
        self.assertEqual(self.inquiry.task_progress.count(), 2)
```

- [ ] **Step 2: Run the model tests and verify RED**

Run: `backend\venv\Scripts\python.exe backend\manage.py test Inquiry.test_task_progress_model`

Expected: import failure because `InquiryTaskProgress` and `TaskStatus` do not exist.

- [ ] **Step 3: Implement the model**

Add a text-choice enum and model:

```python
class TaskStatus(models.TextChoices):
    ACTIVE = "active", "Active"
    PROGRESS_SAVED = "progress_saved", "Progress Saved"
    PAYMENT_PENDING = "payment_pending", "Payment Pending"


class InquiryTaskProgress(models.Model):
    Inquiry_Id = models.ForeignKey(
        InquiryDetails_tbl, on_delete=models.CASCADE,
        related_name="task_progress", db_column="Inquiry_Id",
    )
    Resource_Id = models.ForeignKey(
        StaffDetails, on_delete=models.PROTECT,
        related_name="task_progress", db_column="Resource_Id",
    )
    Work_Date = models.DateField(db_column="Work_Date")
    Start_Time = models.DateTimeField(db_column="Start_Time")
    End_Time = models.DateTimeField(null=True, blank=True, db_column="End_Time")
    Progress_Notes = models.TextField(blank=True, db_column="Progress_Notes")
    Task_Status = models.CharField(
        max_length=24, choices=TaskStatus.choices,
        default=TaskStatus.ACTIVE, db_column="Task_Status",
    )
    Created_By = models.ForeignKey(
        User, on_delete=models.PROTECT, db_column="Created_By",
    )
    Created_On = models.DateTimeField(auto_now_add=True, db_column="Created_On")
    Updated_On = models.DateTimeField(auto_now=True, db_column="Updated_On")

    class Meta:
        db_table = "InquiryTaskProgress_tbl"
        ordering = ("-Start_Time",)
        constraints = [
            models.UniqueConstraint(
                fields=("Resource_Id",),
                condition=models.Q(End_Time__isnull=True),
                name="unique_active_task_per_resource",
            ),
        ]
```

Generate the migration with `backend\venv\Scripts\python.exe backend\manage.py makemigrations Inquiry`. Inspect it to confirm it creates the table and filtered unique constraint without altering existing inquiry columns.

- [ ] **Step 4: Run persistence verification**

Run:

```powershell
backend\venv\Scripts\python.exe backend\manage.py test Inquiry.test_task_progress_model
backend\venv\Scripts\python.exe backend\manage.py makemigrations --check
backend\venv\Scripts\python.exe backend\manage.py check
```

Expected: model tests pass, no missing migration, and no Django system-check errors. Review checkpoint: inspect `models.py`, migration SQL shape, and test isolation before Task 2.

---

### Task 2: Task Authorization And Transactional Service

**Files:**
- Create: `backend/Inquiry/task_progress.py`
- Create: `backend/Inquiry/test_task_progress_service.py`
- Modify: `backend/Inquiry/serializers.py`

**Interfaces:**
- Produces: `get_task_actor(user)`, `can_read_inquiry_task(user, inquiry)`, `can_update_inquiry_task(user, inquiry)`, `start_inquiry_task(*, inquiry, user)`, and `save_inquiry_progress(*, inquiry, user, progress_notes, outcome)`.
- Consumes: `InquiryTaskProgress`, `TaskStatus`, `StaffDetails`, `StatusTypeMaster`, `staff.access.has_full_access`, and `timezone`.

- [ ] **Step 1: Write failing service tests**

Use real database fixtures and `unittest.mock.patch("Inquiry.task_progress.timezone.now")` so expected timestamps are literals. Cover assigned-resource success, admin rejection, other-resource rejection, missing status master, a second active session on another inquiry, required notes, save without an active row, ordinary save, and Payment Pending save.

```python
@patch("Inquiry.task_progress.timezone.now")
def test_start_uses_server_time_and_sets_inquiry_in_progress(self, now):
    now.return_value = self.started_at
    row = start_inquiry_task(inquiry=self.inquiry, user=self.staff_user)
    self.assertEqual(row.Start_Time, self.started_at)
    self.assertEqual(row.Work_Date, timezone.localdate(self.started_at))
    self.inquiry.refresh_from_db()
    self.assertEqual(self.inquiry.Status_Id, self.in_progress_status)

@patch("Inquiry.task_progress.timezone.now")
def test_payment_pending_save_ends_row_and_changes_inquiry_status(self, now):
    row = self.create_active_row()
    now.return_value = self.ended_at
    saved = save_inquiry_progress(
        inquiry=self.inquiry,
        user=self.staff_user,
        progress_notes="Installation completed and handed over.",
        outcome=TaskStatus.PAYMENT_PENDING,
    )
    self.assertEqual(saved.pk, row.pk)
    self.assertEqual(saved.End_Time, self.ended_at)
    self.assertEqual(saved.Task_Status, TaskStatus.PAYMENT_PENDING)
    self.inquiry.refresh_from_db()
    self.assertEqual(self.inquiry.Status_Id, self.payment_pending_status)
```

- [ ] **Step 2: Run service tests and verify RED**

Run: `backend\venv\Scripts\python.exe backend\manage.py test Inquiry.test_task_progress_service`

Expected: import failure for the missing service functions.

- [ ] **Step 3: Implement authorization helpers and transactional writes**

Implement `get_task_actor` using `get_staff` and `has_full_access`. `can_read_inquiry_task` returns true for full-access users or the assigned resource; `can_update_inquiry_task` returns true only for the assigned active resource. Raise `rest_framework.exceptions.PermissionDenied` for admins and non-assigned staff on writes. Resolve status masters using case-insensitive exact names; raise `serializers.ValidationError({"status": "The In Progress status is not configured."})` or the Payment Pending equivalent.

Use `@transaction.atomic` and lock relevant records:

```python
def _status_named(name):
    status = StatusTypeMaster.objects.filter(status_type_name__iexact=name).first()
    if not status:
        raise serializers.ValidationError(
            {"status": f"The {name} status is not configured."}
        )
    return status


@transaction.atomic
def start_inquiry_task(*, inquiry, user):
    staff = _require_assigned_resource(user, inquiry)
    locked_staff = StaffDetails.objects.select_for_update().get(pk=staff.pk)
    if InquiryTaskProgress.objects.filter(
        Resource_Id=locked_staff, End_Time__isnull=True,
    ).exists():
        raise serializers.ValidationError(
            {"task": "Finish the active task before starting another one."}
        )
    started_at = timezone.now()
    row = InquiryTaskProgress.objects.create(
        Inquiry_Id=inquiry, Resource_Id=locked_staff,
        Work_Date=timezone.localdate(started_at, ZoneInfo("Asia/Kolkata")),
        Task_Status=TaskStatus.ACTIVE, Created_By=user,
    )
    inquiry.Status_Id = _status_named("In Progress")
    inquiry.save(update_fields=("Status_Id",))
    return row
```

`save_inquiry_progress` must trim notes, reject blank text, lock and fetch the active row for both authenticated resource and selected inquiry, accept only `progress_saved` or `payment_pending`, set backend `End_Time`, and update the inquiry only for Payment Pending.

- [ ] **Step 4: Run service verification**

Run: `backend\venv\Scripts\python.exe backend\manage.py test Inquiry.test_task_progress_service Inquiry.test_task_progress_model`

Expected: all service and persistence tests pass. Review checkpoint: verify every write path is atomic and no client-controlled timestamp enters a service signature.

---

### Task 3: Read-Only Task Detail API

**Files:**
- Modify: `backend/Inquiry/serializers.py`
- Modify: `backend/Inquiry/views.py`
- Create: `backend/Inquiry/test_task_detail_api.py`

**Interfaces:**
- Produces: `InquiryTaskProgressSerializer`, `InquiryTaskDetailSerializer`, and `GET /api/inquiries/{id}/task-detail/`.
- Consumes: `can_update_inquiry_task(user, inquiry)` and the `task_progress` relation.

- [ ] **Step 1: Write failing API tests**

Authenticate with DRF `APIClient`. Assert admin receives 200 with all rows and `can_update_task=False`; assigned staff receives 200 with `can_update_task=True`; other staff receives 403; and progress history IDs are newest first.

```python
def test_admin_reads_history_but_cannot_update(self):
    self.client.force_authenticate(self.admin_user)
    response = self.client.get(f"/api/inquiries/{self.inquiry.pk}/task-detail/")
    self.assertEqual(response.status_code, 200)
    self.assertFalse(response.data["can_update_task"])
    self.assertEqual(
        [row["id"] for row in response.data["task_progress"]],
        [self.newer.pk, self.older.pk],
    )
```

- [ ] **Step 2: Run the read API tests and verify RED**

Run: `backend\venv\Scripts\python.exe backend\manage.py test Inquiry.test_task_detail_api`

Expected: 404 because the viewset action is not registered.

- [ ] **Step 3: Implement serializers and detail action**

`InquiryTaskProgressSerializer` exposes read-only `id`, `work_date`, `start_time`, `end_time`, `progress_notes`, `task_status`, `task_status_label`, `resource_id`, and `resource_name`. `InquiryTaskDetailSerializer` extends the existing inquiry representation with `task_progress`, `active_session`, and `can_update_task`.

Add `Resource_Id` to `select_related` and `task_progress__Resource_Id` to prefetching. Add the action:

```python
@action(detail=True, methods=("get",), url_path="task-detail")
def task_detail(self, request, pk=None):
    inquiry = self.get_object()
    if not can_read_inquiry_task(request.user, inquiry):
        raise PermissionDenied("This inquiry is not assigned to you.")
    return Response(InquiryTaskDetailSerializer(
        inquiry, context={"request": request},
    ).data)
```

- [ ] **Step 4: Run read API verification**

Run: `backend\venv\Scripts\python.exe backend\manage.py test Inquiry.test_task_detail_api`

Expected: all read/permission/history-order tests pass. Review checkpoint: confirm admin response is read-only by contract and other staff cannot infer unassigned inquiry details.

---

### Task 4: Start And Save API Actions

**Files:**
- Modify: `backend/Inquiry/serializers.py`
- Modify: `backend/Inquiry/views.py`
- Create: `backend/Inquiry/test_task_write_api.py`

**Interfaces:**
- Produces: `TaskProgressSaveSerializer`, `POST /api/inquiries/{id}/start-task/`, and `POST /api/inquiries/{id}/save-progress/`.
- Consumes: Task 2 service functions and Task 3 progress serializer.

- [ ] **Step 1: Write failing endpoint tests**

Assert assigned staff can start with an empty JSON object, start response timestamps match the stored row, and save accepts only:

```json
{
  "progress_notes": "Configured the customer environment.",
  "outcome": "progress_saved"
}
```

Test `payment_pending`, missing notes, invalid outcome, no active row, admin POST, unassigned staff POST, and a second active task conflict. Assert invalid responses leave row and inquiry state unchanged.

- [ ] **Step 2: Run endpoint tests and verify RED**

Run: `backend\venv\Scripts\python.exe backend\manage.py test Inquiry.test_task_write_api`

Expected: 404 for both missing actions.

- [ ] **Step 3: Implement input serializer and actions**

```python
class TaskProgressSaveSerializer(serializers.Serializer):
    progress_notes = serializers.CharField(trim_whitespace=True, allow_blank=False)
    outcome = serializers.ChoiceField(choices=(
        TaskStatus.PROGRESS_SAVED,
        TaskStatus.PAYMENT_PENDING,
    ))


@action(detail=True, methods=("post",), url_path="start-task")
def start_task(self, request, pk=None):
    row = start_inquiry_task(inquiry=self.get_object(), user=request.user)
    return Response(InquiryTaskProgressSerializer(row).data, status=201)


@action(detail=True, methods=("post",), url_path="save-progress")
def save_progress(self, request, pk=None):
    serializer = TaskProgressSaveSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    row = save_inquiry_progress(
        inquiry=self.get_object(), user=request.user,
        **serializer.validated_data,
    )
    return Response(InquiryTaskProgressSerializer(row).data)
```

- [ ] **Step 4: Run complete backend feature verification**

Run:

```powershell
backend\venv\Scripts\python.exe backend\manage.py test Inquiry.test_task_progress_model Inquiry.test_task_progress_service Inquiry.test_task_detail_api Inquiry.test_task_write_api
backend\venv\Scripts\python.exe backend\manage.py check
```

Expected: all new backend tests pass and system checks are clean. Review checkpoint: manually compare response field names with the frontend contract in Task 5.

---

### Task 5: Frontend Task Detail State Contract

**Files:**
- Create: `frontend/src/pages/Schedule/scheduleTaskState.js`
- Create: `frontend/src/pages/Schedule/scheduleTaskState.test.js`

**Interfaces:**
- Produces: `mapTaskDetail(response)`, `buildProgressPayload(notes, outcome)`, `formatTaskDuration(startTime, endTime)`, and `canRenderTaskControls(detail)`.
- Consumes: Task 3 JSON fields and Task 4 outcome values.

- [ ] **Step 1: Write failing pure behavior tests**

Use complete literal API fixtures. Assert mapping preserves products/history, selects the active row, admins cannot render controls, assigned staff can, payload text is trimmed, and completed duration is formatted while active duration returns `Running`.

```javascript
test("builds the save-progress payload from resource input", () => {
  assert.deepEqual(
    buildProgressPayload("  Installed release  ", "payment_pending"),
    { progress_notes: "Installed release", outcome: "payment_pending" },
  );
});

test("duration distinguishes active and completed sessions", () => {
  assert.equal(formatTaskDuration("2026-08-27T09:00:00Z", null), "Running");
  assert.equal(
    formatTaskDuration("2026-08-27T09:00:00Z", "2026-08-27T10:35:00Z"),
    "1h 35m",
  );
});
```

- [ ] **Step 2: Run state tests and verify RED**

Run: `npm.cmd test -- --test-name-pattern="task detail|save-progress payload|duration"` from `frontend`.

Expected: module-not-found failure for `scheduleTaskState.js`.

- [ ] **Step 3: Implement minimal pure helpers**

Implement explicit null handling and use `Math.max(0, end - start)` for duration. `canRenderTaskControls` returns true only when `canUpdateTask === true`; it must not infer permission from the locally cached role.

- [ ] **Step 4: Run frontend helper verification**

Run: `npm.cmd test -- --test-name-pattern="task detail|save-progress payload|duration"` from `frontend`.

Expected: all new helper tests pass. Review checkpoint: compare casing and status values with backend serializer output.

---

### Task 6: Schedule Detail View

**Files:**
- Create: `frontend/src/pages/Schedule/ScheduleDetail.jsx`
- Create: `frontend/src/pages/Schedule/ScheduleDetail.css`
- Modify: `frontend/src/pages/Schedule/Schedule.jsx`

**Interfaces:**
- Produces: `ScheduleDetail({ inquiryId, onBack, onProgressSaved })`.
- Consumes: `GET task-detail`, `POST start-task`, `POST save-progress`, shared authentication token, and Task 5 helpers.

- [ ] **Step 1: Add detail selection to Schedule**

Add `selectedInquiryId` state. View Details sets the selected ID. When selected, render:

```jsx
<ScheduleDetail
  inquiryId={selectedInquiryId}
  onBack={() => setSelectedInquiryId(null)}
  onProgressSaved={async () => {
    setSelectedInquiryId(null);
    await fetchSchedule();
  }}
/>
```

Keep the Schedule sidebar state unchanged so Back returns to the already-selected Schedule module.

- [ ] **Step 2: Implement detail loading and read-only sections**

Use Axios with the existing `crm_access_token`. Render scoped `schedule-detail-*` classes for header/back action, customer summary, product table, progress table, loading, empty history, and API error with Retry. Never render a page-level marketing hero or nested cards.

Progress columns are Work Date, Start, End, Duration, Status, and Notes. `formatTaskDuration` supplies Duration. Product columns are Product, Requirement, Quantity, Rate, and Amount.

- [ ] **Step 3: Implement assigned-resource task controls**

When `canRenderTaskControls(detail)` and no active session, render Start Task. Disable it while the POST is pending. On success, replace detail state with a fresh `task-detail` response so the authoritative server timestamp appears.

When active, render its server start time, required textarea, segmented outcome control (`progress_saved` / `payment_pending`), and Save Progress. Keep notes state unchanged on error. On successful save call `onProgressSaved()`.

For `can_update_task=false`, render a quiet read-only label and no write buttons or form fields.

- [ ] **Step 4: Add responsive scoped styling**

Use an unframed page layout with an 8px-or-less radius, compact tables, horizontal overflow for fixed-column tables, stable button sizes, and no generic selectors such as `.card-header`, `.inquiry-card`, `.info-grid`, or `.total-row`. At widths below 700px, stack summary fields and keep tables horizontally scrollable rather than collapsing columns into unreadable labels.

- [ ] **Step 5: Run frontend verification**

Run from `frontend`:

```powershell
npm.cmd test
npx.cmd eslint src/pages/Schedule/Schedule.jsx src/pages/Schedule/ScheduleDetail.jsx src/pages/Schedule/scheduleTaskState.js src/pages/Schedule/scheduleTaskState.test.js
npm.cmd run build
```

Expected: tests, focused lint, and production build pass. Review checkpoint: inspect admin and resource conditional branches and verify every POST error keeps the detail view and notes intact.

---

### Task 7: Migration And End-to-End Verification

**Files:**
- Verify: `backend/Inquiry/migrations/0003_inquirytaskprogress.py`
- Verify: all files from Tasks 1-6

**Interfaces:**
- Produces: deployable schema and verified user workflow.
- Consumes: complete backend and frontend implementation.

- [ ] **Step 1: Run the migration against the configured development database**

Run:

```powershell
backend\venv\Scripts\python.exe backend\manage.py migrate Inquiry
backend\venv\Scripts\python.exe backend\manage.py showmigrations Inquiry
```

Expected: migration is applied and shown with `[X]`. Before running, review generated SQL Server migration operations and confirm the target is the intended development database.

- [ ] **Step 2: Run full automated verification**

Run:

```powershell
backend\venv\Scripts\python.exe backend\manage.py test Inquiry
backend\venv\Scripts\python.exe backend\manage.py check
```

Then from `frontend` run:

```powershell
npm.cmd test
npm.cmd run build
```

Expected: all Inquiry backend tests, all frontend tests, Django checks, and the production build pass. If legacy unrelated Inquiry tests fail, record exact pre-existing failures separately and keep all new focused suites green.

- [ ] **Step 3: Verify the resource workflow manually**

Using an assigned staff account: open Schedule detail, start a task, refresh and confirm Running persists, save Progress Saved with notes, confirm return to Schedule and In Progress status, reopen and start/save a second same-day session, then save a later session as Payment Pending and confirm Schedule status changes.

- [ ] **Step 4: Verify administrative read-only behavior manually**

Using admin and super-admin accounts: open the same detail, confirm all history and duration values are visible, confirm no Start/Save controls exist, and confirm direct POST attempts return 403.

- [ ] **Step 5: Final review checkpoint**

Inspect migration safety, API responses, permissions, transaction boundaries, responsive layout, and the spec requirements line by line. Record test command outputs and any residual environmental limitation in the completion handoff.
