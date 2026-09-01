export function isPaymentPendingStatus(statusName) {
  return String(statusName || "").trim().toLowerCase() === "payment pending";
}

export function canAccessTaskActions(canUpdateTask, statusName) {
  return Boolean(canUpdateTask) && !isPaymentPendingStatus(statusName);
}
