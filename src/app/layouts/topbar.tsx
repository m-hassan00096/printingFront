import { Menu, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import { useUiStore } from "@/shared/stores/ui-store";

type TopbarProps = {
  title: string;
};

export function Topbar({ title }: TopbarProps) {
  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const isMobileSidebarOpen = useUiStore((state) => state.isMobileSidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const toggleMobileSidebar = useUiStore((state) => state.toggleMobileSidebar);

  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-border/80 bg-background/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
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
          <p className="hidden text-[11px] font-medium text-muted-foreground sm:block">مساحة العمل</p>
          <h1 className="truncate text-base font-bold sm:mt-0.5 sm:text-lg">{title}</h1>
        </div>
      </div>

      <Badge variant="outline" className="shrink-0 gap-2 bg-card px-3 py-1.5">
        <span className="size-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
        <span className="hidden sm:inline">تأسيس الواجهة</span>
        <span className="sm:hidden">تأسيس</span>
      </Badge>
    </header>
  );
}
