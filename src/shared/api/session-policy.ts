/** API responses that invalidate or require revalidating current auth metadata. */
export function shouldResetSession(status?: number, url?: string): boolean {
  // Both active-session loss and initial guest /auth/me are 401. The listener
  // will only clear business data if an authenticated user was cached.
  return status === 401 && !/\/auth\/login(?:[/?#]|$)/.test(url ?? "");
}

export function shouldRefreshPermissions(status?: number, url?: string): boolean {
  // A revoked action will be rejected immediately by Spatie on the backend.
  // Re-fetch /auth/me once instead of waiting for the periodic permission poll.
  return status === 403 && !/\/auth\/(?:login|me|logout)(?:[/?#]|$)/.test(url ?? "");
}
