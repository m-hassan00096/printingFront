# Identity Feature — Users, Roles & Permissions

**Project:** طَبعة — printingFront  
**Frontend branch:** `feature/identity`  
**Backend reference:** `m-hassan00096/printingApi` → `develop` → `Modules/Identity`  
**Status:** Specification and UI/UX plan only — **implementation not started**  
**Dependency:** Auth merged into frontend `develop` via PR #1.

## 1. Goal and boundaries

إدارة مستخدمي النظام وأدوارهم وصلاحياتهم بشكل واضح وآمن ومناسب لمدير المطبعة، بدون ازدحام الشاشة أو تكرار الـ Auth.

- `features/auth`: Login / Logout / Me / session / guards فقط، كما هي.
- `features/identity`: Users CRUD, Roles CRUD, permission selection and displays, profiles and authorization states.
- `app`: compose routes and sidebar entries gated by actual API-returned permissions.
- `shared`: only reusable components/types with genuine cross-feature usage.

**No registration, public password reset or email login.** System admin manages user accounts. Single company, Arabic-first, RTL, Cairo. Do not change the existing Overview page.

## 2. Routes — planned frontend

| Route | Purpose | Required permission |
|---|---|---|
| `/users` | Users list, search, filters | `identity.users.view` |
| `/users/new` | Create user | `identity.users.create` |
| `/users/:id` | User detail and contextual actions | `identity.users.view` |
| `/users/:id/edit` | Edit user and role | `identity.users.update` |
| `/roles` | Roles list | `identity.roles.view` |
| `/roles/new` | Create role and permission matrix | `identity.roles.create` |
| `/roles/:id/edit` | Role editor and permission matrix | `identity.roles.update` |

A user with read-only permissions can browse without seeing edit/delete actions. Do not display disabled navigation items for unavailable modules; opening a route directly must still show a 403/permission page. Laravel authorization is authoritative.

**Navigation UX:** one group **المستخدمون والصلاحيات** with **المستخدمون** and **الأدوار والصلاحيات**; show each link only when its corresponding `*.view` permission exists. Avoid a separate top-level **الصلاحيات** page unless backend adds a real catalog endpoint.

## 3. Real Backend API Contracts (verified against develop)

All routes below use `auth:sanctum`, camelCase input/output, standard `{ success, message, data }` envelope. `apiClient` is already configured in Auth. The frontend must not guess an unavailable endpoint.

### Users

| Method | URL | Permission | Response |
|---|---|---|---|
| GET | `/api/v1/users` | `identity.users.view` | `data: { users: User[], pagination }` |
| GET | `/api/v1/users/{user}` | `identity.users.view` | `data: User` |
| POST | `/api/v1/users` | `identity.users.create` | 201, `data: User` |
| PUT/PATCH | `/api/v1/users/{user}` | `identity.users.update` | 200, `data: User` |
| DELETE | `/api/v1/users/{user}` | `identity.users.delete` | success, empty/null data |

`GET /users` query params:
- `filter[search]`: substring matching name, username, phone.
- `filter[status]`: `0` inactive, `1` active.
- `filter[role]`: technical role **name/key**, not translated Arabic alias.
- `sort`: allowed `id`, `name`, `username`, `created_at` (prepend `-` for descending). Default `-id`.
- `page >= 1`, `perPage` between 1 and 100; default 15.

User resource (both list/detail):

```json
{
  "id": 12,
  "name": "محمد أحمد",
  "username": "mohamed",
  "phone": "01000000000",
  "address": "الجيزة",
  "avatar": null,
  "status": 1,
  "statusLabel": "نشط",
  "role": { "id": 2, "name": "receptionist", "alias": "موظف استقبال" }
}
```

Examples are illustrative; actual backend role name/alias and status label come from the API. Never assume `role` is always non-null.

Create user request: `name` required string max255; `username` required unique max255; `phone` nullable unique max32; `address` nullable max1000; `avatar` optional image jpg/jpeg/png/webp max5MB; `status` optional 0/1 (defaults to 1); `roleId` required ID for an **active web role**; `password` and `passwordConfirmation` required 8..255 and equal.

