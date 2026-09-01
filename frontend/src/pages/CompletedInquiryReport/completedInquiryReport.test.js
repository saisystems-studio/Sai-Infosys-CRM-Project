import test from "node:test";
import assert from "node:assert/strict";

import {
  filterCompletedInquiryReport,
  getCompletedTaskSummary,
} from "./completedInquiryReport.js";

const reportRow = {
  id: 4,
  customer_name: "Acme Systems",
  resource_name: "Anita Rao",
  schedule_date: "2026-08-31",
  products: [{ product_name: "Tally Support" }],
  task_progress: [
    {
      progress_notes: "Configured backups",
      start_time: "2026-08-31T09:00:00Z",
      end_time: "2026-08-31T10:30:00Z",
      resource_name: "Anita Rao",
    },
  ],
};

test("report search matches customer, staff, product, and task notes", () => {
  for (const query of ["acme", "anita", "tally", "backups"]) {
    assert.deepEqual(filterCompletedInquiryReport([reportRow], { search: query }), [reportRow]);
  }
  assert.deepEqual(filterCompletedInquiryReport([reportRow], { search: "missing" }), []);
});

test("report filters scheduled dates and assigned staff", () => {
  assert.deepEqual(
    filterCompletedInquiryReport([reportRow], {
      fromDate: "2026-08-30",
      toDate: "2026-08-31",
      staffId: "12",
    }),
    [],
  );
  assert.deepEqual(
    filterCompletedInquiryReport([{ ...reportRow, Resource_Id: 12 }], {
      fromDate: "2026-08-30",
      toDate: "2026-08-31",
      staffId: "12",
    }),
    [{ ...reportRow, Resource_Id: 12 }],
  );
});

test("task summary identifies who did what and totals completed duration", () => {
  assert.deepEqual(getCompletedTaskSummary(reportRow), {
    completedCount: 1,
    totalSeconds: 5400,
    latestWorker: "Anita Rao",
    latestNotes: "Configured backups",
  });
});
