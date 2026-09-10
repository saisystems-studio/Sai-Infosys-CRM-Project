import test from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import demoData from "./demoData.json" with { type: "json" };
import { buildReport } from "./reportModel.js";
import { createExcelBuffer, createPdf, reportSheets } from "./reportExport.js";

const report = buildReport(demoData, { customerId: "c1", from: "2026-01-01", to: "2026-06-30" });

test("Excel round-trip preserves every section, monetary numbers, and untrusted text", async () => {
  const sheets = reportSheets(report);
  sheets[0].rows.push(["Literal", "=1+1"]);
  const buffer = await createExcelBuffer(sheets);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  assert.equal(workbook.worksheets.length, 8);
  assert.equal(workbook.getWorksheet("Detailed activity").rowCount, report.activities.length + 1);
  assert.equal(workbook.getWorksheet("Summary").lastRow.getCell(2).value, "=1+1");
  const revenueSheet = workbook.getWorksheet("Revenue breakdown");
  assert.equal(typeof revenueSheet.getCell("B2").value, "number");
  assert.equal([2, 3, 4, 5].reduce((sum, row) => sum + revenueSheet.getCell(`B${row}`).value, 0), report.totalRevenue);
});

test("detail export includes only supplied matching rows across pages", () => {
  const filtered = report.activities.filter(a => a.type === "Follow-up");
  const sheets = reportSheets(report, filtered);
  assert.equal(sheets.length, 1);
  assert.equal(sheets[0].rows.length, filtered.length);
  assert.ok(sheets[0].rows.every(row => row[1] === "Follow-up"));
  assert.equal(reportSheets(report, [])[0].rows.length, 0);
});

test("PDF export produces a multipage PDF with report identity and live-data label", async () => {
  const doc = await createPdf(report, reportSheets(report));
  const content = doc.output();
  assert.ok(content.startsWith("%PDF-"));
  assert.ok(doc.getNumberOfPages() >= 8);
  assert.ok(content.includes("Customer Business Summary Report"));
  assert.ok(content.includes("Live CRM data"));
});
