import { useCallback, useEffect, useMemo, useState } from "react";
import "./PaymentApproval.css";
import "./PaymentPending.css";
import { applyRecordedPayment } from "./paymentPendingState";
import { authorizedPaymentFetch } from "./paymentPendingApi";
import { canRecordPayment } from "./paymentApprovalAccess";

const API_BASE = "http://127.0.0.1:8000/api";

const formatAmount = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getPaymentProduct = (payment) =>
  payment?.product_name || payment?.product_type_name || payment?.requirement || "Product";

const getPaymentCompany = (payment) => payment?.company_name || "Unassigned Company";

const getPaymentDate = (payment) =>
  payment?.created_on || payment?.createdAt || payment?.Created_On || payment?.latest_payment_date || "";

export default function PaymentPending() {
  const currentUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("crm_user") || "{}");
    } catch {
      return {};
    }
  }, []);
  const canRecord = canRecordPayment(currentUser);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [amount, setAmount] = useState("");
  const [paymentType, setPaymentType] = useState("full");
  const [saving, setSaving] = useState(false);
  const [productFilter, setProductFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const productOptions = useMemo(
    () =>
      [...new Set(payments.map((payment) => getPaymentProduct(payment)))].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [payments],
  );

  const companyOptions = useMemo(
    () =>
      [...new Set(payments.map((payment) => getPaymentCompany(payment)))].filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [payments],
  );

  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) => {
        const productName = getPaymentProduct(payment);
        const companyName = getPaymentCompany(payment);
        const paymentDate = getPaymentDate(payment);

        const matchesProduct = productFilter === "all" || productName === productFilter;
        const matchesCompany = companyFilter === "all" || companyName === companyFilter;

        const normalizedDate = paymentDate ? new Date(paymentDate) : null;
        const fromDateValue = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
        const toDateValue = toDate ? new Date(`${toDate}T23:59:59`) : null;

        const matchesFromDate = !fromDate || !normalizedDate || normalizedDate >= fromDateValue;
        const matchesToDate = !toDate || !normalizedDate || normalizedDate <= toDateValue;

        return matchesProduct && matchesCompany && matchesFromDate && matchesToDate;
      }),
    [companyFilter, fromDate, payments, productFilter, toDate],
  );

  const clearFilters = () => {
    setProductFilter("all");
    setCompanyFilter("all");
    setFromDate("");
    setToDate("");
  };

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await authorizedPaymentFetch(
        `${API_BASE}/inquiries/payment-pending/`,
        {},
        { apiUrl: API_BASE },
      );
      if (!response.ok) throw new Error("Unable to load pending payments.");
      setPayments(await response.json());
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const openPaymentModal = (payment) => {
    setSelectedPayment(payment);
    setPaymentType("full");
    setAmount(payment.remaining_balance);
    setError("");
  };

  const closePaymentModal = () => {
    if (!saving) setSelectedPayment(null);
  };

  const submitPayment = async (event) => {
    event.preventDefault();
    if (!selectedPayment) return;

    try {
      setSaving(true);
      setError("");
      const response = await authorizedPaymentFetch(
        `${API_BASE}/inquiries/payment-pending/${selectedPayment.id}/paid/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ amount, payment_type: paymentType }),
        },
        { apiUrl: API_BASE },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.amount?.[0] || data.payment_type?.[0] || data.detail || "Unable to record payment.");
      }
      setPayments((current) => applyRecordedPayment(current, data));
      setSelectedPayment(null);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const hasActiveFilters = productFilter !== "all" || companyFilter !== "all" || fromDate || toDate;

  return (
    <section className="payment-approval-page">
      <div className="payment-approval-heading">
        <div>
          <span className="payment-approval-kicker">Finance control</span>
          <h1>Payment Pending</h1>
          <p>Record full payments or installments and track balances.</p>
        </div>
        <span className="payment-approval-count">{filteredPayments.length} pending</span>
      </div>

      {error && !selectedPayment && <div className="payment-approval-error">{error}</div>}

      <div className="payment-pending-filter-bar">
        <div className="payment-pending-filter-group">
          <label>
            <span>Product</span>
            <select value={productFilter} onChange={(event) => setProductFilter(event.target.value)}>
              <option value="all">All products</option>
              {productOptions.map((product) => (
                <option key={product} value={product}>{product}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Company</span>
            <select value={companyFilter} onChange={(event) => setCompanyFilter(event.target.value)}>
              <option value="all">All companies</option>
              {companyOptions.map((company) => (
                <option key={company} value={company}>{company}</option>
              ))}
            </select>
          </label>
          <label>
            <span>From date</span>
            <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </label>
          <label>
            <span>To date</span>
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
        </div>
        {hasActiveFilters && (
          <button type="button" className="payment-pending-clear-btn" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <div className="payment-approval-card">
        {loading ? (
          <div className="payment-approval-empty">Loading pending payments...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="payment-approval-empty">
            {hasActiveFilters ? "No pending payments match the current filters." : "No pending payments found."}
          </div>
        ) : (
          <div className="payment-approval-table-wrap">
            <table className="payment-approval-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Product</th>
                  <th>Date</th>
                  <th>Revenue Amount</th>
                  <th>Paid Amount</th>
                  <th>Remaining</th>
                  {canRecord && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.customer_name || "-"}</td>
                    <td>{payment.company_name || "-"}</td>
                    <td>{getPaymentProduct(payment)}</td>
                    <td>{formatDate(getPaymentDate(payment))}</td>
                    <td>{formatAmount(payment.revenue_amount)}</td>
                    <td>{formatAmount(payment.total_paid)}</td>
                    <td className="payment-pending-balance">{formatAmount(payment.remaining_balance)}</td>
                    {canRecord && (
                      <td>
                        <button type="button" className="payment-received-btn" onClick={() => openPaymentModal(payment)}>
                          Paid
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedPayment && (
        <div className="payment-pending-modal-backdrop" onMouseDown={closePaymentModal}>
          <form className="payment-pending-modal" onSubmit={submitPayment} onMouseDown={(event) => event.stopPropagation()}>
            <div className="payment-pending-modal-header">
              <div>
                <span className="payment-approval-kicker">Record payment</span>
                <h2>{selectedPayment.customer_name || "Customer"}</h2>
              </div>
              <button type="button" className="payment-pending-close" onClick={closePaymentModal} disabled={saving}>×</button>
            </div>
            <p className="payment-pending-remaining">Remaining balance: <strong>{formatAmount(selectedPayment.remaining_balance)}</strong></p>
            {error && <div className="payment-approval-error">{error}</div>}
            <label className="payment-pending-field">
              Payment amount
              <input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} required />
            </label>
            <fieldset className="payment-pending-types">
              <legend>Payment type</legend>
              <label>
                <input type="radio" value="full" checked={paymentType === "full"} onChange={() => { setPaymentType("full"); setAmount(selectedPayment.remaining_balance); }} />
                Full Payment
              </label>
              <label>
                <input type="radio" value="installment" checked={paymentType === "installment"} onChange={() => setPaymentType("installment")} />
                Installment
              </label>
            </fieldset>
            <div className="payment-pending-modal-actions">
              <button type="button" className="payment-pending-cancel" onClick={closePaymentModal} disabled={saving}>Cancel</button>
              <button type="submit" className="payment-received-btn" disabled={saving}>{saving ? "Saving..." : "Confirm Paid"}</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
