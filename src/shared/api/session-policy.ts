/** A 401 from a protected API means the server no longer accepts our session.
 * Login and /auth/me have their own expected unauthenticated responses.
 */
export function shouldResetSession(status?: number, url?: string): boolean {
  return status === 401 && !/\/auth\/(?:login|me)(?:[/?#]|$)/.test(url ?? "");
}

