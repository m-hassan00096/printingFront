import type { ReactNode } from "react";
import { hasAnyPermission } from "../lib/auth-helpers";
import { ShieldAlert } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { useCurrentUser } from "../hooks/use-current-user";

type RequirePermissionProps = {
  anyOf: readonly string[];
  children: ReactNode;
};

export function RequirePermission({ anyOf, children }: RequirePermissionProps) {
  const { data: user } = useCurrentUser();
  const allowed = hasAnyPermission(user?.permissions, anyOf);

  if (allowed) return <>{children}</>;

  return (
    <section className="mx-auto flex max-w-xl flex-col items-center gap-4 rounded-2xl border bg-card px-6 py-12 text-center shadow-sm">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-secondary">
        <ShieldAlert className="size-7 text-primary" aria-hidden="true" />
      </div>
      <h2 className="text-xl font-extrabold">ليس لديك صلاحية الوصول</h2>
      <p className="text-sm leading-7 text-muted-foreground">
        هذه الصفحة غير متاحة للدور الحالي. تواصل مع المسؤول إذا كنت تحتاج إليها.
      </p>
      <Button asChild variant="outline"><Link to="/">العودة إلى الرئيسية</Link></Button>
    </section>
  );
}
