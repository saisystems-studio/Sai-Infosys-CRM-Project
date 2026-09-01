import test from "node:test";
import assert from "node:assert/strict";

import { refreshAccessToken } from "./authSession.js";

function createStorage(values = {}) {
  const data = new Map(Object.entries(values));
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: (key) => data.delete(key),
  };
}

test("refreshAccessToken stores and returns a renewed access token", async () => {
  const storage = createStorage({ crm_refresh_token: "valid-refresh" });
  const fetcher = async () => ({
    ok: true,
    json: async () => ({ access: "renewed-access" }),
  });

  const access = await refreshAccessToken({
    apiUrl: "http://api.test/api",
    storage,
    fetcher,
  });

  assert.equal(access, "renewed-access");
  assert.equal(storage.getItem("crm_access_token"), "renewed-access");
  assert.equal(storage.getItem("access_token"), "renewed-access");
});

test("refreshAccessToken rejects when the refresh token is invalid", async () => {
  const storage = createStorage({ crm_refresh_token: "expired-refresh" });
  const fetcher = async () => ({ ok: false, status: 401 });

  await assert.rejects(
    refreshAccessToken({
      apiUrl: "http://api.test/api",
      storage,
      fetcher,
    }),
    /refresh failed/i,
  );
});
