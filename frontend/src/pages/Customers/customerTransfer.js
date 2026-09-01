const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

export function formatCustomerImportResult(data = {}) {
  const imported = Number(data.imported) || 0;
  const skipped = Number(data.skipped_duplicates) || 0;
  return `Imported ${pluralize(imported, "customer")}. Skipped ${pluralize(skipped, "duplicate")}.`;
}

export function formatCustomerImportError(error) {
  return (
    error?.response?.data?.error ||
    error?.response?.data?.detail ||
    "Customer import failed. Check the template and try again."
  );
}
