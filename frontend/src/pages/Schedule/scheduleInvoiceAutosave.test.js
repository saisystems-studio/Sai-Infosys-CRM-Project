import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInvoiceAmountPayload,
  scheduleInvoiceAmountSave,
} from "./scheduleInvoiceAutosave.js";

test("invoice autosave sends the API field name", () => {
  assert.deepEqual(buildInvoiceAmountPayload("1250.50"), {
    invoice_amount: "1250.50",
  });
});

test("invoice autosave waits until editing pauses", async () => {
  const savedValues = [];
  scheduleInvoiceAmountSave((value) => savedValues.push(value), "1250.50", 20);

  assert.deepEqual(savedValues, []);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(savedValues, ["1250.50"]);
});

test("canceling invoice autosave prevents a stale value from saving", async () => {
  const savedValues = [];
  const cancel = scheduleInvoiceAmountSave(
    (value) => savedValues.push(value),
    "100.00",
    20,
  );

  cancel();
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.deepEqual(savedValues, []);
});
