# Inquiry Task Progress Design

## Purpose

Add a Schedule detail workflow where the assigned resource can record multiple timed work sessions against an inquiry. Administrators and super administrators can inspect the inquiry and its complete work history but cannot start or complete task sessions.

## Scope

This feature covers:

- A dedicated Schedule detail view opened from each Schedule card.
- Server-timed task sessions with a daily progress history.
- One active task session per resource at a time.
- Multiple completed sessions per resource and inquiry on the same day.
- Inquiry main-status changes to In Progress or Payment Pending.
- Read-only administrative visibility.

Payment collection, invoicing, duration reporting, task editing/deletion, and a generic CRM activity system are outside this scope.

## Data Model

Add `InquiryTaskProgress` in the Inquiry application with these fields:

- `Inquiry_Id`: foreign key to `InquiryDetails_tbl`, cascading on inquiry deletion and exposed through a `task_progress` related name.
- `Resource_Id`: foreign key to `StaffDetails`, protected from deletion while history exists.
- `Work_Date`: Asia/Kolkata business date derived by the backend when the session starts.
- `Start_Time`: backend timestamp captured when the session starts.
- `End_Time`: nullable backend timestamp captured when progress is saved.
- `Progress_Notes`: required text when completing a session; blank while active.
- `Task_Status`: `Active`, `Progress Saved`, or `Payment Pending`.
- `Created_By`: authenticated Django user that started the session.
- `Created_On` and `Updated_On`: audit timestamps.

Add a conditional database uniqueness constraint on `Resource_Id` where `End_Time` is null. This is the final concurrency guard that prevents a resource from having overlapping active sessions.

Start and end timestamps remain timezone-aware timestamps. Duration is not stored independently. Future reporting will calculate it from `End_Time - Start_Time`, avoiding inconsistent redundant data.

## Status Rules

Task progress history and inquiry status are separate concepts.

- Starting a task sets the progress row to Active and changes the inquiry's main status to the master status named In Progress.
- Saving ordinary progress sets the row to Progress Saved and leaves the inquiry In Progress.
- Saving with the Payment Pending outcome sets the row to Payment Pending and changes the inquiry's main status to the master status named Payment Pending.
- Existing completed history rows never change when the inquiry's current status changes.
- If either required master status is absent, the write endpoint returns a validation error and does not partially modify data.

## Permissions

Administrators and super administrators may list schedules, open detail views, and read all progress history. They may not start or save progress.

Regular staff may read and update only inquiries whose `Resource_Id` is their own `StaffDetails` record. Both frontend visibility and backend authorization enforce this rule. The backend rule is authoritative.

A resource with an active session cannot start another session for any inquiry. After saving that session, the resource may start another session immediately, including another session for the same inquiry on the same date.

## API Design

Extend the inquiry viewset with detail actions:

- `GET /api/inquiries/{id}/task-detail/`
  Returns the inquiry list/detail representation plus ordered progress history, the current active session if any, and a `can_update_task` permission flag.

- `POST /api/inquiries/{id}/start-task/`
  Takes no client timestamp. Inside a transaction it validates ownership and the global one-active-session constraint, creates the Active row using backend date/time, changes the inquiry to In Progress, and returns the created session.

- `POST /api/inquiries/{id}/save-progress/`
  Accepts required `progress_notes` and an `outcome` of `progress_saved` or `payment_pending`. Inside a transaction it finds the authenticated resource's active row for this inquiry, saves the backend end time, notes, and task status, applies the inquiry status rule, and returns the completed row.

History is ordered by `Start_Time` descending. Clients cannot submit or override resource, work date, start time, end time, or created-by fields.

Expected errors use DRF validation responses for missing notes, missing master statuses, no active task, another active task, non-assignment, and admin write attempts. Database uniqueness errors from simultaneous starts are converted into a stable validation response.

## Frontend Design

`Schedule.jsx` retains responsibility for loading and displaying the schedule list. Clicking View Details selects an inquiry and renders a new `ScheduleDetail` component inside the dashboard content area. Back returns to the existing Schedule list without changing sidebar navigation.

The detail page contains:

- Compact inquiry header with back action, status, schedule date, and assigned resource.
- Customer/contact summary.
- Product and requirement table with quantities, rates, and total.
- Task-progress grid showing work date, start time, end time, task status, notes, and a calculated duration when both timestamps exist; active sessions display `Running` instead.
- Assigned-resource task panel with Start Task or the active-session form.

For an assigned resource, Start Task immediately calls the backend. While active, the page shows the server start time, a required notes field, an outcome control with Continue In Progress and Payment Pending, and Save Progress. Saving successfully returns to Schedule and reloads the list so status and counts are current.

For administrators and super administrators, the detail page displays the same inquiry and progress history but renders no task controls. The API-provided `can_update_task` flag drives this presentation.

Refreshing the detail page reloads task detail from the backend. If a session is active, the active form is restored without inventing a new client-side start time. Failed saves preserve the entered notes and show an inline error.

All Schedule detail class names are scoped with a schedule-detail prefix to prevent the CSS collisions previously seen between Schedule and Inquiry List.

## Testing

Backend tests cover:

- Assigned resource can start a session and server timestamps are used.
- Starting changes the inquiry to In Progress.
- A resource cannot have two active sessions, including across inquiries.
- Multiple completed sessions on the same day are accepted.
- Save requires notes and an active session for the selected inquiry.
- Save records the backend end time.
- Progress Saved preserves the inquiry's In Progress status.
- Payment Pending updates the inquiry master status.
- Admin and super-admin writes are rejected while reads succeed.
- Other staff cannot read or modify an unassigned inquiry.
- History ordering is newest first.
- Transaction failures do not leave partial inquiry or progress updates.

Frontend tests cover detail-state mapping, active-session restoration, outcome payload construction, and permission-state decisions. The full frontend test suite, focused backend tests, lint for modified files, production frontend build, and Django system checks run before completion.

## Migration And Compatibility

The new table is additive. Existing inquiries need no data migration and initially have empty progress history. Schedule listing behavior remains compatible. The required In Progress and Payment Pending master statuses must exist before task writes are enabled; missing values produce explicit validation errors rather than implicit status creation.
