import test from "node:test";
import assert from "node:assert/strict";

import { getRequiredCustomerErrors } from "./customerValidation.js";

test("add customer requires company, customer type, and GST number", () => {
  assert.deepEqual(
    getRequiredCustomerErrors({
      company_name: "",
      customer_type: "",
      gst_number: "",
    }),
    {
      company_name: "Company name is required",
      customer_type: "Customer type is required",
      gst_number: "GST number is required",
    },
  );
});

test("GST number must contain exactly 15 characters", () => {
  assert.deepEqual(
    getRequiredCustomerErrors({
      company_name: "Sai Infosys",
      customer_type: "1",
      gst_number: "12345",
    }),
    { gst_number: "GST number must be 15 characters" },
  );
});

test("complete required customer details have no validation errors", () => {
  assert.deepEqual(
    getRequiredCustomerErrors({
      company_name: "Sai Infosys",
      customer_type: "1",
      gst_number: "29ABCDE1234F1Z5",
    }),
    {},
  );
});