Update: fields optional; `passwordConfirmation` required when `password` provided. When no avatar is uploaded, current avatar remains unchanged. **Avatar uses multipart/form-data**; confirm appropriate Laravel-compatible update method before enabling editing an avatar (typically POST plus `_method=PATCH` if required by the server). Do not send password values back in resources or persist in global state.

Changing a user's status and password currently happens via `PUT/PATCH /users/{user}`, not separate activate/deactivate/reset-password endpoints. Users are soft deleted.

### Roles

| Method | URL | Permission | Response |
|---|---|---|---|
| GET | `/api/v1/roles` | `identity.roles.view` | `data: { roles: Role[], pagination }` |
| GET | `/api/v1/roles/{role}` | `identity.roles.view` | `data: Role` |
| POST | `/api/v1/roles` | `identity.roles.create` | 201, `data: Role` |
| PUT/PATCH | `/api/v1/roles/{role}` | `identity.roles.update` | 200, `data: Role` |
| DELETE | `/api/v1/roles/{role}` | `identity.roles.delete` | success, empty/null data |

`GET /roles`: `filter[search]` (technical name or Arabic alias; max150); `filter[status]` (0/1); `sort` allowed `id`, `name`, `created_at`, `usersCount`; `page`, `perPage` (default 15, max100); default sort `-id`.

Role resource:

```json
{
  "id": 2,
  "name": "موظف استقبال",
  "nameAr": "موظف استقبال",
  "key": "receptionist",
  "status": 1,
  "statusLabel": "نشط",
  "usersCount": 3,
  "permissionIds": [1, 5, 9]
}
```

**Important:** `permissionIds` is conditional (loaded in role detail and create/update, not guaranteed in role list). Fetch role detail before editing permissions.

Create role: `nameAr` required 2..150 and unique for Arabic role translations; `status` required 0/1; `permissionIds` **required present array**, 0..500 entries, distinct integer IDs that exist for the `web` guard. An empty list is valid (not the same as omitting the field). Technical `key` is backend-generated.

Update role: `nameAr`, `status`, `permissionIds` optional; if supplying permissionIds it replaces the complete role permission set. Do not send missing permissions as `[]` accidentally on partial updates.

The technical `admin` role is protected: its Arabic alias may change but the API rejects deactivation/permission changes and deletion. An assigned role cannot be deleted (including assignments to soft-deleted users). Represent these restrictions in the UI, while still handling backend conflicts.

### Permissions catalog — **backend integration gap**

The permission `identity.permissions.view` is seeded, but as of the inspected `Modules/Identity/routes/api.php` there is **no `GET /api/v1/permissions` endpoint** returning permission IDs, keys, localized labels, and module groups.

A usable role editor **must not** hardcode permission IDs or make up this API.

**Next backend contract to agree/add before enabling role-permission edit:**

`GET /api/v1/permissions` (suggestion only; NOT implemented)
- Auth + `identity.permissions.view`
- Return actual permissions `id`, technical `name`, Arabic `alias` and frontend-safe grouping metadata (`module` or prefix-derived groups); predictable ordering.
- No permission-create/update/delete API required: permissions are code/seed managed.
- Super-admin has visibility but cannot bypass admin-role backend protection.

Until this backend endpoint exists, implement roles list/details and **do not ship a fake permission editor**. A real editor depends on real permission IDs.

## 4. UI/UX decisions

### User listing

Desktop-first, simple page header **المستخدمون** and single primary button **إضافة مستخدم** (only if permitted). Search input and two compact dropdown filters **الحالة** and **الدور**. Columns: image/name, username, phone, role, status, actions menu. Default newest first, pagination; avoid overlarge summary KPI cards. For mobile use compact list cards rather than an overflowing mini-table. Debounce search (~300ms) and preserve filters in URL query params.

Actions should be visible only if authorized. Use clear, distinct labels: **عرض التفاصيل**, **تعديل**, **تعطيل/تفعيل** (update status), **إعادة تعيين كلمة المرور** (update with password + confirmation), **حذف**. Confirmation dialogs for disable and delete; explain consequence, and show request errors.

### User create/edit

