import assert from "node:assert/strict";
import test from "node:test";

import { applyRecordedPayment } from "./paymentPendingState.js";

test("an installment keeps the row and updates its paid and remaining amounts", () => {
  const rows = [{ id: 1, total_paid: "0.00", remaining_balance: "10.00" }];

  assert.deepEqual(
    applyRecordedPayment(rows, {
      id: 1,
      total_paid: "4.00",
      remaining_balance: "6.00",
      payment_status: "Pending",
    }),
    [{ id: 1, total_paid: "4.00", remaining_balance: "6.00" }],
  );
});

test("a full payment removes the completed row from the pending list", () => {
  const rows = [{ id: 1, total_paid: "4.00", remaining_balance: "6.00" }];

  assert.deepEqual(
    applyRecordedPayment(rows, {
      id: 1,
      total_paid: "10.00",
      remaining_balance: "0.00",
      payment_status: "Received",
    }),
    [],
  );
});
