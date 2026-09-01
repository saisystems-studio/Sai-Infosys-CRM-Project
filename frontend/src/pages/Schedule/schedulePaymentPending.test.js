import test from "node:test";
import assert from "node:assert/strict";

import {
  buildPaymentPendingPayload,
  getPaymentPendingDefaults,
  getPaymentPendingError,
  validateInvoiceAmount,
  validateRevenueAmount,
} from "./schedulePaymentPending.js";

test("schedule card prefills both payment amounts from the inquiry total", () => {
  assert.deepEqual(getPaymentPendingDefaults({ total: 5500 }), {
    invoiceAmount: "5500",
    revenueAmount: "5500",
  });
});

test("payment pending rejects a missing invoice amount", () => {
  assert.equal(
    validateInvoiceAmount(""),
    "Enter the invoice amount before continuing.",
  );
});

test("payment pending rejects a negative invoice amount", () => {
  assert.equal(
    validateInvoiceAmount("-1"),
    "Invoice amount cannot be negative.",
  );
});

test("payment pending rejects a missing revenue amount", () => {
  assert.equal(
    validateRevenueAmount(""),
    "Enter the total revenue amount before continuing.",
  );
});

test("payment pending rejects negative revenue", () => {
  assert.equal(
    validateRevenueAmount("-1"),
    "Revenue amount cannot be negative.",
  );
});

test("payment pending sends invoice and revenue amounts expected by the API", () => {
  assert.deepEqual(buildPaymentPendingPayload("3000.00", "2500.00"), {
    invoice_amount: "3000.00",
    revenue_amount: "2500.00",
  });
});

test("unpaid service sends zero amounts and the unpaid flag", () => {
  assert.deepEqual(buildPaymentPendingPayload("3000.00", "2500.00", true), {
    invoice_amount: 0,
    revenue_amount: 0,
    unpaid_service: true,
  });
});

test("payment completion displays a list validation error returned by the API", () => {
  assert.equal(
    getPaymentPendingError(
      { response: { data: ["Required inquiry status 'Completed' is not configured."] } },
      true,
    ),
    "Required inquiry status 'Completed' is not configured.",
  );
});
