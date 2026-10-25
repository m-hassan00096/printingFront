import { lazy, Suspense } from "react";
import { featureAccessPolicy, identityAccessPolicy } from "@/app/access-policy";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/app/layouts/app-shell";
import { FeaturePlaceholderPage } from "@/app/pages/feature-placeholder-page";
import { FoundationPage } from "@/app/pages/foundation-page";
import { NotFoundPage } from "@/app/pages/not-found-page";
import { GuestOnly } from "@/features/auth/components/guest-only";
import { RequireAuth } from "@/features/auth/components/require-auth";
import { RequirePermission } from "@/features/auth/components/require-permission";
import { AuthLoading } from "@/features/auth/components/auth-loading";

const LoginPage = lazy(async () => {
  const module = await import("@/features/auth/pages/login-page");
  return { default: module.LoginPage };
});

const UsersPage = lazy(async () => ({ default: (await import("@/features/identity/pages/users-page")).UsersPage }));
const UserDetailPage = lazy(async () => ({ default: (await import("@/features/identity/pages/user-detail-page")).UserDetailPage }));
const UserFormPage = lazy(async () => ({ default: (await import("@/features/identity/pages/user-form-page")).UserFormPage }));
const RolesPage = lazy(async () => ({ default: (await import("@/features/identity/pages/roles-page")).RolesPage }));
const RoleFormPage = lazy(async () => ({ default: (await import("@/features/identity/pages/role-form-page")).RoleFormPage }));

function LazyIdentity({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<AuthLoading />}>{children}</Suspense>;
}

const featurePaths = [
  { path: "orders", key: "orders" as const, permissions: featureAccessPolicy.orders },
  { path: "production", key: "production" as const, permissions: featureAccessPolicy.production },
  { path: "deliveries", key: "deliveries" as const, permissions: featureAccessPolicy.deliveries },
  { path: "customers", key: "customers" as const, permissions: featureAccessPolicy.customers },
  { path: "collections", key: "collections" as const, permissions: featureAccessPolicy.collections },
  { path: "finance", key: "finance" as const, permissions: featureAccessPolicy.finance },
  {
    path: "settings", key: "settings" as const,
    permissions: featureAccessPolicy.settings,
  },
];

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GuestOnly />}>
          <Route path="login" element={<Suspense fallback={<AuthLoading />}><LoginPage /></Suspense>} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<FoundationPage />} />
            {featurePaths.map(({ path, key, permissions }) => (
              <Route
                key={path}
                path={path}
                element={
                  <RequirePermission anyOf={permissions}>
                    <FeaturePlaceholderPage featureKey={key} />
                  </RequirePermission>
                }
              />
            ))}

            <Route path="users" element={<RequirePermission anyOf={identityAccessPolicy.users}><LazyIdentity><UsersPage /></LazyIdentity></RequirePermission>} />
            <Route path="users/new" element={<RequirePermission anyOf={identityAccessPolicy.createUser}><LazyIdentity><UserFormPage /></LazyIdentity></RequirePermission>} />
            <Route path="users/:id" element={<RequirePermission anyOf={identityAccessPolicy.users}><LazyIdentity><UserDetailPage /></LazyIdentity></RequirePermission>} />
            <Route path="users/:id/edit" element={<RequirePermission anyOf={identityAccessPolicy.editUser}><LazyIdentity><UserFormPage /></LazyIdentity></RequirePermission>} />
            <Route path="roles" element={<RequirePermission anyOf={identityAccessPolicy.roles}><LazyIdentity><RolesPage /></LazyIdentity></RequirePermission>} />
            <Route path="roles/new" element={<RequirePermission anyOf={identityAccessPolicy.createRole}><LazyIdentity><RoleFormPage /></LazyIdentity></RequirePermission>} />
            <Route path="roles/:id/edit" element={<RequirePermission anyOf={identityAccessPolicy.editRole}><LazyIdentity><RoleFormPage /></LazyIdentity></RequirePermission>} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
