import { Outlet, useLocation } from "react-router-dom";
import { getPageTitle } from "@/app/navigation";
import { Sidebar } from "@/app/layouts/sidebar";
import { Topbar } from "@/app/layouts/topbar";
import { cn } from "@/shared/lib/utils";
import { useUiStore } from "@/shared/stores/ui-store";

export function AppShell() {
  const location = useLocation();
  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const isMobileSidebarOpen = useUiStore((state) => state.isMobileSidebarOpen);
  const closeMobileSidebar = useUiStore((state) => state.closeMobileSidebar);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      {isMobileSidebarOpen && (
        <button
          type="button"
          aria-label="إغلاق القائمة الجانبية"
          className="fixed inset-0 z-30 bg-black/65 backdrop-blur-[2px] lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      <div
        className={cn(
          "min-h-screen transition-[margin] duration-150",
          isSidebarCollapsed ? "lg:mr-12" : "lg:mr-[220px]",
        )}
      >
        <Topbar title={getPageTitle(location.pathname)} />
        <main className="w-full p-4 sm:p-5 lg:p-6">
          <Outlet />
        </main>
        <footer className="flex items-center justify-between gap-3 px-4 pb-4 text-[11px] text-muted-foreground sm:px-5 lg:px-6">
          <span>طَبعة · إدارة الطباعة بوضوح</span>
          <span>لوحة تشغيل يومية</span>
        </footer>
      </div>
    </div>
  );
}
