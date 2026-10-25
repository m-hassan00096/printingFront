import axios from "axios";
import { apiClient, initializeCsrf } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";
import type { AuthUser, LoginCredentials } from "../types/auth.types";

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const response = await apiClient.get<ApiResponse<AuthUser>>("/auth/me");
    return response.data.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      return null;
    }
    throw error;
  }
}

export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  await initializeCsrf();
  const response = await apiClient.post<ApiResponse<AuthUser>>("/auth/login", credentials);
  return response.data.data;
}

export async function logout(): Promise<void> {
  await initializeCsrf();
  await apiClient.post<ApiResponse<null>>("/auth/logout");
}
