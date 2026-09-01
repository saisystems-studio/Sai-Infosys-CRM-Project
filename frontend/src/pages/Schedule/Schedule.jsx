import { useEffect, useState } from "react";
import axios from "axios";
import "./Schedule.css";
import {
  formatTaskDuration,
  getDefaultScheduleDateRange,
  getScheduleDateState,
  getScheduleInitials,
  getTodayDateString,
  getTotalTaskDurationSeconds,
  hasScheduleAdminAccess,
  isScheduleCardActivationKey,
} from "./schedulePresentation";
import {
  buildPaymentPendingPayload,
  getPaymentPendingDefaults,
  getPaymentPendingError,
  validateInvoiceAmount,
  validateRevenueAmount,
} from "./schedulePaymentPending";

const API_BASE_URL = "http://127.0.0.1:8000/api";

const getInitialAdminState = () => {
  try {
    const user = JSON.parse(localStorage.getItem("crm_user") || "{}");
    return hasScheduleAdminAccess(user);
  } catch {
    return false;
  }
};

const getInitialUser = () => {
  try {
    return JSON.parse(localStorage.getItem("crm_user") || "{}");
  } catch {
    return {};
  }
};

const Schedule = ({ onViewDetails }) => {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [movingInquiryId, setMovingInquiryId] = useState(null);
  const [paymentPendingInquiry, setPaymentPendingInquiry] = useState(null);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [revenueAmount, setRevenueAmount] = useState("");
  const [unpaidService, setUnpaidService] = useState(false);
  const [isAdmin] = useState(getInitialAdminState);
  const [currentUser] = useState(getInitialUser);
  const [durationNow, setDurationNow] = useState(() => new Date());
  const [filters, setFilters] = useState(() => ({
    ...getDefaultScheduleDateRange(),
    staffId: "",
    status: "",
    product: "",
  }));
  const normalizedRole = String(currentUser.role || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
  const isSuperAdmin =
    isAdmin &&
    (currentUser.staff_id == null || normalizedRole === "super admin");

  // ============================================================
  // FETCH LOGGED-IN STAFF SCHEDULE
  // ============================================================
  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("crm_access_token");

      if (!token) {
        setError("Authentication token not found. Please login again.");
        setLoading(false);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/inquiries/schedule/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      setInquiries(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Authentication failed. Please login again.");
      } else if (err.response?.status === 400) {
        setError(err.response?.data?.detail || "Staff details not found.");
      } else {
        setError(
          err.response?.data?.detail || "Failed to load assigned inquiries.",
        );
      }
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // LOAD DATA
  // ============================================================
  useEffect(() => {
    fetchSchedule();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setDurationNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  // ============================================================
  // FORMAT DATE
  // ============================================================
  const formatDate = (date) => {
    if (!date) return "-";
    try {
      return new Date(date).toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return date;
    }
  };

  const formatCallbackDateTime = (date) => {
    if (!date) return "";
    try {
      return new Date(date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return date;
    }
  };

  // ============================================================
  // FORMAT AMOUNT
  // ============================================================
  const formatAmount = (amount) => {
    if (amount === null || amount === undefined) return "₹ 0.00";
    return `₹ ${Number(amount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // ============================================================
  // GET PRODUCT NAMES - FIXED
  // ============================================================
  const getProductNames = (products) => {
    if (!products || !Array.isArray(products) || products.length === 0) {
      return [];
    }

    return products.map((product) => {
      // Try different possible field names for product name
      return (
        product.product_name ||
        product.name ||
        product.product_type_name ||
        product.title ||
        String(product.id || "Product")
      );
    });
  };

  const getProductDisplay = (products) => {
    const names = getProductNames(products);
    if (names.length === 0) return "0";
    if (names.length === 1) return names[0];
    return `${names[0]} +${names.length - 1} more`;
  };

  // ============================================================
  // STATUS COLORS
  // ============================================================
  const getStatusColor = (status) => {
    const statusMap = {
      New: "#2563eb",
      "In Progress": "#d97706",
      Completed: "#059669",
      Cancelled: "#dc2626",
      "On Hold": "#7c3aed",
    };
    return statusMap[status] || "#6b7280";
  };

  const getStatusBgColor = (status) => {
    const statusMap = {
      New: "#dbeafe",
      "In Progress": "#fef3c7",
      Completed: "#d1fae5",
      Cancelled: "#fee2e2",
      "On Hold": "#ede9fe",
    };
    return statusMap[status] || "#f3f4f6";
  };

  // ============================================================
  // NAVIGATE TO DETAIL VIEW
  // ============================================================
  const handleViewDetails = (inquiryId) => {
    onViewDetails(inquiryId);
  };

  const openPaymentPendingDialog = (inquiry) => {
    const defaults = getPaymentPendingDefaults(inquiry);
    setPaymentPendingInquiry(inquiry);
    setInvoiceAmount(defaults.invoiceAmount);
    setRevenueAmount(defaults.revenueAmount);
    setUnpaidService(false);
    setError("");
  };

  const handleMoveToPaymentPending = async () => {
    if (!paymentPendingInquiry) return;

    const validationError = unpaidService
      ? ""
      : validateInvoiceAmount(invoiceAmount) ||
        validateRevenueAmount(revenueAmount);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setMovingInquiryId(paymentPendingInquiry.id);
      setError("");

      const token = localStorage.getItem("crm_access_token");
      await axios.post(
        `${API_BASE_URL}/inquiries/${paymentPendingInquiry.id}/move-to-payment-pending/`,
        buildPaymentPendingPayload(invoiceAmount, revenueAmount, unpaidService),
        { headers: { Authorization: `Bearer ${token}` } },
      );

      setPaymentPendingInquiry(null);
      setInvoiceAmount("");
      setRevenueAmount("");
      setUnpaidService(false);
      await fetchSchedule();
    } catch (err) {
      setError(getPaymentPendingError(err, unpaidService));
    } finally {
      setMovingInquiryId(null);
    }
  };

  // ============================================================
  // FILTER OPTIONS
  // ============================================================
  const staffOptions = inquiries
    .filter((inquiry) => inquiry.Resource_Id && inquiry.resource_name)
    .reduce((options, inquiry) => {
      const value = String(inquiry.Resource_Id);
      if (!options.some((option) => option.value === value)) {
        options.push({ value, label: inquiry.resource_name });
      }
      return options;
    }, [])
    .sort((left, right) => left.label.localeCompare(right.label));

  const statusOptions = [
    ...new Set(inquiries.map((inquiry) => inquiry.status_name).filter(Boolean)),
  ].sort();

  // Get unique product options from all inquiries - FIXED
  const productOptions = [
    ...new Set(
      inquiries
        .flatMap((inquiry) => {
          if (!inquiry.products || !Array.isArray(inquiry.products)) return [];
          return inquiry.products.map((product) => {
            return (
              product.product_name ||
              product.name ||
              product.product_type_name ||
              product.title ||
              String(product.id)
            );
          });
        })
        .filter(Boolean),
    ),
  ].sort();

  // ============================================================
  // FILTERED INQUIRIES
  // ============================================================
  const effectiveFromDate = filters.fromDate || getTodayDateString(durationNow);
  const effectiveToDate = filters.toDate || getTodayDateString(durationNow);

  const filteredInquiries = inquiries.filter((inquiry) => {
    const scheduleDate = String(inquiry.schedule_date || "").slice(0, 10);
    const matchesFromDate = !effectiveFromDate || scheduleDate >= effectiveFromDate;
    const matchesToDate = !effectiveToDate || scheduleDate <= effectiveToDate;
    const matchesStaff =
      !filters.staffId || String(inquiry.Resource_Id || "") === filters.staffId;
    const matchesStatus =
      !filters.status || inquiry.status_name === filters.status;

    // Product filter - FIXED
    let matchesProduct = true;
    if (filters.product) {
      const productNames = getProductNames(inquiry.products);
      matchesProduct = productNames.some(
        (name) =>
          name && name.toLowerCase().includes(filters.product.toLowerCase()),
      );
    }

    return (
      matchesFromDate &&
      matchesToDate &&
      matchesStaff &&
      matchesStatus &&
      matchesProduct
    );
  });

  const ownInquiries =
    isAdmin && !isSuperAdmin
      ? filteredInquiries.filter(
          (inquiry) =>
            String(inquiry.Resource_Id) === String(currentUser.staff_id),
        )
      : filteredInquiries;

  const staffInquiries =
    isAdmin && !isSuperAdmin
      ? filteredInquiries.filter(
          (inquiry) =>
            String(inquiry.Resource_Id) !== String(currentUser.staff_id),
        )
      : filteredInquiries;

  // ============================================================
  // LOADING
  // ============================================================
  if (loading) {
    return (
      <div className="schedule-page">
        <div className="schedule-loading">
          <div className="loading-spinner" />
          <p>Loading your schedule...</p>
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN PAGE
  // ============================================================
  return (
    <div className="schedule-page">
      {/* Compact toolbar */}
      <div className="schedule-header">
        <div className="schedule-header-left">
          <div className="schedule-heading">
            <h1>{isAdmin ? "All Staff Schedule" : "My Schedule"}</h1>
            <span className="header-subtitle">
              {isAdmin ? "All assigned inquiries" : "Your assigned inquiries"}
            </span>
          </div>
          <div className="schedule-role-badge">
            <span className="schedule-badge-dot" />
            {isAdmin ? currentUser.role || "Admin" : "Staff"}
          </div>
        </div>

        <div className="schedule-stats" aria-label="Schedule summary">
          <div className="schedule-stat">
            <span className="schedule-stat-number">
              {filteredInquiries.length}
            </span>
            <span className="schedule-stat-label">Total</span>
          </div>
          <div className="schedule-stat">
            <span className="schedule-stat-number">
              {
                filteredInquiries.filter(
                  (i) => getScheduleDateState(i.schedule_date) === "today",
                ).length
              }
            </span>
            <span className="schedule-stat-label">Today</span>
          </div>
          <div className="schedule-stat schedule-stat-alert">
            <span className="schedule-stat-number">
              {
                filteredInquiries.filter(
                  (i) => getScheduleDateState(i.schedule_date) === "overdue",
                ).length
              }
            </span>
            <span className="schedule-stat-label">Overdue</span>
          </div>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="schedule-error">
          <span className="error-icon" aria-hidden="true">
            ⚠
          </span>
          <span>{error}</span>
          <button type="button" onClick={fetchSchedule}>
            Retry
          </button>
        </div>
      )}

      <div className="schedule-filters" aria-label="Schedule filters">
        <label>
          From date
          <input
            type="date"
            value={filters.fromDate}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                fromDate: event.target.value || getTodayDateString(new Date()),
              }))
            }
          />
        </label>
        <label>
          To date
          <input
            type="date"
            value={filters.toDate}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                toDate: event.target.value || getTodayDateString(new Date()),
              }))
            }
          />
        </label>
        {isAdmin && (
          <label>
            Staff
            <select
              value={filters.staffId}
              onChange={(event) =>
                setFilters((current) => ({
                  ...current,
                  staffId: event.target.value,
                }))
              }
            >
              <option value="">All staff</option>
              {staffOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Task status
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value,
              }))
            }
          >
            <option value="">All status</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        {/* New Product Filter */}
        <label>
          Product
          <select
            value={filters.product}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                product: event.target.value,
              }))
            }
          >
            <option value="">All products</option>
            {productOptions.map((product) => (
              <option key={product} value={product}>
                {product}
              </option>
            ))}
          </select>
        </label>
        {(filters.fromDate ||
          filters.toDate ||
          filters.staffId ||
          filters.status ||
          filters.product) && (
          <button
            type="button"
            className="schedule-clear-filters"
            onClick={() => {
              const today = getTodayDateString(new Date());
              setFilters({
                fromDate: today,
                toDate: today,
                staffId: "",
                status: "",
                product: "",
              });
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {/* EMPTY STATE */}
      {!error && filteredInquiries.length === 0 && (
        <div className="schedule-empty">
          <div className="empty-icon" aria-hidden="true">
            📅
          </div>
          <h3>
            {inquiries.length > 0
              ? "No inquiries match these filters"
              : isAdmin
                ? "No inquiries found"
                : "No inquiries assigned"}
          </h3>
          <p>
            {inquiries.length > 0
              ? "Try changing or clearing the selected filters."
              : isAdmin
                ? "There are no inquiries in the system yet."
                : "You don't have any inquiries assigned to you yet."}
          </p>
          <button type="button" className="help-btn">
            Explore help center
          </button>
        </div>
      )}

      {/* CARDS GRID */}
      {!error && filteredInquiries.length > 0 && (
        <div className="schedule-sections">
          {(isAdmin && !isSuperAdmin
            ? [
                {
                  title: "My Tasks",
                  subtitle: "Inquiries assigned to you",
                  items: ownInquiries,
                  emptyMessage: "No tasks assigned to you.",
                },
                {
                  title: "Staff Tasks",
                  subtitle: "Inquiries assigned to your staff",
                  items: staffInquiries,
                  emptyMessage: "No staff tasks found.",
                },
              ]
            : [
                {
                  title: isSuperAdmin ? "All Staff Tasks" : null,
                  subtitle: isSuperAdmin ? "All assigned inquiries" : null,
                  items: filteredInquiries,
                  emptyMessage: "No staff tasks found.",
                },
              ]
          ).map((section) => (
            <section
              className="schedule-section"
              key={section.title || "schedule"}
            >
              {section.title && (
                <div className="schedule-section-heading">
                  <div>
                    <h2>{section.title}</h2>
                    <p>{section.subtitle}</p>
                  </div>
                  <span>{section.items.length}</span>
                </div>
              )}
              {section.items.length > 0 ? (
                <div className="schedule-grid">
                  {section.items.map((inquiry, index) => (
                    <article
                      key={inquiry.id}
                      className="schedule-card"
                      role="button"
                      tabIndex={0}
                      aria-label={`View details for ${inquiry.customer_name || "customer"}`}
                      data-date-state={getScheduleDateState(
                        inquiry.schedule_date,
                      )}
                      onClick={() => handleViewDetails(inquiry.id)}
                      onKeyDown={(event) => {
                        if (isScheduleCardActivationKey(event.key)) {
                          event.preventDefault();
                          handleViewDetails(inquiry.id);
                        }
                      }}
                    >
                      {/* Card Header */}
                      <div className="schedule-card-header">
                        <div className="schedule-card-header-left">
                          <span className="schedule-card-index">
                            #{String(index + 1).padStart(2, "0")}
                          </span>
                          <span
                            className="schedule-status-chip"
                            style={{
                              background: getStatusBgColor(inquiry.status_name),
                              color: getStatusColor(inquiry.status_name),
                            }}
                          >
                            <span
                              className="schedule-status-dot"
                              style={{
                                background: getStatusColor(inquiry.status_name),
                              }}
                            />
                            {inquiry.status_name || "New"}
                          </span>
                        </div>
                        <div className="schedule-card-date">
                          <svg
                            viewBox="0 0 24 24"
                            width="14"
                            height="14"
                            fill="currentColor"
                          >
                            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" />
                          </svg>
                          {formatDate(inquiry.schedule_date)}
                        </div>
                      </div>

                      {/* Card Body */}
                      <div className="schedule-card-body">
                        <div className="schedule-customer">
                          <div className="schedule-avatar">
                            {getScheduleInitials(inquiry.customer_name)}
                          </div>
                          <div className="schedule-customer-details">
                            <h4 className="schedule-customer-name">
                              {inquiry.customer_name || "Unknown Customer"}
                            </h4>
                            <div className="schedule-contact">
                              {inquiry.phone_number && (
                                <span className="schedule-contact-item">
                                  <svg
                                    viewBox="0 0 24 24"
                                    width="13"
                                    height="13"
                                    fill="currentColor"
                                  >
                                    <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                  </svg>
                                  {inquiry.phone_number}
                                </span>
                              )}
                              {inquiry.email_id && (
                                <span className="schedule-contact-item">
                                  <svg
                                    viewBox="0 0 24 24"
                                    width="13"
                                    height="13"
                                    fill="currentColor"
                                  >
                                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                                  </svg>
                                  {inquiry.email_id}
                                </span>
                              )}
                            </div>
                          </div>
                          {inquiry.next_reschedule_at && (
                            <div className="schedule-reschedule-notice">
                              <svg
                                viewBox="0 0 24 24"
                                width="14"
                                height="14"
                                fill="currentColor"
                                aria-hidden="true"
                              >
                                <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 15H5V9h14v10Z" />
                              </svg>
                              <span>
                                <strong>Rescheduled</strong>
                                <small>
                                  {formatCallbackDateTime(
                                    inquiry.next_reschedule_at,
                                  )}
                                </small>
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="schedule-meta">
                          <div className="schedule-meta-item">
                            <span className="schedule-meta-label">Source</span>
                            <span className="schedule-meta-value">
                              {inquiry.source_name || "—"}
                            </span>
                          </div>
                          <div className="schedule-meta-divider" />
                          <div className="schedule-meta-item">
                            <span className="schedule-meta-label">
                              Products
                            </span>
                            <span className="schedule-meta-value schedule-product-count">
                              {/* FIXED: Show product names instead of count */}
                              {getProductDisplay(inquiry.products)}
                            </span>
                          </div>
                          <div className="schedule-meta-divider" />
                          <div className="schedule-meta-item">
                            <span className="schedule-meta-label">Amount</span>
                            <span className="schedule-meta-value schedule-total">
                              {formatAmount(inquiry.total)}
                            </span>
                          </div>
                          {(Number(inquiry.completed_task_duration_seconds) >
                            0 ||
                            inquiry.active_task_started_at) && (
                            <>
                              <div className="schedule-meta-divider" />
                              <div className="schedule-meta-item">
                                <span className="schedule-meta-label">
                                  Task Duration
                                </span>
                                <span className="schedule-meta-value schedule-duration">
                                  {formatTaskDuration(
                                    getTotalTaskDurationSeconds(
                                      inquiry,
                                      durationNow,
                                    ),
                                  )}
                                </span>
                              </div>
                            </>
                          )}
                        </div>

                        {isAdmin && (
                          <div className="schedule-resource">
                            <svg
                              viewBox="0 0 24 24"
                              width="14"
                              height="14"
                              fill="currentColor"
                            >
                              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                            </svg>
                            <span className="schedule-resource-name">
                              {inquiry.resource_name || "Unassigned"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Card Footer */}
                      {inquiry.can_move_to_payment_pending && (
                        <div className="schedule-card-footer">
                          <button
                            type="button"
                            className="schedule-payment-pending-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              openPaymentPendingDialog(inquiry);
                            }}
                            onKeyDown={(event) => event.stopPropagation()}
                            disabled={movingInquiryId === inquiry.id}
                          >
                            {movingInquiryId === inquiry.id
                              ? "Moving..."
                              : "Move to Payment Pending"}
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              ) : (
                <div className="schedule-section-empty">
                  {section.emptyMessage || "No inquiries assigned."}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {paymentPendingInquiry && (
        <div
          className="payment-pending-modal-overlay"
          onClick={() => setPaymentPendingInquiry(null)}
        >
          <div
            className="payment-pending-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="payment-pending-modal-header">
              <div>
                <span className="payment-pending-eyebrow">Confirm status</span>
                <h2>
                  {unpaidService
                    ? "Complete Unpaid Service"
                    : "Move to Payment Pending"}
                </h2>
              </div>
              <button
                type="button"
                className="payment-pending-close"
                onClick={() => setPaymentPendingInquiry(null)}
                aria-label="Close payment pending dialog"
              >
                ×
              </button>
            </div>
            <p className="payment-pending-customer">
              {paymentPendingInquiry.customer_name || "This inquiry"}
            </p>
            <label className="payment-pending-unpaid">
              <input
                type="checkbox"
                checked={unpaidService}
                onChange={(event) => setUnpaidService(event.target.checked)}
              />
              <span>
                <strong>Unpaid Service</strong>
                <small>Complete without creating a pending payment</small>
              </span>
            </label>
            {!unpaidService && (
              <div className="payment-pending-fields">
                <div>
                  <label
                    className="payment-pending-label"
                    htmlFor="invoice-amount"
                  >
                    Invoice amount
                  </label>
                  <div className="payment-pending-input-wrap">
                    <span>₹</span>
                    <input
                      id="invoice-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={invoiceAmount}
                      onChange={(event) => setInvoiceAmount(event.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                <div>
                  <label
                    className="payment-pending-label"
                    htmlFor="revenue-amount"
                  >
                    Revenue amount
                  </label>
                  <div className="payment-pending-input-wrap">
                    <span>₹</span>
                    <input
                      id="revenue-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={revenueAmount}
                      onChange={(event) => setRevenueAmount(event.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
            <div className="payment-pending-modal-actions">
              <button
                type="button"
                className="payment-pending-cancel"
                onClick={() => setPaymentPendingInquiry(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="payment-pending-confirm"
                onClick={handleMoveToPaymentPending}
                disabled={movingInquiryId === paymentPendingInquiry.id}
              >
                {movingInquiryId === paymentPendingInquiry.id
                  ? "Saving..."
                  : unpaidService
                    ? "Complete"
                    : "Confirm & Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Schedule;
