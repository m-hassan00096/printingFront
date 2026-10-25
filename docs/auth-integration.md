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
