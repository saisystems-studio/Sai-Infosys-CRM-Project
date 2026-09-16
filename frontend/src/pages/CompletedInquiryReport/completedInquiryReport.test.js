import test from "node:test";
import assert from "node:assert/strict";

import {
  filterCompletedInquiryReport,
  getCompletedReportDateRange,
  getCompactCompletedDateTime,
  getLatestCompletedTask,
  getCompletedTaskSummary,
} from "./completedInquiryReport.js";

const reportRow = {
  id: 4,
  customer_name: "Acme Systems",
  company_name: "Acme Pvt Ltd",
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

test("report search matches company, staff, product, and task notes", () => {
  for (const query of ["pvt", "anita", "tally", "backups"]) {
    assert.deepEqual(filterCompletedInquiryReport([reportRow], { search: query }), [reportRow]);
  }
  assert.deepEqual(filterCompletedInquiryReport([reportRow], { search: "missing" }), []);
});

test("report uses the latest completed task for an inquiry row", () => {
  const olderTask = reportRow.task_progress[0];
  const latestTask = {
    ...olderTask,
    id: 8,
    end_time: "2026-08-31T12:00:00Z",
    progress_notes: "Final customer handover completed",
  };

  assert.equal(
    getLatestCompletedTask([olderTask, latestTask], {
      fromDate: "2026-08-31",
      toDate: "2026-08-31",
    }),
    latestTask,
  );
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

test("report date presets create inclusive task completion periods", () => {
  const today = new Date("2026-09-10T10:00:00");
  assert.deepEqual(getCompletedReportDateRange("today", today), {
    fromDate: "2026-09-10", toDate: "2026-09-10",
  });
  assert.deepEqual(getCompletedReportDateRange("today-yesterday", today), {
    fromDate: "2026-09-09", toDate: "2026-09-10",
  });
  assert.deepEqual(getCompletedReportDateRange("last-7-days", today), {
    fromDate: "2026-09-04", toDate: "2026-09-10",
  });
  assert.deepEqual(getCompletedReportDateRange("this-month", today), {
    fromDate: "2026-09-01", toDate: "2026-09-30",
  });
  assert.deepEqual(getCompletedReportDateRange("last-month", today), {
    fromDate: "2026-08-01", toDate: "2026-08-31",
  });
});

test("compact completion timestamp omits the year and uses a short month", () => {
  assert.equal(
    getCompactCompletedDateTime("2026-09-16T05:27:00Z"),
    "16 Sep, 10:57 AM",
  );
});
