import test from "node:test";
import assert from "node:assert/strict";

import { createStaffMode, editStaffMode } from "./staffNavigation.js";
import { mergeMenuPermissions } from "./staffFormState.js";

test("create mode clears the previously selected staff member", () => {
  assert.deepEqual(createStaffMode(), {
    active: "Add Staff",
    selectedStaff: null,
  });
});

test("edit mode opens the staff form with the selected grid record", () => {
  const staff = { Id: 17, Full_Name: "Priya Kumar" };

  assert.deepEqual(editStaffMode(staff), {
    active: "Add Staff",
    selectedStaff: staff,
  });
});

test("loaded staff permissions replace defaults for matching menus", () => {
  const menus = [{ Id: 1 }, { Id: 2 }];
  const permissions = [
    {
      Menu: 2,
      Can_View: true,
      Can_Add: false,
      Can_Edit: true,
      Can_Delete: false,
    },
  ];

  assert.deepEqual(mergeMenuPermissions(menus, permissions), {
    1: { view: false, add: false, edit: false, delete: false },
    2: { view: true, add: false, edit: true, delete: false },
  });
});