Full-page form because user account, role, credentials, and optional avatar can exceed a small dialog. Form groups:
1. **البيانات الأساسية:** name, username, phone, address, avatar.
2. **الوصول للنظام:** active role, active/inactive status.
3. **بيانات الدخول:** password + confirmation (required only for create; edit via a separate small reset-password dialog or section).

Maintain field-level errors, disable double submit, respect `multipart/form-data`, render server errors without discarding entered fields. No email field. Use current user's permissions to show actions but trust backend response.

### Roles listing and editor

Roles table: Arabic name, enabled status, `usersCount`, actions. Technical key only in details, not noisy list cells.

For role create/edit, dedicate a page with **اسم الدور**, **الحالة**, then grouped permissions with short Arabic labels and checkboxes, search, group toggles, clear selected count, and a single Save action. **Groups by module** (Orders, Production, Deliveries, Customers, Finance, Settings, Identity) with collapsible sections to reduce cognitive load. Do not invent permissions if the catalog isn't available. Treat empty `permissionIds` as deliberately none; warn before removing large groups. The `admin` role's permission matrix is read-only and status can't be disabled. Disable Delete when role has users.

### Shared UX requirements

Arabic RTL/Cairo, meaningful loading skeletons, empty search state, error retry state, accessible field labels, focus states, mobile usability, keyboard access, actionable toast confirmations, and no color-only status distinction. Keep Overview unchanged.

## 5. Implementation plan

1. **Frontend identity foundation:** `src/features/identity/{api,hooks,types,schemas,components,pages}` as needed. Export only stable public types/APIs. Do not duplicate Auth session state in Zustand.
2. **Routes and access:** app-level `/users*`, `/roles*`, only visible when permissions allow; add clear `RequirePermission` per action. Keep Auth's `/auth/me` query authoritative.
3. **Users read-side:** list, filters/search/pagination, details, status text and role labels.
4. **Users mutations:** create, edit, status change, password reset through update, soft delete with confirm; React Query invalidation. If the current user is changed, invalidate `authQueryKeys.currentUser`.
5. **Roles read-side:** list/details; independently render `usersCount`, status, protected admin role.
6. **Backend permissions catalog:** settle response shape, add endpoint in backend **via a separate approved change**, then build role permission editor.
7. **Roles mutations:** add/update/delete with safe full `permissionIds` replacements and confirmation, react to backend errors and refresh Auth current-user data as appropriate.
8. **Quality:** realistic UI screenshot review for Arabic, browser smoke tests against Laravel, unit/integration tests, `npm ci && npm test && npm run typecheck && npm run lint && npm run build`.

## 6. Tests / acceptance checklist

- Users list shows backend `data.users`, search matches name/username/phone, filters/sort/pagination survive navigation.
- GET/POST/PUT/PATCH/DELETE access is controlled by explicit Identity permissions; backend 403 is never mistaken for 401.
- User creation validates missing role/name/username/password, duplicate username/phone, inactive roles; avatar validation and errors are clear.
- Updating a user doesn't inadvertently wipe avatar/password/role; password confirmation only with new password.
- No user credentials stored in Zustand, localStorage or query-cache response payloads.
- Roles read endpoints use `data.roles`, and role details fetch `permissionIds`.
- Role editor never operates without a real permission catalog; newly selected IDs originate from backend.
- Admin role editing/deleting restrictions and assigned-role deletion rejection are displayed clearly.
- Revoked Identity permission updates navigation on backend 403 and prevents rendering protected action.
- Logout/session expiry clears Identity cached data, login as a different user never reveals prior user records.
- Empty, loading, retry, disabled and destructive-action states are keyboard accessible and readable in Arabic.
- Full CI and real Laravel browser smoke tests succeed before PR into develop.

## 7. Open questions / backend gaps (do not silently improvise)

- Permissions catalog endpoint **does not yet exist**. Decide/backend implementation needed before role-editor delivery.
- No separate `activate`, `deactivate`, or `reset-password` endpoints exist in current Identity routes; use the real Update User API.
- Backend user deletion currently soft deletes; make the impact clear in UI and respect backend rules.
- The ability to upload a new avatar via method override on existing user update should be confirmed against the backend before enabling that workflow.
- Some global specs may propose different contract shapes. **Current Identity routes/requests/resources are authoritative until an agreed backend change.**
