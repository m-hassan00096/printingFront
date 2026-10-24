import axios from "axios";

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

export async function initializeCsrf(): Promise<void> {
  await csrfClient.get("/sanctum/csrf-cookie");
}

export function getApiErrorMessage(
  error: unknown,
  fallback = "حدث خطأ غير متوقع. حاول مرة أخرى.",
): string {
  if (axios.isAxiosError<{ message?: string }>(error)) {
    return error.response?.data?.message ?? fallback;
  }

  return fallback;
}
