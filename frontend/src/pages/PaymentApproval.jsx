import { useCallback, useEffect, useMemo, useState } from "react";
import "./PaymentApproval.css";
import { canMarkPaymentReceived } from "./paymentApprovalAccess";
import { authorizedPaymentFetch } from "./paymentPendingApi";

const API_BASE = "http://127.0.0.1:8000/api";

const formatAmount = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatDate = (value) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "-";

const getPaymentProduct = (payment) =>
  payment?.product_name || payment?.product?.product_type_name || payment?.requirement || "Product";

const getPaymentCompany = (payment) => payment?.company_name || "Unassigned Company";

export default function PaymentApproval() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [receivedId, setReceivedId] = useState(null);
  const [productFilter, setProductFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
  const canMarkReceived = canMarkPaymentReceived(user);

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
        const paymentDate = payment?.payment_date ? new Date(payment.payment_date) : null;
        const fromDateValue = fromDate ? new Date(`${fromDate}T00:00:00`) : null;
        const toDateValue = toDate ? new Date(`${toDate}T23:59:59`) : null;

        const matchesProduct = productFilter === "all" || productName === productFilter;
        const matchesCompany = companyFilter === "all" || companyName === companyFilter;
        const matchesFromDate = !fromDate || !paymentDate || paymentDate >= fromDateValue;
        const matchesToDate = !toDate || !paymentDate || paymentDate <= toDateValue;

        return matchesProduct && matchesCompany && matchesFromDate && matchesToDate;
      }),
    [companyFilter, fromDate, payments, productFilter, toDate],
  );

  const hasActiveFilters = productFilter !== "all" || companyFilter !== "all" || fromDate || toDate;

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
        `${API_BASE}/inquiries/payment-approvals/`,
        {},
        { apiUrl: API_BASE },
      );
      if (!response.ok) throw new Error("Unable to load payment approvals.");
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

  const markReceived = async (paymentId) => {
    try {
      setReceivedId(paymentId);
      setError("");
      const response = await authorizedPaymentFetch(
        `${API_BASE}/inquiries/payment-approvals/${paymentId}/received/`,
        { method: "POST" },
        { apiUrl: API_BASE },
      );
      if (!response.ok) throw new Error("Unable to update payment.");
      await loadPayments();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setReceivedId(null);
    }
  };

  return (
    <section className="payment-approval-page">
      <div className="payment-approval-heading">
        <div>
          <span className="payment-approval-kicker">Finance control</span>
          <h1>Payment Approval</h1>
          <p>Review each payment saved from Payment Pending.</p>
        </div>
        <span className="payment-approval-count">{filteredPayments.length} payments</span>
      </div>

      {error && <div className="payment-approval-error">{error}</div>}

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
          <div className="payment-approval-empty">Loading payment approvals...</div>
        ) : filteredPayments.length === 0 ? (
          <div className="payment-approval-empty">
            {hasActiveFilters ? "No saved payments match the current filters." : "No saved payments found."}
          </div>
        ) : (
          <div className="payment-approval-table-wrap">
            <table className="payment-approval-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Product</th>
                  <th>Payment Date</th>
                  <th>Revenue Amount</th>
                  <th>Payment Amount</th>
                  <th>Payment Type</th>
                  <th>Remaining</th>
                  <th>Status / Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.customer_name || "-"}</td>
                    <td>{payment.company_name || "-"}</td>
                    <td>{getPaymentProduct(payment)}</td>
                    <td>{formatDate(payment.payment_date)}</td>
                    <td className="payment-approval-revenue">{formatAmount(payment.revenue_amount)}</td>
                    <td>{formatAmount(payment.payment_amount)}</td>
                    <td>{payment.payment_type === "full" ? "Full Payment" : "Installment"}</td>
                    <td className="payment-approval-balance">{formatAmount(payment.remaining_balance)}</td>
                    <td>
                      {!canMarkReceived || payment.approval_status !== "Pending" ? (
                        <span className={payment.approval_status === "Received" ? "payment-status received" : "payment-status pending"}>
                          {payment.approval_status || "Pending"}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="payment-received-btn"
                          onClick={() => markReceived(payment.id)}
                          disabled={receivedId === payment.id}
                        >
                          {receivedId === payment.id ? "Saving..." : "Received"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
