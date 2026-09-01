import assert from "node:assert/strict";
import test from "node:test";

import { authorizedPaymentFetch } from "./paymentPendingApi.js";

function createStorage(values = {}) {
  const data = new Map(Object.entries(values));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test("payment requests use the current CRM access token", async () => {
  const calls = [];
  const response = await authorizedPaymentFetch("http://api.test/payment-pending/", {}, {
    apiUrl: "http://api.test",
    storage: createStorage({
      crm_access_token: "current-token",
      access_token: "stale-token",
    }),
    fetcher: async (url, options) => {
      calls.push({ url, options });
      return { status: 200 };
    },
  });

  assert.equal(response.status, 200);
  assert.equal(calls[0].options.headers.Authorization, "Bearer current-token");
});

test("payment requests retry once with a refreshed token after 401", async () => {
  const calls = [];
  const response = await authorizedPaymentFetch("http://api.test/payment-pending/1/paid/", { method: "POST" }, {
    apiUrl: "http://api.test",
    storage: createStorage({ crm_refresh_token: "refresh-token" }),
    fetcher: async (url, options = {}) => {
      calls.push({ url, options });
      if (url.endsWith("/auth/token/refresh/")) {
        return { ok: true, json: async () => ({ access: "renewed-token" }) };
      }
      return calls.filter((call) => call.url.endsWith("/paid/")).length === 1
        ? { status: 401 }
        : { status: 200 };
    },
  });

  assert.equal(response.status, 200);
  assert.equal(calls.at(-1).options.headers.Authorization, "Bearer renewed-token");
});
