export function isPaymentPendingStatus(statusName) {
  return ["payment pending", "completed"].includes(
    String(statusName || "").trim().toLowerCase(),
  );
}

export function canAccessTaskActions(canUpdateTask, statusName) {
  return Boolean(canUpdateTask) && !isPaymentPendingStatus(statusName);
}
