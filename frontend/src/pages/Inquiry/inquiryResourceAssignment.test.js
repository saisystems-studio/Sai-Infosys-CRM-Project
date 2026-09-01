import test from "node:test";
import assert from "node:assert/strict";

import {
  canAssignAnyResource,
  getNewInquiryResource,
} from "./inquiryResourceAssignment.js";

test("regular staff default to their own resource and cannot reassign it", () => {
  const user = { role: "Sales", staff_id: 17 };

  assert.equal(canAssignAnyResource(user), false);
  assert.equal(getNewInquiryResource(user), "17");
});

test("admin and super admin can choose any resource", () => {
  assert.equal(canAssignAnyResource({ role: "Admin", staff_id: 2 }), true);
  assert.equal(canAssignAnyResource({ role: "Super Admin", staff_id: 1 }), true);
  assert.equal(getNewInquiryResource({ role: "Admin", staff_id: 2 }), "");
});
