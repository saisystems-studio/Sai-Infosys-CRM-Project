import test from "node:test";
import assert from "node:assert/strict";

import { startInactivityTimer } from "./sessionActivity.js";

const wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

test("logs out after the configured period without activity", async () => {
  const activityTarget = new EventTarget();
  let logoutCount = 0;
  const stop = startInactivityTimer({
    activityTarget,
    timeoutMs: 20,
    onInactive: () => {
      logoutCount += 1;
    },
  });

  await wait(35);
  stop();

  assert.equal(logoutCount, 1);
});

test("user activity restarts the inactivity countdown", async () => {
  const activityTarget = new EventTarget();
  let logoutCount = 0;
  const stop = startInactivityTimer({
    activityTarget,
    timeoutMs: 35,
    onInactive: () => {
      logoutCount += 1;
    },
  });

  await wait(20);
  activityTarget.dispatchEvent(new Event("mousemove"));
  await wait(20);
  assert.equal(logoutCount, 0);

  await wait(25);
  stop();

  assert.equal(logoutCount, 1);
});

test("form and pointer activity restarts the inactivity countdown", async () => {
  const activityTarget = new EventTarget();
  let logoutCount = 0;
  const stop = startInactivityTimer({
    activityTarget,
    timeoutMs: 35,
    onInactive: () => {
      logoutCount += 1;
    },
  });

  await wait(20);
  activityTarget.dispatchEvent(new Event("input"));
  await wait(20);
  assert.equal(logoutCount, 0);

  await wait(25);
  stop();

  assert.equal(logoutCount, 1);
});

test("stopping the timer prevents automatic logout", async () => {
  const activityTarget = new EventTarget();
  let logoutCount = 0;
  const stop = startInactivityTimer({
    activityTarget,
    timeoutMs: 20,
    onInactive: () => {
      logoutCount += 1;
    },
  });

  stop();
  await wait(35);

  assert.equal(logoutCount, 0);
});
