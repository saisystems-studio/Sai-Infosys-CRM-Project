import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMenuAccess,
  canPerform,
  hasFullMenuAccess,
  loadActiveMenu,
  saveActiveMenu,
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

test("a refreshed temporary detail page returns to its permitted parent menu", () => {
  const menus = [
    { Id: 1, Menu_Name: "Overview", parent_id: null },
    { Id: 8, Menu_Name: "Schedule", parent_id: null },
  ];

  assert.equal(selectInitialMenu(menus, "Schedule Detail"), "Schedule");
  assert.equal(selectInitialMenu(menus, "Schedule Detail", true), "Schedule Detail");
});

test("active menu is saved and restored for a browser refresh", () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };

  saveActiveMenu("Customer List", storage);

  assert.equal(loadActiveMenu(storage), "Customer List");
});

test("refresh keeps the current page even when Dashboard is available", () => {
  const menus = [{ Menu_Name: "Dashboard" }, { Menu_Name: "Customer List" }];
  assert.equal(selectInitialMenu(menus, "Customer List"), "Customer List");
  assert.equal(selectInitialMenu(menus, ""), "Dashboard");
  assert.equal(selectInitialMenu(menus, "Unavailable Page"), "Dashboard");
});
