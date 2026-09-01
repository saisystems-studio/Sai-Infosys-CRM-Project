# Admin Access and Schedule Design

## Goal

Separate Admin and Super Admin capabilities while giving Admin users a task workspace for inquiries assigned directly to them.

## Role capabilities

### Super Admin

- Can view, add, edit, and delete throughout the CRM.
- Sees one schedule section containing all scheduled inquiries.
- Can inspect task details and history.
- Cannot start, update, or complete an inquiry task because task work must be performed by its assigned resource.

### Admin

- Can view, add, and edit throughout the CRM.
- Cannot delete records anywhere in the CRM.
- Sees two schedule sections:
  - **My Tasks:** inquiries assigned to the Admin's own active staff profile.
  - **Other Staff Tasks:** inquiries assigned to every other staff profile.
- Can start, update, save, and complete tasks in **My Tasks**.
- Has view-only access to tasks in **Other Staff Tasks**.
- An Admin's own inquiries appear only in **My Tasks** and are not duplicated in **Other Staff Tasks**.

### Staff

- Continues using assigned menu permissions for view, add, edit, and delete actions.
- Sees only inquiries assigned to their own active staff profile.
- Can perform task work only on those assigned inquiries.

## Backend authorization

The backend remains the source of truth. Hiding a button is not considered authorization.

- Keep centralized normalized role detection for `Admin` and `Super Admin`.
- Add a centralized delete capability check:
  - Super Admin and a Django superuser without a staff profile may delete.
  - Admin may not delete.
  - Staff delete access continues to follow `StaffMenuPermission.Can_Delete`.
- Apply the delete capability in `HasMenuPermission` before allowing any `DELETE` request.
- Change inquiry task authorization so an active Admin staff profile may update an inquiry only when it is the assigned resource.
- Super Admin remains unable to perform assigned task work.
- Admin and Super Admin retain read access to all inquiry schedules and task histories.

## Frontend authorization

- Use the normalized CRM role and server-provided access flags rather than Django's `is_staff` value.
- Full menu visibility remains enabled for Admin and Super Admin.
- Generated menu action permissions set `delete: false` for Admin and `delete: true` for Super Admin.
- Existing page-level delete controls continue using menu action permissions, so Admin delete controls disappear consistently.
- The backend still rejects a manually issued Admin delete request.

## Schedule presentation

- The existing schedule endpoint continues returning all non-payment-pending inquiries to Admin and Super Admin, and assigned inquiries to Staff.
- The frontend compares each inquiry's resource identifier with the logged-in user's `staff_id`.
- Admin receives two non-duplicating collections: own and other staff.
- Super Admin receives one all-schedules collection.
- Staff receives one own-schedule collection.
- Empty states are displayed per section so an Admin can independently see whether they have no personal tasks or whether other staff have no tasks.
- Task action controls use inquiry-level update permission. Admin actions appear only for personally assigned inquiries; other staff cards remain view-only.

## Error and edge-case handling

- An Admin without an active linked staff profile sees an empty **My Tasks** section and all inquiries under **Other Staff Tasks**; no task action is enabled.
- Missing resource identifiers are treated as other/unassigned work and never become editable by Admin.
- Role comparison is case-insensitive and normalizes spaces, underscores, and hyphens.
- Direct unauthorized delete or task-update requests return HTTP 403.

## Verification

Backend regression tests will prove:

- Admin receives full non-delete menu actions and cannot call DELETE endpoints.
- Super Admin receives delete access and can call permitted DELETE endpoints.
- Admin can update a task assigned to their own staff profile.
- Admin cannot update another staff member's task.
- Super Admin cannot update assigned task work.
- Admin and Super Admin can read all schedule entries; Staff can read only their own.

Frontend regression tests will prove:

- Admin menu access hides delete while Super Admin retains it.
- Admin schedule entries split into own and other collections without duplication.
- Staff and Super Admin use their respective single-section schedule layouts.
- Admin task controls appear only on personally assigned inquiries.

The frontend test suite and production build, plus the relevant backend authorization and inquiry test suites, must pass before completion.
