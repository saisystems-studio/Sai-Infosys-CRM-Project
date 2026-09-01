import test from "node:test";
import assert from "node:assert/strict";

import { paginateItems } from "./customerViewPagination.js";

test("paginateItems returns the requested fixed-size page", () => {
  const result = paginateItems(["a", "b", "c", "d", "e"], 2, 2);

  assert.deepEqual(result.items, ["c", "d"]);
  assert.equal(result.page, 2);
  assert.equal(result.pageCount, 3);
});

test("paginateItems keeps the page within the available range", () => {
  const result = paginateItems(["a", "b", "c"], 9, 2);

  assert.deepEqual(result.items, ["c"]);
  assert.equal(result.page, 2);
  assert.equal(result.pageCount, 2);
});

test("paginateItems handles an empty collection", () => {
  const result = paginateItems([], 1, 4);

  assert.deepEqual(result.items, []);
  assert.equal(result.page, 1);
  assert.equal(result.pageCount, 1);
});
