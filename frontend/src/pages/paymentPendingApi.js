import { refreshAccessToken } from "../authSession.js";

export async function authorizedPaymentFetch(url, options = {}, {
  apiUrl,
  storage = localStorage,
  fetcher = fetch,
} = {}) {
  const request = (accessToken) =>
    fetcher(url, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${accessToken}`,
      },
    });

  let response = await request(storage.getItem("crm_access_token"));
  if (response.status !== 401) return response;

  const renewedAccess = await refreshAccessToken({
    apiUrl,
    storage,
    fetcher,
  });
  return request(renewedAccess);
}
