import { Link, useParams } from "react-router-dom";
import { ArrowRight, Pencil, UserRound } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { useUser } from "../hooks/use-identity";
import { ErrorState, IdentityStatus, LoadingState, SectionHeader } from "../components/identity-ui";
import { parseIdentityId } from "../lib/identity-helpers";

export function UserDetailPage() {
  const { id: raw } = useParams();
  const id = parseIdentityId(raw);
  const user = useUser(id);
  const { data: session } = useCurrentUser();

  if (!id) return <ErrorState error={null} retry={() => undefined} />;
  if (user.isPending) return <LoadingState />;
  if (user.isError) return <ErrorState error={user.error} retry={() => void user.refetch()} />;
  const value = user.data;
  return <div className="space-y-6">
    <Button variant="ghost" asChild><Link to="/users"><ArrowRight className="size-4" /> العودة للمستخدمين</Link></Button>
    <SectionHeader title="تفاصيل المستخدم" detail="بيانات الحساب والدور الحالي." actions={
      session?.permissions.includes("identity.users.update") && <Button asChild><Link to={`/users/${id}/edit`}><Pencil className="size-4" /> تعديل المستخدم</Link></Button>
    } />
    <section className="max-w-3xl rounded-lg border bg-card p-5  sm:p-7">
      <div className="flex items-center gap-4 border-b pb-6">
        {value.avatar ? <img className="size-16 rounded-lg object-cover" src={value.avatar} alt="" /> :
          <span className="flex size-16 items-center justify-center rounded-lg bg-secondary"><UserRound className="size-8 text-primary" /></span>}
        <div className="space-y-1"><h3 className="text-xl font-extrabold">{value.name}</h3><span dir="ltr" className="block text-xs text-muted-foreground">{value.username}</span></div>
      </div>
      <dl className="grid gap-x-6 gap-y-6 pt-6 sm:grid-cols-2">
        {([["اسم المستخدم", value.username], ["رقم الهاتف", value.phone || "—"], ["العنوان", value.address || "—"], ["الدور", value.role?.alias || "بدون دور"]] as const).map(([label, content]) =>
          <div key={label}><dt className="mb-1.5 text-xs font-semibold text-muted-foreground">{label}</dt><dd className="break-words text-sm font-bold">{content}</dd></div>
        )}
        <div><dt className="mb-2 text-xs font-semibold text-muted-foreground">الحالة</dt><dd><IdentityStatus status={value.status} label={value.statusLabel} /></dd></div>
      </dl>
    </section>
  </div>;
}
