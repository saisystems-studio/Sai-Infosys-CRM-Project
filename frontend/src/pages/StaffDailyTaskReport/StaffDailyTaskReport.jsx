import axios from "axios";
import { useEffect, useMemo, useState } from "react";
import { getCompletedReportDateRange } from "../CompletedInquiryReport/completedInquiryReport";
import { exportReport } from "../../reportExport";
import "./StaffDailyTaskReport.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/crm/api";
const time = (value) => value ? new Date(value).toLocaleTimeString("en-IN", {
  hour: "2-digit", minute: "2-digit", hour12: true,
}) : "—";
const duration = (start, end) => {
  if (!start || !end) return "In progress";
  const minutes = Math.max(0, Math.round((new Date(end) - new Date(start)) / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
};
const formatAmount = (value) => `₹${Number(value || 0).toLocaleString("en-IN", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
})}`;

export default function StaffDailyTaskReport() {
  const [datePreset, setDatePreset] = useState("today");
  const [dateRange, setDateRange] = useState(() => getCompletedReportDateRange("today", new Date()));
  const [staff, setStaff] = useState("");
  const [search, setSearch] = useState("");
  const [report, setReport] = useState({ tasks: [], staff: [], summary: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  const loadReport = async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("crm_access_token");
      const response = await axios.get(`${API_BASE_URL}/staff-daily-task-report/`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { from_date: dateRange.fromDate, to_date: dateRange.toDate, ...(staff ? { staff } : {}) },
      });
      setReport(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load the staff daily task report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadReport(); }, [dateRange.fromDate, dateRange.toDate, staff]);

  const selectDatePreset = (preset) => {
    setDatePreset(preset);
    setDateRange(getCompletedReportDateRange(preset, new Date()));
  };

  const resetFilters = () => {
    setDatePreset("today");
    setDateRange(getCompletedReportDateRange("today", new Date()));
    setStaff("");
    setSearch("");
  };

  const tasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return report.tasks || [];
    return (report.tasks || []).filter((task) => [
      task.resource_name, task.customer_name, task.company_name, task.progress_notes,
      task.task_status_label, ...(task.products || []),
    ].some((value) => String(value || "").toLowerCase().includes(query)));
  }, [report.tasks, search]);

  const summary = {
    total: tasks.length,
    completed: tasks.filter((task) => task.end_time).length,
    active: tasks.filter((task) => !task.end_time).length,
    total_amount: report.summary?.total_amount || 0,
    revenue_amount: report.summary?.revenue_amount || 0,
  };
  const exportHeaders = ["Date", "Staff", "Company", "Customer", "Product", "Remarks", "Start time", "End time", "Duration"];
  const exportRows = tasks.map((task) => [
    task.work_date || "", task.resource_name || "Unassigned", task.company_name || "", task.customer_name || "",
    (task.products || []).join(", "), task.progress_notes || "", time(task.start_time), time(task.end_time), duration(task.start_time, task.end_time),
  ]);
  const handleExport = async (format) => {
    setExporting(format);
    try {
      await exportReport({ format, title: "Staff Daily Task Report", filename: "staff-daily-task-report", periodLabel: dateRange.fromDate === dateRange.toDate ? dateRange.fromDate : `${dateRange.fromDate} to ${dateRange.toDate}`, headers: exportHeaders, rows: exportRows });
    } finally { setExporting(""); }
  };

  return <section className="daily-task-report">
    <header className="daily-task-header">
      <div><span>Reports / Staff activity</span><h1>Staff Daily Task Report</h1><p>Track each staff member’s task activity for a selected period.</p></div>
      <div className="daily-task-date">{dateRange.fromDate === dateRange.toDate ? dateRange.fromDate : `${dateRange.fromDate} to ${dateRange.toDate}`}</div>
    </header>

    <div className="daily-task-filters">
      <label><span>Period</span><select value={datePreset} onChange={(event) => selectDatePreset(event.target.value)}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="today-yesterday">Yesterday &amp; Today</option><option value="last-7-days">Last 7 days</option><option value="next-month">Next month</option><option value="this-month">This month</option><option value="last-month">Last month</option><option value="custom">Mention period</option></select></label>
      {datePreset === "custom" && <><label><span>From date</span><input type="date" value={dateRange.fromDate} onChange={(event) => setDateRange((current) => ({ ...current, fromDate: event.target.value }))} /></label><label><span>To date</span><input type="date" value={dateRange.toDate} onChange={(event) => setDateRange((current) => ({ ...current, toDate: event.target.value }))} /></label></>}
      <label><span>Staff member</span><select value={staff} onChange={(event) => setStaff(event.target.value)}><option value="">All staff</option>{(report.staff || []).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
      <label className="daily-task-search"><span>Search</span><input value={search} placeholder="Staff, customer, company or notes" onChange={(event) => setSearch(event.target.value)} /></label>
      <button type="button" onClick={resetFilters}>Reset</button>
      <div className="report-export-actions">
        <button type="button" disabled={!tasks.length || Boolean(exporting)} onClick={() => handleExport("excel")}>{exporting === "excel" ? "Exporting..." : "Export Excel"}</button>
        <button type="button" disabled={!tasks.length || Boolean(exporting)} onClick={() => handleExport("pdf")}>{exporting === "pdf" ? "Exporting..." : "Export PDF"}</button>
      </div>
    </div>

    <div className="daily-task-summary">
      <Metric label="Tasks" value={summary.total} />
      <Metric label="Completed" value={summary.completed} tone="success" />
      <Metric label="In progress" value={summary.active} tone="warning" />
      <Metric label="Total amount" value={formatAmount(summary.total_amount)} tone="primary" />
      <Metric label="Revenue amount" value={formatAmount(summary.revenue_amount)} tone="success" />
    </div>

    {loading ? <div className="daily-task-state">Loading daily task activity…</div> : error ? <div className="daily-task-state error">{error}<button type="button" onClick={loadReport}>Retry</button></div> : tasks.length === 0 ? <div className="daily-task-state">No task activity was recorded for this date.</div> : <div className="daily-task-table-wrap"><div className="daily-task-table" role="table" aria-label="Staff daily task activity">
      <div className="daily-task-row head" role="row"><span>Date</span><span>Company name</span><span>Product</span><span>Remarks</span><span>Start time</span><span>End time</span><span>Duration</span></div>
      {tasks.map((task) => <div className="daily-task-row" role="row" key={task.id}>
        <span data-label="Date">{task.work_date}</span>
        <span data-label="Company name"><strong>{task.company_name || task.customer_name || "—"}</strong><small>{task.company_name ? task.customer_name : ""}</small></span>
        <span data-label="Product" className="daily-task-products">{task.products?.length ? task.products.map((product) => <em key={product}>{product}</em>) : "—"}</span>
        <span data-label="Remarks">{task.progress_notes || "No remarks recorded"}</span>
        <span data-label="Start time">{time(task.start_time)}</span>
        <span data-label="End time">{time(task.end_time)}</span>
        <span data-label="Duration" className="daily-task-duration">{duration(task.start_time, task.end_time)}</span>
      </div>)}
    </div></div>}
  </section>;
}

function Metric({ label, value, tone = "" }) { return <div className={`daily-task-metric ${tone}`}><strong>{value}</strong><span>{label}</span></div>; }
