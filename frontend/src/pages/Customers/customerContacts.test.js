import test from "node:test";
import assert from "node:assert/strict";

import { updateContactField } from "./customerContacts.js";

test("contact name updates preserve letters and spaces", () => {
  const contacts = [
    { id: 1, contact_name: "", contact_number: "" },
    { id: 2, contact_name: "Existing", contact_number: "9876543210" },
  ];

  assert.deepEqual(updateContactField(contacts, 1, "contact_name", "Arun Kumar"), [
    { id: 1, contact_name: "Arun Kumar", contact_number: "" },
    { id: 2, contact_name: "Existing", contact_number: "9876543210" },
  ]);
});
