import { useEffect, useRef, useState } from "react";
import axios from "axios";
import {
  buildReminderDateTimeValue,
  buildReminderReschedulePayload,
  isReminderCallbackDue,
  validateReminderReschedule,
} from "./taskReminderReschedule.js";
import "./TaskReminder.css";

const API_BASE_URL = "/crm/api";
const POLL_INTERVAL_MS = 15000;
const REMINDER_HOURS = Array.from({ length: 12 }, (_, index) =>
  String(index + 1).padStart(2, "0"),
);
const REMINDER_MINUTES = Array.from({ length: 60 }, (_, index) =>
  String(index).padStart(2, "0"),
);

const playReminderSound = () => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;
  const context = new AudioContext();
  [0, 0.22, 0.44].forEach((offset) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, context.currentTime + offset);
    gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + offset + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + offset + 0.16);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(context.currentTime + offset);
    oscillator.stop(context.currentTime + offset + 0.18);
  });
  window.setTimeout(() => context.close(), 1000);
};

const formatCallback = (value) =>
  new Date(value).toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });

const getReminderUser = () => {
  try {
    return JSON.parse(localStorage.getItem("crm_user") || "{}");
  } catch {
    return {};
  }
};

const canReceiveStaffReminder = (user) => {
  return user.staff_id != null;
};

const getAcknowledgedKey = (staffId, inquiryId, callbackAt) =>
  `crm_callback_ack:${staffId}:${inquiryId}:${callbackAt}`;

