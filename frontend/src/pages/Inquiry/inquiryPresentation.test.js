import test from "node:test";
import assert from "node:assert/strict";

import * as presentation from "./inquiryPresentation.js";

const { getCustomerInitials, getSourceName, getStatusTone } = presentation;

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

test("inquiry cards prefer the company name and fall back to the customer name", () => {
  assert.equal(
    presentation.getInquiryDisplayName?.({
      company_name: "Acme Systems",
      customer_name: "Anita Rao",
    }),
    "Acme Systems",
  );
  assert.equal(
    presentation.getInquiryDisplayName?.({ customer_name: "Anita Rao" }),
    "Anita Rao",
  );
});

test("created-date periods keep only inquiries within the requested report range", () => {
  const inquiries = [
    { id: 1, created_date: "2026-09-15" },
    { id: 2, created_date: "2026-09-14" },
    { id: 3, created_date: "2026-09-09" },
    { id: 4, created_date: "2026-08-31" },
  ];
  const now = new Date("2026-09-15T12:00:00");

  assert.deepEqual(
    presentation.filterInquiriesByCreatedPeriod?.(inquiries, "last-7-days", now),
    [inquiries[0], inquiries[1], inquiries[2]],
  );
});

test("inquiry records provide fallback options when filter master data is unavailable", () => {
  const options = presentation.getInquiryFilterFallbackOptions?.([
    {
      Status_Id: 3,
      status_name: "Completed",
      Resource_Id: 8,
      resource_name: "Anu",
      products: [{ ProductType_Id: 5, product_name: "TSS" }],
    },
  ]);

  assert.deepEqual(options, {
    statuses: [{ Id: 3, status_type_name: "Completed" }],
    resources: [{ Id: 8, Full_Name: "Anu" }],
    products: [{ Id: 5, product_type_name: "TSS" }],
  });
});
