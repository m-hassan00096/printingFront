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
          className="fixed inset-0 z-30 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
          onClick={closeMobileSidebar}
        />
      )}

      <div
        className={cn(
          "min-h-screen transition-[margin] duration-200",
          isSidebarCollapsed ? "lg:mr-20" : "lg:mr-64",
        )}
      >
        <Topbar title={getPageTitle(location.pathname)} />
        <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
        <footer className="mx-auto flex max-w-[1600px] items-center justify-between gap-3 px-4 pb-6 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <span>طَبعة · إدارة الطباعة بوضوح</span>
          <span>الواجهة قيد التأسيس</span>
        </footer>
      </div>
    </div>
  );
}