const TaskReminder = ({ onOpenInquiry }) => {
  const [reminder, setReminder] = useState(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleHour, setRescheduleHour] = useState("12");
  const [rescheduleMinute, setRescheduleMinute] = useState("00");
  const [reschedulePeriod, setReschedulePeriod] = useState("AM");
  const [rescheduleError, setRescheduleError] = useState("");
  const [savingReschedule, setSavingReschedule] = useState(false);
  const notifiedCallbacks = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    const checkCallbacks = async () => {
      const token = localStorage.getItem("crm_access_token");
      const user = getReminderUser();
      if (!token || !canReceiveStaffReminder(user)) return;
      try {
        const response = await axios.get(`${API_BASE_URL}/inquiries/schedule/`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (cancelled) return;
        const now = Date.now();
        const dueInquiry = response.data.find((inquiry) => {
          if (!inquiry.next_reschedule_at) return false;
          if (inquiry.active_task_started_at) return false;
          if (String(inquiry.Resource_Id) !== String(user.staff_id)) {
            return false;
          }
          const callbackKey = `${inquiry.id}:${inquiry.next_reschedule_at}`;
          const acknowledgedKey = getAcknowledgedKey(
            user.staff_id,
            inquiry.id,
            inquiry.next_reschedule_at,
          );
          return isReminderCallbackDue(inquiry.next_reschedule_at, new Date(now)) &&
            !notifiedCallbacks.current.has(callbackKey) &&
            localStorage.getItem(acknowledgedKey) !== "1";
        });
        if (dueInquiry) {
          notifiedCallbacks.current.add(`${dueInquiry.id}:${dueInquiry.next_reschedule_at}`);
          setReminder(dueInquiry);
          playReminderSound();
        }
      } catch (error) {
        if (error.response?.status !== 401) {
          console.error("Task reminder check failed:", error);
        }
      }
    };
    checkCallbacks();
    const timer = window.setInterval(checkCallbacks, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  if (!reminder) return null;

  const acknowledgeReminder = () => {
    const user = getReminderUser();
    localStorage.setItem(
      getAcknowledgedKey(
        user.staff_id,
        reminder.id,
        reminder.next_reschedule_at,
      ),
      "1",
    );
  };

  const saveReminderReschedule = async () => {
    const rescheduleAt = buildReminderDateTimeValue(
      rescheduleDate,
      rescheduleHour,
      rescheduleMinute,
      reschedulePeriod,
    );
    const validationError = validateReminderReschedule(rescheduleAt);
    if (validationError) {
      setRescheduleError(validationError);
      return;
    }
    try {
      setSavingReschedule(true);
      setRescheduleError("");
      const token = localStorage.getItem("crm_access_token");
      await axios.post(
        `${API_BASE_URL}/inquiries/${reminder.id}/reschedule-callback/`,
        buildReminderReschedulePayload(rescheduleAt),
        { headers: { Authorization: `Bearer ${token}` } },
      );
      acknowledgeReminder();
      setReminder(null);
      setRescheduling(false);
      setRescheduleDate("");
    } catch (error) {
      setRescheduleError(
        error.response?.data?.detail ||
          error.response?.data?.reschedule_at?.[0] ||
          "Unable to reschedule this callback.",
      );
    } finally {
      setSavingReschedule(false);
    }
  };

  return (
    <div className="task-reminder-overlay">
      <section className="task-reminder" role="alertdialog" aria-modal="true" aria-labelledby="task-reminder-title">
        <div className="task-reminder-icon" aria-hidden="true">🔔</div>
        <div className="task-reminder-content">
          <span className="task-reminder-label">Callback reminder</span>
          <h2 id="task-reminder-title">{reminder.customer_name || "Customer inquiry"}</h2>
          <p className="task-reminder-time">Call scheduled for {formatCallback(reminder.next_reschedule_at)}</p>
          <div className="task-reminder-details">
            <span><strong>Phone:</strong> {reminder.phone_number || "—"}</span>
            <span><strong>Assigned to:</strong> {reminder.resource_name || "—"}</span>
            <span><strong>Source:</strong> {reminder.source_name || "—"}</span>
          </div>
          {rescheduling && (
            <div className="task-reminder-reschedule">
              <label htmlFor="reminder-reschedule-date">New callback time</label>
              <div className="task-reminder-date-time">
                <input
                  id="reminder-reschedule-date"
                  type="date"
                  value={rescheduleDate}
                  onChange={(event) => {
                    setRescheduleDate(event.target.value);
                    setRescheduleError("");
                  }}
                  disabled={savingReschedule}
                  aria-label="Callback date"
                />
                <select
                  value={rescheduleHour}
                  onChange={(event) => setRescheduleHour(event.target.value)}
                  disabled={savingReschedule}
                  aria-label="Callback hour"
                >
                  {REMINDER_HOURS.map((hour) => (
                    <option key={hour} value={hour}>{hour}</option>
                  ))}
                </select>
                <span aria-hidden="true">:</span>
                <select
                  value={rescheduleMinute}
                  onChange={(event) => setRescheduleMinute(event.target.value)}
                  disabled={savingReschedule}
                  aria-label="Callback minute"
                >
                  {REMINDER_MINUTES.map((minute) => (
                    <option key={minute} value={minute}>{minute}</option>
                  ))}
                </select>
                <select
                  value={reschedulePeriod}
                  onChange={(event) => setReschedulePeriod(event.target.value)}
                  disabled={savingReschedule}
                  aria-label="Callback AM or PM"
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
              {rescheduleError && (
                <span className="task-reminder-error" role="alert">
                  {rescheduleError}
                </span>
              )}
            </div>
          )}
          <div className="task-reminder-actions">
            {rescheduling ? (
              <>
                <button
                  type="button"
                  className="task-reminder-dismiss"
                  onClick={() => {
                    setRescheduling(false);
                    setRescheduleDate("");
                    setRescheduleError("");
                  }}
                  disabled={savingReschedule}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="task-reminder-open"
                  onClick={saveReminderReschedule}
                  disabled={savingReschedule}
                >
                  {savingReschedule ? "Saving..." : "Confirm Reschedule"}
                </button>
              </>
            ) : (
              <>
            <button
              type="button"
              className="task-reminder-reschedule-btn"
              onClick={() => setRescheduling(true)}
            >
              Reschedule
            </button>
            <button type="button" className="task-reminder-open" onClick={() => {
              acknowledgeReminder();
              setReminder(null);
              onOpenInquiry(reminder.id, { autoStartTask: true });
            }}>Open inquiry</button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default TaskReminder;
