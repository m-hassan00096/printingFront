import { Printer } from "lucide-react";
import { NavLink } from "react-router-dom";
import { canAccessNavigation, navigationGroups } from "@/app/navigation";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { cn } from "@/shared/lib/utils";
import { useUiStore } from "@/shared/stores/ui-store";

export function Sidebar() {
  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const isMobileSidebarOpen = useUiStore((state) => state.isMobileSidebarOpen);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);
  const { data: user } = useCurrentUser();
  const groups = navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => canAccessNavigation(item, user?.permissions ?? [])),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <aside
      aria-label="القائمة الرئيسية"
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex w-[220px] flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-150",
        isSidebarCollapsed && "lg:w-12",
        isMobileSidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-sidebar-border px-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/15 text-[#A5ACFF]">
          <Printer className="size-4.5" strokeWidth={2} aria-hidden="true" />
        </div>
        <div className={cn("min-w-0", isSidebarCollapsed && "lg:hidden")}>
          <p className="text-sm leading-tight font-bold tracking-tight">طَبعة</p>
          <p className="mt-0.5 text-[10px] text-sidebar-muted">إدارة الطباعة والإنتاج</p>
        </div>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
        {groups.map((group) => (
          <section key={group.label} className="space-y-1">
            <h2 className={cn("px-2 text-[10px] font-semibold tracking-wide text-sidebar-muted", isSidebarCollapsed && "lg:hidden")}>
              {group.label}
            </h2>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    title={isSidebarCollapsed ? item.label : undefined}
                    aria-label={item.label}
                    onClick={closeMobileSidebar}
                    className={({ isActive }) =>
                      cn(
                        "group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors duration-100",
                        isActive
                          ? "border-r-2 border-primary bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-muted hover:bg-[#252536] hover:text-sidebar-foreground",
                        isSidebarCollapsed && "lg:justify-center lg:px-0",
                      )
                    }
                  >
                    <Icon className="size-4 shrink-0" strokeWidth={1.9} aria-hidden="true" />
                    <span className={cn("truncate", isSidebarCollapsed && "lg:hidden")}>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="shrink-0 border-t border-sidebar-border p-3">
        <div className={cn("rounded-md border border-sidebar-border bg-muted/60 p-3", isSidebarCollapsed && "lg:flex lg:justify-center lg:p-2")}>
          <span className="mb-2 flex size-1.5 rounded-full bg-[#3DD68C]" aria-hidden="true" />
          <p className={cn("text-xs font-semibold text-sidebar-foreground", isSidebarCollapsed && "lg:hidden")}>مساحة العمل</p>
          <p className={cn("mt-1 text-[11px] leading-5 text-sidebar-muted", isSidebarCollapsed && "lg:hidden")}>
            تظهر الأقسام حسب صلاحيات حسابك.
          </p>
        </div>
      </div>
    </aside>
  );
}
