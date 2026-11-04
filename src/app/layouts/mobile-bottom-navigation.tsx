import { Ellipsis } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { navigationGroups, canAccessNavigation, type NavigationItem } from "@/app/navigation";
import type { AuthUser } from "@/features/auth/types/auth.types";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { useUiStore } from "@/shared/stores/ui-store";
import { cn } from "@/shared/lib/utils";

/** Navigation is always permission-filtered, even when a role name suggests admin access. */
export function getMobileShortcuts(
  user: Pick<AuthUser, "role" | "permissions"> | null | undefined,
): NavigationItem[] {
  if (!user) return [];
  const allowed = navigationGroups.flatMap(group => group.items)
    .filter(item => canAccessNavigation(item, user.permissions));
  const role = (user.role ?? "").toLowerCase().replace(/[\s-]+/g, "_");
  const isAdmin = role === "admin" || role === "superadmin" || role === "super_admin";
  const primary = isAdmin
    ? ["/customers", "/finance", "/orders"]
    : ["/customers", "/orders", "/collections"];
  const choices = primary
    .map(to => allowed.find(item => item.to === to))
    .filter((item): item is NavigationItem => Boolean(item))
    .map(item => isAdmin && item.to === "/orders" ? {...item, label: "الأوردرات"} : item);
  // Designers and other restricted roles must still be able to reach their work.
  if (!choices.length) {
    return ["/production", "/deliveries", "/printing-services", "/"]
      .map(to => allowed.find(item => item.to === to))
      .filter((item): item is NavigationItem => Boolean(item))
      .slice(0, 3);
  }
  return choices;
}

/** Mobile only: desktop navigation remains the full, unchanged Sidebar. */
export function MobileBottomNavigation() {
  const { data: user } = useCurrentUser();
  const location = useLocation();
  const open = useUiStore(state => state.isMobileSidebarOpen);
  const openSidebar = useUiStore(state => state.toggleMobileSidebar);
  const closeSidebar = useUiStore(state => state.closeMobileSidebar);
  const shortcuts = getMobileShortcuts(user);
  return (
    <nav aria-label="التنقل السريع للموبايل"
      className="tabaa-mobile-nav fixed inset-x-0 bottom-0 z-30 border-t border-border bg-white/95 shadow-[0_-4px_20px_#25335712] backdrop-blur-lg lg:hidden">
      <div className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${shortcuts.length + 1}, minmax(0, 1fr))` }}>
        {shortcuts.map(item => {
          const Icon = item.icon;
          const active = location.pathname === item.to || location.pathname.startsWith(item.to + "/");
          return <NavLink key={item.to} to={item.to} onClick={closeSidebar}
            aria-label={`التنقل السريع: ${item.label}`}
            aria-current={active ? "page" : undefined}
            className={cn("flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-[11px] font-semibold focus-visible:outline-offset-[-3px]",
              active ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
            <span className={cn("flex h-8 min-w-12 items-center justify-center rounded-xl transition-colors",
              active && "bg-secondary")}>
              <Icon className="size-5" strokeWidth={active ? 2.4 : 1.9} aria-hidden="true" />
            </span>
            <span className="max-w-full truncate">{item.label}</span>
          </NavLink>;
        })}
        <button type="button" aria-label="المزيد" aria-controls="tabaa-mobile-sidebar"
          aria-expanded={open} onClick={openSidebar}
          className={cn("flex min-h-[64px] min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-2 text-[11px] font-semibold focus-visible:outline-offset-[-3px]",
            open ? "text-primary" : "text-muted-foreground hover:text-foreground")}>
          <span className={cn("flex h-8 min-w-12 items-center justify-center rounded-xl",
            open && "bg-secondary")}>
            <Ellipsis className="size-5" aria-hidden="true"/>
          </span>
          <span>المزيد</span>
        </button>
      </div>
    </nav>
  );
}
