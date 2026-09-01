# Task 2 Report: Task Authorization And Transactional Service

## Files Changed

- `backend/Inquiry/task_progress.py`
  - Added task actor/access helpers and atomic start/save operations.
  - Starts lock the active staff resource, enforce one active task across inquiries,
    use server time and Kolkata work dates, and assign the `In Progress` master status.
  - Saves lock the actor's active task row, validate/trim notes and outcomes, record
    server end time, and assign `Payment Pending` only for that outcome.
  - Stable DRF validation errors cover missing status masters, invalid input, active-task
    conflicts, absent active rows, and database contention during the lock/create path.
- `backend/Inquiry/test_task_progress_service.py`
  - Added real-database `TestCase` fixtures and frozen service timestamps for authorization,
    start/save success, invalid input, absent status masters, active-task conflict, and
    rollback/atomicity behavior.

## Red/Green Evidence

- RED was prepared first by adding the service contract tests before `task_progress.py`
  existed. The intended test invocation could not reach Django because this checkout's
  virtual environment launcher is invalid.
- GREEN verification was attempted after implementation with the focused Task 1+2 suite.
  It could not execute for the same environment reason; no development database migration
  was attempted.

## Commands And Output Summary

```powershell
& '.\venv\Scripts\python.exe' manage.py test Inquiry.test_task_progress_service --verbosity 2
```

```text
did not find executable at 'C:\Users\Sai_Dev_3\AppData\Local\Programs\Python\Python313\python.exe': Access is denied.
```

```powershell
& '.\venv\Scripts\python.exe' manage.py test Inquiry.test_task_progress_model Inquiry.test_task_progress_service --verbosity 2
```

```text
did not find executable at 'C:\Users\Sai_Dev_3\AppData\Local\Programs\Python\Python313\python.exe': Access is denied.
```

`py -0p` also reported no installed Python interpreters.

## Self-Review

- Admin and super-admin users can read via `can_read_inquiry_task`, but `start_inquiry_task`
  and `save_inquiry_progress` reject them with DRF `PermissionDenied`.
- Only an active `StaffDetails` record assigned to the inquiry can read/write; other and
  inactive staff are denied.
- Both operations use `transaction.atomic`; master statuses are validated before writes so
  missing configuration leaves task/inquiry state unchanged.
- Start serializes competing starts on the staff resource and converts unique-constraint
  conflicts to a stable `ValidationError`.

## Concerns

- The focused tests remain unexecuted until the virtual environment is repaired or a
  compatible Python interpreter is installed. The `venv/pyvenv.cfg` points to the missing
  `C:\Users\Sai_Dev_3\AppData\Local\Programs\Python\Python313\python.exe`.
- SQL Server-specific row-lock behavior is covered by the service design and integration
  tests but still needs execution against the repaired test environment.

## Fix Round 1/5

### Files Changed

- `backend/Inquiry/task_progress.py`
  - Replaced Django `is_staff`/`is_superuser` checks with `staff.access.get_staff()` and
    `has_full_access()`. `Admin` and `Super Admin` staff roles are read-only regardless of
    Django's `is_staff` flag, while ordinary assigned staff retain task-write access even
    when their Django account has `is_staff=True`.
  - Wrapped only the `select_for_update()` resource acquisition in a nested transaction and
    converts its `DatabaseError` to a stable DRF `ValidationError`. Permission and input
    validation occur outside that handler and remain unchanged.
- `backend/Inquiry/test_task_progress_service.py`
  - Added role-based admin/super-admin fixtures without Django `is_staff`, an ordinary
    assigned `is_staff=True` fixture, and start/save lock-error boundary tests.

### Commands And Output

Initial non-escalated focused test command could not access the configured interpreter:

```powershell
& '.\venv\Scripts\python.exe' manage.py test Inquiry.test_task_progress_service --verbosity 2
```

```text
did not find executable at 'C:\Users\Sai_Dev_3\AppData\Local\Programs\Python\Python313\python.exe': Access is denied.
```

Escalated focused verification command:

```powershell
& '.\venv\Scripts\python.exe' manage.py test Inquiry.test_task_progress_service Inquiry.test_task_progress_model --verbosity 2
```

Output summary: Django created and destroyed only `test_SaiInfosysCRM`; all migrations ran
against that disposable test database. `Ran 17 tests in 11.143s` and `OK` (exit code 0).
The suite emitted one pre-existing DRF `min_value should be an integer or Decimal instance`
warning from `rest_framework.fields`; Django system checks reported no issues.

### Self-Review

- Role access uses the same `get_staff`/`has_full_access` behavior as staff permissions,
  including role normalization for `Admin` and `Super Admin`.
- The lock exception handler surrounds no authorization or validation branch, so a denied
  user still receives `PermissionDenied` and invalid progress input still receives its
  specific `ValidationError`.
- The new lock-error tests assert observable start/save responses and unchanged task state;
  a targeted mock is used only to simulate a database lock timeout/deadlock that a single
  test connection cannot reliably induce.

### Concerns

- The focused suite is green under elevated execution. Running it without elevation still
  fails at virtual-environment interpreter access, so routine local test execution depends
  on that permission or repairing the interpreter installation.
