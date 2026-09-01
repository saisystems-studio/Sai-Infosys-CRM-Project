import test from "node:test";
import assert from "node:assert/strict";

import {
  getCustomerInitials,
  getSourceName,
  getStatusTone,
} from "./inquiryPresentation.js";

test("customer initials create a compact two-letter avatar", () => {
  assert.equal(getCustomerInitials("Acme Industries"), "AI");
  assert.equal(getCustomerInitials("Priya"), "PR");
  assert.equal(getCustomerInitials(""), "CU");
});

test("status tone maps common workflow statuses consistently", () => {
  assert.equal(getStatusTone("New"), "new");
  assert.equal(getStatusTone("In Progress"), "progress");
  assert.equal(getStatusTone("Follow Up"), "follow");
  assert.equal(getStatusTone("Completed"), "completed");
  assert.equal(getStatusTone("Cancelled"), "cancelled");
  assert.equal(getStatusTone("Unknown"), "default");
});

test("source name falls back to the source master when an inquiry only has Source_Id", () => {
  const inquiry = { Source_Id: 2 };
  const sources = [
    { Id: 1, source_type_name: "Website" },
    { Id: 2, source_type_name: "Referral" },
  ];

  assert.equal(getSourceName(inquiry, sources), "Referral");
});
