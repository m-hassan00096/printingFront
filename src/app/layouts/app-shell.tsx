import { Outlet, useLocation } from "react-router-dom";
import { getPageTitle } from "@/app/navigation";
import { Sidebar } from "@/app/layouts/sidebar";
import { Topbar } from "@/app/layouts/topbar";
import { cn } from "@/shared/lib/utils";
import { useUiStore } from "@/shared/stores/ui-store";

export function AppShell() {
  const location = useLocation();
  const isSidebarCollapsed = useUiStore(state => state.isSidebarCollapsed);
  const isMobileSidebarOpen = useUiStore(state => state.isMobileSidebarOpen);
  const closeMobileSidebar = useUiStore(state => state.closeMobileSidebar);
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      {isMobileSidebarOpen && (
        <button type="button" aria-label="إغلاق القائمة الجانبية"
          className="fixed inset-0 z-30 bg-[#1b2340]/35 backdrop-blur-[2px] lg:hidden"
          onClick={closeMobileSidebar} />
      )}
      <div className={cn("min-h-screen transition-[margin] duration-150",
        isSidebarCollapsed ? "lg:mr-[66px]" : "lg:mr-[238px]")}>
        <Topbar title={getPageTitle(location.pathname)} />
        <main className="mx-auto min-h-[calc(100vh-116px)] w-full max-w-[1660px] px-4 py-6 sm:px-6 sm:py-7 xl:px-8 xl:py-8">
          <Outlet />
        </main>
        <footer className="mx-auto flex max-w-[1660px] flex-wrap items-center justify-between gap-2 px-4 pb-5 text-[11px] text-muted-foreground/80 sm:px-6 xl:px-8">
          <span>طَبعة · إدارة الطباعة بوضوح</span>
          <span>لوحة تشغيل يومية</span>
        </footer>
      </div>
    </div>
  );
}
