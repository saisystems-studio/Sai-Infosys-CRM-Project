export function buildReminderDateTimeValue(date, hour, minute, period) {
  if (!date || !hour || !minute || !period) return "";
  const hour12 = Number(hour);
  if (hour12 < 1 || hour12 > 12) return "";
  const hour24 = (hour12 % 12) + (period === "PM" ? 12 : 0);
  return `${date}T${String(hour24).padStart(2, "0")}:${minute}`;
}

export function validateReminderReschedule(value, now = new Date()) {
  if (!value) return "Choose a new callback date and time.";
  const callbackAt = new Date(value);
  if (
    Number.isNaN(callbackAt.getTime()) ||
    callbackAt.getFullYear() < now.getFullYear() ||
    (callbackAt.getFullYear() === now.getFullYear() &&
      callbackAt.getMonth() < now.getMonth()) ||
    (callbackAt.getFullYear() === now.getFullYear() &&
      callbackAt.getMonth() === now.getMonth() &&
      callbackAt.getDate() < now.getDate())
  ) {
    return "Choose a future callback date and time.";
  }
  return "";
}8

export function buildReminderReschedulePayload(value) {
  return { reschedule_at: value };
}

export function isReminderCallbackDue(value, now = new Date()) {
  const callbackAt = new Date(value);
  return !Number.isNaN(callbackAt.getTime()) && callbackAt <= now;
}
