import axios from "axios";
import { shouldRefreshPermissions, shouldResetSession } from "@/shared/api/session-policy";

const backendBaseURL = import.meta.env.VITE_BACKEND_URL || undefined;

const defaultHeaders = {
  Accept: "application/json",
  "X-Requested-With": "XMLHttpRequest",
};

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api/v1",
  withCredentials: true,
  withXSRFToken: true,
  headers: defaultHeaders,
});

const csrfClient = axios.create({
  baseURL: backendBaseURL,
  withCredentials: true,
  withXSRFToken: true,
  headers: defaultHeaders,
});

/**
 * Registered from the auth boundary. Keeping a callback avoids importing
 * React Query or an auth store into the shared API client.
 */
let sessionExpiredHandler: (() => void) | null = null;
let permissionsChangedHandler: (() => void) | null = null;

export function onSessionExpired(callback: () => void): () => void {
  sessionExpiredHandler = callback;
  return () => {
    if (sessionExpiredHandler === callback) sessionExpiredHandler = null;
  };
}

export function onPermissionDenied(callback: () => void): () => void {
  permissionsChangedHandler = callback;
  return () => {
    if (permissionsChangedHandler === callback) permissionsChangedHandler = null;
  };
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) &&
        shouldResetSession(error.response?.status, error.config?.url)) {
      sessionExpiredHandler?.();
    }
    if (axios.isAxiosError(error) &&
        shouldRefreshPermissions(error.response?.status, error.config?.url)) {
      permissionsChangedHandler?.();
    }
    return Promise.reject(error);
  },
);

export async function initializeCsrf(): Promise<void> {
  await csrfClient.get("/sanctum/csrf-cookie");
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "حدث خطأ غير متوقع. حاول مرة أخرى.",
): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message || fallback;
  }
  return fallback;
}
