import test from "node:test";
import assert from "node:assert/strict";

import {
  getContactNumberError,
  updateContactField,
} from "./customerContacts.js";

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

test("contact number input keeps only the first ten digits", () => {
  const contacts = [{ id: 1, contact_name: "Arun", contact_number: "" }];

  assert.deepEqual(
    updateContactField(contacts, 1, "contact_number", "98a 76-54321099"),
    [{ id: 1, contact_name: "Arun", contact_number: "9876543210" }],
  );
});

test("contact number validation requires exactly ten digits", () => {
  assert.equal(getContactNumberError(""), "Contact number is required");
  assert.equal(
    getContactNumberError("987654321"),
    "Contact number must be exactly 10 digits",
  );
  assert.equal(getContactNumberError("9876543210"), "");
});
