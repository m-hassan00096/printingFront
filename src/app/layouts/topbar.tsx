import { Menu, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { Button } from "@/shared/components/ui/button";
import { useUiStore } from "@/shared/stores/ui-store";

type TopbarProps = { title: string };

export function Topbar({ title }: TopbarProps) {
  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const isMobileSidebarOpen = useUiStore((state) => state.isMobileSidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const toggleMobileSidebar = useUiStore((state) => state.toggleMobileSidebar);
  const { data: user } = useCurrentUser();
  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between gap-3 border-b border-border/80 bg-white px-4 sm:px-6 lg:px-8 shadow-[0_2px_9px_#1d2b5805]">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          aria-label={isMobileSidebarOpen ? "إغلاق القائمة الجانبية" : "فتح القائمة الجانبية"}
          aria-expanded={isMobileSidebarOpen}
          onClick={toggleMobileSidebar}
        >
          <Menu className="size-5" />
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="hidden lg:inline-flex"
          aria-label={isSidebarCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
          title={isSidebarCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
          onClick={toggleSidebar}
        >
          {isSidebarCollapsed ? <PanelRightOpen className="size-5" /> : <PanelRightClose className="size-5" />}
        </Button>

        <div className="min-w-0">
          <p className="hidden text-[10px] font-medium text-muted-foreground sm:block">مساحة العمل</p>
          <h1 className="truncate text-xs font-semibold text-[#525f78] sm:mt-0.5 sm:text-sm">{title}</h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden min-w-0 text-left sm:block" dir="rtl">
          <p className="max-w-40 truncate text-xs font-bold">{user?.name}</p>
          <p className="mt-0.5 max-w-40 truncate text-[11px] text-muted-foreground">{user?.roleAlias || user?.role || "مستخدم"}</p>
        </div>
        <span className="flex size-8 items-center justify-center rounded-full border border-[#dfe3ff] bg-[#ebeeff] text-xs font-bold text-primary" aria-hidden="true">
          {user?.name?.charAt(0) ?? "ط"}
        </span>

      </div>
    </header>
  );
}
