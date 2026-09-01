// ScheduleDetailModal.jsx
import { useEffect } from "react";
import { getScheduleInitials } from "./schedulePresentation";

const ScheduleDetailModal = ({
  inquiry,
  isAdmin,
  onClose,
  formatDate,
  formatAmount,
  getStatusColor,
  getStatusBgColor,
}) => {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    // Lock background scroll while modal is open
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  if (!inquiry) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="schedule-modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="schedule-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-modal-title"
      >
        {/* Modal Header */}
        <div className="schedule-modal-header">
          <div className="schedule-modal-header-left">
            <div className="schedule-avatar schedule-avatar-lg">
              {getScheduleInitials(inquiry.customer_name)}
            </div>
            <div>
              <h2 id="schedule-modal-title">
                {inquiry.customer_name || "Unknown Customer"}
              </h2>
              <span
                className="schedule-status-chip"
                style={{
                  background: getStatusBgColor(inquiry.status_name),
                  color: getStatusColor(inquiry.status_name),
                }}
              >
                <span
                  className="schedule-status-dot"
                  style={{ background: getStatusColor(inquiry.status_name) }}
                />
                {inquiry.status_name || "New"}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="schedule-modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>

        {/* Modal Body (scrollable) */}
        <div className="schedule-modal-body">
          {/* Contact section */}
          <section className="schedule-modal-section">
            <h3>Contact Information</h3>
            <div className="schedule-modal-grid">
              <div className="schedule-modal-field">
                <span className="schedule-meta-label">Phone</span>
                <span className="schedule-meta-value">
                  {inquiry.phone_number || "—"}
                </span>
              </div>
              <div className="schedule-modal-field">
                <span className="schedule-meta-label">Email</span>
                <span className="schedule-meta-value">
                  {inquiry.email_id || "—"}
                </span>
              </div>
            </div>
          </section>

          {/* Schedule / source section */}
          <section className="schedule-modal-section">
            <h3>Schedule Details</h3>
            <div className="schedule-modal-grid">
              <div className="schedule-modal-field">
                <span className="schedule-meta-label">Scheduled Date</span>
                <span className="schedule-meta-value">
                  {formatDate(inquiry.schedule_date)}
                </span>
              </div>
              <div className="schedule-modal-field">
                <span className="schedule-meta-label">Source</span>
                <span className="schedule-meta-value">
                  {inquiry.source_name || "—"}
                </span>
              </div>
              {isAdmin && (
                <div className="schedule-modal-field">
                  <span className="schedule-meta-label">Assigned Staff</span>
                  <span className="schedule-meta-value">
                    {inquiry.resource_name || "Unassigned"}
                  </span>
                </div>
              )}
              <div className="schedule-modal-field">
                <span className="schedule-meta-label">Total Amount</span>
                <span className="schedule-meta-value schedule-total">
                  {formatAmount(inquiry.total)}
                </span>
              </div>
            </div>
          </section>

          {/* Products section */}
          <section className="schedule-modal-section">
            <h3>Products ({inquiry.products ? inquiry.products.length : 0})</h3>
            {inquiry.products && inquiry.products.length > 0 ? (
              <div className="schedule-modal-table-wrap">
                <table className="schedule-modal-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Subtotal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inquiry.products.map((product, idx) => (
                      <tr key={product.id ?? idx}>
                        <td>{product.name || product.product_name || "—"}</td>
                        <td>{product.quantity ?? "—"}</td>
                        <td>{formatAmount(product.price)}</td>
                        <td>
                          {formatAmount(
                            product.subtotal ??
                              (product.price && product.quantity
                                ? product.price * product.quantity
                                : null),
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="schedule-modal-empty-text">No products added.</p>
            )}
          </section>

          {/* Notes / remarks, if present */}
          {inquiry.remarks && (
            <section className="schedule-modal-section">
              <h3>Remarks</h3>
              <p className="schedule-modal-remarks">{inquiry.remarks}</p>
            </section>
          )}
        </div>

        {/* Modal Footer */}
        <div className="schedule-modal-footer">
          <button
            type="button"
            className="schedule-modal-btn-secondary"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleDetailModal;
