export const clamp = (value) => Math.max(0, Math.min(100, value || 0));

export function buildTaskRows(inquiry) {
  const product = [...new Set((inquiry.products || []).map(item => item.product_name || item.product_type_name).filter(Boolean))].join(", ") || inquiry.product || "—";
  return (inquiry.task_progress || []).map(task => {
    const seconds = task.start_time && task.end_time
      ? Math.floor((Date.parse(task.end_time) - Date.parse(task.start_time)) / 1000)
      : NaN;
    const duration = Number.isFinite(seconds) && seconds >= 0
      ? `${Math.floor(seconds / 3600)}h ${Math.floor(seconds % 3600 / 60)}m ${seconds % 60}s`
      : task.start_time && !task.end_time ? "In progress" : "—";
    return { id: task.id, date: task.work_date, product,
      start: task.start_time, end: task.end_time, duration, remark: task.progress_notes || "—" };
  });
}
export const money = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
export const dateLabel = (value) => value ? new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
export const engagementLabel = (score) => score >= 90 ? "Highly Engaged" : score >= 75 ? "Active Customer" : score >= 60 ? "Moderate Customer" : "Low Engagement";
export const engagementColor = (score) => score >= 90 ? "#158568" : score >= 75 ? "#4263db" : score >= 60 ? "#b77812" : "#c44f67";

export function validateFilters(filters, customers) {
  if (!customers.some(c => c.id === filters.customerId)) return "Please select a customer.";
  for (const value of [filters.from, filters.to]) {
    const date = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return "Please enter valid From and To dates.";
  }
  return filters.from > filters.to ? "From Date must be on or before To Date." : "";
}

export function filterAndSort(rows, query, sortKey, direction) {
  const term = query.trim().toLowerCase();
  return rows.filter(row => Object.values(row).some(value => String(value ?? "").toLowerCase().includes(term)))
    .sort((a, b) => {
      const left = a[sortKey] ?? "", right = b[sortKey] ?? "";
      const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), undefined, { numeric: true });
      return direction === "asc" ? result : -result;
    });
}

export function buildReport(data, filters) {
  const belongs = row => row.customerId === filters.customerId;
  const inRange = date => date && date >= filters.from && date <= filters.to;
  const select = rows => rows.filter(row => belongs(row) && inRange(row.date));
  const schedules = select(data.schedules), transactions = select(data.transactions);
  const revenueByInquiry = new Map();
  for (const payment of transactions) {
    if (!payment.inquiryId) continue;
    revenueByInquiry.set(payment.inquiryId, (revenueByInquiry.get(payment.inquiryId) || 0) + payment.amount);
  }
  const inquiries = select(data.inquiries).map(row => ({
    ...row,
    revenueAmount: revenueByInquiry.get(row.id) || 0,
  }));
  const customer = data.customers.find(b => b.id === filters.customerId);
  const totalRevenue = transactions.reduce((sum, row) => sum + row.amount, 0);
  const expectedRevenue = inquiries.reduce((sum, row) => sum + row.expectedRevenue, 0);
  const achievement = expectedRevenue > 0 ? Math.round(totalRevenue / expectedRevenue * 100) : null;
  const scheduleCounts = Object.fromEntries(["Completed", "Pending", "Cancelled"].map(status => [status, schedules.filter(row => row.status === status).length]));
  const completedInquiries = inquiries.filter(row => String(row.status || "").toLowerCase() === "completed");
  const inProgressInquiries = inquiries.filter(row => String(row.status || "").toLowerCase() === "in progress" || row.hasActiveTask);
  const notStartedInquiries = inquiries.filter(row => !row.taskProgressCount && String(row.status || "").toLowerCase() !== "completed");
  // A visit is an attended/completed schedule; pending and cancelled bookings are not visits.
  const visits = schedules.filter(row => row.status === "Completed");
  const repeatInquiries = Math.max(0, inquiries.length - 1), repeatVisits = Math.max(0, visits.length - 1);
  const last = (rows, key = "date") => [...rows].sort((a, b) => b[key].localeCompare(a[key]))[0] || null;
  const productNames = [...new Set([...inquiries, ...schedules, ...transactions].map(row => row.product))];
  const products = productNames.map(name => ({
    id: name, name, inquiries: inquiries.filter(row => row.product === name).length,
    schedules: schedules.filter(row => row.product === name).length,
    revenue: transactions.filter(row => row.product === name).reduce((sum, row) => sum + row.amount, 0),
  })).sort((a, b) => b.inquiries - a.inquiries || b.revenue - a.revenue || a.name.localeCompare(b.name));
  const events = select(data.events);
  const resourceNames = [...new Set([...inquiries, ...schedules, ...transactions, ...events].map(row => row.resource).filter(Boolean))];
  const resources = resourceNames.map(name => ({
    id: name, name, visits: visits.filter(row => row.resource === name).length,
    completed: visits.filter(row => row.resource === name).length,
    revenue: transactions.filter(row => row.resource === name).reduce((sum, row) => sum + row.amount, 0),
  }));
  const revenueCategories = [...new Set(transactions.map(row => row.category).filter(Boolean))].sort();
  const revenue = revenueCategories.map(name => ({ name, value: transactions.filter(row => row.category === name).reduce((sum, row) => sum + row.amount, 0) }));
  const activity = (row, type, date = row.date, revenue = 0) => ({
    id: `${type}-${row.id}`, date, type, product: row.product, resource: row.resource || "Unassigned",
    status: type === "Schedule Created" ? "Created" : row.status || "Completed", revenue, remarks: row.remarks || "—",
  });
  const activities = [
    ...inquiries.map(row => activity(row, "Inquiry Created")),
    ...data.schedules.filter(belongs).filter(row => inRange(row.createdDate)).map(row => activity(row, "Schedule Created", row.createdDate)),
    ...data.schedules.filter(belongs).filter(row => row.status === "Completed" && inRange(row.completedDate)).map(row => activity(row, "Schedule Completed", row.completedDate)),
    ...events.map(row => activity(row, row.type)),
    ...transactions.map(row => activity(row, { AMC: "AMC Visit", Service: "Service Visit", "Product Sales": "Product Sale" }[row.category] || row.category, row.date, row.amount)),
  ].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
  const monthIndex = date => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
  const months = Math.max(1, monthIndex(filters.to) - monthIndex(filters.from) + 1);
  const activeMonths = new Set(activities.map(row => row.date.slice(0, 7))).size;
  const components = [
    { name: "Repeat inquiry", weight: 30, score: clamp(repeatInquiries / 3 * 100), description: "Three repeat inquiries earns full credit." },
    { name: "Completed schedules", weight: 30, score: schedules.length ? scheduleCounts.Completed / schedules.length * 100 : 0, description: "Completed schedules ÷ all schedules." },
    { name: "Revenue contribution", weight: 25, score: clamp(achievement), description: "Current revenue ÷ expected revenue, capped at 100%." },
    { name: "Activity participation", weight: 15, score: clamp(activeMonths / months * 100), description: "Months with activity ÷ months in the selected period." },
  ];
  const engagement = Math.round(components.reduce((sum, row) => sum + row.score * row.weight / 100, 0));
  return { customer, filters, inquiries, schedules, totalRevenue, expectedRevenue, achievement, scheduleCounts, repeatInquiries, repeatVisits,
    completedInquiries, inProgressInquiries, notStartedInquiries,
    products, resources, revenue, activities, components, engagement, mostInterested: products.find(row => row.inquiries > 0) || null,
    lastInquiry: last(inquiries), lastSchedule: last(schedules), lastFollowUp: last(schedules),
  };
}
