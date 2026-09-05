export function normalizeTallySerialNumber(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 9);
}

export function getLicenseErrors(license) {
  if (!String(license.tally_serial_number || "").trim()) return {};

  const errors = {};
  if (!/^\d{9}$/.test(license.tally_serial_number)) {
    errors.tally_serial = "License number must be exactly 9 digits";
  }
  if (!license.license_type) errors.license_type = "License type is required";
  if (!String(license.admin_id || "").trim()) {
    errors.admin_id = "Admin ID is required";
  }
  if (!license.expiry_date) errors.expiry_date = "Expiry date is required";
  return errors;
}

export function prepareLicensesForPayload(licenses) {
  return licenses
    .filter((license) => String(license.tally_serial_number || "").trim())
    .map(({ id, ...license }) => license);
}
