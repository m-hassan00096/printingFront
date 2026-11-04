import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { Button } from "@/shared/components/ui/button";
import { useUiStore } from "@/shared/stores/ui-store";

type TopbarProps = { title: string; hidePageContext?: boolean };

export function Topbar({ title, hidePageContext = false }: TopbarProps) {
  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const { data: user } = useCurrentUser();
  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between gap-3 border-b border-border bg-white/95 px-4 shadow-[0_2px_9px_#1d2b5805] backdrop-blur sm:px-6 lg:h-[72px] lg:px-8">
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary lg:hidden" aria-hidden="true">م</span>
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

        {!hidePageContext && <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        </div>}
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden min-w-0 text-left sm:block" dir="rtl">
          <p className="max-w-40 truncate text-xs font-bold">{user?.name}</p>
          <p className="mt-0.5 max-w-40 truncate text-[11px] text-muted-foreground">{user?.roleAlias || user?.role || "مستخدم"}</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-full border border-[#ddd5ff] bg-[#f0edfc] text-sm font-semibold text-primary" aria-hidden="true">
          {user?.name?.charAt(0) ?? "ط"}
        </span>

      </div>
    </header>
  );
}
