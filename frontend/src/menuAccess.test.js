import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMenuAccess,
  canPerform,
  hasFullMenuAccess,
  selectInitialMenu,
} from "./menuAccess.js";

test("only Admin and Super Admin roles receive full menu access", () => {
  assert.equal(hasFullMenuAccess({ role: "Admin" }), true);
  assert.equal(hasFullMenuAccess({ role: "Super Admin" }), true);
  assert.equal(hasFullMenuAccess({ role: "Sales" }), false);
});

test("a staff profile follows its role even when its Django user is a superuser", () => {
  assert.equal(
    hasFullMenuAccess({ role: "Staff", staff_id: 3, is_superuser: true }),
    false,
  );
  assert.equal(
    hasFullMenuAccess({ role: "Super Admin", staff_id: 1, is_superuser: true }),
    true,
  );
  assert.equal(hasFullMenuAccess({ is_superuser: true, staff_id: null }), true);
});

test("regular staff menu access follows the permission response", () => {
  const access = buildMenuAccess([
    {
      Id: 4,
      Menu_Name: "Customer List",
      Can_View: true,
      Can_Add: false,
      Can_Edit: true,
      Can_Delete: false,
    },
  ]);

  assert.equal(canPerform(access, "Customer List", "view"), true);
  assert.equal(canPerform(access, "Customer List", "add"), false);
  assert.equal(canPerform(access, "Customer List", "edit"), true);
  assert.equal(canPerform(access, "Customer List", "delete"), false);
  assert.equal(canPerform(access, "Staff List", "view"), false);
});

test("the initial page is changed when the current page is not permitted", () => {
  const menus = [
    { Id: 2, Menu_Name: "Customers", parent_id: null },
    { Id: 3, Menu_Name: "Customer List", parent_id: 2 },
  ];

  assert.equal(selectInitialMenu(menus, "Overview"), "Customer List");
  assert.equal(selectInitialMenu(menus, "Customer List"), "Customer List");
  assert.equal(selectInitialMenu([], "Overview"), "");
});

test("the permitted Overview dashboard is the initial page after login", () => {
  const menus = [
    { Id: 2, Menu_Name: "Master", parent_id: null },
    { Id: 5, Menu_Name: "Product Type Master", parent_id: 2 },
    { Id: 1, Menu_Name: "Overview", parent_id: null },
  ];

  assert.equal(selectInitialMenu(menus, ""), "Overview");
});
