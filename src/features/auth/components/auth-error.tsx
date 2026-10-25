import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

type AuthErrorProps = {
  onRetry: () => void;
  isRetrying: boolean;
};

export function AuthError({ onRetry, isRetrying }: AuthErrorProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section role="alert" className="w-full max-w-md space-y-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
          <AlertCircle className="size-6" aria-hidden="true" />
        </div>
        <h1 className="text-lg font-extrabold">تعذّر الاتصال بالخادم</h1>
        <p className="text-sm leading-7 text-muted-foreground">
          لم نتمكن من التأكد من جلسة الدخول. تحقق من الاتصال ثم أعد المحاولة.
        </p>
        <Button onClick={onRetry} disabled={isRetrying} className="w-full">
          <RefreshCw className={isRetrying ? "size-4 animate-spin" : "size-4"} aria-hidden="true" />
          إعادة المحاولة
        </Button>
      </section>
    </main>
  );
}
