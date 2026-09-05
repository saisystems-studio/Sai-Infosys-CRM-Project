import { useEffect, useMemo, useState } from "react";
import { filterPaymentDetails, getPaymentCardSummary, getPaymentCompany, getPaymentProduct } from "./paymentDetailsReport";
import "./CompletedInquiryReport/CompletedInquiryReport.css";
import "./PaymentDetailsReport.css";

const API_BASE = import.meta.env.VITE_API_URL || "/crm/api";
const emptyFilters = { search: "", product: "", company: "", fromDate: "", toDate: "" };
const headers = () => ({ Authorization: `Bearer ${localStorage.getItem("crm_access_token") || ""}` });
const formatAmount = (value) => `₹${Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (value) => value ? new Date(value).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";
const initials = (name) => String(name || "P").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

export default function PaymentReceivedDetails() {
  const [payments, setPayments] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPayments = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/inquiries/payment-received-details/`, { headers: headers() });
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
    fetch(`${API_BASE}/inquiries/payment-received-details/`, { headers: headers() })
      .then((response) => {
        if (!response.ok) throw new Error("Unable to load payment details.");
        return response.json();
      })
      .then((data) => { if (active) setPayments(data); })
      .catch((loadError) => { if (active) setError(loadError.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const filteredPayments = useMemo(() => filterPaymentDetails(payments, filters), [payments, filters]);
  const productOptions = [...new Set(payments.map(getPaymentProduct))].sort();
  const companyOptions = [...new Set(payments.map(getPaymentCompany))].sort();

  const summaryStats = useMemo(() => {
    const totalRevenue = filteredPayments.reduce((sum, payment) => sum + Number(payment.revenue_amount || payment.amount || 0), 0);
    const latestPayment = [...filteredPayments].sort((a, b) => new Date(b.created_on || b.payment_date || 0) - new Date(a.created_on || a.payment_date || 0))[0];
    const productCounts = filteredPayments.reduce((acc, payment) => {
      const product = getPaymentProduct(payment);
      acc[product] = (acc[product] || 0) + 1;
      return acc;
    }, {});
    const topProduct = Object.entries(productCounts).sort((a, b) => b[1] - a[1])[0];

    return {
      totalReceived: filteredPayments.length,
      totalRevenue,
      topProduct: topProduct ? topProduct[0] : "No product",
      latestPayment,
    };
  }, [filteredPayments]);

  if (loading) return <div className="completed-report-state"><span className="completed-report-spinner" />Loading payment details…</div>;

  return (
    <section className="completed-report-page payment-details-report">
      <header className="completed-report-header payment-details-header">
        <div><span className="completed-report-eyebrow">Finance reports</span><h1>Payment Received Report</h1><p>A clear record of customer payments confirmed as received.</p></div>
        <div className="completed-report-total"><strong>{filteredPayments.length}</strong><span>Received</span></div>
      </header>

      <div className="completed-report-filters">
        <label className="completed-report-search"><span>Search</span><input value={filters.search} placeholder="Customer, company or product…" onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        <label><span>Product</span><select value={filters.product} onChange={(event) => setFilters({ ...filters, product: event.target.value })}><option value="">All products</option>{productOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>Company</span><select value={filters.company} onChange={(event) => setFilters({ ...filters, company: event.target.value })}><option value="">All companies</option>{companyOptions.map((value) => <option key={value}>{value}</option>)}</select></label>
        <label><span>From</span><input type="date" value={filters.fromDate} onChange={(event) => setFilters({ ...filters, fromDate: event.target.value })} /></label>
        <label><span>To</span><input type="date" value={filters.toDate} onChange={(event) => setFilters({ ...filters, toDate: event.target.value })} /></label>
        {Object.values(filters).some(Boolean) && <button type="button" onClick={() => setFilters(emptyFilters)}>Clear</button>}
      </div>

      {error ? <div className="completed-report-error">{error}<button type="button" onClick={loadPayments}>Retry</button></div> : (
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
              <span>Top product</span>
              <strong>{summaryStats.topProduct}</strong>
              <small>{filteredPayments.length ? "Best performer" : "No data"}</small>
            </div>
            <div className="payment-details-summary-card">
              <span>Latest payment</span>
              <strong>{summaryStats.latestPayment ? formatDate(summaryStats.latestPayment.created_on || summaryStats.latestPayment.payment_date) : "—"}</strong>
              <small>{summaryStats.latestPayment ? summaryStats.latestPayment.customer_name || "Customer" : "Waiting for records"}</small>
            </div>
          </div>

          {filteredPayments.length === 0 ? (
            <div className="completed-report-empty"><strong>No payment details found</strong><span>Try changing the report filters.</span></div>
          ) : <div className="completed-report-grid">{filteredPayments.map((payment) => {
            const summary = getPaymentCardSummary(payment);
            const receivedDate = payment.created_on || payment.payment_date;
            return <article className="completed-report-card payment-details-card" key={payment.id}>
              <div className="completed-report-card-top"><div className="completed-report-avatar payment-details-avatar">{initials(payment.customer_name)}</div><div className="completed-report-customer"><span>Payment #{payment.id}</span><h2>{payment.customer_name || "Unknown customer"}</h2><p>{summary.company}</p></div><span className="completed-report-badge">✓ Received</span></div>
              <div className="completed-report-facts"><div><span>Payment date</span><strong>{formatDate(receivedDate)}</strong></div><div><span>Product</span><strong>{summary.product}</strong></div><div><span>Paid amount</span><strong>{formatAmount(summary.paidAmount)}</strong></div><div><span>Revenue</span><strong className="payment-details-revenue">{formatAmount(summary.revenueAmount)}</strong></div></div>
              <div className="payment-details-company"><span>Company</span><strong>{summary.company}</strong></div>
              <footer><span>Transaction recorded</span><strong>{formatDate(receivedDate)}</strong></footer>
            </article>;
          })}</div>}
        </>
      )}
    </section>
  );
}
