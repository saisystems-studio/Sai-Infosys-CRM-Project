const startOfDay = (value) => {
  const date = value instanceof Date ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

export function hasScheduleAdminAccess(user = {}) {
  if (typeof user.has_full_access === "boolean") {
    return user.has_full_access;
  }

  const role = String(user.role || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .replaceAll("-", " ")
    .replace(/\s+/g, " ");

  if (role) return role === "admin" || role === "super admin";
  return Boolean(user.is_superuser);
}

export function getScheduleDateState(value, now = new Date()) {
  if (!value) return "unscheduled";
  const scheduled = startOfDay(value);
  const today = startOfDay(now);
  if (!scheduled || !today) return "unscheduled";
  if (scheduled.getTime() === today.getTime()) return "today";
  return scheduled < today ? "overdue" : "upcoming";
}

export function getScheduleInitials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "CU";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts.at(-1)[0]}`.toUpperCase();
}

export function isScheduleCardActivationKey(key) {
  return key === "Enter" || key === " ";
}

export function getTotalTaskDurationSeconds(inquiry, now = new Date()) {
  const completed = Number(inquiry?.completed_task_duration_seconds) || 0;
  const activeStart = inquiry?.active_task_started_at;
  if (!activeStart) return Math.max(0, completed);

  const startedAt = new Date(activeStart);
  const currentTime = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(currentTime.getTime())) {
    return Math.max(0, completed);
  }

  const activeSeconds = Math.max(
    0,
    Math.floor((currentTime.getTime() - startedAt.getTime()) / 1000),
  );
  return Math.max(0, completed) + activeSeconds;
}

export function formatTaskDuration(totalSeconds) {
  const totalMinutes = Math.floor(Math.max(0, Number(totalSeconds) || 0) / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
