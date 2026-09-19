const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const safeFileName = (value) =>
  String(value || "report")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export async function exportReport({ format, title, periodLabel, headers, rows, filename }) {
  if (!rows.length) return;
  const baseName = `${safeFileName(filename || title)}-${new Date().toISOString().slice(0, 10)}`;

  if (format === "excel") {
    const module = await import("exceljs");
    const Workbook = module.Workbook || module.default.Workbook;
    const workbook = new Workbook();
    workbook.creator = "Sai Infosys CRM";
    const sheet = workbook.addWorksheet(title.slice(0, 31));
    sheet.addRow([title]);
    sheet.addRow([`Period: ${periodLabel || "All records"}`]);
    sheet.addRow([]);
    sheet.addRow(headers);
    rows.forEach((row) => sheet.addRow(row));
    const lastColumn = Math.max(headers.length, 1);
    const lastColumnLetter = sheet.getColumn(lastColumn).letter;
    sheet.mergeCells(`A1:${lastColumnLetter}1`);
    sheet.mergeCells(`A2:${lastColumnLetter}2`);
    sheet.getCell("A1").font = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    sheet.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF31546B" } };
    sheet.getCell("A2").font = { italic: true, color: { argb: "FF475569" } };
    sheet.getRow(4).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF305272" } };
      cell.alignment = { vertical: "middle", wrapText: true };
    });
    sheet.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true };
    });
    headers.forEach((header, index) => {
      const contentWidth = rows.reduce(
        (maximum, row) => Math.max(maximum, String(row[index] ?? "").length),
        String(header).length,
      );
      sheet.getColumn(index + 1).width = Math.min(Math.max(contentWidth + 2, 12), 35);
    });
    sheet.views = [{ state: "frozen", ySplit: 4 }];
    sheet.autoFilter = { from: "A4", to: `${lastColumnLetter}${sheet.rowCount}` };
    const buffer = await workbook.xlsx.writeBuffer();
    downloadBlob(new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${baseName}.xlsx`);
    return;
  }

  if (format === "pdf") {
    const [{ jsPDF }, { autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
    const doc = new jsPDF({ orientation: headers.length > 5 ? "landscape" : "portrait", unit: "mm", format: "a4" });
    doc.setTextColor(23, 32, 51);
    doc.setFontSize(17);
    doc.text(title, 14, 16);
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(`Period: ${periodLabel || "All records"} | ${rows.length} records`, 14, 23);
    autoTable(doc, {
      head: [headers], body: rows.map((row) => row.map((cell) => String(cell ?? ""))), startY: 29,
      margin: { left: 8, right: 8, bottom: 16 },
      styles: { fontSize: 7, cellPadding: 2, overflow: "linebreak" },
      headStyles: { fillColor: [48, 82, 114], textColor: 255 },
      alternateRowStyles: { fillColor: [246, 249, 251] },
    });
    const pageCount = doc.getNumberOfPages();
    for (let page = 1; page <= pageCount; page += 1) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(`Sai Infosys CRM | Page ${page} of ${pageCount}`, 14, doc.internal.pageSize.getHeight() - 8);
    }
    doc.save(`${baseName}.pdf`);
    return;
  }

  throw new Error(`Unsupported export format: ${format}`);
}
