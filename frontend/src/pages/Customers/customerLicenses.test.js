import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeTallySerialNumber,
  getLicenseErrors,
  prepareLicensesForPayload,
} from "./customerLicenses.js";

test("serial input accepts only nine digits and preserves leading zeroes", () => {
  assert.equal(normalizeTallySerialNumber("001234567890"), "001234567");
  assert.equal(normalizeTallySerialNumber("ab012-345 678xyz9"), "012345678");
  assert.equal(normalizeTallySerialNumber(""), "");
});

test("a blank tally serial number makes the license row optional", () => {
  const license = {
    id: 1,
    tally_serial_number: "",
    license_type: "",
    admin_id: "",
    expiry_date: "",
  };

  assert.deepEqual(getLicenseErrors(license), {});
  assert.deepEqual(prepareLicensesForPayload([license]), []);
});

test("entering a tally serial number requires complete license details", () => {
  const license = {
    id: 1,
    tally_serial_number: "123",
    license_type: "",
    admin_id: "",
    expiry_date: "",
  };

  assert.deepEqual(getLicenseErrors(license), {
    tally_serial: "License number must be exactly 9 digits",
    license_type: "License type is required",
    admin_id: "Admin ID is required",
    expiry_date: "Expiry date is required",
  });
});

test("a complete license row is included in the save payload", () => {
  const license = {
    id: 7,
    tally_serial_number: "123456789",
    license_type: "2",
    admin_id: "admin@example.com",
    expiry_date: "2020-01-01",
  };

  assert.deepEqual(getLicenseErrors(license), {});
  assert.deepEqual(prepareLicensesForPayload([license]), [
    {
      tally_serial_number: "123456789",
      license_type: "2",
      admin_id: "admin@example.com",
      expiry_date: "2020-01-01",
    },
  ]);
});
