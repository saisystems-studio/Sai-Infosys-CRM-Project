import test from "node:test";
import assert from "node:assert/strict";

import { createInquiryEditState } from "./inquiryEdit.js";

test("maps a list inquiry into populated edit form state", () => {
  const state = createInquiryEditState({
    id: 42,
    Customer_Id: 7,
    customer_name: "Acme Systems",
    phone_number: "9876543210",
    email_id: "sales@acme.test",
    tally_serial_number: "TS-100",
    rating_id: 3,
    Status_Id: 4,
    Source_Id: 5,
    Resource_Id: 6,
    schedule_date: "2026-09-15",
    products: [
      { product: 11, qty: "2.00", rate: "450.00", requirement: "Migration" },
      { ProductType_Id: 12, Quantity: "1.00", Rate: "300.00", Requirment: "Training" },
    ],
  });

  assert.deepEqual(state, {
    inquiryId: "42",
    phone: "9876543210",
    customerId: "7",
    customer: {
      name: "Acme Systems",
      email: "sales@acme.test",
      serial: "TS-100",
      expiry: "",
    },
    rating: "3",
    schedule: "2026-09-15",
    resource: "6",
    source: "5",
    status: "4",
    items: [
      { id: "inquiry-product-42-0", product: "11", quantity: "2.00", rate: "450.00", requirement: "Migration" },
      { id: "inquiry-product-42-1", product: "12", quantity: "1.00", rate: "300.00", requirement: "Training" },
    ],
  });
});

