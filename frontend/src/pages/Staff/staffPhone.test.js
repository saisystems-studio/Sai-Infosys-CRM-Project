import test from "node:test";
import assert from "node:assert/strict";

import { getStaffPhoneError, normalizeStaffPhone } from "./staffPhone.js";

test("staff phone input keeps only the first ten digits", () => {
  assert.equal(normalizeStaffPhone("98a 76-54321099"), "9876543210");
});

test("staff phone validation requires exactly ten digits", () => {
  assert.equal(getStaffPhoneError(""), "Phone Number is required.");
  assert.equal(
    getStaffPhoneError("987654321"),
    "Phone Number must be exactly 10 digits.",
  );
  assert.equal(getStaffPhoneError("9876543210"), "");
});
