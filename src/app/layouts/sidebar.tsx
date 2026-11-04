import { LoaderCircle, LogOut, Printer } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { getApiErrorMessage } from "@/shared/api/http";
import { uiMessages } from "@/shared/translations/ar/ui";
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
  const logout = useLogout();
  const navigate = useNavigate();
  async function handleLogout() {
    try {
      await logout.mutateAsync();
      closeMobileSidebar();
      navigate("/login", { replace: true });
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, uiMessages.sidebar.logoutError));
    }
  }
  const groups = navigationGroups.map(group => ({
    ...group, items: group.items.filter(item => canAccessNavigation(item, user?.permissions ?? [])),
  })).filter(group => group.items.length > 0);

  return (
    <aside aria-label="القائمة الرئيسية"
      className={cn(
        "fixed inset-y-0 right-0 z-40 flex w-[238px] flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[2px_0_14px_#1d254009] transition-[width,transform] duration-150",
        isSidebarCollapsed && "lg:w-[66px]",
        isMobileSidebarOpen ? "translate-x-0 shadow-2xl" : "translate-x-full lg:translate-x-0",
      )}>
      <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-sidebar-border bg-white px-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-[0_5px_12px_#6250c929]">
          <Printer className="size-5" strokeWidth={2} aria-hidden="true" />
        </div>
        <div className={cn("min-w-0", isSidebarCollapsed && "lg:hidden")}>
          <p className="text-lg leading-7 font-bold tracking-tight">طَبعة</p>
        </div>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {groups.map(group => (
          <section key={group.label} className="space-y-1.5">
            <h2 className={cn("px-3 text-[11px] font-semibold text-sidebar-muted", isSidebarCollapsed && "lg:hidden")}>{group.label}</h2>
            <div className="space-y-1">
              {group.items.map(item => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.to} to={item.to} end={item.to === "/" || item.to === "/finance"}
                    title={isSidebarCollapsed ? item.label : undefined} aria-label={item.label}
                    onClick={closeMobileSidebar}
                    className={({isActive}) => cn(
                      "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors duration-150",
                      isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-[#69758a] hover:bg-[#f7f5ff] hover:text-[#41348e]",
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
      <div className="shrink-0 border-t border-sidebar-border bg-white p-3">
        <button type="button" aria-label={uiMessages.sidebar.logout} title={uiMessages.sidebar.logout}
          disabled={logout.isPending} onClick={() => void handleLogout()}
          className={cn(
            "flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-start text-[13px] font-semibold text-[#ae3f51] transition-colors hover:bg-[#fff0f2] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60",
            isSidebarCollapsed && "lg:justify-center lg:px-0",
          )}>
          {logout.isPending ? <LoaderCircle className="size-[18px] shrink-0 animate-spin" /> : <LogOut className="size-[18px] shrink-0" />}
          <span className={cn(isSidebarCollapsed && "lg:sr-only")}>{uiMessages.sidebar.logout}</span>
        </button>
      </div>
    </aside>
  );
}
