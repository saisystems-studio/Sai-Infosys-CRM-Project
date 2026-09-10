import test from "node:test";
import assert from "node:assert/strict";
import { buildReport, buildTaskRows, engagementLabel, filterAndSort, validateFilters } from "./reportModel.js";

test("task grid binds products and remarks and calculates duration across midnight", () => {
  const rows = buildTaskRows({ products: [{ product_name: "AMC" }, { product_name: "Install" }], task_progress: [
    { id: 1, work_date: "2026-09-01", start_time: "2026-09-01T23:30:00+05:30", end_time: "2026-09-02T01:00:15+05:30", progress_notes: "Finished" },
    { id: 2, start_time: "2026-09-02T10:00:00+05:30", end_time: null },
  ] });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].product, "AMC, Install");
  assert.equal(rows[0].date, "2026-09-01");
  assert.equal(rows[0].duration, "1h 30m 15s");
  assert.equal(rows[0].remark, "Finished");
  assert.equal(rows[1].duration, "In progress");
  assert.deepEqual(buildTaskRows({ products: [] }), []);
});

const data = {
  customers: [{ id: "c1", name: "Customer" }, { id: "c2", name: "Other" }],
  inquiries: [
    { id: "i1", customerId: "c1", date: "2026-01-01", product: "CCTV", resource: "Ana", expectedRevenue: 1000 },
    { id: "i2", customerId: "c1", date: "2026-01-31", product: "CCTV", resource: "Ana", expectedRevenue: 1000 },
    { id: "i3", customerId: "c2", date: "2026-01-10", product: "Alarm", expectedRevenue: 9000 },
  ],
  schedules: [
    { id: "s1", customerId: "c1", date: "2026-01-12", createdDate: "2026-01-02", completedDate: "2026-01-12", product: "CCTV", resource: "Ana", status: "Completed" },
    { id: "s2", customerId: "c1", date: "2026-01-18", createdDate: "2026-01-15", product: "CCTV", resource: "Ana", status: "Pending" },
    { id: "s3", customerId: "c1", date: "2026-01-19", createdDate: "2026-01-15", product: "CCTV", resource: "Ana", status: "Cancelled" },
  ],
  transactions: [{ id: "t1", customerId: "c1", date: "2026-01-12", product: "CCTV", resource: "Ana", category: "Installation", amount: 500 }],
  events: [{ id: "e1", customerId: "c1", date: "2026-01-13", type: "Follow-up", product: "CCTV", resource: "Ana" }],
};
const filters = { customerId: "c1", from: "2026-01-01", to: "2026-01-31" };

test("inquiry revenue sums only its own payments in the selected customer and period", () => {
  const payment = { ...data.transactions[0], inquiryId: "i1" };
  const report = buildReport({ ...data, transactions: [
    payment,
    { ...payment, id: "t2", amount: 125 },
    { ...payment, id: "t3", date: "2026-02-01", amount: 900 },
    { ...payment, id: "t4", customerId: "c2", amount: 800 },
  ] }, filters);
  assert.equal(report.inquiries[0].revenueAmount, 625);
  assert.equal(report.inquiries[1].revenueAmount, 0);
  assert.equal(report.inquiries[0].expectedRevenue, 1000);
  assert.equal(data.inquiries[0].revenueAmount, undefined);
});

test("customer and inclusive date filters reconcile all report totals without duplicate revenue", () => {
  const report = buildReport(data, filters);
  assert.equal(report.inquiries.length, 2);
  assert.equal(report.totalRevenue, 500);
  assert.equal(report.expectedRevenue, 2000);
  assert.equal(report.achievement, 25);
  assert.equal(report.repeatInquiries, 1);
  assert.equal(report.repeatVisits, 0);
  assert.deepEqual(report.scheduleCounts, { Completed: 1, Pending: 1, Cancelled: 1 });
  assert.equal(report.products[0].revenue, 500);
  assert.equal(report.resources[0].visits, 1);
  assert.equal(report.resources[0].revenue, 500);
  assert.equal(report.activities.reduce((sum, a) => sum + a.revenue, 0), 500);
  assert.equal(report.engagement, 41);
});

test("empty date range has finite zero KPIs and no fabricated last activity", () => {
  const report = buildReport(data, { ...filters, from: "2027-01-01", to: "2027-01-31" });
  assert.equal(report.engagement, 0);
  assert.equal(report.achievement, null);
  assert.equal(report.lastSchedule, null);
  assert.equal(report.mostInterested, null);
  assert.deepEqual(report.activities, []);
});

test("engagement labels respect every threshold", () => {
  assert.equal(engagementLabel(90), "Highly Engaged");
  assert.equal(engagementLabel(89), "Active Customer");
  assert.equal(engagementLabel(75), "Active Customer");
  assert.equal(engagementLabel(60), "Moderate Customer");
  assert.equal(engagementLabel(59), "Low Engagement");
});

test("invalid dates, reversed dates and unknown customers are rejected", () => {
  assert.ok(validateFilters({ ...filters, from: "2026-02-31" }, data.customers));
  assert.ok(validateFilters({ ...filters, from: "2026-02-01" }, data.customers));
  assert.ok(validateFilters({ ...filters, customerId: "missing" }, data.customers));
  assert.equal(validateFilters(filters, data.customers), "");
});

test("table search is case insensitive and numeric sorting preserves original rows", () => {
  const rows = [{ name: "CCTV", revenue: 100 }, { name: "cctv Pro", revenue: 20 }, { name: "Alarm", revenue: 2 }];
  assert.deepEqual(filterAndSort(rows, "CCTV", "revenue", "asc").map(r => r.revenue), [20, 100]);
  assert.equal(rows[0].revenue, 100);
});
