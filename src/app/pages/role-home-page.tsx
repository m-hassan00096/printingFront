import { Navigate } from "react-router-dom";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { DashboardPage } from "@/features/dashboard/pages/dashboard-page";

/**
 * Operators without order-list access should open their permitted workplace,
 * not an empty Dashboard. Protected by RequireAuth, so permissions are loaded.
 */
export function RoleHomePage() {
  const { data: user } = useCurrentUser();
  const permissions = user?.permissions ?? [];
  if (!permissions.includes("orders.list") &&
      permissions.includes("production.items.list")) {
    return <Navigate to="/production" replace />;
  }
  return <DashboardPage />;
}
