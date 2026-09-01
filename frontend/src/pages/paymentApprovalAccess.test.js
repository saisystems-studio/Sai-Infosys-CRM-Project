import assert from "node:assert/strict";
import test from "node:test";

import {
  canRecordPayment,
  canMarkPaymentReceived,
  canViewPaymentApproval,
} from "./paymentApprovalAccess.js";

test("Admin users can only view payment statuses", () => {
  assert.equal(canMarkPaymentReceived({ role: "Admin" }), false);
  assert.equal(canViewPaymentApproval({ role: "Admin" }), true);
});

test("Super Admin users can mark pending payments as received", () => {
  assert.equal(canMarkPaymentReceived({ role: "Super Admin" }), true);
  assert.equal(canViewPaymentApproval({ role: "Super Admin" }), true);
});

test("only Admin users can record a payment from Payment Pending", () => {
  assert.equal(canRecordPayment({ role: "Admin" }), true);
  assert.equal(canRecordPayment({ role: "Super Admin" }), false);
});
