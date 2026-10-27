import { LoaderCircle, LogOut, Menu, PanelRightClose, PanelRightOpen, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { CommandPalette } from "@/app/layouts/command-palette";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import { useUiStore } from "@/shared/stores/ui-store";

type TopbarProps = { title: string };

export function Topbar({ title }: TopbarProps) {
  const isSidebarCollapsed = useUiStore((state) => state.isSidebarCollapsed);
  const isMobileSidebarOpen = useUiStore((state) => state.isMobileSidebarOpen);
  const toggleSidebar = useUiStore((state) => state.toggleSidebar);
  const toggleMobileSidebar = useUiStore((state) => state.toggleMobileSidebar);
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();
  const navigate = useNavigate();
  const [commandOpen, setCommandOpen] = useState(false);
  useEffect(() => {
    const openCommand = () => setCommandOpen(true);
    document.addEventListener("tabaa:open-command", openCommand);
    return () => document.removeEventListener("tabaa:open-command", openCommand);
  }, []);

  async function handleLogout() {
    try {
      await logoutMutation.mutateAsync();
      navigate("/login", { replace: true });
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "تعذّر تسجيل الخروج. حاول مرة أخرى."));
    }
  }

  return (
    <>
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-3 border-b border-border/80 bg-background/95 px-4 backdrop-blur-sm sm:px-5 lg:px-6">
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
          <h1 className="truncate text-sm font-semibold sm:mt-0.5 sm:text-base">{title}</h1>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <button type="button" onClick={() => setCommandOpen(true)} aria-label="بحث سريع أو انتقال" className="flex h-8 items-center gap-2 rounded-md border border-border bg-card px-2.5 text-xs text-muted-foreground transition-colors hover:border-primary/60 hover:text-foreground sm:min-w-44">
          <Search className="size-4" aria-hidden="true" /><span className="hidden flex-1 text-start sm:inline">بحث أو انتقال...</span><kbd className="violet-shortcut hidden sm:inline">Ctrl K</kbd>
        </button>
        <div className="hidden min-w-0 text-left sm:block" dir="rtl">
          <p className="max-w-40 truncate text-xs font-semibold">{user?.name}</p>
          <p className="mt-0.5 max-w-40 truncate text-[11px] text-muted-foreground">{user?.roleAlias || user?.role || "مستخدم"}</p>
        </div>
        <span className="flex size-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-[#ADB3FF]" aria-hidden="true">
          {user?.name?.charAt(0) ?? "ط"}
        </span>
        <Button
          size="icon"
          variant="ghost"
          aria-label="تسجيل الخروج"
          title="تسجيل الخروج"
          disabled={logoutMutation.isPending}
          onClick={() => void handleLogout()}
        >
          {logoutMutation.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}
        </Button>
      </div>
    </header>
    <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </>
  );
}
