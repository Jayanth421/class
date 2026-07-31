import axios from "axios";
import { getAccessToken, getRefreshToken, setAuthSession, clearAuthSession } from "./tokenStorage";

function isLocalHostName(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1";
}

function rewriteLocalApiBaseForLan(baseUrl) {
  const candidate = String(baseUrl || "").trim();
  if (!candidate || typeof window === "undefined") return candidate;

  try {
    const parsed = new URL(candidate);
    if (!isLocalHostName(parsed.hostname)) return candidate;

    const runtimeHost = String(window.location.hostname || "").trim();
    if (!runtimeHost || isLocalHostName(runtimeHost)) return candidate;

    const portPart = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.protocol}//${runtimeHost}${portPart}${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (_error) {
    return candidate;
  }
}

function getDefaultDevApiBaseURL() {
  if (typeof window === "undefined") return "http://localhost:5000/api";
  const runtimeHost = String(window.location.hostname || "").trim();
  if (!runtimeHost || isLocalHostName(runtimeHost)) return "http://localhost:5000/api";
  return `http://${runtimeHost}:5000/api`;
}

const envBaseURL = String(import.meta.env.VITE_API_BASE_URL || "").trim();
const normalizedEnvBaseURL = rewriteLocalApiBaseForLan(envBaseURL);
const isProductionBuild = Boolean(import.meta.env.PROD);
const isLocalEnvTarget =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/i.test(normalizedEnvBaseURL) ||
  /^https?:\/\/\[(::1)\](:\d+)?(\/|$)/i.test(normalizedEnvBaseURL);

// Prevent deployed builds from accidentally calling localhost.
const apiBaseURL =
  isProductionBuild && isLocalEnvTarget
    ? "/api"
    : normalizedEnvBaseURL || (isProductionBuild ? "/api" : getDefaultDevApiBaseURL());

const api = axios.create({
  baseURL: apiBaseURL,
  timeout: 15000
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const isUnauthorized = error?.response?.status === 401;
    if (!isUnauthorized || originalRequest._retry) {
      return Promise.reject(error);
    }

    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      clearAuthSession();
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    if (!refreshPromise) {
      refreshPromise = axios
        .post(`${api.defaults.baseURL}/auth/refresh`, { refreshToken })
        .then((res) => {
          const nextAccessToken = res.data.accessToken;
          setAuthSession({ accessToken: nextAccessToken });
          return nextAccessToken;
        })
        .catch((refreshError) => {
          clearAuthSession();
          throw refreshError;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    const newAccessToken = await refreshPromise;
    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
    return api(originalRequest);
  }
);

export default api;
