/** Redirect only to a local application path, never an external URL. */
export function safeReturnPath(path: unknown): string {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") ||
      path.includes("\\") || /^\/login(?:[/?#]|$)/i.test(path)) {
    return "/";
  }
  return path;
}

/** Only listed backend permissions grant access. Empty requirements are denied. */
export function hasAnyPermission(
  permissions: readonly string[] | null | undefined,
  required: readonly string[],
): boolean {
  return required.length > 0 && required.some((permission) => permissions?.includes(permission));
}

/** A 401 from a protected API means the server no longer accepts our session.
 * Login and /auth/me have their own expected unauthenticated responses.
 */
export function shouldResetSession(status?: number, url?: string): boolean {
  return status === 401 && !/\/auth\/(?:login|me)(?:[/?#]|$)/.test(url ?? "");
}
