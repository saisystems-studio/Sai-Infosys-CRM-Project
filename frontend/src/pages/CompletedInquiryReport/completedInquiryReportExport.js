const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export async function exportCompletedInquiryReport(format, rows, periodLabel) {
  const headers = ["Inquiry", "Company", "Status", "Type", "Staff", "Completed on", "Last update", "Duration", "Products"];
  const filename = `completed-inquiry-report-${new Date().toISOString().slice(0, 10)}`;

  if (format === "excel") {
    const module = await import("exceljs");
    const Workbook = module.Workbook || module.default.Workbook;
    const workbook = new Workbook();
    workbook.creator = "Sai Infosys CRM";
    const sheet = workbook.addWorksheet("Completed inquiries");
    sheet.addRow(["Completed Inquiry Report"]);
    sheet.addRow([`Period: ${periodLabel}`]);
    sheet.addRow([]);
    sheet.addRow(headers);
    rows.forEach((row) => sheet.addRow(row));
    sheet.mergeCells("A1:I1");
    sheet.mergeCells("A2:I2");
    sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
    sheet.getCell("A2").font = { italic: true, color: { argb: "FF475569" } };
    sheet.getRow(4).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF305272" } };
    });
    sheet.views = [{ state: "frozen", ySplit: 4 }];
    sheet.autoFilter = { from: "A4", to: `I${Math.max(4, sheet.rowCount)}` };
    [12, 26, 18, 12, 20, 22, 36, 14, 32].forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
    sheet.eachRow((row) => row.alignment = { vertical: "top", wrapText: true });
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${filename}.xlsx`);
    return;
  }

  const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setTextColor(23, 32, 51);
  doc.setFontSize(17);
  doc.text("Completed Inquiry Report", 14, 16);
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`Period: ${periodLabel} | ${rows.length} completed task inquiries`, 14, 23);
  autoTable(doc, {
    head: [headers],
    body: rows,
    startY: 29,
    margin: { left: 8, right: 8, bottom: 16 },
    styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [48, 82, 114], textColor: 255 },
    alternateRowStyles: { fillColor: [246, 249, 251] },
  });
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text(`Sai Infosys CRM | Page ${page} of ${pages}`, 14, 202);
  }
  doc.save(`${filename}.pdf`);
}
