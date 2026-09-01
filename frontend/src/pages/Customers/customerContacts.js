export function updateContactField(contacts, id, field, value) {
  return contacts.map((contact) =>
    contact.id === id ? { ...contact, [field]: value } : contact,
  );
}
