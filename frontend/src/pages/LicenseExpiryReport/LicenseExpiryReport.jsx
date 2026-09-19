import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  filterLicenseExpiryRows,
  getLicenseExpiryDateRange,
} from "./licenseExpiryReport";
import { exportReport } from "../../reportExport";
import "./LicenseExpiryReport.css";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/crm/api";
const defaultRange = getLicenseExpiryDateRange("this-month");

const formatDate = (value) => {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-IN", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(date);
};

export default function LicenseExpiryReport() {
  const [period, setPeriod] = useState("this-month");
  const [filters, setFilters] = useState({ ...defaultRange, productId: "" });
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  const hasCustomRange = period !== "custom" || (filters.fromDate && filters.toDate);
  const reportRows = useMemo(
    () => filterLicenseExpiryRows(rows, filters),
    [rows, filters],
  );

  const loadReport = async () => {
    if (!hasCustomRange) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const params = {
        from_date: filters.fromDate,
        to_date: filters.toDate,
        ...(filters.productId ? { product_id: filters.productId } : {}),
      };
      const response = await axios.get(`${API_BASE_URL}/license-expiry-report/`, {
        params,
        headers: { Authorization: `Bearer ${localStorage.getItem("crm_access_token")}` },
      });
      setRows(response.data.rows || []);
      setProducts(response.data.products || []);
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Unable to load the licence expiry report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
    // Fetch after the selected period or licence type changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.fromDate, filters.toDate, filters.productId, hasCustomRange]);

  const selectPeriod = (value) => {
    setPeriod(value);
    setFilters((current) => ({
      ...current,
      ...getLicenseExpiryDateRange(value),
    }));
  };
  const handleExport = async (format) => {
    setExporting(format);
    try {
      await exportReport({
        format, title: "Customer Licence Expiry Report", filename: "licence-expiry-report",
        periodLabel: `${filters.fromDate} to ${filters.toDate}`,
        headers: ["Company name", "Contact number", "Product", "Serial number", "Expiry date"],
        rows: reportRows.map((row) => [row.company_name || "", row.contact_number || "", row.product_name || "", row.serial_number || "", formatDate(row.expiry_date)]),
      });
    } finally { setExporting(""); }
  };

  return (
    <section className="license-expiry-report-page">
      <header className="license-expiry-report-header">
        <div>
          <span className="license-expiry-report-eyebrow">Customer reports</span>
          <h1>Customer Licence Expiry Report</h1>
          <p>Track customer licence renewals due in the selected period.</p>
        </div>
        <div className="license-expiry-report-total">
          <strong>{reportRows.length}</strong>
          <span>Licences expiring</span>
        </div>
      </header>

      <div className="license-expiry-report-filters">
        <label>
          <span>Period</span>
          <select value={period} onChange={(event) => selectPeriod(event.target.value)}>
            <option value="last-month">Last month</option>
            <option value="this-month">This month</option>
            <option value="next-month">Next month</option>
            <option value="next-year">Next year</option>
            <option value="custom">Mention period</option>
          </select>
        </label>
        {period === "custom" && <>
          <label><span>From date</span><input type="date" value={filters.fromDate} onChange={(event) => setFilters((current) => ({ ...current, fromDate: event.target.value }))} /></label>
          <label><span>To date</span><input type="date" value={filters.toDate} onChange={(event) => setFilters((current) => ({ ...current, toDate: event.target.value }))} /></label>
        </>}
        <label>
          <span>Product</span>
          <select value={filters.productId} onChange={(event) => setFilters((current) => ({ ...current, productId: event.target.value }))}>
            <option value="">All licence types</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
          </select>
        </label>
        <div className="report-export-actions">
          <button type="button" disabled={!reportRows.length || Boolean(exporting)} onClick={() => handleExport("excel")}>{exporting === "excel" ? "Exporting..." : "Export Excel"}</button>
          <button type="button" disabled={!reportRows.length || Boolean(exporting)} onClick={() => handleExport("pdf")}>{exporting === "pdf" ? "Exporting..." : "Export PDF"}</button>
        </div>
      </div>

      {loading ? <div className="license-expiry-report-state"><span className="license-expiry-report-spinner" />Loading licences…</div> : error ? (
        <div className="license-expiry-report-error"><span>{error}</span><button type="button" onClick={loadReport}>Retry</button></div>
      ) : !hasCustomRange ? (
        <div className="license-expiry-report-empty"><strong>Select a date range</strong><span>Choose both dates to view licence expiries.</span></div>
      ) : reportRows.length === 0 ? (
        <div className="license-expiry-report-empty"><strong>No licences expire in this period</strong><span>Try another period or licence type.</span></div>
      ) : (
        <div className="license-expiry-report-table-wrap">
          <div className="license-expiry-report-table" role="table" aria-label="Customer licence expiry details">
            <div className="license-expiry-report-table-head" role="row">
              <span role="columnheader">Company name</span><span role="columnheader">Contact number</span><span role="columnheader">Product</span><span role="columnheader">Serial number</span><span role="columnheader">Expiry date</span>
            </div>
            {reportRows.map((row) => (
              <div className="license-expiry-report-table-row" role="row" key={row.id}>
                <strong role="cell" data-label="Company name">{row.company_name}</strong>
                <span role="cell" data-label="Contact number">{row.contact_number || "—"}</span>
                <span role="cell" data-label="Product"><em>{row.product_name}</em></span>
                <span role="cell" data-label="Serial number">{row.serial_number || "—"}</span>
                <time role="cell" data-label="Expiry date" dateTime={row.expiry_date}>{formatDate(row.expiry_date)}</time>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
