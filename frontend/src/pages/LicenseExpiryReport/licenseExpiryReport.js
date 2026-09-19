const toDateValue = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
};

export function getLicenseExpiryDateRange(preset, today = new Date()) {
  const current = new Date(today);
  current.setHours(0, 0, 0, 0);
  const from = new Date(current);
  const to = new Date(current);

  if (preset === "last-month") {
    from.setMonth(from.getMonth() - 1, 1);
    to.setMonth(to.getMonth(), 0);
  } else if (preset === "this-month") {
    from.setDate(1);
    to.setMonth(to.getMonth() + 1, 0);
  } else if (preset === "next-month") {
    from.setMonth(from.getMonth() + 1, 1);
    to.setMonth(to.getMonth() + 2, 0);
  } else if (preset === "next-year") {
    from.setFullYear(from.getFullYear() + 1, 0, 1);
    to.setFullYear(to.getFullYear() + 1, 11, 31);
  } else if (preset === "custom") {
    return { fromDate: "", toDate: "" };
  }

  return { fromDate: toDateValue(from), toDate: toDateValue(to) };
}

export function filterLicenseExpiryRows(rows = [], filters = {}) {
  return rows.filter((row) => (
    (!filters.fromDate || row.expiry_date >= filters.fromDate) &&
    (!filters.toDate || row.expiry_date <= filters.toDate) &&
    (!filters.productId || String(row.product_id) === String(filters.productId))
  ));
}
