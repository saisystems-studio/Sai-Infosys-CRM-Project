import { useCallback, useEffect, useState } from "react";
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

export default function PaymentApproval() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [receivedId, setReceivedId] = useState(null);
  const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
  const canMarkReceived = canMarkPaymentReceived(user);

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
        <span className="payment-approval-count">{payments.length} payments</span>
      </div>

      {error && <div className="payment-approval-error">{error}</div>}

      <div className="payment-approval-card">
        {loading ? (
          <div className="payment-approval-empty">Loading payment approvals...</div>
        ) : payments.length === 0 ? (
          <div className="payment-approval-empty">No saved payments found.</div>
        ) : (
          <div className="payment-approval-table-wrap">
            <table className="payment-approval-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Requirement</th>
                  <th>Revenue Amount</th>
                  <th>Payment Amount</th>
                  <th>Payment Type</th>
                  <th>Payment Date</th>
                  <th>Remaining</th>
                  <th>Status / Action</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.customer_name || "-"}</td>
                    <td>{payment.company_name || "-"}</td>
                    <td>{payment.requirement || "-"}</td>
                    <td className="payment-approval-revenue">{formatAmount(payment.revenue_amount)}</td>
                    <td>{formatAmount(payment.payment_amount)}</td>
                    <td>{payment.payment_type === "full" ? "Full Payment" : "Installment"}</td>
                    <td>{formatDate(payment.payment_date)}</td>
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
