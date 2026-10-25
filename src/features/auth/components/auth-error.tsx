import axios from "axios";
import { AlertCircle, LoaderCircle, LogOut, RefreshCw, ShieldAlert } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import { useLogout } from "../hooks/use-logout";

type AuthErrorProps = {
  onRetry: () => void;
  isRetrying: boolean;
  error?: unknown;
};

export function AuthError({ onRetry, isRetrying, error }: AuthErrorProps) {
  const denied = axios.isAxiosError(error) && error.response?.status === 403;
  const logout = useLogout();
  const navigate = useNavigate();

  async function signOut() {
    try {
      await logout.mutateAsync();
      navigate("/login", { replace: true });
    } catch (failure: unknown) {
      toast.error(getApiErrorMessage(failure, "تعذّر تسجيل الخروج. حاول مرة أخرى."));
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section role="alert" className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
          {denied ? <ShieldAlert className="size-6" aria-hidden="true" /> :
            <AlertCircle className="size-6" aria-hidden="true" />}
        </div>
        <h1 className="text-lg font-extrabold">
          {denied ? "تعذّر الوصول إلى حسابك" : "تعذّر الاتصال بالخادم"}
        </h1>
        <p className="text-sm leading-7 text-muted-foreground">
          {denied
            ? "قد يكون حسابك أو دورك غير نشط. تواصل مع المسؤول، أو سجّل الخروج."
            : "لم نتمكن من التأكد من جلسة الدخول. تحقق من الاتصال ثم أعد المحاولة."}
        </p>
        {denied ? (
          <Button onClick={() => void signOut()} disabled={logout.isPending} className="w-full">
            {logout.isPending ? <LoaderCircle className="size-4 animate-spin" /> : <LogOut className="size-4" />}
            تسجيل الخروج
          </Button>
        ) : (
          <Button onClick={onRetry} disabled={isRetrying} className="w-full">
            <RefreshCw className={isRetrying ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
            إعادة المحاولة
          </Button>
        )}
      </section>
    </main>
  );
}
