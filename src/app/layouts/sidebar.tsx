import { useEffect, useRef } from "react";
import { LoaderCircle, LogOut, Printer, X } from "lucide-react";
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
  const closeButton = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  useEffect(() => { if (isMobileSidebarOpen) closeButton.current?.focus(); }, [isMobileSidebarOpen]);
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
    <aside id="tabaa-mobile-sidebar" ref={drawerRef} aria-label="القائمة الرئيسية"
      role={isMobileSidebarOpen ? "dialog" : undefined} aria-modal={isMobileSidebarOpen ? true : undefined}
      onKeyDown={event => {
        if (!isMobileSidebarOpen || event.key !== "Tab" || !drawerRef.current) return;
        const tabbable = Array.from(drawerRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href]:not([aria-disabled="true"]), [tabindex]:not([tabindex="-1"])',
        ));
        if (!tabbable.length) return;
        const first = tabbable[0];
        const last = tabbable[tabbable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }}
      className={cn(
        "tabaa-mobile-sidebar fixed inset-y-0 right-0 z-40 flex w-[min(86vw,320px)] flex-col border-l border-sidebar-border bg-sidebar text-sidebar-foreground shadow-[2px_0_14px_#1d254009] transition-[width,transform] duration-150 lg:w-[238px]",
        isSidebarCollapsed && "lg:w-[66px]",
        isMobileSidebarOpen ? "translate-x-0 shadow-2xl" : "translate-x-full lg:translate-x-0",
      )}>
      <div className="flex h-[72px] shrink-0 items-center gap-3 border-b border-sidebar-border bg-white px-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-[0_5px_12px_#6250c929]">
          <Printer className="size-5" strokeWidth={2} aria-hidden="true" />
        </div>
        <div className={cn("min-w-0 flex-1", isSidebarCollapsed && "lg:hidden")}>
          <p className="truncate text-base leading-7 font-bold tracking-tight">مطبعة المصرية</p>
        </div>
        <button ref={closeButton} type="button" onClick={closeMobileSidebar} aria-label="إغلاق القائمة الرئيسية"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted lg:hidden">
          <X className="size-5" aria-hidden="true"/>
        </button>
      </div>
      <nav className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 py-4">
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
      <div className="tabaa-sidebar-footer shrink-0 border-t border-sidebar-border bg-white p-3">
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
