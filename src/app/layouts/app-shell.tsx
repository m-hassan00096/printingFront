import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { MobileBottomNavigation } from "@/app/layouts/mobile-bottom-navigation";
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
  // A change of page always dismisses the mobile drawer.
  useEffect(() => { closeMobileSidebar(); }, [location.pathname, closeMobileSidebar]);
  useEffect(() => {
    if (!isMobileSidebarOpen) return;
    const media = window.matchMedia?.("(min-width: 1024px)");
    if (media?.matches) { closeMobileSidebar(); return; }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeMobileSidebar(); }
    };
    const onResize = () => { if (media?.matches) closeMobileSidebar(); };
    document.addEventListener("keydown", onKey);
    media?.addEventListener?.("change", onResize);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      media?.removeEventListener?.("change", onResize);
    };
  }, [isMobileSidebarOpen, closeMobileSidebar]);
  return (
    <div className="tabaa-app min-h-[100dvh] min-w-0 bg-background">
      <Sidebar />
      {isMobileSidebarOpen && (
        <button type="button" aria-label="إغلاق القائمة الجانبية"
          className="fixed inset-0 z-30 bg-[#1b2340]/40 lg:hidden"
          onClick={closeMobileSidebar} />
      )}
      <div className={cn("min-h-[100dvh] min-w-0 transition-[margin] duration-150",
        isSidebarCollapsed ? "lg:mr-[66px]" : "lg:mr-[238px]")}>
        <Topbar title={getPageTitle(location.pathname)} hidePageContext={location.pathname === "/finance"} />
        <main className="tabaa-app-main mx-auto min-h-[calc(100dvh-60px)] min-w-0 w-full max-w-[1660px] px-3 py-4 sm:px-6 sm:py-6 lg:min-h-[calc(100dvh-72px)] xl:px-8 xl:py-7">
          <Outlet />
        </main>
      </div>
      <MobileBottomNavigation />
    </div>
  );
}
