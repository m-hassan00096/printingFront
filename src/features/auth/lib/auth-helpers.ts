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
