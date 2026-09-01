import test from "node:test";
import assert from "node:assert/strict";

import {
  canAccessTaskActions,
  isPaymentPendingStatus,
} from "./scheduleTaskCompletion.js";

test("payment pending marks the task process as completed", () => {
  assert.equal(isPaymentPendingStatus("Payment Pending"), true);
  assert.equal(isPaymentPendingStatus(" payment pending "), true);
  assert.equal(isPaymentPendingStatus("In Progress"), false);
});

test("completed inquiry marks the task process as completed", () => {
  assert.equal(isPaymentPendingStatus("Completed"), true);
  assert.equal(canAccessTaskActions(true, "Completed"), false);
});

test("completed inquiries cannot access task actions", () => {
  assert.equal(canAccessTaskActions(true, "Payment Pending"), false);
  assert.equal(canAccessTaskActions(true, "In Progress"), true);
  assert.equal(canAccessTaskActions(false, "In Progress"), false);
});
