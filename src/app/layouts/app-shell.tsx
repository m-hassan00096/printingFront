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
    <div className="tabaa-app min-h-screen bg-background">
      <Sidebar />
      {isMobileSidebarOpen && (
        <button type="button" aria-label="إغلاق القائمة الجانبية"
          className="fixed inset-0 z-30 bg-[#1b2340]/35 backdrop-blur-[2px] lg:hidden"
          onClick={closeMobileSidebar} />
      )}
      <div className={cn("min-h-screen transition-[margin] duration-150",
        isSidebarCollapsed ? "lg:mr-[66px]" : "lg:mr-[238px]")}>
        <Topbar title={getPageTitle(location.pathname)} hidePageContext={location.pathname === "/finance"} />
        <main className="mx-auto min-h-[calc(100vh-96px)] w-full max-w-[1660px] px-4 py-5 sm:px-6 sm:py-6 xl:px-8 xl:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
