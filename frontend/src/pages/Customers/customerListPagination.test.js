import test from "node:test";
import assert from "node:assert/strict";

import { CUSTOMER_LIST_PAGE_SIZE } from "./customerListPagination.js";

test("customer list displays ten rows per page", () => {
  assert.equal(CUSTOMER_LIST_PAGE_SIZE, 10);
});
