import test from "node:test";
import assert from "node:assert/strict";
import * as schedulePresentation from "./schedulePresentation.js";

import {
  formatTaskDuration,
  getScheduleDateState,
  getScheduleInitials,
  getTotalTaskDurationSeconds,
  hasScheduleAdminAccess,
} from "./schedulePresentation.js";

test("Django staff accounts use their CRM role for schedule access", () => {
  assert.equal(
    hasScheduleAdminAccess({ role: "Staff", is_staff: true }),
    false,
  );
  assert.equal(hasScheduleAdminAccess({ role: "Admin" }), true);
  assert.equal(hasScheduleAdminAccess({ role: "Super Admin" }), true);
});

test("schedule dates are classified relative to the current day", () => {
  const today = new Date("2026-08-27T10:00:00");

  assert.equal(getScheduleDateState("2026-08-26", today), "overdue");
  assert.equal(getScheduleDateState("2026-08-27", today), "today");
  assert.equal(getScheduleDateState("2026-08-28", today), "upcoming");
  assert.equal(getScheduleDateState("", today), "unscheduled");
});

test("customer names produce compact two-letter schedule avatars", () => {
  assert.equal(getScheduleInitials("Sai Infosys"), "SI");
  assert.equal(getScheduleInitials("Priya"), "PR");
  assert.equal(getScheduleInitials(""), "CU");
});

test("task duration combines completed sessions with the active session", () => {
  const inquiry = {
    completed_task_duration_seconds: 9000,
    active_task_started_at: "2026-08-28T10:00:00Z",
  };
  const now = new Date("2026-08-28T10:15:00Z");

  assert.equal(getTotalTaskDurationSeconds(inquiry, now), 9900);
  assert.equal(formatTaskDuration(9900), "2h 45m");
});

test("task duration shows zero when an inquiry has never been started", () => {
  assert.equal(getTotalTaskDurationSeconds({}, new Date()), 0);
  assert.equal(formatTaskDuration(0), "0m");
});

test("schedule cards open details from Enter or Space only", () => {
  assert.equal(
    schedulePresentation.isScheduleCardActivationKey?.("Enter"),
    true,
  );
  assert.equal(schedulePresentation.isScheduleCardActivationKey?.(" "), true);
  assert.equal(
    schedulePresentation.isScheduleCardActivationKey?.("Escape"),
    false,
  );
});
