import test from "node:test";
import assert from "node:assert/strict";

import {
  filterLicenseExpiryRows,
  getLicenseExpiryDateRange,
} from "./licenseExpiryReport.js";

test("licence expiry presets cover last, current, and next calendar month", () => {
  const today = new Date("2026-09-16T10:00:00");

  assert.deepEqual(getLicenseExpiryDateRange("last-month", today), {
    fromDate: "2026-08-01",
    toDate: "2026-08-31",
  });
  assert.deepEqual(getLicenseExpiryDateRange("this-month", today), {
    fromDate: "2026-09-01",
    toDate: "2026-09-30",
  });
  assert.deepEqual(getLicenseExpiryDateRange("next-month", today), {
    fromDate: "2026-10-01",
    toDate: "2026-10-31",
  });
  assert.deepEqual(getLicenseExpiryDateRange("next-year", today), {
    fromDate: "2027-01-01",
    toDate: "2027-12-31",
  });
  assert.deepEqual(getLicenseExpiryDateRange("custom", today), {
    fromDate: "",
    toDate: "",
  });
});

test("licence expiry rows can be narrowed by period and licence type", () => {
  const rows = [
    { id: 1, expiry_date: "2026-09-18", product_id: 3 },
    { id: 2, expiry_date: "2026-10-01", product_id: 4 },
  ];

  assert.deepEqual(
    filterLicenseExpiryRows(rows, {
      fromDate: "2026-09-01",
      toDate: "2026-09-30",
      productId: "3",
    }),
    [rows[0]],
  );
});
