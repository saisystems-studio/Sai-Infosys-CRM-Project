import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FiCalendar,
  FiCheck,
  FiBox,
  FiEdit3,
  FiPhone,
} from "react-icons/fi";
import "./PaymentApproval.css";
import "./PaymentPending.css";
import { applyRecordedPayment } from "./paymentPendingState";
import { authorizedPaymentFetch } from "./paymentPendingApi";
import { canRecordPayment } from "./paymentApprovalAccess";
import { buildProductBillDetailSummary } from "./productBillDetailPresentation";

const API_BASE = "/crm/api";

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

const formatDateInput = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

const getPaymentProduct = (payment) =>
  payment?.product_name ||
  payment?.product_type_name ||
  payment?.requirement ||
  "Product";

const getPaymentCompany = (payment) =>
  payment?.company_name || "Unassigned Company";

const getPaymentDate = (payment) =>
  payment?.created_on ||
  payment?.createdAt ||
  payment?.Created_On ||
  payment?.latest_payment_date ||
  "";

const isProductBill = (payment) => payment?.source === "product_billing";

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
  const [selectedBilling, setSelectedBilling] = useState(null);
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpType, setFollowUpType] = useState("call");
  const [followUpNotes, setFollowUpNotes] = useState("");
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentModalMode, setPaymentModalMode] = useState("record");
  const [paymentType, setPaymentType] = useState("full");
  const [saving, setSaving] = useState(false);
  const [productFilter, setProductFilter] = useState("all");
  const [companyFilter, setCompanyFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const selectedBillingSummary = selectedBilling
    ? buildProductBillDetailSummary(selectedBilling)
    : null;

  const productOptions = useMemo(
    () =>
      [...new Set(payments.map((payment) => getPaymentProduct(payment)))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [payments],
  );

  const companyOptions = useMemo(
    () =>
      [...new Set(payments.map((payment) => getPaymentCompany(payment)))]
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    [payments],
  );

  const filteredPayments = useMemo(
    () =>
      payments.filter((payment) => {
        const productName = getPaymentProduct(payment);
        const companyName = getPaymentCompany(payment);
        const paymentDate = getPaymentDate(payment);

        const matchesProduct =
          productFilter === "all" || productName === productFilter;
        const matchesCompany =
          companyFilter === "all" || companyName === companyFilter;

        const normalizedDate = paymentDate ? new Date(paymentDate) : null;
        const fromDateValue = fromDate
          ? new Date(`${fromDate}T00:00:00`)
          : null;
        const toDateValue = toDate ? new Date(`${toDate}T23:59:59`) : null;

        const matchesFromDate =
          !fromDate || !normalizedDate || normalizedDate >= fromDateValue;
        const matchesToDate =
          !toDate || !normalizedDate || normalizedDate <= toDateValue;

        return (
          matchesProduct && matchesCompany && matchesFromDate && matchesToDate
        );
      }),
    [companyFilter, fromDate, payments, productFilter, toDate],
  );

  const totalRemaining = useMemo(
    () =>
      filteredPayments.reduce(
        (total, payment) => total + (Number(payment.remaining_balance) || 0),
        0,
      ),
    [filteredPayments],
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
    setPaymentModalMode("record");
    setPaymentType("full");
    setAmount(payment.remaining_balance);
    setError("");
  };

  const openPaidAmountEditor = (payment) => {
    setSelectedPayment(payment);
    setPaymentModalMode("edit");
    setAmount(payment.total_paid);
    setError("");
  };

  const openProductBillDetail = async (payment) => {
    setDetailLoading(true);
    setError("");
    try {
      const response = await authorizedPaymentFetch(
        `${API_BASE}/inquiries/payment-pending/${payment.id}/follow-up/`,
        {},
        { apiUrl: API_BASE },
      );
      const followUps = await response.json();
      if (!response.ok) throw new Error(followUps.detail || "Unable to load bill follow-ups.");
      setSelectedBilling({ ...payment, followUps });
      setFollowUpDate(new Date().toISOString().split("T")[0]);
      setFollowUpType("call");
      setFollowUpNotes("");
    } catch (detailError) {
      setError(detailError.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitProductBillFollowUp = async (event) => {
    event.preventDefault();
    if (!selectedBilling) return;
    try {
      setFollowUpSaving(true);
      setError("");
      const response = await authorizedPaymentFetch(
        `${API_BASE}/inquiries/payment-pending/${selectedBilling.id}/follow-up/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            FollowUp_Date: followUpDate,
            FollowUp_Type: followUpType,
            Notes: followUpNotes,
          }),
        },
        { apiUrl: API_BASE },
      );
      const followUp = await response.json();
      if (!response.ok) throw new Error(followUp.detail || "Unable to save bill follow-up.");
      setSelectedBilling((current) => current && ({
        ...current,
        followUps: [followUp, ...(current.followUps || [])],
      }));
      setFollowUpNotes("");
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setFollowUpSaving(false);
    }
  };

  const openInquiryDetail = async (payment) => {
    setDetailLoading(true);
    setError("");
    try {
      const response = await authorizedPaymentFetch(
        `${API_BASE}/inquiries/${payment.Inquiry_Id}/task-detail/`,
        {},
        { apiUrl: API_BASE },
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.detail || "Unable to load inquiry tasks.");
      const historyResponse = await authorizedPaymentFetch(
        `${API_BASE}/inquiries/payment-pending/${payment.id}/follow-up/`,
        {},
        { apiUrl: API_BASE },
      );
      const history = await historyResponse.json();
      if (!historyResponse.ok)
        throw new Error(history.detail || "Unable to load payment follow-ups.");
      setSelectedInquiry({ payment, detail: data, followUps: history });
      // Set default follow-up date to today
      const today = new Date().toISOString().split("T")[0];
      setFollowUpDate(today);
      setFollowUpType("call");
      setFollowUpNotes("");
    } catch (detailError) {
      setError(detailError.message);
    } finally {
      setDetailLoading(false);
    }
  };

  const submitFollowUp = async (event) => {
    event.preventDefault();
    if (!selectedInquiry) return;
    try {
      setFollowUpSaving(true);
      setError("");
      const response = await authorizedPaymentFetch(
        `${API_BASE}/inquiries/payment-pending/${selectedInquiry.payment.id}/follow-up/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            FollowUp_Date: followUpDate,
            FollowUp_Type: followUpType,
            Notes: followUpNotes,
          }),
        },
        { apiUrl: API_BASE },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.FollowUp_Date?.[0] ||
            data.FollowUp_Type?.[0] ||
            data.Notes?.[0] ||
            data.detail ||
            "Unable to save follow-up.",
        );
      }
      setFollowUpDate(formatDateInput(new Date()));
      setFollowUpType("call");
      setFollowUpNotes("");
      setSelectedInquiry(
        (current) =>
          current && {
            ...current,
            followUps: [...current.followUps, data].sort(
              (a, b) =>
                b.FollowUp_Date.localeCompare(a.FollowUp_Date) ||
                b.FollowUp_Id - a.FollowUp_Id,
            ),
          },
      );
    } catch (followUpError) {
      setError(followUpError.message);
    } finally {
      setFollowUpSaving(false);
    }
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
      const isEdit = paymentModalMode === "edit";
      const response = await authorizedPaymentFetch(
        `${API_BASE}/inquiries/payment-pending/${selectedPayment.id}/${isEdit ? "paid-amount" : "paid"}/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(isEdit ? { total_paid: amount } : { amount, payment_type: paymentType }),
        },
        { apiUrl: API_BASE },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.total_paid?.[0] ||
            data.amount?.[0] ||
            data.payment_type?.[0] ||
            data.detail ||
            "Unable to record payment.",
        );
      }
      setPayments((current) => applyRecordedPayment(current, data));
      setSelectedPayment(null);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const closeInquiryDetail = () => {
    if (followUpSaving) return;
    setSelectedInquiry(null);
    setFollowUpDate("");
    setFollowUpNotes("");
  };

  const hasActiveFilters =
    productFilter !== "all" || companyFilter !== "all" || fromDate || toDate;

  return (
    <section className="payment-approval-page">
      <div className="payment-approval-heading payment-finance-banner">
        <div>
          <span className="payment-approval-kicker">Finance control</span>
          <h1>Payment Pending</h1>
          <p>Record full payments or installments and track balances.</p>
        </div>
        <div className="payment-pending-total">
          <span>Total Remaining</span>
          <strong>{formatAmount(totalRemaining)}</strong>
        </div>
        <span className="payment-approval-count">
          <strong>{filteredPayments.length}</strong>
          <span>Pending</span>
        </span>
      </div>

      {error && !selectedPayment && !selectedInquiry && (
        <div className="payment-approval-error">{error}</div>
      )}

      <div className="payment-pending-filter-bar">
        <div className="payment-pending-filter-group">
          <label>
            <span>Product</span>
            <select
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
            >
              <option value="all">All products</option>
              {productOptions.map((product) => (
                <option key={product} value={product}>
                  {product}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Company</span>
            <select
              value={companyFilter}
              onChange={(event) => setCompanyFilter(event.target.value)}
            >
              <option value="all">All companies</option>
              {companyOptions.map((company) => (
                <option key={company} value={company}>
                  {company}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>From date</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>
          <label>
            <span>To date</span>
            <input
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            className="payment-pending-clear-btn"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="payment-approval-card">
        {loading ? (
          <div className="payment-approval-empty">
            Loading pending payments...
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="payment-approval-empty">
            {hasActiveFilters
              ? "No pending payments match the current filters."
              : "No pending payments found."}
          </div>
        ) : (
          <div className="payment-approval-table-wrap">
            <table className="payment-approval-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Company</th>
                  <th>Product</th>
                  <th>Source</th>
                  <th>Date</th>
                  <th className="payment-pending-amount-column">
                    Revenue Amount
                  </th>
                  <th className="payment-pending-amount-column">Paid Amount</th>
                  <th className="payment-pending-amount-column">Remaining</th>
                  {canRecord && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {filteredPayments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.customer_name || "-"}</td>
                    <td>{payment.company_name || "-"}</td>
                    <td>{getPaymentProduct(payment)}</td>
                    <td>
                      {isProductBill(payment) ? (
                        <span className="payment-pending-source">Product bill</span>
                      ) : "Inquiry"}
                    </td>
                    <td>{formatDate(getPaymentDate(payment))}</td>
                    <td className="payment-pending-amount-column">
                      {formatAmount(payment.revenue_amount)}
                    </td>
                    <td className="payment-pending-amount-column">
                      <span className="payment-pending-paid-value">
                        {formatAmount(payment.total_paid)}
                        {canRecord && Number(payment.total_paid) > 0 && (
                          <button
                            type="button"
                            className="payment-paid-edit-btn"
                            onClick={() => openPaidAmountEditor(payment)}
                            aria-label={`Edit paid amount for ${payment.customer_name || "payment"}`}
                            title="Edit paid amount"
                          >
                            <FiEdit3 aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    </td>
                    <td className="payment-pending-balance payment-pending-amount-column">
                      {formatAmount(payment.remaining_balance)}
                    </td>
                    {canRecord && (
                      <td className="payment-pending-actions">
                        <button
                          type="button"
                          className="payment-view-btn"
                          onClick={() => isProductBill(payment) ? openProductBillDetail(payment) : openInquiryDetail(payment)}
                          aria-label={`View ${payment.customer_name || "inquiry"} details`}
                          title="View inquiry tasks"
                        >
                          👁
                        </button>
                        <button
                          type="button"
                          className="payment-received-btn"
                          onClick={() => openPaymentModal(payment)}
                        >
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

      {/* Inquiry Detail Modal - Redesigned to match reference image */}
      {selectedInquiry && (
        <div
          className="payment-pending-modal-backdrop"
          onClick={closeInquiryDetail}
        >
          <div
            className="payment-pending-detail-modal payment-detail-reference"
            role="dialog"
            aria-modal="true"
            aria-label="Inquiry details"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="payment-pending-detail-header">
              <div>
                <span className="payment-approval-kicker">INQUIRY DETAILS</span>
                <h2>
                  {selectedInquiry.detail.customer_name ||
                    selectedInquiry.payment.customer_name ||
                    "Customer"}
                </h2>
                <p className="company-name">
                  {selectedInquiry.detail.company_name ||
                    selectedInquiry.payment.company_name ||
                    "-"}
                </p>
              </div>
              <div className="payment-detail-customer-phone">
                <span>Customer number</span>
                <strong>
                  <FiPhone aria-hidden="true" />
                  {selectedInquiry.detail.phone_number || "Not provided"}
                </strong>
              </div>
              <button
                type="button"
                className="payment-pending-close"
                onClick={closeInquiryDetail}
              >
                ×
              </button>
            </div>

            {error && (
              <div className="payment-approval-error" role="alert">
                {error}
              </div>
            )}

            {detailLoading && (
              <div className="payment-approval-empty">
                Loading inquiry details...
              </div>
            )}

            {!detailLoading && (
              <>
                <h3 className="payment-detail-section-title">
                  Details Summary
                </h3>
                <div className="payment-pending-detail-summary">
                  <div className="summary-item">
                    <span className="payment-summary-icon resource">
                      <FiCheck />
                    </span>
                    <div>
                      <span className="summary-label">(Resource)</span>
                      <span className="summary-value">
                        {selectedInquiry.detail.resource_name || "Not assigned"}
                      </span>
                    </div>
                  </div>
                  <div className="summary-item">
                    <span className="payment-summary-icon">
                      <FiBox />
                    </span>
                    <div>
                      <span className="summary-label">(Product)</span>
                      <span className="summary-value">
                        {getPaymentProduct(selectedInquiry.payment)}
                      </span>
                    </div>
                  </div>
                  <div className="summary-item">
                    <span className="payment-summary-icon">?</span>
                    <div>
                      <span className="summary-label">(Remaining)</span>
                      <span className="summary-value">
                        {formatAmount(
                          selectedInquiry.payment.remaining_balance,
                        )}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="payment-pending-task-section">
                  <h3 className="payment-detail-section-title">Task Updates</h3>
                  <form
                    className="payment-detail-update-grid"
                    onSubmit={submitFollowUp}
                  >
                    <fieldset
                      className="payment-detail-panel"
                      disabled={followUpSaving}
                    >
                      <h4>
                        <FiCalendar aria-hidden="true" /> Schedule Follow-up
                      </h4>
                      <label className="payment-detail-field">
                        <span>Follow-up date</span>
                        <input
                          type="date"
                          value={followUpDate}
                          required
                          onChange={(event) =>
                            setFollowUpDate(event.target.value)
                          }
                        />
                      </label>
                      <fieldset className="payment-detail-types">
                        <legend>Follow-up Type</legend>
                        <div className="followup-type-group">
                          {["call", "email", "meeting"].map((type) => (
                            <label className="type-option" key={type}>
                              <input
                                type="radio"
                                name="payment-follow-up-type"
                                value={type}
                                checked={followUpType === type}
                                onChange={() => setFollowUpType(type)}
                              />
                              {type[0].toUpperCase() + type.slice(1)}
                            </label>
                          ))}
                        </div>
                      </fieldset>
                    </fieldset>
                    <fieldset
                      className="payment-detail-panel"
                      disabled={followUpSaving}
                    >
                      <h4>
                        <FiEdit3 aria-hidden="true" /> Add Notes
                      </h4>
                      <label className="payment-detail-field">
                        <span>Notes</span>
                        <textarea
                          value={followUpNotes}
                          maxLength={500}
                          rows="3"
                          onChange={(event) =>
                            setFollowUpNotes(event.target.value)
                          }
                          placeholder="Enter payment follow-up details and next steps..."
                        />
                      </label>
                      <span className="payment-detail-note-count">
                        {followUpNotes.length} / 500
                      </span>
                      <div className="payment-pending-followup-actions">
                        <button
                          type="button"
                          className="payment-pending-cancel"
                          onClick={closeInquiryDetail}
                        >
                          Cancel
                        </button>
                        <button type="submit" className="payment-received-btn">
                          {followUpSaving ? "Saving..." : "Save & Update"}
                        </button>
                      </div>
                    </fieldset>
                  </form>

                  <div className="payment-detail-history-grid">
                    <div className="payment-pending-task-history">
                      <h4>Payment Follow-up History</h4>
                      {selectedInquiry.followUps?.length ? (
                        <div className="task-timeline">
                          {selectedInquiry.followUps.map((followUp) => (
                            <div
                              className="timeline-item payment-history-followup"
                              key={followUp.FollowUp_Id}
                            >
                              <div className="timeline-date">
                                {formatDate(followUp.FollowUp_Date)}
                              </div>
                              <div className="timeline-content">
                                <div
                                  className="timeline-description"
                                  style={{
                                    whiteSpace: "pre-wrap",
                                    overflowWrap: "anywhere",
                                  }}
                                >
                                  {followUp.Notes || "No notes added."}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="payment-approval-empty">
                          No payment follow-ups recorded.
                        </p>
                      )}
                    </div>

                    {/* Task History */}
                    <div className="payment-pending-task-history">
                      <h4>Task History</h4>
                      {selectedInquiry.detail.task_progress?.length ? (
                        <div className="task-timeline">
                          {selectedInquiry.detail.task_progress.map(
                            (task, index) => (
                            <div
                              className={`timeline-item payment-history-task ${task.task_status === "rescheduled" ? "is-rescheduled" : ""}`}
                              key={task.id || index}
                            >
                              <div className="timeline-date">
                                {formatDate(
                                  task.work_date || task.created_date,
                                )}
                              </div>
                              <div className="timeline-content">
                                <div className="timeline-title">
                                  <span
                                    className="payment-timeline-icon"
                                    aria-hidden="true"
                                  >
                                    {task.task_status === "rescheduled" ? (
                                      <FiCalendar />
                                    ) : (
                                      <FiCheck />
                                    )}
                                  </span>
                                  <strong>
                                    {task.task_status_label ||
                                      task.task_status ||
                                      "Progress Saved"}
                                  </strong>
                                  {task.resource_name && (
                                    <span className="payment-history-resource">
                                      {task.resource_name}
                                    </span>
                                  )}
                                  {task.task_status === "Completed" && (
                                    <span className="status-badge completed">
                                      Completed
                                    </span>
                                  )}
                                  {task.task_status === "rescheduled" && (
                                    <span className="status-badge rescheduled">
                                      Rescheduled
                                    </span>
                                  )}
                                </div>
                                <div className="timeline-description">
                                  {task.progress_notes || "Task updated"}
                                  {task.work_date &&
                                    task.task_status === "Rescheduled" && (
                                      <span className="reschedule-note">
                                        Call moved to{" "}
                                        {formatDate(task.work_date)}
                                      </span>
                                    )}
                                </div>
                              </div>
                            </div>
                            ),
                          )}
                        </div>
                      ) : (
                        <p className="payment-approval-empty">
                          No task updates recorded.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {selectedBilling && (
        <div className="payment-pending-modal-backdrop" onMouseDown={() => setSelectedBilling(null)}>
          <section
            className="payment-pending-detail-modal payment-detail-reference product-bill-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Product bill details"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="payment-pending-modal-header">
              <div>
                <span className="payment-approval-kicker">PRODUCT BILL DETAILS</span>
                <h2>{selectedBillingSummary.customer}</h2>
                <p className="company-name">{selectedBillingSummary.company}</p>
              </div>
              <button type="button" className="payment-pending-close" onClick={() => setSelectedBilling(null)}>×</button>
            </div>
            <h3 className="payment-detail-section-title">Details Summary</h3>
            <dl className="payment-pending-bill-details payment-pending-detail-summary">
              <div><dt>Product</dt><dd>{selectedBillingSummary.product}</dd></div>
              <div><dt>Bill amount</dt><dd>{formatAmount(selectedBillingSummary.billAmount)}</dd></div>
              <div><dt>Remaining</dt><dd>{formatAmount(selectedBillingSummary.remainingAmount)}</dd></div>
            </dl>
            <section className="payment-pending-task-section">
              <h3 className="payment-detail-section-title">Task Updates</h3>
              <form className="payment-pending-bill-followup payment-detail-update-grid" onSubmit={submitProductBillFollowUp}>
              <fieldset className="payment-detail-panel product-bill-followup-schedule" disabled={followUpSaving}>
              <h4><FiCalendar aria-hidden="true" /> Schedule Follow-up</h4>
              {error && <div className="payment-approval-error">{error}</div>}
              <label className="product-bill-followup-date">
                <span>Follow-up date</span>
                <input type="date" value={followUpDate} required disabled={followUpSaving} onChange={(event) => setFollowUpDate(event.target.value)} />
              </label>
              <fieldset className="product-bill-followup-type">
                <legend>Follow-up type</legend>
                {['call', 'email', 'meeting'].map((type) => (
                  <label key={type}><input type="radio" value={type} checked={followUpType === type} onChange={() => setFollowUpType(type)} />{type[0].toUpperCase() + type.slice(1)}</label>
                ))}
              </fieldset>
              </fieldset>
              <fieldset className="payment-detail-panel product-bill-followup-add-notes" disabled={followUpSaving}>
              <h4><FiEdit3 aria-hidden="true" /> Add Notes</h4>
              <label className="product-bill-followup-notes">
                <span>Notes</span>
                <textarea value={followUpNotes} maxLength="500" rows="3" disabled={followUpSaving} onChange={(event) => setFollowUpNotes(event.target.value)} placeholder="Enter payment follow-up details and next steps..." />
              </label>
              <button type="submit" className="payment-received-btn product-bill-followup-save" disabled={followUpSaving}>{followUpSaving ? 'Saving...' : 'Save follow-up'}</button>
              </fieldset>
            </form>
            </section>
            <section className="payment-pending-bill-history product-bill-history payment-detail-history-grid">
              <h3>Payment Follow-up History</h3>
              {detailLoading ? <p>Loading follow-ups...</p> : selectedBilling.followUps?.length ? (
                selectedBilling.followUps.map((followUp) => (
                  <div key={followUp.FollowUp_Id} className="payment-pending-bill-history-item">
                    <strong>{formatDate(followUp.FollowUp_Date)} · {followUp.FollowUp_Type}</strong>
                    <span>{followUp.Notes || 'No notes added.'}</span>
                  </div>
                ))
              ) : <p>No payment follow-ups recorded.</p>}
            </section>
          </section>
        </div>
      )}

      {/* Payment Modal */}
      {selectedPayment && (
        <div
          className="payment-pending-modal-backdrop"
          onMouseDown={closePaymentModal}
        >
          <form
            className="payment-pending-modal"
            onSubmit={submitPayment}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="payment-pending-modal-header">
              <div>
                <span className="payment-approval-kicker">
                  {paymentModalMode === "edit" ? "Edit paid amount" : "Record payment"}
                </span>
                <h2>{selectedPayment.customer_name || "Customer"}</h2>
              </div>
              <button
                type="button"
                className="payment-pending-close"
                onClick={closePaymentModal}
                disabled={saving}
              >
                ×
              </button>
            </div>
            <p className="payment-pending-remaining">
              {paymentModalMode === "edit" ? "Current remaining balance: " : "Remaining balance: "}
              <strong>{formatAmount(selectedPayment.remaining_balance)}</strong>
            </p>
            {error && <div className="payment-approval-error">{error}</div>}
            <label className="payment-pending-field">
              {paymentModalMode === "edit" ? "Total paid amount" : "Payment amount"}
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
              />
            </label>
            {paymentModalMode === "record" && <fieldset className="payment-pending-types">
              <legend>Payment type</legend>
              <label>
                <input
                  type="radio"
                  value="full"
                  checked={paymentType === "full"}
                  onChange={() => {
                    setPaymentType("full");
                    setAmount(selectedPayment.remaining_balance);
                  }}
                />
                Full Payment
              </label>
              <label>
                <input
                  type="radio"
                  value="installment"
                  checked={paymentType === "installment"}
                  onChange={() => setPaymentType("installment")}
                />
                Installment
              </label>
            </fieldset>}
            <div className="payment-pending-modal-actions">
              <button
                type="button"
                className="payment-pending-cancel"
                onClick={closePaymentModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="payment-received-btn"
                disabled={saving}
              >
                {saving ? "Saving..." : paymentModalMode === "edit" ? "Save amount" : "Confirm Paid"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
