import { LoaderCircle, LogOut, Menu, PanelRightClose, PanelRightOpen } from "lucide-react";
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

  async function handleLogout() {
    try {
      await logoutMutation.mutateAsync();
      navigate("/login", { replace: true });
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "تعذّر تسجيل الخروج. حاول مرة أخرى."));
    }
  }

  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between gap-3 border-b border-border/80 bg-background/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
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

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <div className="hidden min-w-0 text-left sm:block" dir="rtl">
          <p className="max-w-40 truncate text-xs font-extrabold">{user?.name}</p>
          <p className="mt-0.5 max-w-40 truncate text-[11px] text-muted-foreground">{user?.roleAlias || user?.role || "مستخدم"}</p>
        </div>
        <span className="flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-extrabold text-primary" aria-hidden="true">
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
  );
}
