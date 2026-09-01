const normalizeRole = (role = "") =>
  String(role).trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");

export function canAssignAnyResource(user = {}) {
  return ["admin", "super admin"].includes(normalizeRole(user.role));
}

export function getNewInquiryResource(user = {}) {
  if (canAssignAnyResource(user)) return "";
  return user.staff_id == null ? "" : String(user.staff_id);
}
