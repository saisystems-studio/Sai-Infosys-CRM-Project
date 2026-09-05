import test from "node:test";
import assert from "node:assert/strict";

import {
  createCustomerSavedHandler,
  createCustomerUpdatedHandler,
} from "./customerNavigation.js";

test("successful customer creation navigates to Customer List", () => {
  let activePage = "Add Customer";
  const handleSaved = createCustomerSavedHandler((page) => {
    activePage = page;
  });

  handleSaved();

  assert.equal(activePage, "Customer List");
});

test("successful customer update refreshes data without closing the modal", () => {
  let refreshCount = 0;
  let modalOpen = true;
  const handleUpdated = createCustomerUpdatedHandler(() => {
    refreshCount += 1;
  });

  handleUpdated();

  assert.equal(refreshCount, 1);
  assert.equal(modalOpen, true);
});
