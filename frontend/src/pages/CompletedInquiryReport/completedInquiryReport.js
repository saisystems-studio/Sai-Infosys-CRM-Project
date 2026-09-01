const normalize = (value) => String(value || "").trim().toLowerCase();

const productName = (product) =>
  product?.product_name || product?.name || product?.product_type_name || "";

export function filterCompletedInquiryReport(rows = [], filters = {}) {
  const search = normalize(filters.search);
  return rows.filter((row) => {
    const scheduledDate = String(row.schedule_date || "").slice(0, 10);
    const searchable = [
      row.customer_name,
      row.phone_number,
      row.email_id,
      row.resource_name,
      ...(row.products || []).map(productName),
      ...(row.task_progress || []).flatMap((task) => [
        task.resource_name,
        task.progress_notes,
      ]),
    ].map(normalize).join(" ");
    return (
      (!search || searchable.includes(search)) &&
      (!filters.fromDate || scheduledDate >= filters.fromDate) &&
      (!filters.toDate || scheduledDate <= filters.toDate) &&
      (!filters.staffId || String(row.Resource_Id || "") === String(filters.staffId)) &&
      (!filters.product || (row.products || []).some((item) => normalize(productName(item)) === normalize(filters.product)))
    );
  });
}

export function getCompletedTaskSummary(row = {}) {
  const completed = (row.task_progress || []).filter((task) => task.end_time);
  const totalSeconds = completed.reduce((total, task) => {
    const start = new Date(task.start_time).getTime();
    const end = new Date(task.end_time).getTime();
    return total + (Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, (end - start) / 1000) : 0);
  }, 0);
  const latest = completed[0] || {};
  return {
    completedCount: completed.length,
    totalSeconds,
    latestWorker: latest.resource_name || row.resource_name || "Unassigned",
    latestNotes: latest.progress_notes || "No task notes recorded",
  };
}
