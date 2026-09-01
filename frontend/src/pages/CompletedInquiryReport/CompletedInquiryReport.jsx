import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { filterCompletedInquiryReport, getCompletedTaskSummary } from "./completedInquiryReport";
import "./CompletedInquiryReport.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
const emptyFilters = { search: "", fromDate: "", toDate: "", staffId: "", product: "" };

const formatDate = (value, includeTime = false) => {
  if (!value) return "—";
  const options = { day: "2-digit", month: "short", year: "numeric" };
  if (includeTime) Object.assign(options, { hour: "numeric", minute: "2-digit" });
  return new Date(value).toLocaleString("en-IN", options);
};

const formatDuration = (seconds) => {
  const minutes = Math.round(Number(seconds || 0) / 60);
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
};

const formatAmount = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const productName = (item) => item.product_name || item.product_type_name || "Product";

export default function CompletedInquiryReport({ onViewDetails }) {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [expandedId, setExpandedId] = useState(null);
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

  const filteredRows = useMemo(
    () => filterCompletedInquiryReport(rows, filters),
    [rows, filters],
  );
  const staffOptions = [...new Map(rows.filter((row) => row.Resource_Id).map((row) => [String(row.Resource_Id), row.resource_name])).entries()];
  const productOptions = [...new Set(rows.flatMap((row) => (row.products || []).map(productName)))].sort();

  if (loading) return <div className="completed-report-state"><span className="completed-report-spinner" />Loading completed inquiries…</div>;

  return (
    <section className="completed-report-page">
      <header className="completed-report-header">
        <div>
          <span className="completed-report-eyebrow">Reports</span>
          <h1>Completed Inquery Report</h1>
          <p>A clear record of completed customer work and the staff who delivered it.</p>
        </div>
        <div className="completed-report-total"><strong>{filteredRows.length}</strong><span>Completed</span></div>
      </header>

      <div className="completed-report-filters">
        <label className="completed-report-search"><span>Search</span><input value={filters.search} placeholder="Customer, staff, product or task…" onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        <label><span>From</span><input type="date" value={filters.fromDate} onChange={(event) => setFilters({ ...filters, fromDate: event.target.value })} /></label>
        <label><span>To</span><input type="date" value={filters.toDate} onChange={(event) => setFilters({ ...filters, toDate: event.target.value })} /></label>
        <label><span>Staff</span><select value={filters.staffId} onChange={(event) => setFilters({ ...filters, staffId: event.target.value })}><option value="">All staff</option>{staffOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
        <label><span>Product</span><select value={filters.product} onChange={(event) => setFilters({ ...filters, product: event.target.value })}><option value="">All products</option>{productOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
        {Object.values(filters).some(Boolean) && <button type="button" onClick={() => setFilters(emptyFilters)}>Clear filters</button>}
      </div>

      {error ? <div className="completed-report-error">{error}<button type="button" onClick={loadReport}>Retry</button></div> : filteredRows.length === 0 ? (
        <div className="completed-report-empty"><strong>No completed inquiries found</strong><span>Try changing the report filters.</span></div>
      ) : (
        <div className="completed-report-grid">
          {filteredRows.map((row) => {
            const summary = getCompletedTaskSummary(row);
            const expanded = expandedId === row.id;
            return <article className="completed-report-card" key={row.id}>
              <div className="completed-report-card-top">
                <div className="completed-report-avatar">{String(row.customer_name || "C").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase()}</div>
                <div className="completed-report-customer"><span>Inquiry #{row.id}</span><h2>{row.customer_name}</h2><p>{row.phone_number || "No phone"}{row.email_id ? ` · ${row.email_id}` : ""}</p></div>
                <span className="completed-report-badge">✓ Completed</span>
              </div>

              <div className="completed-report-facts">
                <div><span>Assigned to</span><strong>{row.resource_name || "Unassigned"}</strong></div>
                <div><span>Scheduled</span><strong>{formatDate(row.schedule_date)}</strong></div>
                <div><span>Work logged</span><strong>{formatDuration(summary.totalSeconds)}</strong></div>
                <div><span>Inquiry value</span><strong>{formatAmount(row.total)}</strong></div>
              </div>

              <div className="completed-report-products"><span>Products / Services</span><div>{(row.products || []).length ? row.products.map((item) => <em key={item.id}>{productName(item)}</em>) : <em>Not specified</em>}</div></div>
              <div className="completed-report-latest"><span>Latest completed work · {summary.latestWorker}</span><p>{summary.latestNotes}</p></div>

              {expanded && <div className="completed-report-history"><h3>Task history</h3>{(row.task_progress || []).map((task) => <div className="completed-report-task" key={task.id}><i /><div><strong>{task.resource_name}</strong><span>{formatDate(task.start_time, true)} — {formatDate(task.end_time, true)}</span><p>{task.progress_notes || "No notes recorded"}</p></div></div>)}</div>}

              <footer>
                <button type="button" className="completed-report-history-btn" onClick={() => setExpandedId(expanded ? null : row.id)}>{expanded ? "Hide task history" : `View task history (${summary.completedCount})`}</button>
                <button type="button" className="completed-report-detail-btn" onClick={() => onViewDetails(row.id)}>View full details →</button>
              </footer>
            </article>;
          })}
        </div>
      )}
    </section>
  );
}
