# Auth Feature — Sanctum SPA contract

Target backend: `m-hassan00096/printingApi`, branch `develop`, Identity module.

## Routes

- `GET /sanctum/csrf-cookie`: initialize CSRF protection (Laravel root).
- `POST /api/v1/auth/login`: `{ username, password }`.
- `GET /api/v1/auth/me`: currently signed-in user, or 401.
- `POST /api/v1/auth/logout`: terminate current web session.

## Logged-in user shape

```json
{
  "name": "اسم المستخدم",
  "username": "username",
  "status": 1,
  "statusLabel": "نشط",
  "role": "admin",
  "roleAlias": "مدير النظام",
  "permissions": ["orders.list", "deliveries.ready.view"]
}
```

The real API wraps this in `{ "success": true, "message": "", "data": ... }`.
The displayed values are illustrative, not fixtures imported by the application.

## Browser configuration

Set `VITE_API_BASE_URL` to the backend `/api/v1` prefix and `VITE_BACKEND_URL` to Laravel's root. React uses Axios with `withCredentials: true` and `withXSRFToken: true`.

The backend must have `SANCTUM_STATEFUL_DOMAINS` (including frontend host and port), CORS `supports_credentials`, the frontend origin in `allowed_origins`, a working session driver, and correct cookie domain for the environment. Locally use `localhost` consistently for both frontend and Laravel; avoid mixing `localhost` and `127.0.0.1`.

The browser cannot read HttpOnly session cookie. It *can* send it automatically. Session presence is derived from `GET /auth/me`, not from local storage.

## Query ownership and navigation

- `useCurrentUser` caches the current user in TanStack Query; a 401 becomes a guest (`null`).
- Network/server errors remain errors and render a retry state rather than incorrectly showing a login screen.
- Login obtains the CSRF cookie, posts credentials, updates current-user cache, then navigates to the intended page or root.
- Logout invalidates Laravel session, clears the whole query cache (protecting user-scoped data), and returns to login.
- A positive payment mutation must not be retried automatically. This rule applies when finance feature is implemented, not to Auth.
- The sidebar hides unavailable destinations based on backend permissions; `RequirePermission` also blocks frontend route entry. This is UX only: the backend remains authoritative.

## UI/UX

- Arabic RTL, Cairo font, form intentionally limited to `username` and `password`.
- Accessible show/hide password and keyboard-focus styles.
- Field errors render inline; login errors render above the form.
- No self-service password recovery (password reset is admin-managed in backend).
- Avoid mock account details and never store credentials on the browser.

## Manual acceptance checklist

1. Open `/orders` while logged out: redirected to `/login`.
2. Log in with valid username/password: return to `/orders` if permitted.
3. Refresh a protected route: session recovered via `GET /auth/me`.
4. Invalid credentials show a clear error; no navigation.
5. Disabled account shows backend error.
6. Menu items are filtered from the backend's actual `permissions` array.
7. Logout removes access to protected routes; the session is invalidated server-side.
8. Simulate backend network failure on `GET /auth/me`: show an explicit retry action.
9. Confirm no Bearer Token is written to Local Storage or Session Storage.

## Local Vite origin is intentional

`npm run dev` binds to `localhost:5173` with a strict port. This is deliberate: Laravel Sanctum must recognize the exact browser `Origin`, including port. If 5173 is already used, stop that process instead of silently falling back to 5174. Open `http://localhost:5173/login` (not a LAN IP such as `http://192.168.1.14:5174`). Keep the backend root as `http://localhost:8000`. `SANCTUM_STATEFUL_DOMAINS` should include `localhost:5173,localhost:8000` and CORS should allow `http://localhost:5173` with credential support. If LAN testing becomes necessary, choose and configure that exact origin and a compatible same-site cookie strategy first.

## Session expiry and access revocation

- The global API response interceptor reacts to `401` from protected business APIs by purging user-scoped TanStack Query data and marking the user as logged out. `/auth/me` itself interprets 401 as a guest and login credential validation remains distinct.
- On a normal login, the current-user query is updated and older in-flight `/auth/me` requests are cancelled so stale guest state cannot overwrite a successful session.
- `GET /auth/me` refetches on window focus and at an approximately 60-second interval while the page is active, because the backend does not yet advertise a permissions-version change header. Permissions on the backend take effect immediately regardless of this UI refresh.
- `403` when fetching the current session is not treated as a network error or a guest: the UI explains that the account/role might be inactive and offers logout.
- On logout, the entire Query cache is cleared; on denied logins no prior user state is accepted.
- If a session expires during a future feature mutation, the API interceptor prevents old user-specific data from remaining in the app cache. The backend remains the sole authorization authority.

## Automated tests

Run `npm test` for pure auth helpers (local redirect safety, permission matching, session-expiry response classification, and login validation). GitHub Actions currently uses `npm install` because the committed lockfile needs normalization with the CI npm version. Update/commit the lockfile, then switch to `npm ci`. It runs tests, typecheck, lint and build. React interaction tests / full browser Sanctum login remain on the manual integration checklist.

## Instant permission-revocation refresh

An HTTP 403 on a business API triggers a new `GET /auth/me` via React Query invalidation; it does **not** automatically log out a healthy session. A 403 on `/auth/me` renders the suspended-account screen. A 401 on `/auth/me` clears private data only when there was a cached authenticated user, not during an ordinary initial guest request.

Backend permissions are always the real enforcement. The single `src/app/access-policy.ts` policy feeds both visible sidebar links and route guards so they cannot drift.
