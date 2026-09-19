import test from "node:test";
import assert from "node:assert/strict";

import { buildProductBillDetailSummary } from "./productBillDetailPresentation.js";

test("product bill detail summary presents the customer and bill amounts", () => {
  assert.deepEqual(
    buildProductBillDetailSummary({
      customer_name: "Kumar",
      company_name: "Kumar Traders",
      product_name: "AMC",
      revenue_amount: "2500",
      total_paid: "500",
      remaining_balance: "2000",
      created_on: "2026-09-16",
    }),
    {
      customer: "Kumar",
      company: "Kumar Traders",
      product: "AMC",
      billAmount: 2500,
      paidAmount: 500,
      remainingAmount: 2000,
      billDate: "2026-09-16",
    },
  );
});
