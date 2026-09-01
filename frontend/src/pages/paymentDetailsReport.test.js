import test from "node:test";
import assert from "node:assert/strict";

import {
  filterPaymentDetails,
  getPaymentCardSummary,
} from "./paymentDetailsReport.js";

const payment = {
  id: 8,
  customer_name: "Acme Systems",
  company_name: "Sai Infosys",
  product_name: "Tally Support",
  created_on: "2026-09-01T10:00:00Z",
  amount: "2500.00",
  revenue_amount: "5000.00",
};

test("payment report filters by search, company, product, and date", () => {
  assert.deepEqual(filterPaymentDetails([payment], { search: "acme" }), [payment]);
  assert.deepEqual(filterPaymentDetails([payment], { company: "Sai Infosys" }), [payment]);
  assert.deepEqual(filterPaymentDetails([payment], { product: "Tally Support" }), [payment]);
  assert.deepEqual(filterPaymentDetails([payment], { fromDate: "2026-09-01", toDate: "2026-09-01" }), [payment]);
  assert.deepEqual(filterPaymentDetails([payment], { search: "missing" }), []);
});

test("payment card summary exposes paid and revenue values", () => {
  assert.deepEqual(getPaymentCardSummary(payment), {
    product: "Tally Support",
    company: "Sai Infosys",
    paidAmount: 2500,
    revenueAmount: 5000,
  });
});
