const ACCESS_KEYS = ["crm_access_token", "access_token"];
const REFRESH_KEYS = ["crm_refresh_token", "refresh_token"];

function firstStoredValue(storage, keys) {
  for (const key of keys) {
    const value = storage.getItem(key);
    if (value) return value;
  }
  return null;
}

export async function refreshAccessToken({
  apiUrl,
  storage = localStorage,
  fetcher = fetch,
}) {
  const refresh = firstStoredValue(storage, REFRESH_KEYS);
  if (!refresh) throw new Error("No refresh token available");

  const response = await fetcher(`${apiUrl}/auth/token/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });

  if (!response.ok) throw new Error("Token refresh failed");

  const tokens = await response.json();
  ACCESS_KEYS.forEach((key) => storage.setItem(key, tokens.access));
  if (tokens.refresh) {
    REFRESH_KEYS.forEach((key) => storage.setItem(key, tokens.refresh));
  }
  return tokens.access;
}

export function configureAxiosAuth({ axiosClient, apiUrl, onSessionExpired }) {
  let refreshPromise = null;

  const interceptorId = axiosClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const request = error.config;
      if (error.response?.status !== 401 || !request || request._retry) {
        return Promise.reject(error);
      }

      request._retry = true;
      try {
        refreshPromise ||= refreshAccessToken({ apiUrl });
        const access = await refreshPromise;
        axiosClient.defaults.headers.common.Authorization = `Bearer ${access}`;
        request.headers = request.headers || {};
        request.headers.Authorization = `Bearer ${access}`;
        return axiosClient(request);
      } catch (refreshError) {
        onSessionExpired();
        return Promise.reject(refreshError);
      } finally {
        refreshPromise = null;
      }
    },
  );

  return () => axiosClient.interceptors.response.eject(interceptorId);
}
