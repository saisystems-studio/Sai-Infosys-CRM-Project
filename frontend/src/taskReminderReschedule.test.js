import test from "node:test";
import assert from "node:assert/strict";

import {
  buildReminderDateTimeValue,
  buildReminderReschedulePayload,
  isReminderCallbackDue,
  validateReminderReschedule,
} from "./taskReminderReschedule.js";

test("12 AM converts to midnight", () => {
  assert.equal(
    buildReminderDateTimeValue("2026-09-02", "12", "00", "AM"),
    "2026-09-02T00:00",
  );
});

test("12 PM remains noon", () => {
  assert.equal(
    buildReminderDateTimeValue("2026-09-02", "12", "00", "PM"),
    "2026-09-02T12:00",
  );
});

test("afternoon time converts to 24-hour time", () => {
  assert.equal(
    buildReminderDateTimeValue("2026-09-02", "01", "30", "PM"),
    "2026-09-02T13:30",
  );
});

test("reminder reschedule requires a callback time", () => {
  assert.equal(
    validateReminderReschedule("", new Date("2026-09-01T12:00:00")),
    "Choose a new callback date and time.",
  );
});

test("reminder reschedule accepts any time today", () => {
  assert.equal(
    validateReminderReschedule(
      "2026-09-01T11:59",
      new Date("2026-09-01T12:00:00"),
    ),
    "",
  );
});

test("reminder reschedule rejects a callback date before today", () => {
  assert.equal(
    validateReminderReschedule(
      "2026-08-31T23:59",
      new Date("2026-09-01T12:00:00"),
    ),
    "Choose a future callback date and time.",
  );
});

test("reminder reschedule preserves the selected local callback time", () => {
  assert.deepEqual(
    buildReminderReschedulePayload("2026-09-01T14:30"),
    { reschedule_at: "2026-09-01T14:30" },
  );
});

test("reminder is not due before the selected local time", () => {
  assert.equal(
    isReminderCallbackDue("2026-09-01T13:40", new Date("2026-09-01T13:39:59")),
    false,
  );
  assert.equal(
    isReminderCallbackDue("2026-09-01T13:40", new Date("2026-09-01T13:40:00")),
    true,
  );
});
