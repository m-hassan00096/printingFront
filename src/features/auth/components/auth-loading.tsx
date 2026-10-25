import { LoaderCircle, Printer } from "lucide-react";

export function AuthLoading() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background p-6">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
        <Printer className="size-7" aria-hidden="true" />
      </div>
      <div role="status" className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
        جاري التحقق من جلسة الدخول...
      </div>
    </main>
  );
}
