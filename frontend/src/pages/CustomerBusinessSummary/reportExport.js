// Export libraries load only when requested, keeping the dashboard startup small.
export function reportSheets(report, activityRows) {
  const { customer: c, filters: f } = report;
  const activities = activityRows ?? report.activities;
  const activitySheet = { name: "Detailed activity", headers: ["Date", "Activity Type", "Product", "Resource", "Status", "Revenue (INR)", "Remarks"], rows: activities.map(a => [a.date, a.type, a.product, a.resource, a.status, a.revenue, a.remarks]) };
  if (activityRows) return [activitySheet];
  return [
    { name: "Summary", headers: ["Metric", "Value"], rows: [
      ["Data source", "Live CRM database records"], ["Customer", c.name], ["Company", c.company], ["Period", `${f.from} to ${f.to}`],
      ["Mobile", c.mobile], ["Email", c.email], ["Customer type", c.customerType], ["Rating", c.rating], ["Assigned resource", c.resource], ["Created date", c.createdDate], ["Last follow-up in period", report.lastFollowUp?.date || "N/A"],
      ["Total inquiries", report.inquiries.length], ["Total schedules", report.schedules.length], ["Completed schedules", report.scheduleCounts.Completed], ["Pending schedules", report.scheduleCounts.Pending], ["Cancelled schedules", report.scheduleCounts.Cancelled],
      ["Total revenue (INR)", report.totalRevenue], ["Expected revenue (INR)", report.expectedRevenue], ["Potential achievement (%)", report.achievement ?? "N/A"], ["Repeat inquiries", report.repeatInquiries], ["Repeat visits", report.repeatVisits],
      ["Products interested", report.products.filter(p => p.inquiries > 0).length], ["Most requested product", report.mostInterested?.name || "N/A"], ["Last product inquiry", report.lastInquiry?.product || "N/A"], ["Last inquiry date", report.lastInquiry?.date || "N/A"], ["Last schedule date", report.lastSchedule?.date || "N/A"], ["Engagement score (%)", report.engagement],
    ] },
    { name: "Inquiry history", headers: ["Inquiry Date", "Product", "Source", "Status", "Assigned Resource", "Expected Revenue (INR)"], rows: report.inquiries.map(i => [i.date, i.product, i.source, i.status, i.resource, i.expectedRevenue]) },
    { name: "Product interest", headers: ["Product", "Inquiry Count", "Schedule Count", "Revenue (INR)"], rows: report.products.map(p => [p.name, p.inquiries, p.schedules, p.revenue]) },
    { name: "Schedule analysis", headers: ["Date", "Product", "Resource", "Status"], rows: report.schedules.map(s => [s.date, s.product, s.resource, s.status]) },
    { name: "Resource interaction", headers: ["Resource", "Number of Visits", "Completed Tasks", "Revenue (INR)"], rows: report.resources.map(r => [r.name, r.visits, r.completed, r.revenue]) },
    { name: "Revenue breakdown", headers: ["Category", "Revenue (INR)"], rows: report.revenue.map(r => [r.name, r.value]) },
    { name: "Engagement methodology", headers: ["Component", "Weight (%)", "Score (%)", "Method"], rows: report.components.map(c => [c.name, c.weight, Math.round(c.score), c.description]) },
    activitySheet,
  ];
}

export async function createExcelBuffer(sheets, report) {
  const module = await import("exceljs");
  const Workbook = module.Workbook || module.default.Workbook;
  const workbook = new Workbook();
  workbook.creator = "Sai Infosys CRM";
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    const columnCount = Math.max(sheet.headers.length, 1);
    const reportSubtitle = report
      ? `${report.customer.company || report.customer.name} | ${report.filters.from} to ${report.filters.to}`
      : "Live CRM database records";
    worksheet.addRow(["Customer Business Summary Report"]);
    worksheet.addRow([reportSubtitle]);
    worksheet.addRow([sheet.name]);
    worksheet.addRow([]);
    worksheet.addRow(sheet.headers);
    sheet.rows.forEach(row => worksheet.addRow(row));
    worksheet.mergeCells(1, 1, 1, columnCount);
    worksheet.mergeCells(2, 1, 2, columnCount);
    worksheet.mergeCells(3, 1, 3, columnCount);
    worksheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    worksheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF31546B" } };
    worksheet.getCell("A1").alignment = { vertical: "middle" };
    worksheet.getRow(1).height = 27;
    worksheet.getCell("A2").font = { size: 10, color: { argb: "FF475569" } };
    worksheet.getCell("A3").font = { bold: true, size: 11, color: { argb: "FF31546B" } };
    worksheet.getRow(5).eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5254BE" } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    sheet.headers.forEach((header, index) => {
      const column = worksheet.getColumn(index + 1);
      column.width = Math.min(60, Math.max(18, ...[sheet.headers, ...sheet.rows].map(row => String(row[index] ?? "").length + 2)));
      column.alignment = { vertical: "top", wrapText: true };
      if (/revenue|amount/i.test(header)) column.numFmt = '#,##0.00';
    });
    for (let rowNumber = 6; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      row.eachCell({ includeEmpty: true }, cell => {
        cell.border = { bottom: { style: "thin", color: { argb: "FFE5E7EB" } } };
        if (rowNumber % 2 === 0) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8FAFC" } };
      });
      if (sheet.name === "Summary") row.getCell(1).font = { bold: true, color: { argb: "FF334155" } };
    }
    worksheet.views = [{ state: "frozen", ySplit: 5 }];
    worksheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: Math.max(5, worksheet.rowCount), column: columnCount } };
    worksheet.pageSetup = { orientation: columnCount > 5 ? "landscape" : "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  }
  return workbook.xlsx.writeBuffer();
}

export async function createPdf(report, sheets) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  sheets.forEach((sheet, index) => {
    if (index) doc.addPage();
    doc.setTextColor(42, 45, 73);
    doc.setFontSize(17);
    doc.text("Customer Business Summary Report", 14, 17);
    doc.setFontSize(10);
    doc.text(`${report.customer.company} | ${report.filters.from} to ${report.filters.to} | Live CRM data`, 14, 25);
    doc.setFontSize(12);
    doc.text(sheet.name, 14, 35);
    autoTable(doc, { head: [sheet.headers], body: sheet.rows, startY: 41, margin: { top: 17, bottom: 17 }, styles: { fontSize: 8, cellPadding: 3, overflow: "linebreak" }, headStyles: { fillColor: [82, 84, 190] }, alternateRowStyles: { fillColor: [246, 247, 252] } });
  });
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page); doc.setFontSize(8); doc.setTextColor(120);
    doc.text(`Sai Infosys CRM | Live CRM data | Page ${page} of ${doc.getNumberOfPages()}`, 14, 202);
  }
  return doc;
}

export async function downloadReport(format, report, activityRows) {
  const sheets = reportSheets(report, activityRows);
  const filename = `demo-customer-${report.customer.id}-${activityRows ? "activity" : "summary"}-${report.filters.from}-${report.filters.to}`;
  if (format === "pdf") {
    const doc = await createPdf(report, sheets);
    doc.save(`${filename}.pdf`);
    return;
  }
  const buffer = await createExcelBuffer(sheets, report);
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url; link.download = `${filename}.xlsx`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
