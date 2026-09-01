import { useCallback, useEffect, useState } from "react";
import "./PaymentApproval.css";

const API_BASE = "http://127.0.0.1:8000/api";

const headers = () => ({
  Authorization: `Bearer ${localStorage.getItem("crm_access_token")}`,
});

const formatAmount = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function PaymentReceivedDetails() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const response = await fetch(
        `${API_BASE}/inquiries/payment-received-details/`,
        { headers: headers() },
      );
      if (!response.ok) {
        throw new Error("Unable to load received payment details.");
      }
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

  return (
    <section className="payment-approval-page">
      <div className="payment-approval-heading">
        <div>
          <span className="payment-approval-kicker">Finance control</span>
          <h1>Payment Received Details</h1>
          <p>View revenue payments confirmed as received.</p>
        </div>
        <span className="payment-approval-count">{payments.length} received</span>
      </div>
      {error && <div className="payment-approval-error">{error}</div>}
      <div className="payment-approval-card">
        {loading ? (
          <div className="payment-approval-empty">
            Loading received payment details...
          </div>
        ) : payments.length === 0 ? (
          <div className="payment-approval-empty">
            No received payments found.
          </div>
        ) : (
          <div className="payment-approval-table-wrap">
            <table className="payment-approval-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Requirement</th>
                  <th>Amount</th>
                  <th>Revenue Amount</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.customer_name || "-"}</td>
                    <td>{payment.company_name || "-"}</td>
                    <td>{payment.requirement || "-"}</td>
                    <td>{formatAmount(payment.amount)}</td>
                    <td className="payment-approval-revenue">
                      {formatAmount(payment.revenue_amount)}
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
