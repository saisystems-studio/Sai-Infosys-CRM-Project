import { useEffect, useMemo, useState } from "react";
import {
  filterPaymentDetails,
  getPaymentCardSummary,
  getPaymentCompany,
  getPaymentProduct,
  getPaymentStaff,
} from "./paymentDetailsReport";
import { getCompletedReportDateRange } from "./CompletedInquiryReport/completedInquiryReport";
import { exportReport } from "../reportExport";
import "./CompletedInquiryReport/CompletedInquiryReport.css";
import "./PaymentDetailsReport.css";

const API_BASE = import.meta.env.VITE_API_URL || "/crm/api";
const emptyFilters = {
  search: "",
  product: "",
  company: "",
  staff: "",
  fromDate: "",
  toDate: "",
};
const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem("crm_access_token") || ""}`,
});
const formatAmount = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

export default function PaymentReceivedDetails() {
  const [payments, setPayments] = useState([]);
  const [staff, setStaff] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [datePreset, setDatePreset] = useState("custom");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState("");

  const selectDatePreset = (preset) => {
    setDatePreset(preset);
    setFilters((current) => ({
      ...current,
      ...getCompletedReportDateRange(preset),
    }));
  };

  const loadPayments = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `${API_BASE}/inquiries/payment-received-details/`,
        { headers: headers() },
      );
      if (!response.ok) throw new Error("Unable to load payment details.");
      setPayments(await response.json());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    fetch(`${API_BASE}/inquiries/payment-received-details/`, {
      headers: headers(),
    })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load payment details.");
        return response.json();
      })
      .then((data) => {
        if (active) setPayments(data);
      })
      .catch((loadError) => {
        if (active) setError(loadError.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    fetch(`${API_BASE}/inquiries/resources/`, { headers: headers() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load staff.");
        return response.json();
      })
      .then((data) => {
        if (active) setStaff(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // Payment data stays usable if the optional staff list is unavailable.
      });

    return () => {
      active = false;
    };
  }, []);

  const filteredPayments = useMemo(
    () => filterPaymentDetails(payments, filters),
    [payments, filters],
  );
  const productOptions = [...new Set(payments.map(getPaymentProduct))].sort();
  const companyOptions = [...new Set(payments.map(getPaymentCompany))].sort();
  const staffOptions = [
    ...new Set([
      ...staff.map((member) => member.Full_Name).filter(Boolean),
      ...payments.map(getPaymentStaff),
    ]),
  ].sort();
  const summaryStats = useMemo(() => {
    const totalPaidAmount = filteredPayments.reduce(
      (sum, payment) =>
        sum + Number(payment.payment_amount || payment.amount || 0),
      0,
    );
    const totalRevenue = filteredPayments.reduce(
      (sum, payment) =>
        sum + Number(payment.revenue_amount || payment.amount || 0),
      0,
    );
    const latestPayment = [...filteredPayments].sort(
      (a, b) =>
        new Date(b.payment_date || b.created_on || 0) -
        new Date(a.payment_date || a.created_on || 0),
    )[0];
    return {
      totalReceived: filteredPayments.length,
      totalPaidAmount,
      totalRevenue,
      latestPayment,
    };
  }, [filteredPayments]);
  const handleExport = async (format) => {
    setExporting(format);
    try {
      await exportReport({
        format, title: "Payment Received Report", filename: "payment-received-report",
        periodLabel: filters.fromDate && filters.toDate ? `${filters.fromDate} to ${filters.toDate}` : "All payments",
        headers: ["Company", "Payment date", "Product", "Paid amount", "Revenue", "Payment type", "Remaining", "Status"],
        rows: filteredPayments.map((payment) => {
          const summary = getPaymentCardSummary(payment);
          return [summary.company, formatDate(payment.payment_date || payment.created_on), summary.product, Number(summary.paidAmount || 0), Number(summary.revenueAmount || 0), payment.payment_type === "full" ? "Full Payment" : "Installment", Number(payment.remaining_balance || 0), "Received"];
        }),
      });
    } finally { setExporting(""); }
  };

  if (loading)
    return (
      <div className="completed-report-state">
        <span className="completed-report-spinner" />
        Loading payment details…
      </div>
    );

  return (
    <section className="completed-report-page payment-details-report">
      <header className="completed-report-header payment-details-header">
        <div>
          <span className="completed-report-eyebrow">Finance reports</span>
          <h1>Payment Received Report</h1>
          <p>A clear record of customer payments confirmed as received.</p>
        </div>
        <div className="payment-details-header-amount">
          <span>Total paid amount</span>
          <strong>{formatAmount(summaryStats.totalPaidAmount)}</strong>
          <small>For the selected filters</small>
        </div>
        <div className="completed-report-total">
          <strong>{filteredPayments.length}</strong>
          <span>Received</span>
        </div>
      </header>

      <div className="completed-report-filters">
        <label className="completed-report-search">
          <span>Search</span>
          <input
            value={filters.search}
            placeholder="Customer, company or product…"
            onChange={(event) =>
              setFilters({ ...filters, search: event.target.value })
            }
          />
        </label>
        <label>
          <span>Period</span>
          <select
            value={datePreset}
            onChange={(event) => selectDatePreset(event.target.value)}
          >
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="today-yesterday">Yesterday &amp; Today</option>
            <option value="last-7-days">Last 7 days</option>
            <option value="next-month">Next month</option>
            <option value="this-month">This month</option>
            <option value="last-month">Last month</option>
            <option value="custom">Mention period</option>
          </select>
        </label>
        <label>
          <span>Product</span>
          <select
            value={filters.product}
            onChange={(event) =>
              setFilters({ ...filters, product: event.target.value })
            }
          >
            <option value="">All products</option>
            {productOptions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Company</span>
          <select
            value={filters.company}
            onChange={(event) =>
              setFilters({ ...filters, company: event.target.value })
            }
          >
            <option value="">All companies</option>
            {companyOptions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <label className="payment-details-staff-filter">
          <span>Staff</span>
          <select
            value={filters.staff}
            onChange={(event) =>
              setFilters({ ...filters, staff: event.target.value })
            }
          >
            <option value="">All staff</option>
            {staffOptions.map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        {datePreset === "custom" && (
          <>
            <label>
              <span>From date</span>
              <input
                type="date"
                value={filters.fromDate}
                onChange={(event) =>
                  setFilters({ ...filters, fromDate: event.target.value })
                }
              />
            </label>
            <label>
              <span>To date</span>
              <input
                type="date"
                value={filters.toDate}
                onChange={(event) =>
                  setFilters({ ...filters, toDate: event.target.value })
                }
              />
            </label>
          </>
        )}
        {Object.values(filters).some(Boolean) && (
          <button
            type="button"
            onClick={() => {
              setDatePreset("custom");
              setFilters(emptyFilters);
            }}
          >
            Clear
          </button>
        )}
        <div className="completed-report-export-actions">
          <button type="button" disabled={!filteredPayments.length || Boolean(exporting)} onClick={() => handleExport("excel")}>{exporting === "excel" ? "Exporting..." : "Export Excel"}</button>
          <button type="button" disabled={!filteredPayments.length || Boolean(exporting)} onClick={() => handleExport("pdf")}>{exporting === "pdf" ? "Exporting..." : "Export PDF"}</button>
        </div>
      </div>

      {error ? (
        <div className="completed-report-error">
          {error}
          <button type="button" onClick={loadPayments}>
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="payment-details-summary">
            <div className="payment-details-summary-card">
              <span>Total received</span>
              <strong>{summaryStats.totalReceived}</strong>
              <small>Payments</small>
            </div>
            <div className="payment-details-summary-card accent">
              <span>Total revenue</span>
              <strong>{formatAmount(summaryStats.totalRevenue)}</strong>
              <small>Confirmed</small>
            </div>
            <div className="payment-details-summary-card">
              <span>Total paid amount</span>
              <strong>{formatAmount(summaryStats.totalPaidAmount)}</strong>
              <small>Received from customers</small>
            </div>
            <div className="payment-details-summary-card">
              <span>Latest payment</span>
              <strong>
                {summaryStats.latestPayment
                  ? formatDate(
                      summaryStats.latestPayment.payment_date ||
                        summaryStats.latestPayment.created_on,
                    )
                  : "—"}
              </strong>
              <small>
                {summaryStats.latestPayment
                  ? summaryStats.latestPayment.customer_name || "Customer"
                  : "Waiting for records"}
              </small>
            </div>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="completed-report-empty">
              <strong>No payment details found</strong>
              <span>Try changing the report filters.</span>
            </div>
          ) : (
            <div className="payment-details-table-wrap">
              <div
                className="payment-details-table"
                role="table"
                aria-label="Received payment details"
              >
                <div className="payment-details-table-head" role="row">
                  <span role="columnheader">Company</span>
                  <span role="columnheader">Payment date</span>
                  <span role="columnheader">Product</span>
                  <span role="columnheader">Paid amount</span>
                  <span role="columnheader">Revenue</span>
                  <span role="columnheader">Payment type</span>
                  <span role="columnheader">Remaining</span>
                  <span role="columnheader">Status</span>
                </div>
                {filteredPayments.map((payment) => {
                  const summary = getPaymentCardSummary(payment);
                  const receivedDate =
                    payment.payment_date || payment.created_on;
                  return (
                    <div
                      className="payment-details-table-row"
                      role="row"
                      key={payment.id}
                    >
                      <span
                        role="cell"
                        data-label="Company"
                        className="payment-details-company"
                      >
                        {summary.company}
                      </span>
                      <span role="cell" data-label="Payment date">
                        {formatDate(receivedDate)}
                      </span>
                      <span role="cell" data-label="Product">
                        {summary.product}
                      </span>
                      <span
                        role="cell"
                        data-label="Paid amount"
                        className="payment-details-paid"
                      >
                        {formatAmount(summary.paidAmount)}
                      </span>
                      <span
                        role="cell"
                        data-label="Revenue"
                        className="payment-details-revenue"
                      >
                        {formatAmount(summary.revenueAmount)}
                      </span>
                      <span role="cell" data-label="Payment type">
                        {payment.payment_type === "full"
                          ? "Full Payment"
                          : "Installment"}
                      </span>
                      <span
                        role="cell"
                        data-label="Remaining"
                        className="payment-details-remaining"
                      >
                        {formatAmount(payment.remaining_balance)}
                      </span>
                      <span role="cell" data-label="Status">
                        <span className="payment-details-status">
                          ✓ Received
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
