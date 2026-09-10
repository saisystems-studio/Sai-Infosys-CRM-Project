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

export async function createExcelBuffer(sheets) {
  const module = await import("exceljs");
  const Workbook = module.Workbook || module.default.Workbook;
  const workbook = new Workbook();
  workbook.creator = "Sai Infosys CRM";
  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.addRow(sheet.headers);
    sheet.rows.forEach(row => worksheet.addRow(row));
    worksheet.views = [{ state: "frozen", ySplit: 1 }];
    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, worksheet.rowCount), column: sheet.headers.length } };
    worksheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5254BE" } };
    });
    worksheet.columns.forEach((column, index) => {
      column.width = Math.min(60, Math.max(18, ...[sheet.headers, ...sheet.rows].map(row => String(row[index] ?? "").length + 2)));
      column.alignment = { vertical: "top", wrapText: true };
      if (/revenue|amount/i.test(sheet.headers[index])) column.numFmt = '#,##0.00';
    });
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
  const buffer = await createExcelBuffer(sheets);
  const url = URL.createObjectURL(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
  const link = document.createElement("a");
  link.href = url; link.download = `${filename}.xlsx`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
