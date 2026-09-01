import assert from "node:assert/strict";
import test from "node:test";

import { markPaymentReceivedInList } from "./paymentApprovalState.js";

test("marking one transaction received does not change other installments", () => {
  const rows = [
    { id: 10, approval_status: "Pending" },
    { id: 11, approval_status: "Pending" },
  ];

  assert.deepEqual(markPaymentReceivedInList(rows, 10), [
    { id: 10, approval_status: "Received" },
    { id: 11, approval_status: "Pending" },
  ]);
});
