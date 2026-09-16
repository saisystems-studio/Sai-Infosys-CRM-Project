import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  filterCompletedInquiryReport,
  getCompactCompletedDateTime,
  getCompletedReportDateRange,
  getLatestCompletedTask,
} from "./completedInquiryReport";
import "./CompletedInquiryReport.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/crm/api";
const emptyFilters = {
  search: "",
  ...getCompletedReportDateRange("today"),
  staffId: "",
  product: "",
};

const formatDuration = (task) => {
  const start = new Date(task.start_time).getTime();
  const end = new Date(task.end_time).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) return "—";
  const minutes = Math.floor(Math.max(0, end - start) / 60000);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};

const productName = (item) => item.product_name || item.product_type_name || "Product";
export default function CompletedInquiryReport({ onViewDetails }) {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [datePreset, setDatePreset] = useState("today");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReport = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await axios.get(`${API_BASE_URL}/inquiries/completed-inquiry-report/`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("crm_access_token")}` },
      });
      setRows(response.data);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load the completed inquiry report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    axios.get(`${API_BASE_URL}/inquiries/completed-inquiry-report/`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("crm_access_token")}` },
    }).then((response) => {
      if (active) setRows(response.data);
    }).catch((requestError) => {
      if (active) setError(requestError.response?.data?.detail || "Unable to load the completed inquiry report.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const filteredInquiries = useMemo(
    () => filterCompletedInquiryReport(rows, filters),
    [rows, filters],
  );
  const reportRows = useMemo(() => {
    return filteredInquiries
      .map((inquiry) => ({
        inquiry,
        task: getLatestCompletedTask(inquiry.task_progress, filters),
      }))
      .filter(({ task }) => task);
  }, [filteredInquiries, filters.fromDate, filters.toDate]);
  const staffOptions = [...new Map(rows.filter((row) => row.Resource_Id).map((row) => [String(row.Resource_Id), row.resource_name])).entries()];
  const productOptions = [...new Set(rows.flatMap((row) => (row.products || []).map(productName)))].sort();
  const selectDatePreset = (preset) => {
    setDatePreset(preset);
    setFilters((current) => ({
      ...current,
      ...getCompletedReportDateRange(preset),
    }));
  };

  if (loading) return <div className="completed-report-state"><span className="completed-report-spinner" />Loading today’s completed inquiries…</div>;

  return (
    <section className="completed-report-page">
      <header className="completed-report-header">
        <div>
          <span className="completed-report-eyebrow">Reports</span>
          <h1>Completed Inquiry Report</h1>
          <p>Latest completed-task update, including payment-pending work, for each inquiry in the selected period.</p>
        </div>
        <div className="completed-report-total"><strong>{reportRows.length}</strong><span>Completed task inquiries</span></div>
      </header>

      <div className="completed-report-filters">
        <label className="completed-report-search"><span>Search</span><input value={filters.search} placeholder="Company, staff, product or task…" onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        <label><span>Period</span><select value={datePreset} onChange={(event) => selectDatePreset(event.target.value)}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="today-yesterday">Yesterday &amp; Today</option><option value="last-7-days">Last 7 days</option><option value="next-month">Next month</option><option value="this-month">This month</option><option value="last-month">Last month</option><option value="custom">Mention period</option></select></label>
        {datePreset === "custom" && <><label><span>From date</span><input type="date" value={filters.fromDate} onChange={(event) => setFilters({ ...filters, fromDate: event.target.value })} /></label><label><span>To date</span><input type="date" value={filters.toDate} onChange={(event) => setFilters({ ...filters, toDate: event.target.value })} /></label></>}
        <label><span>Staff</span><select value={filters.staffId} onChange={(event) => setFilters({ ...filters, staffId: event.target.value })}><option value="">All staff</option>{staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label><span>Product</span><select value={filters.product} onChange={(event) => setFilters({ ...filters, product: event.target.value })}><option value="">All products</option>{productOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
        {Object.values(filters).some(Boolean) && <button type="button" onClick={() => { setDatePreset("today"); setFilters(emptyFilters); }}>Clear filters</button>}
      </div>

      {error ? <div className="completed-report-error">{error}<button type="button" onClick={loadReport}>Retry</button></div> : reportRows.length === 0 ? (
        <div className="completed-report-empty"><strong>No completed inquiries found</strong><span>Try choosing a different period or adjusting the filters.</span></div>
      ) : (
        <div className="completed-report-table-wrap">
            <div className="completed-report-table" role="table" aria-label="Completed inquiry details">
            <div className="completed-report-table-head" role="row">
              <span role="columnheader">Inquiry</span><span role="columnheader">Company</span><span role="columnheader">Status</span><span role="columnheader">Staff</span><span role="columnheader">Done</span><span role="columnheader">Last update</span><span role="columnheader">Duration</span><span role="columnheader">Products</span><span role="columnheader">View</span>
            </div>
            {reportRows.map(({ inquiry, task }) => (
              <div className="completed-report-table-row" role="row" key={inquiry.id}>
                <span role="cell" data-label="Inquiry">#{inquiry.id}</span>
                <span role="cell" data-label="Company" className="completed-report-customer-cell"><strong>{inquiry.company_name || "No company name"}</strong></span>
                <span role="cell" data-label="Status"><em className={`completed-report-status ${inquiry.status_name === "Payment Pending" ? "completed-report-status-pending" : ""}`}>{inquiry.status_name || "Completed"}</em></span>
                <span role="cell" data-label="Staff">{task.resource_name || inquiry.resource_name || "Unassigned"}</span>
                <span role="cell" data-label="Done">{getCompactCompletedDateTime(task.end_time)}</span>
                <span role="cell" data-label="Last update" className="completed-report-notes">{task.progress_notes || "No notes recorded"}</span>
                <span role="cell" data-label="Duration" className="completed-report-duration">{formatDuration(task)}</span>
                <span role="cell" data-label="Products" className="completed-report-products-cell">{(inquiry.products || []).length ? inquiry.products.map((item) => <em key={item.id}>{productName(item)}</em>) : "Not specified"}</span>
                <span role="cell" data-label="View"><button type="button" className="completed-report-view-icon" onClick={() => onViewDetails(inquiry.id)} aria-label={`View full details for inquiry ${inquiry.id}`} title="View full details"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.75" /></svg></button></span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
