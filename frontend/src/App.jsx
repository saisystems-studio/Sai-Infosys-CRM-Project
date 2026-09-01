import { useEffect, useState } from "react";
import axios from "axios";
import Dashboard from "./Pages/Dashboard";
import Login from "./Pages/Login";
import { startInactivityTimer } from "./sessionActivity";
import { configureAxiosAuth, refreshAccessToken } from "./authSession";

const apiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/api";
const inactivityTimeoutMs = 30 * 60 * 1000;

function clearSession() {
  [
    "crm_access_token",
    "crm_refresh_token",
    "crm_user",
    // Remove the legacy keys still used by a few existing screens.
    "access_token",
    "refresh_token",
  ].forEach((key) => localStorage.removeItem(key));
  delete axios.defaults.headers.common.Authorization;
}

function App() {
  const [status, setStatus] = useState("checking");

  const showLogin = () => {
    clearSession();
    window.history.replaceState({}, "", "/login");
    setStatus("anonymous");
  };

  useEffect(() => {
    const validateSession = async () => {
      const access = localStorage.getItem("crm_access_token");

      if (!access) {
        showLogin();
        return;
      }

      try {
        const response = await fetch(`${apiUrl}/auth/me/`, {
          headers: { Authorization: `Bearer ${access}` },
        });

        if (response.status === 401) {
          try {
            const renewedAccess = await refreshAccessToken({ apiUrl });
            return validateSessionWithAccess(renewedAccess);
          } catch {
            showLogin();
            return;
          }
        }

        if (!response.ok) return;

        const user = await response.json();
        axios.defaults.headers.common.Authorization = `Bearer ${access}`;
        localStorage.setItem("crm_user", JSON.stringify(user));
        window.history.replaceState({}, "", "/");
        setStatus("authenticated");
      } catch {
        // Do not allow protected pages to render when the session cannot be checked.
        showLogin();
      }
    };

    const validateSessionWithAccess = async (access) => {
      const response = await fetch(`${apiUrl}/auth/me/`, {
        headers: { Authorization: `Bearer ${access}` },
      });
      if (!response.ok) throw new Error("Session validation failed");
      const user = await response.json();
      axios.defaults.headers.common.Authorization = `Bearer ${access}`;
      localStorage.setItem("crm_user", JSON.stringify(user));
      window.history.replaceState({}, "", "/");
      setStatus("authenticated");
    };

    validateSession();

    const revalidateWhenVisible = () => {
      if (document.visibilityState === "visible") validateSession();
    };
    window.addEventListener("focus", validateSession);
    document.addEventListener("visibilitychange", revalidateWhenVisible);
    const removeAuthInterceptor = configureAxiosAuth({
      axiosClient: axios,
      apiUrl,
      onSessionExpired: showLogin,
    });

    return () => {
      window.removeEventListener("focus", validateSession);
      document.removeEventListener("visibilitychange", revalidateWhenVisible);
      removeAuthInterceptor();
    };
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return undefined;

    return startInactivityTimer({
      activityTarget: window,
      timeoutMs: inactivityTimeoutMs,
      onInactive: showLogin,
    });
  }, [status]);

  const handleLogin = ({ access, refresh, user }) => {
    localStorage.setItem("crm_access_token", access);
    localStorage.setItem("crm_refresh_token", refresh);
    localStorage.setItem("crm_user", JSON.stringify(user));

    // Keep old customer screens working until they are migrated to the CRM keys.
    localStorage.setItem("access_token", access);
    localStorage.setItem("refresh_token", refresh);
    axios.defaults.headers.common.Authorization = `Bearer ${access}`;

    window.history.replaceState({}, "", "/");
    setStatus("authenticated");
  };

  if (status === "checking") return null;

  return status === "authenticated" ? (
    <Dashboard />
  ) : (
    <Login onLogin={handleLogin} />
  );
}

export default App;
