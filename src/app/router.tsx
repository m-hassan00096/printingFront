import { lazy, Suspense } from "react";
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

const featurePaths = [
  { path: "orders", key: "orders" as const, permissions: ["orders.list"] },
  { path: "production", key: "production" as const, permissions: ["production.items.list"] },
  { path: "deliveries", key: "deliveries" as const, permissions: ["deliveries.ready.view", "deliveries.list"] },
  { path: "customers", key: "customers" as const, permissions: ["customers.view"] },
  { path: "collections", key: "collections" as const, permissions: ["finance.collections.view"] },
  { path: "finance", key: "finance" as const, permissions: ["finance.balances.view", "finance.ledger.view"] },
  {
    path: "settings", key: "settings" as const,
    permissions: ["settings.view_parameter_values", "settings.bank_accounts.view", "settings.e_wallets.view", "settings.selects.view"],
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
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
