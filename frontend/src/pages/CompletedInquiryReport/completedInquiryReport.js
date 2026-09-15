const normalize = (value) => String(value || "").trim().toLowerCase();

const productName = (product) =>
  product?.product_name || product?.name || product?.product_type_name || "";

const toDateValue = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function getCompletedReportDateRange(preset, today = new Date()) {
  const current = new Date(today);
  current.setHours(0, 0, 0, 0);
  const from = new Date(current);
  const to = new Date(current);

  if (preset === "yesterday") {
    from.setDate(from.getDate() - 1);
    to.setDate(to.getDate() - 1);
  } else if (preset === "today-yesterday") {
    from.setDate(from.getDate() - 1);
  } else if (preset === "last-7-days") {
    from.setDate(from.getDate() - 6);
  } else if (preset === "next-month") {
    from.setMonth(from.getMonth() + 1, 1);
    to.setMonth(to.getMonth() + 2, 0);
  } else if (preset === "this-month") {
    from.setDate(1);
    to.setMonth(to.getMonth() + 1, 0);
  } else if (preset === "last-month") {
    from.setMonth(from.getMonth() - 1, 1);
    to.setMonth(to.getMonth(), 0);
  } else if (preset === "custom") {
    return { fromDate: "", toDate: "" };
  }

  return { fromDate: toDateValue(from), toDate: toDateValue(to) };
}

export function getCompletedTaskDate(task = {}) {
  return String(task.work_date || task.end_time || "").slice(0, 10);
}

export function getLatestCompletedTask(tasks = [], filters = {}) {
  return (
    tasks
      .filter((task) => {
        const taskDate = getCompletedTaskDate(task);
        return (
          task.end_time &&
          (!filters.fromDate || taskDate >= filters.fromDate) &&
          (!filters.toDate || taskDate <= filters.toDate)
        );
      })
      .sort(
        (first, second) =>
          new Date(second.end_time).getTime() - new Date(first.end_time).getTime(),
      )[0] || null
  );
}

export function filterCompletedInquiryReport(rows = [], filters = {}) {
  const search = normalize(filters.search);
  return rows.filter((row) => {
    const hasTaskInPeriod = (row.task_progress || []).some((task) => {
      const taskDate = getCompletedTaskDate(task);
      return task.end_time &&
        (!filters.fromDate || taskDate >= filters.fromDate) &&
        (!filters.toDate || taskDate <= filters.toDate);
    });
    const searchable = [
      row.customer_name,
      row.company_name,
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
      hasTaskInPeriod &&
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
