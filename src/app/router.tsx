import { lazy, Suspense } from "react";
import { featureAccessPolicy, identityAccessPolicy, printingServiceAccessPolicy } from "@/app/access-policy";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "@/app/layouts/app-shell";
import { DashboardPage } from "@/features/dashboard/pages/dashboard-page";
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
const SettingsPage = lazy(async () => ({ default: (await import("@/features/settings/pages/settings-page")).SettingsPage }));
const CustomersPage = lazy(async () => ({ default: (await import("@/features/customers/pages/customers-page")).CustomersPage }));
const CustomerDetailPage = lazy(async () => ({ default: (await import("@/features/customers/pages/customer-detail-page")).CustomerDetailPage }));
const PrintingServicesPage = lazy(async () => ({ default: (await import("@/features/printing-services/pages/printing-services-page")).PrintingServicesPage }));
const PrintingServiceDetailPage = lazy(async () => ({ default: (await import("@/features/printing-services/pages/printing-service-detail-page")).PrintingServiceDetailPage }));
const PrintingServiceFormPage = lazy(async () => ({ default: (await import("@/features/printing-services/pages/printing-service-form-page")).PrintingServiceFormPage }));
const OrdersPage = lazy(async () => ({ default: (await import("@/features/orders/pages/orders-page")).OrdersPage }));
const OrderCreatePage = lazy(async () => ({ default: (await import("@/features/orders/pages/order-create-page")).OrderCreatePage }));
const OrderDetailPage = lazy(async () => ({ default: (await import("@/features/orders/pages/order-detail-page")).OrderDetailPage }));
const ProductionPage = lazy(async () => ({ default: (await import("@/features/production/pages/production-page")).ProductionPage }));
const DeliveriesPage = lazy(async () => ({ default: (await import("@/features/deliveries/pages/deliveries-page")).DeliveriesPage }));
const CollectionsPage = lazy(async () => ({ default: (await import("@/features/collections/pages/collections-page")).CollectionsPage }));
const FinancePage = lazy(async () => ({ default: (await import("@/features/finance/pages/finance-page")).FinancePage }));

function LazyIdentity({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<AuthLoading />}>{children}</Suspense>;
}


export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GuestOnly />}>
          <Route path="login" element={<Suspense fallback={<AuthLoading />}><LoginPage /></Suspense>} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />

            <Route path="production" element={<RequirePermission anyOf={featureAccessPolicy.production}><Suspense fallback={<AuthLoading />}><ProductionPage /></Suspense></RequirePermission>} />
            <Route path="deliveries" element={<RequirePermission anyOf={featureAccessPolicy.deliveries}><Suspense fallback={<AuthLoading />}><DeliveriesPage /></Suspense></RequirePermission>} />
            <Route path="collections" element={<RequirePermission anyOf={featureAccessPolicy.collections}><Suspense fallback={<AuthLoading />}><CollectionsPage /></Suspense></RequirePermission>} />
            <Route path="finance" element={<RequirePermission anyOf={featureAccessPolicy.finance}><Suspense fallback={<AuthLoading />}><FinancePage /></Suspense></RequirePermission>} />
            <Route path="orders" element={<RequirePermission anyOf={featureAccessPolicy.orders}><Suspense fallback={<AuthLoading />}><OrdersPage /></Suspense></RequirePermission>} />
            <Route path="orders/new" element={<RequirePermission anyOf={["orders.create"]}><Suspense fallback={<AuthLoading />}><OrderCreatePage /></Suspense></RequirePermission>} />
            <Route path="orders/:id" element={<RequirePermission anyOf={["orders.view"]}><Suspense fallback={<AuthLoading />}><OrderDetailPage /></Suspense></RequirePermission>} />
            <Route path="printing-services" element={<RequirePermission anyOf={printingServiceAccessPolicy.view}><Suspense fallback={<AuthLoading />}><PrintingServicesPage /></Suspense></RequirePermission>} />
            <Route path="printing-services/new" element={<RequirePermission anyOf={printingServiceAccessPolicy.create}><Suspense fallback={<AuthLoading />}><PrintingServiceFormPage /></Suspense></RequirePermission>} />
            <Route path="printing-services/:id" element={<RequirePermission anyOf={printingServiceAccessPolicy.view}><Suspense fallback={<AuthLoading />}><PrintingServiceDetailPage /></Suspense></RequirePermission>} />
            <Route path="printing-services/:id/edit" element={<RequirePermission anyOf={printingServiceAccessPolicy.update}><Suspense fallback={<AuthLoading />}><PrintingServiceFormPage /></Suspense></RequirePermission>} />
            <Route path="customers" element={<RequirePermission anyOf={featureAccessPolicy.customers}><Suspense fallback={<AuthLoading />}><CustomersPage /></Suspense></RequirePermission>} />
            <Route path="customers/:id" element={<RequirePermission anyOf={featureAccessPolicy.customers}><Suspense fallback={<AuthLoading />}><CustomerDetailPage /></Suspense></RequirePermission>} />
            <Route path="settings" element={<RequirePermission anyOf={featureAccessPolicy.settings}><Suspense fallback={<AuthLoading />}><SettingsPage /></Suspense></RequirePermission>} />
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
