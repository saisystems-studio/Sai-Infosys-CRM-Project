import test from "node:test";
import assert from "node:assert/strict";

import {
  formatCustomerImportError,
  formatCustomerImportResult,
} from "./customerTransfer.js";

test("customer import result reports imported and duplicate counts", () => {
  assert.equal(
    formatCustomerImportResult({ imported: 2, skipped_duplicates: 1 }),
    "Imported 2 customers. Skipped 1 duplicate.",
  );
});

test("customer import error uses the backend validation detail", () => {
  const error = { response: { data: { error: "Missing required sheet: Contacts." } } };

  assert.equal(
    formatCustomerImportError(error),
    "Missing required sheet: Contacts.",
  );
});
