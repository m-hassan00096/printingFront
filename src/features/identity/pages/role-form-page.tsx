import { useEffect, useState } from "react";
import axios from "axios";
import { ArrowRight, Info, LoaderCircle, Save } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import type { ApiErrorResponse } from "@/shared/api/api-types";
import { ErrorState, IdentityStatus, LoadingState, SectionHeader, fieldClass, fieldLabel } from "../components/identity-ui";
import { useCreateRole, useRole, useUpdateRole } from "../hooks/use-identity";
import { parseIdentityId } from "../lib/identity-helpers";

export function RoleFormPage() {
  const { id: raw } = useParams();
  const isNew = !raw;
  const id = parseIdentityId(raw);
  const navigate = useNavigate();
  const role = useRole(isNew ? 0 : id);
  const create = useCreateRole();
  const update = useUpdateRole();
  const [nameAr, setNameAr] = useState("");
  const [status, setStatus] = useState<0 | 1>(1);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  useEffect(() => {
    if (role.data && !isNew) {
      setNameAr(role.data.nameAr ?? role.data.name);
      setStatus(role.data.status);
    }
  }, [role.data, isNew]);

  const protectedAdmin = role.data?.key === "admin";
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldError(null);
    const label = nameAr.trim();
    if (label.length < 2 || label.length > 150) {
      setFieldError("اسم الدور يجب أن يكون من 2 إلى 150 حرفًا.");
      return;
    }
    if (isNew && !acknowledged) {
      setError("يجب تأكيد إنشاء الدور دون أي صلاحيات قبل المتابعة.");
      return;
    }
    try {
      if (isNew) {
        // Backend requires a present permissionIds array; empty means *zero*
        // privileges. Never invent IDs while no permission catalog endpoint exists.
        await create.mutateAsync({ nameAr: label, status, permissionIds: [] });
        toast.success("تم إنشاء الدور بدون صلاحيات. لا تمنحه لمستخدم قبل ضبط الصلاحيات.");
      } else {
        await update.mutateAsync({ id, payload: protectedAdmin ? { nameAr: label } : { nameAr: label, status } });
        toast.success("تم تحديث بيانات الدور.");
      }
      navigate("/roles", { replace: true });
    } catch (failure: unknown) {
      if (axios.isAxiosError<ApiErrorResponse>(failure) && failure.response?.status === 422) {
        const msg = failure.response.data?.errors?.nameAr?.[0];
        if (msg) { setFieldError(msg); return; }
      }
      setError(getApiErrorMessage(failure, "تعذّر حفظ الدور."));
    }
  }
  const busy = create.isPending || update.isPending;
  if (!isNew && !id) return <ErrorState error={null} retry={() => undefined} />;
  if (!isNew && role.isPending) return <LoadingState />;
  if (!isNew && role.isError) return <ErrorState error={role.error} retry={() => void role.refetch()} />;
  return <div className="mx-auto max-w-3xl space-y-6">
    <Button asChild variant="ghost"><Link to="/roles"><ArrowRight className="size-4" /> العودة للأدوار</Link></Button>
    <SectionHeader title={isNew ? "إضافة دور" : "تعديل الدور"} detail="إعداد الاسم والحالة، مع إبقاء الصلاحيات تحت تحكم الباك." />
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</p>}
      <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
        <label className="block space-y-2"><span className={fieldLabel}>اسم الدور بالعربي <span className="text-destructive">*</span></span>
          <input className={fieldClass} value={nameAr} maxLength={150} onChange={(e) => setNameAr(e.target.value)} disabled={busy} aria-invalid={!!fieldError} />
          {fieldError && <span role="alert" className="text-xs text-destructive">{fieldError}</span>}
        </label>
        {role.data && <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
          <div><p className="mb-2 text-xs text-muted-foreground">المعرّف التقني</p><p dir="ltr" className="text-right text-sm font-semibold">{role.data.key}</p></div>
          <div><p className="mb-2 text-xs text-muted-foreground">المستخدمون المرتبطون</p><p className="text-sm font-semibold">{role.data.usersCount}</p></div>
        </div>}
        <label className="block space-y-2"><span className={fieldLabel}>الحالة</span>
          <select className={fieldClass} value={status} disabled={busy || protectedAdmin} onChange={(e) => setStatus(Number(e.target.value) as 0 | 1)}>
            <option value={1}>نشط</option><option value={0}>غير نشط</option>
          </select>
          {protectedAdmin && <span className="block text-xs text-muted-foreground">لا يمكن تعطيل دور مدير النظام.</span>}
        </label>
      </section>
      <section className="space-y-3 rounded-2xl border bg-muted/40 p-5">
        <div className="flex items-center gap-2"><Info className="size-5 text-primary" /><h3 className="font-extrabold">الصلاحيات</h3></div>
        <p className="text-sm leading-7 text-muted-foreground">
          قائمة الصلاحيات وأرقامها غير متوفرة حاليًا في API الباك. لذلك لن نعرض خيارات وهمية، ولن نعدّل صلاحيات دور موجود.
        </p>
        {role.data && <p className="text-sm">عدد الصلاحيات الحالية: <strong>{role.data.permissionIds?.length ?? 0}</strong> — محفوظة بدون تغيير عند تعديل الاسم أو الحالة.</p>}
        {isNew && <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-card p-4 text-sm leading-7">
          <input type="checkbox" className="mt-2 size-4 accent-primary" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
          <span>أفهم أن الدور الجديد سيتم إنشاؤه <strong>بدون أي صلاحيات</strong> إلى أن تتوفر شاشة توزيع الصلاحيات.</span>
        </label>}
      </section>
      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild><Link to="/roles">إلغاء</Link></Button>
        <Button type="submit" disabled={busy || (isNew && !acknowledged)}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}حفظ الدور</Button>
      </div>
      {role.data && <div className="flex justify-end"><IdentityStatus status={role.data.status} label={role.data.statusLabel} /></div>}
    </form>
  </div>;
}
