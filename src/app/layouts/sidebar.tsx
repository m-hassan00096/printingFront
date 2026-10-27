import { Printer } from "lucide-react";
import { NavLink } from "react-router-dom";
import { canAccessNavigation, navigationGroups } from "@/app/navigation";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { cn } from "@/shared/lib/utils";
import { useUiStore } from "@/shared/stores/ui-store";

export function Sidebar() {
  const isSidebarCollapsed = useUiStore(state => state.isSidebarCollapsed);
  const isMobileSidebarOpen = useUiStore(state => state.isMobileSidebarOpen);
  const closeMobileSidebar = useUiStore(state => state.closeMobileSidebar);
  const { data: user } = useCurrentUser();
  const groups = navigationGroups.map(group => ({
    ...group, items: group.items.filter(item => canAccessNavigation(item, user?.permissions ?? [])),
  })).filter(group => group.items.length > 0);

  return (
    <aside aria-label="القائمة الرئيسية"
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex w-[238px] flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width,transform] duration-150",
        isSidebarCollapsed && "lg:w-[66px]",
        isMobileSidebarOpen ? "translate-x-0 shadow-2xl" : "translate-x-full lg:translate-x-0",
      )}>
      <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-sidebar-border bg-white/70 px-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-white shadow-[0_4px_10px_#535fd130]">
          <Printer className="size-5" strokeWidth={2} aria-hidden="true" />
        </div>
        <div className={cn("min-w-0", isSidebarCollapsed && "lg:hidden")}>
          <p className="text-base leading-6 font-extrabold tracking-tight">طَبعة</p>
          <p className="text-[10px] font-semibold tracking-wide text-sidebar-muted">إدارة الطباعة والإنتاج</p>
        </div>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {groups.map(group => (
          <section key={group.label} className="space-y-1.5">
            <h2 className={cn("px-3 text-[10px] font-bold text-sidebar-muted", isSidebarCollapsed && "lg:hidden")}>{group.label}</h2>
            <div className="space-y-1">
              {group.items.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.to} to={item.to} end={item.to === "/"}
                    title={isSidebarCollapsed ? item.label : undefined} aria-label={item.label}
                    onClick={closeMobileSidebar}
                    className={({isActive}) => cn(
                      "group flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors duration-150",
                      isActive ? "bg-white text-primary shadow-[0_2px_9px_#26366a0d]" : "text-[#75829a] hover:bg-white/80 hover:text-[#3b4773]",
                      isSidebarCollapsed && "lg:justify-center lg:px-0",
                    )}>
                    <Icon className="size-[17px] shrink-0" strokeWidth={1.9} aria-hidden="true" />
                    <span className={cn("truncate", isSidebarCollapsed && "lg:hidden")}>{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </section>
        ))}
      </nav>
      <div className="shrink-0 border-t border-sidebar-border bg-white/60 p-3">
        <div className={cn("flex items-center gap-2 rounded-lg px-2.5 py-2", isSidebarCollapsed && "lg:justify-center")}>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#e9edff] text-primary">
            <Printer className="size-3.5" aria-hidden="true"/>
          </span>
          <div className={cn("min-w-0", isSidebarCollapsed && "lg:hidden")}>
            <p className="text-xs font-semibold">مساحة العمل</p>
            <p className="truncate text-[10px] text-sidebar-muted">حسب صلاحيات حسابك</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
