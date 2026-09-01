export function normalizeStaffPhone(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 10);
}

export function getStaffPhoneError(value) {
  if (!value) return "Phone Number is required.";
  if (!/^\d{10}$/.test(value)) {
    return "Phone Number must be exactly 10 digits.";
  }
  return "";
}
