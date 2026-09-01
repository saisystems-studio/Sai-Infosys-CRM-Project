export function updateContactField(contacts, id, field, value) {
  const nextValue = field === "contact_number"
    ? String(value).replace(/\D/g, "").slice(0, 10)
    : value;
  return contacts.map((contact) =>
    contact.id === id ? { ...contact, [field]: nextValue } : contact,
  );
}

export function getContactNumberError(value) {
  if (!value) return "Contact number is required";
  if (!/^\d{10}$/.test(value)) return "Contact number must be exactly 10 digits";
  return "";
}
