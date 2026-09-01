import { useEffect, useState, useCallback, useRef } from "react";
import axios from "axios";
import {
  buildPaymentPendingPayload,
  validateInvoiceAmount,
  validateRevenueAmount,
} from "./schedulePaymentPending.js";
import "./ScheduleDetail.css";

const API_BASE_URL = "http://127.0.0.1:8000/api";
const RESCHEDULE_HOURS = Array.from({ length: 24 }, (_, hour) =>
  String(hour + 1).padStart(2, "0"),
);
const RESCHEDULE_MINUTES = Array.from({ length: 60 }, (_, minute) =>
  String(minute).padStart(2, "0"),
);
const RESCHEDULE_PERIODS = ["AM", "PM"];

function TimePartDropdown({
  id,
  value,
  placeholder,
  options,
  onChange,
  onSelect,
  open,
  onToggle,
  disabled,
  label,
}) {
  return (
    <div className="reschedule-time-dropdown" style={{ width: "100%" }}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        aria-label={label}
        style={{
          width: "100%",
          boxSizing: "border-box",
          paddingRight: "28px",
        }}
      />
      <button
        type="button"
        className="reschedule-time-toggle"
        onClick={onToggle}
        disabled={disabled}
        aria-label={`Choose ${label}`}
        aria-expanded={open}
      >
        ▾
      </button>
      {open && (
        <div
          className="reschedule-time-options"
          role="listbox"
          aria-label={label}
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              onClick={() => onSelect(option)}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const formatDateValue = (date) =>
  [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");

function RescheduleDatePicker({ value, onChange, disabled }) {
  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => selectedDate || new Date());
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const availableDays = Array.from(
    { length: daysInMonth },
    (_, index) => new Date(year, monthIndex, index + 1),
  ).filter((date) => date.getDay() !== 0);

  return (
    <div className="reschedule-date-picker">
      <button
        type="button"
        className="reschedule-date-trigger"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled}
        aria-expanded={open}
      >
        {selectedDate ? selectedDate.toLocaleDateString("en-GB") : "dd-mm-yyyy"}
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          className="reschedule-calendar"
          role="dialog"
          aria-label="Choose reschedule date"
        >
          <div className="reschedule-calendar-header">
            <button
              type="button"
              onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}
            >
              ‹
            </button>
            <strong>
              {month.toLocaleString("en-IN", {
                month: "long",
                year: "numeric",
              })}
            </strong>
            <button
              type="button"
              onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}
            >
              ›
            </button>
          </div>
          <div className="reschedule-calendar-weekdays">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="reschedule-calendar-days">
            {availableDays.map((date) => {
              const dateValue = formatDateValue(date);
              const isSelected = dateValue === value;
              const isPast = date < today;
              return (
                <button
                  key={dateValue}
                  type="button"
                  disabled={isPast}
                  className={isSelected ? "selected" : ""}
                  onClick={() => {
                    onChange(dateValue);
                    setOpen(false);
                  }}
                >
                  {date.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const ScheduleDetail = ({ inquiryId, onBack, autoStartTask = false }) => {
  const [inquiry, setInquiry] = useState(null);
  const [taskUpdates, setTaskUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [draftTasks, setDraftTasks] = useState([]);
  const [activeTaskNotes, setActiveTaskNotes] = useState("");
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDropdown, setRescheduleDropdown] = useState("");
  const autoStartedTask = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [revenueAmount, setRevenueAmount] = useState("");
  const [movingToPaymentPending, setMovingToPaymentPending] = useState(false);
  const [paymentPendingError, setPaymentPendingError] = useState("");
  const [paymentPendingSuccess, setPaymentPendingSuccess] = useState("");

  /* ============================================================
     AUTH HEADERS
     ============================================================ */

  const getHeaders = useCallback(() => {
    const token =
      localStorage.getItem("crm_access_token") ||
      localStorage.getItem("access_token");

    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
  }, []);

  /* ============================================================
     FETCH TASK DETAIL
     ============================================================ */

  const fetchTaskDetail = useCallback(async () => {
    if (!inquiryId) return;

    try {
      setTaskError("");

      const response = await axios.get(
        `${API_BASE_URL}/inquiries/${inquiryId}/task-detail/`,
        {
          headers: getHeaders(),
        },
      );

      setInquiry(response.data);
      setInvoiceAmount(
        response.data.total != null ? String(response.data.total) : "",
      );
      setRevenueAmount(
        response.data.total != null ? String(response.data.total) : "",
      );
      setTaskUpdates(response.data.task_progress || []);
      setActiveTaskNotes(response.data.active_session?.progress_notes || "");
      setRescheduleAt("");
      setRescheduleOpen(false);
      setRescheduleDropdown("");
    } catch (err) {
      console.error("Task detail error:", err);

      if (err.response?.status === 401) {
        setTaskError("Authentication failed. Please login again.");
      } else if (err.response?.status === 403) {
        setTaskError(
          err.response?.data?.detail ||
            "You do not have permission to view this task.",
        );
      } else if (err.response?.status === 404) {
        setTaskError("Task details not found.");
      } else {
        setTaskError(
          err.response?.data?.detail || "Task updates are not available yet.",
        );
      }
    }
  }, [inquiryId, getHeaders]);

  /* ============================================================
     FETCH INQUIRY DETAIL
     ============================================================ */

  const fetchDetailData = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setTaskError("");

      if (!inquiryId) {
        setError("Inquiry not selected.");
        setLoading(false);
        return;
      }

      const token =
        localStorage.getItem("crm_access_token") ||
        localStorage.getItem("access_token");

      if (!token) {
        setError("Authentication token not found. Please login again.");
        setLoading(false);
        return;
      }

      /* --------------------------------------------------------
         INQUIRY DETAILS
         -------------------------------------------------------- */

      const inquiryResponse = await axios.get(
        `${API_BASE_URL}/inquiries/${inquiryId}/`,
        {
          headers: getHeaders(),
        },
      );

      setInquiry(inquiryResponse.data);

      /* --------------------------------------------------------
         TASK DETAILS
         -------------------------------------------------------- */

      await fetchTaskDetail();
    } catch (err) {
      console.error("Inquiry detail error:", err);

      if (err.response?.status === 401) {
        setError("Authentication failed. Please login again.");
      } else if (err.response?.status === 403) {
        setError("You do not have permission to view this inquiry.");
      } else if (err.response?.status === 404) {
        setError("Inquiry not found.");
      } else {
        setError(
          err.response?.data?.detail || "Failed to load inquiry details.",
        );
      }
    } finally {
      setLoading(false);
    }
  }, [inquiryId, getHeaders, fetchTaskDetail]);

  /* ============================================================
     INITIAL LOAD
     ============================================================ */

  useEffect(() => {
    fetchDetailData();
  }, [fetchDetailData]);

  const handleMoveToPaymentPending = async () => {
    const invoiceValidationError = validateInvoiceAmount(invoiceAmount);
    if (invoiceValidationError) {
      setPaymentPendingError(invoiceValidationError);
      return;
    }

    const validationError = validateRevenueAmount(revenueAmount);
    if (validationError) {
      setPaymentPendingError(validationError);
      return;
    }

    try {
      setMovingToPaymentPending(true);
      setPaymentPendingError("");
      setPaymentPendingSuccess("");

      await axios.post(
        `${API_BASE_URL}/inquiries/${inquiry.id}/move-to-payment-pending/`,
        buildPaymentPendingPayload(invoiceAmount, revenueAmount),
        { headers: getHeaders() },
      );

      await fetchDetailData();
      setPaymentPendingSuccess("Inquiry moved to Payment Pending.");
    } catch (err) {
      setPaymentPendingError(
        err.response?.data?.detail ||
          "Unable to move this inquiry to Payment Pending.",
      );
    } finally {
      setMovingToPaymentPending(false);
    }
  };

  /* ============================================================
     FORMAT DATE
     ============================================================ */

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

  /* ============================================================
     FORMAT DATE TIME
     ============================================================ */

  const formatDateTime = (date) => {
    if (!date) return "-";

    try {
      return new Date(date).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return date;
    }
  };

  /* ============================================================
     FORMAT AMOUNT
     ============================================================ */

  const formatAmount = (amount) => {
    if (amount === null || amount === undefined) {
      return "₹0.00";
    }

    return `₹${Number(amount).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  /* ============================================================
     STATUS COLOR
     ============================================================ */

  const getStatusColor = (status) => {
    const statusMap = {
      New: "#3b82f6",
      "In Progress": "#f59e0b",
      Completed: "#10b981",
      Cancelled: "#ef4444",
      "On Hold": "#8b5cf6",
    };

    return statusMap[status] || "#6b7280";
  };

  /* ============================================================
     STATUS BACKGROUND
     ============================================================ */

  const getStatusBgColor = (status) => {
    const statusMap = {
      New: "#eff6ff",
      "In Progress": "#fef3c7",
      Completed: "#d1fae5",
      Cancelled: "#fee2e2",
      "On Hold": "#ede9fe",
    };

    return statusMap[status] || "#f3f4f6";
  };

  /* ============================================================
     PRODUCT NAME
     ============================================================ */

  const getProductName = (product) => {
    if (typeof product === "string") return product;

    return product?.product_name || product?.product_type_name || "Product";
  };

  /* ============================================================
     ADD TASK
     ============================================================ */

  const addTask = useCallback(async () => {
    if (!inquiryId) return;

    try {
      setSubmitting(true);
      setTaskError("");

      const response = await axios.post(
        `${API_BASE_URL}/inquiries/${inquiryId}/start-task/`,
        {},
        {
          headers: getHeaders(),
        },
      );

      console.log("Add task response:", response.data);

      /* --------------------------------------------------------
         Refresh task details from database
         -------------------------------------------------------- */

      await fetchTaskDetail();
    } catch (err) {
      console.error("Add task error:", err);

      console.error("FULL ADD TASK ERROR:", err);
      console.error("STATUS:", err.response?.status);
      console.error("DATA:", err.response?.data);

      const message =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        JSON.stringify(err.response?.data) ||
        err.message ||
        "Failed to start task.";

      setTaskError(message);
    } finally {
      setSubmitting(false);
    }
  }, [inquiryId, getHeaders, fetchTaskDetail]);

  useEffect(() => {
    if (
      !autoStartTask ||
      autoStartedTask.current ||
      !inquiry?.can_update_task ||
      inquiry.active_session
    ) {
      return;
    }

    autoStartedTask.current = true;
    addTask();
  }, [autoStartTask, inquiry, addTask]);

  /* ============================================================
     UPDATE DRAFT TEXT
     ============================================================ */

  const updateDraftTask = (draftId, field, value) => {
    setDraftTasks((current) =>
      current.map((task) =>
        task.id === draftId
          ? {
              ...task,
              [field]: value,
            }
          : task,
      ),
    );
  };

  /* ============================================================
     SAVE TASK PROGRESS
     ============================================================ */

  const handleSaveTask = async (task, outcome = "progress_saved") => {
    if (!inquiryId || !task) return;

    const normalizedRescheduleAt = getNormalizedRescheduleAt();

    if (outcome === "rescheduled" && !normalizedRescheduleAt) {
      setTaskError("Please select a valid date, hour, and minute.");
      return;
    }

    try {
      setSubmitting(true);
      setTaskError("");

      const response = await axios.post(
        `${API_BASE_URL}/inquiries/${inquiryId}/save-progress/`,
        {
          progress_notes: task.progress_notes || "",
          outcome,
          ...(outcome === "rescheduled" && {
            reschedule_at: normalizedRescheduleAt,
          }),
        },
        {
          headers: getHeaders(),
        },
      );

      console.log("Save task response:", response.data);

      /* --------------------------------------------------------
         Clear draft
         -------------------------------------------------------- */

      setDraftTasks((current) => current.filter((item) => item.id !== task.id));
      setRescheduleAt("");
      setRescheduleOpen(false);
      setRescheduleDropdown("");

      /* --------------------------------------------------------
         Refresh database data
         -------------------------------------------------------- */

      await fetchTaskDetail();
    } catch (err) {
      console.error("Save task error:", err);

      const message =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Failed to save task progress.";

      setTaskError(message);
    } finally {
      setSubmitting(false);
    }
  };

  /* ============================================================
     REMOVE / END TASK
     ============================================================ */

  const handleRemoveTask = async (task = null) => {
    if (!inquiryId) return;

    try {
      setSubmitting(true);
      setTaskError("");

      /* --------------------------------------------------------
         If this is only a frontend draft, remove it locally
         -------------------------------------------------------- */

      if (task?.id?.toString().startsWith("draft-")) {
        setDraftTasks((current) =>
          current.filter((item) => item.id !== task.id),
        );

        setSubmitting(false);
        return;
      }

      /* --------------------------------------------------------
         End actual backend task
         -------------------------------------------------------- */

      const response = await axios.post(
        `${API_BASE_URL}/inquiries/${inquiryId}/remove-task/`,
        {},
        {
          headers: getHeaders(),
        },
      );

      console.log("Remove task response:", response.data);

      /* --------------------------------------------------------
         Refresh database data
         -------------------------------------------------------- */

      await fetchTaskDetail();
    } catch (err) {
      console.error("Remove task error:", err);

      const message =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        "Failed to end task.";

      setTaskError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const setQuickReschedule = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const dateValue = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    const timeValue = rescheduleAt.split("T")[1] || "00:00";
    setRescheduleAt(`${dateValue}T${timeValue}`);
  };

  const updateRescheduleTimePart = (part, value) => {
    const sanitizedValue = value.replace(/\D/g, "").slice(0, 2);
    const [dateValue = "", timeValue = ""] = rescheduleAt.split("T");
    const [hour = "", minute = ""] = timeValue.split(":");
    const currentHour = Number(hour);
    const currentPeriod = currentHour >= 12 ? "PM" : "AM";
    const selectedHour = Number(sanitizedValue);
    const convertedHour =
      selectedHour >= 1 && selectedHour <= 12
        ? String(
            (selectedHour % 12) + (currentPeriod === "PM" ? 12 : 0),
          ).padStart(2, "0")
        : sanitizedValue;

    setRescheduleAt(
      `${dateValue}T${part === "hour" ? convertedHour : hour}:${
        part === "minute" ? sanitizedValue : minute
      }`,
    );
  };

  const updateReschedulePeriod = (period) => {
    const [dateValue = "", timeValue = ""] = rescheduleAt.split("T");
    const [hour = "", minute = ""] = timeValue.split(":");
    const hourNumber = Number(hour);
    const twelveHour = hourNumber % 12;
    const convertedHour = twelveHour + (period === "PM" ? 12 : 0);

    setRescheduleAt(
      `${dateValue}T${String(convertedHour).padStart(2, "0")}:${minute}`,
    );
  };

  const getRescheduleTimeDisplay = () => {
    const [hour = "", minute = ""] = (rescheduleAt.split("T")[1] || "").split(
      ":",
    );
    const hourNumber = Number(hour);

    if (!/^\d{1,2}$/.test(hour) || hourNumber < 0 || hourNumber > 23) {
      return { hour: "", minute, period: "AM" };
    }

    return {
      hour:
        hour.length === 2
          ? String(((hourNumber + 11) % 12) + 1).padStart(2, "0")
          : String(((hourNumber + 11) % 12) + 1),
      minute,
      period: hourNumber >= 12 ? "PM" : "AM",
    };
  };

  const getNormalizedRescheduleAt = () => {
    const [dateValue = "", timeValue = ""] = rescheduleAt.split("T");
    const [hour = "", minute = ""] = timeValue.split(":");
    const hourNumber = Number(hour);
    const minuteNumber = Number(minute);

    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(dateValue) ||
      !/^\d{1,2}$/.test(hour) ||
      !/^\d{1,2}$/.test(minute) ||
      hourNumber < 0 ||
      hourNumber > 23 ||
      minuteNumber < 0 ||
      minuteNumber > 59
    ) {
      return "";
    }

    return `${dateValue}T${String(hourNumber).padStart(2, "0")}:${String(
      minuteNumber,
    ).padStart(2, "0")}`;
  };

  /* ============================================================
     CREATE FRONTEND DRAFT
     ============================================================ */

  const createDraftTask = () => {
    setDraftTasks((current) => [
      {
        id: `draft-${Date.now()}`,
        work_date: new Date().toISOString().split("T")[0],
        progress_notes: "",
      },
      ...current,
    ]);
  };

  /* ============================================================
     LOADING
     ============================================================ */

  if (loading) {
    return (
      <div className="detail-page">
        <div className="detail-loading">
          <div className="loading-spinner" />
          <p>Loading inquiry details...</p>
        </div>
      </div>
    );
  }

  /* ============================================================
     ERROR
     ============================================================ */

  if (error) {
    return (
      <div className="detail-page">
        <div className="detail-error">
          <span className="error-icon" aria-hidden="true">
            !
          </span>

          <span>{error}</span>

          <div className="error-actions">
            <button type="button" onClick={fetchDetailData}>
              Retry
            </button>

            <button type="button" onClick={onBack}>
              Back to Schedule
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ============================================================
     NOT FOUND
     ============================================================ */

  if (!inquiry) {
    return (
      <div className="detail-page">
        <div className="detail-not-found">
          <h3>Inquiry not found</h3>

          <p>
            The inquiry you're looking for doesn't exist or has been removed.
          </p>

          <button type="button" onClick={onBack}>
            Back to Schedule
          </button>
        </div>
      </div>
    );
  }

  /* ============================================================
     RENDER
     ============================================================ */

  return (
    <div className="detail-page">
      {/* ======================================================
          HEADER
      ====================================================== */}

      <div className="detail-header">
        <button type="button" className="detail-back-btn" onClick={onBack}>
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M10 12L6 8L10 4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Back to Schedule
        </button>

        <div className="detail-title-section">
          <div className="detail-title-left">
            <h1>Inquiry Details</h1>

            <span className="detail-inquiry-id">
              Inquiry #{inquiry.id || "N/A"}
            </span>
          </div>

          {inquiry.products && inquiry.products.length > 0 && (
            <div className="detail-header-products">
              <span className="detail-products-label">Products</span>

              <div className="detail-products-list">
                {inquiry.products.map((product, index) => (
                  <div
                    key={product.id || index}
                    className="detail-product-item"
                  >
                    <span className="product-dot" />
                    <span>{getProductName(product)}</span>
                  </div>
                ))}
              </div>

              <span className="detail-product-count-badge">
                {inquiry.products.length} items
              </span>
            </div>
          )}

          <span
            className="detail-status-chip"
            style={{
              background: getStatusBgColor(inquiry.status_name),
              color: getStatusColor(inquiry.status_name),
            }}
          >
            {inquiry.status_name || "New"}
          </span>
        </div>
      </div>

      {/* ======================================================
          TOP INFORMATION
      ====================================================== */}

      <div className="detail-top-row">
        {/* CUSTOMER INFORMATION */}

        <div className="detail-card detail-card-half">
          <div className="detail-card-header">
            <h3>Customer Information</h3>
          </div>

          <div className="detail-info-row">
            <span className="detail-label">Customer Name</span>

            <span className="detail-value">{inquiry.customer_name || "-"}</span>
          </div>

          <div className="detail-info-row">
            <span className="detail-label">Phone</span>

            <span className="detail-value">
              <a
                href={`tel:${inquiry.phone_number}`}
                className="detail-phone-link"
              >
                {inquiry.phone_number || "-"}
              </a>
            </span>
          </div>
        </div>

        {/* INQUIRY DETAILS */}

        <div className="detail-card detail-card-half">
          <div className="detail-card-header">
            <h3>Inquiry Details</h3>
          </div>

          <div className="detail-info-row">
            <span className="detail-label">Schedule Date</span>

            <span className="detail-value">
              {formatDate(inquiry.schedule_date)}
            </span>
          </div>

          <div className="detail-info-row">
            <span className="detail-label">Total Amount</span>

            <span className="detail-value detail-amount">
              {formatAmount(inquiry.total)}
            </span>
          </div>
        </div>
      </div>

      {/* ======================================================
          TASK UPDATES
      ====================================================== */}

      <div className="detail-task-section">
        <div className="detail-card detail-updates-list">
          {/* TASK HEADER */}

          <div className="detail-card-title-row">
            <div className="detail-card-header">
              <h3>Task Updates</h3>
            </div>

            <div className="task-title-actions">
              {inquiry.can_update_task && (
                <span className="detail-permission-chip">
                  <span className="permission-dot" />
                  Assigned resource
                </span>
              )}

              <button
                type="button"
                className="add-task-btn"
                onClick={addTask}
                disabled={
                  submitting ||
                  !inquiry.can_update_task ||
                  !!inquiry.active_session
                }
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 14 14"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M7 1V13M1 7H13" strokeLinecap="round" />
                </svg>

                {inquiry.active_session ? "Task Active" : "Add Task"}
              </button>
            </div>
          </div>

          {/* ==================================================
              ACTIVE SESSION
          ================================================== */}

          {inquiry.active_session && (
            <div className="active-session-banner">
              <span className="session-dot" />
              Active since {formatDateTime(inquiry.active_session.start_time)}
            </div>
          )}

          {/* ==================================================
              ERROR / WARNING
          ================================================== */}

          {taskError && <div className="task-grid-warning">{taskError}</div>}

          {/* ==================================================
              TASK TABLE
          ================================================== */}

          <div
            className="updates-grid"
            role="table"
            aria-label="Task updates history"
          >
            {/* HEADER */}

            <div className="updates-grid-head" role="row">
              <span role="columnheader">Date</span>

              <span role="columnheader">Progress</span>

              <span role="columnheader">Action</span>
            </div>

            {/* =================================================
                NEW FRONTEND DRAFT
            ================================================= */}

            {draftTasks.map((task) => (
              <div
                key={task.id}
                className="updates-grid-row updates-grid-row-editing"
                role="row"
              >
                <span role="cell" data-label="Date">
                  <span className="update-date-display">
                    {formatDate(task.work_date)}
                  </span>
                </span>

                <span role="cell" data-label="Progress">
                  <textarea
                    rows="2"
                    value={task.progress_notes}
                    onChange={(event) =>
                      updateDraftTask(
                        task.id,
                        "progress_notes",
                        event.target.value,
                      )
                    }
                    placeholder="Enter today's progress..."
                    className="edit-textarea"
                  />
                </span>

                <span role="cell" data-label="Action">
                  <div className="draft-actions">
                    <button
                      type="button"
                      className="submit-draft-btn"
                      onClick={() => handleSaveTask(task)}
                      disabled={submitting}
                    >
                      {submitting ? "Saving..." : "Save"}
                    </button>

                    <button
                      type="button"
                      className="remove-task-btn"
                      onClick={() => handleRemoveTask(task)}
                      disabled={submitting}
                    >
                      Remove
                    </button>
                  </div>
                </span>
              </div>
            ))}

            {/* =================================================
                DATABASE TASK HISTORY
            ================================================= */}

            {taskUpdates.length === 0 && draftTasks.length === 0 ? (
              <div className="updates-grid-empty" role="row">
                {taskError
                  ? "Unable to load task updates."
                  : "No task updates yet."}
              </div>
            ) : (
              taskUpdates.map((update) => {
                const isActiveTask =
                  !update.end_time && inquiry.can_update_task;

                return (
                  <div key={update.id} className="updates-grid-row" role="row">
                    {/* DATE */}

                    <span role="cell" data-label="Date">
                      <span className="update-date-badge">
                        {formatDate(update.work_date)}
                      </span>
                    </span>

                    {/* PROGRESS */}

                    {isActiveTask ? (
                      <span role="cell" data-label="Progress">
                        <input
                          type="text"
                          value={activeTaskNotes}
                          onChange={(event) =>
                            setActiveTaskNotes(event.target.value)
                          }
                          placeholder="Enter today's progress..."
                          className="active-task-notes-input"
                          disabled={submitting}
                        />
                      </span>
                    ) : (
                      <span
                        role="cell"
                        data-label="Progress"
                        className="update-progress"
                      >
                        <span>{update.progress_notes || "Task started"}</span>
                        {update.reschedule_at && (
                          <small className="rescheduled-callback">
                            Call again: {formatDateTime(update.reschedule_at)}
                          </small>
                        )}
                      </span>
                    )}

                    {/* ACTION */}

                    <span role="cell" data-label="Action">
                      {isActiveTask ? (
                        <div className="task-icon-actions">
                          <button
                            type="button"
                            className="task-icon-btn task-save-icon"
                            onClick={() =>
                              handleSaveTask({
                                ...update,
                                progress_notes: activeTaskNotes,
                              })
                            }
                            disabled={submitting || !activeTaskNotes.trim()}
                            aria-label="Save task progress"
                            title="Save task progress"
                          >
                            ✓
                          </button>
                          <div className="reschedule-action">
                            <button
                              type="button"
                              className="task-icon-btn task-reschedule-icon"
                              onClick={() => setRescheduleOpen((open) => !open)}
                              disabled={submitting}
                              aria-label="Choose reschedule date and time"
                              title="Reschedule task"
                            >
                              <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 15H5V9h14v10ZM7 11h5v5H7v-5Z" />
                              </svg>
                            </button>
                            {rescheduleOpen && (
                              <div
                                className="reschedule-modal-overlay"
                                role="presentation"
                                onMouseDown={(event) => {
                                  if (event.target === event.currentTarget) {
                                    setRescheduleOpen(false);
                                  }
                                }}
                              >
                                <div
                                  className="reschedule-popover"
                                  role="dialog"
                                  aria-modal="true"
                                  aria-labelledby="reschedule-modal-title"
                                >
                                  <div className="reschedule-popover-heading">
                                    <span className="reschedule-popover-icon">
                                      <svg
                                        viewBox="0 0 24 24"
                                        aria-hidden="true"
                                      >
                                        <path d="M19 4h-1V2h-2v2H8V2H6v2H5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm0 15H5V9h14v10Z" />
                                      </svg>
                                    </span>
                                    <span>
                                      <strong id="reschedule-modal-title">
                                        Reschedule call
                                      </strong>
                                      <small>
                                        Choose a convenient callback time
                                      </small>
                                    </span>
                                  </div>
                                  <div className="reschedule-quick-options">
                                    <button
                                      type="button"
                                      onClick={() => setQuickReschedule(0)}
                                      disabled={submitting}
                                    >
                                      Today
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setQuickReschedule(1)}
                                      disabled={submitting}
                                    >
                                      Tomorrow
                                    </button>
                                  </div>
                                  <div className="reschedule-fields">
                                    <label>
                                      Date
                                      <RescheduleDatePicker
                                        value={rescheduleAt.split("T")[0] || ""}
                                        onChange={(dateValue) =>
                                          setRescheduleAt(
                                            `${dateValue}T${rescheduleAt.split("T")[1] || "00:00"}`,
                                          )
                                        }
                                        disabled={submitting}
                                      />
                                    </label>
                                    <div className="reschedule-time-group">
                                      <span>Time</span>
                                      <div className="reschedule-time-inputs">
                                        <TimePartDropdown
                                          id="reschedule-hour"
                                          placeholder="HH"
                                          value={
                                            getRescheduleTimeDisplay().hour
                                          }
                                          options={RESCHEDULE_HOURS}
                                          onChange={(value) =>
                                            updateRescheduleTimePart(
                                              "hour",
                                              value,
                                            )
                                          }
                                          onSelect={(value) => {
                                            updateRescheduleTimePart(
                                              "hour",
                                              value,
                                            );
                                            setRescheduleDropdown("");
                                          }}
                                          open={rescheduleDropdown === "hour"}
                                          onToggle={() =>
                                            setRescheduleDropdown((current) =>
                                              current === "hour" ? "" : "hour",
                                            )
                                          }
                                          disabled={submitting}
                                          label="Reschedule hour"
                                        />
                                        <span aria-hidden="true">:</span>
                                        <TimePartDropdown
                                          id="reschedule-minute"
                                          placeholder="MM"
                                          value={
                                            getRescheduleTimeDisplay().minute
                                          }
                                          options={RESCHEDULE_MINUTES}
                                          onChange={(value) =>
                                            updateRescheduleTimePart(
                                              "minute",
                                              value,
                                            )
                                          }
                                          onSelect={(value) => {
                                            updateRescheduleTimePart(
                                              "minute",
                                              value,
                                            );
                                            setRescheduleDropdown("");
                                          }}
                                          open={rescheduleDropdown === "minute"}
                                          onToggle={() =>
                                            setRescheduleDropdown((current) =>
                                              current === "minute"
                                                ? ""
                                                : "minute",
                                            )
                                          }
                                          disabled={submitting}
                                          label="Reschedule minute"
                                        />
                                        <TimePartDropdown
                                          id="reschedule-period"
                                          placeholder="AM"
                                          value={
                                            getRescheduleTimeDisplay().period
                                          }
                                          options={RESCHEDULE_PERIODS}
                                          onChange={() => {}}
                                          onSelect={(value) => {
                                            updateReschedulePeriod(value);
                                            setRescheduleDropdown("");
                                          }}
                                          open={rescheduleDropdown === "period"}
                                          onToggle={() =>
                                            setRescheduleDropdown((current) =>
                                              current === "period"
                                                ? ""
                                                : "period",
                                            )
                                          }
                                          disabled={submitting}
                                          label="Reschedule period"
                                        />
                                      </div>
                                    </div>
                                  </div>
                                  <div className="reschedule-selection">
                                    {rescheduleAt
                                      ? new Date(rescheduleAt).toLocaleString(
                                          "en-IN",
                                          {
                                            weekday: "short",
                                            day: "numeric",
                                            month: "short",
                                            hour: "numeric",
                                            minute: "2-digit",
                                          },
                                        )
                                      : "Select a date and time"}
                                  </div>
                                  <div className="reschedule-popover-actions">
                                    <button
                                      type="button"
                                      onClick={() => setRescheduleOpen(false)}
                                      disabled={submitting}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      className="task-reschedule-btn"
                                      onClick={() =>
                                        handleSaveTask(
                                          {
                                            ...update,
                                            progress_notes: activeTaskNotes,
                                          },
                                          "rescheduled",
                                        )
                                      }
                                      disabled={
                                        submitting ||
                                        !getNormalizedRescheduleAt()
                                      }
                                    >
                                      Confirm
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            className="task-icon-btn task-remove-icon"
                            onClick={() => handleRemoveTask(update)}
                            disabled={submitting}
                            aria-label="Remove active task"
                            title="Remove active task"
                          >
                            ×
                          </button>
                        </div>
                      ) : update.end_time ? (
                        <span className="update-action-dot">✓</span>
                      ) : (
                        <span className="update-action-dot" />
                      )}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {paymentPendingSuccess && (
        <div className="detail-payment-success" role="status">
          {paymentPendingSuccess}
        </div>
      )}

      {inquiry.can_move_to_payment_pending && (
        <div className="detail-payment-panel">
          <div className="detail-payment-fields">
            <label>
              <span>Invoice Amount</span>
              <div className="detail-payment-input-wrap">
                <span aria-hidden="true">₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceAmount}
                  onChange={(event) => {
                    setInvoiceAmount(event.target.value);
                    setPaymentPendingError("");
                  }}
                  disabled={movingToPaymentPending}
                  aria-label="Invoice amount"
                />
              </div>
            </label>

            <label>
              <span>Revenue Amount</span>
              <div className="detail-payment-input-wrap">
                <span aria-hidden="true">₹</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={revenueAmount}
                  onChange={(event) => {
                    setRevenueAmount(event.target.value);
                    setPaymentPendingError("");
                  }}
                  disabled={movingToPaymentPending}
                  aria-label="Revenue amount"
                />
              </div>
            </label>
          </div>

          <div className="detail-payment-action">
            {paymentPendingError && (
              <span className="detail-payment-error" role="alert">
                {paymentPendingError}
              </span>
            )}
            <button
              type="button"
              onClick={handleMoveToPaymentPending}
              disabled={movingToPaymentPending}
            >
              {movingToPaymentPending ? "Moving..." : "Move to Payment Pending"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleDetail;
