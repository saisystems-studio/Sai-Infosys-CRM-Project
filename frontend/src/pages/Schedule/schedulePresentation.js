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

export function getTodayDateString(date = new Date()) {
  const currentDate = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(currentDate.getTime())) return "";

  const year = currentDate.getFullYear();
  const month = String(currentDate.getMonth() + 1).padStart(2, "0");
  const day = String(currentDate.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getDefaultScheduleDateRange(now = new Date()) {
  const today = getTodayDateString(now);
  return {
    fromDate: today,
    toDate: today,
    isTodayOnly: true,
  };
}

export function getSchedulePeriodDateRange(preset, now = new Date()) {
  const current = startOfDay(now);
  if (!current || preset === "custom") return { fromDate: "", toDate: "" };

  const from = new Date(current);
  const to = new Date(current);

  if (preset === "yesterday") {
    from.setDate(from.getDate() - 1);
    to.setDate(to.getDate() - 1);
  } else if (preset === "today-yesterday") {
    from.setDate(from.getDate() - 1);
  } else if (preset === "last-7-days") {
    from.setDate(from.getDate() - 6);
  } else if (preset === "next-month") {
    from.setMonth(from.getMonth() + 1, 1);
    to.setMonth(to.getMonth() + 2, 0);
  } else if (preset === "this-month") {
    from.setDate(1);
    to.setMonth(to.getMonth() + 1, 0);
  } else if (preset === "last-month") {
    from.setMonth(from.getMonth() - 1, 1);
    to.setMonth(to.getMonth(), 0);
  }

  return { fromDate: getTodayDateString(from), toDate: getTodayDateString(to) };
}

export function getScheduleFilterOptions({
  resources = [],
  statuses = [],
  products = [],
  inquiries = [],
} = {}) {
  const unique = (values) => [...new Set(values.filter(Boolean))].sort((left, right) => String(left).localeCompare(String(right)));
  const scheduledStaff = inquiries.map((inquiry) => ({
    value: String(inquiry.Resource_Id || ""),
    label: inquiry.resource_name,
  })).filter((option) => option.value && option.label);
  const staff = resources.length
    ? resources.map((resource) => ({ value: String(resource.Id), label: resource.Full_Name })).filter((option) => option.value && option.label)
    : scheduledStaff;
  const scheduledStatuses = inquiries.map((inquiry) => inquiry.status_name);
  const scheduledProducts = inquiries.flatMap((inquiry) =>
    Array.isArray(inquiry.products)
      ? inquiry.products.map((product) => product.product_name || product.product_type_name || product.name)
      : [],
  );

  return {
    staff: staff
      .filter((option, index, list) => list.findIndex((item) => item.value === option.value) === index)
      .sort((left, right) => left.label.localeCompare(right.label)),
    statuses: unique(statuses.length ? statuses.map((status) => status.status_type_name) : scheduledStatuses),
    products: unique(products.length ? products.map((product) => product.product_type_name) : scheduledProducts),
  };
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

export function getScheduleCustomerDisplayName(inquiry = {}) {
  return (
    String(inquiry.company_name || "").trim() ||
    String(inquiry.customer_name || "").trim() ||
    "Unknown Customer"
  );
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
