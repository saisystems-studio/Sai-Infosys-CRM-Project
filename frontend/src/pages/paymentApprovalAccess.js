const normalizeRole = (role = "") =>
  String(role)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

export function canMarkPaymentReceived(user = {}) {
  const role = normalizeRole(user.role || user.Role || user.user_type);
  return role === "super admin" || (!role && user.is_superuser === true);
}

export function canViewPaymentApproval(user = {}) {
  const role = normalizeRole(user.role || user.Role || user.user_type);
  return (
    role === "admin" ||
    role === "super admin" ||
    (!role && user.is_superuser === true)
  );
}

export function canRecordPayment(user = {}) {
  const role = normalizeRole(user.role || user.Role || user.user_type);
  return role === "admin";
}
