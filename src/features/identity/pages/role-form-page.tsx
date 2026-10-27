import { useEffect, useMemo, useState, type FormEvent } from "react";
import axios from "axios";
import { ArrowRight, Info, LoaderCircle, Save, Search } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import type { ApiErrorResponse } from "@/shared/api/api-types";
import { ErrorState, IdentityStatus, LoadingState, SectionHeader, fieldClass, fieldLabel } from "../components/identity-ui";
import { useCreateRole, usePermissionOptions, useRole, useUpdateRole } from "../hooks/use-identity";
import { parseIdentityId } from "../lib/identity-helpers";

export function RoleFormPage() {
  const { id: raw } = useParams();
  const isNew = !raw;
  const id = parseIdentityId(raw);
  const navigate = useNavigate();
  const role = useRole(isNew ? 0 : id);
  const permissions = usePermissionOptions();
  const create = useCreateRole();
  const update = useUpdateRole();
  const [nameAr, setNameAr] = useState("");
  const [status, setStatus] = useState<0 | 1>(1);
  const [selected, setSelected] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (role.data && !isNew) {
      setNameAr(role.data.nameAr ?? role.data.name);
      setStatus(role.data.status);
      setSelected(role.data.permissionIds ?? []);
    }
  }, [role.data, isNew]);

  const protectedAdmin = role.data?.key === "admin";
  const options = permissions.data ?? [];
  const visible = useMemo(() => options.filter((option) =>
    option.label.toLocaleLowerCase("ar").includes(search.trim().toLocaleLowerCase("ar"))
  ), [options, search]);
  const unknown = selected.filter((value) => !options.some((option) => option.value === value));
  const busy = create.isPending || update.isPending;
  const ready = isNew
    ? permissions.isSuccess
    : protectedAdmin || (permissions.isSuccess && Array.isArray(role.data?.permissionIds));
  const canSave = !busy && ready && unknown.length === 0;

  function toggle(value: number) {
    setSelected((previous) => previous.includes(value)
      ? previous.filter((id) => id !== value)
      : [...previous, value]);
  }
  function selectVisible(add: boolean) {
    const ids = new Set(visible.map((option) => option.value));
    setSelected((previous) => add
      ? [...new Set([...previous, ...ids])]
      : previous.filter((id) => !ids.has(id)));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setFieldError(null);
    const label = nameAr.trim();
    if (label.length < 2 || label.length > 150) {
      setFieldError("اسم الدور يجب أن يكون من 2 إلى 150 حرفًا.");
      return;
    }
    if (!canSave) {
      setError("لا يمكن حفظ صلاحيات الدور قبل اكتمال تحميلها من الخادم.");
      return;
    }
    try {
      if (isNew) {
        // IDs come exclusively from GET /selects?selects=permissions.
        // [] is a deliberate valid selection: no permissions.
        await create.mutateAsync({ nameAr: label, status, permissionIds: selected });
        toast.success("تم إنشاء الدور بنجاح.");
      } else {
        await update.mutateAsync({
          id,
          payload: protectedAdmin
            ? { nameAr: label }
            : { nameAr: label, status, permissionIds: selected },
        });
        toast.success("تم تحديث الدور وصلاحياته.");
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

  if (!isNew && !id) return <ErrorState error={null} retry={() => undefined} />;
  if (!isNew && role.isPending) return <LoadingState />;
  if (!isNew && role.isError) return <ErrorState error={role.error} retry={() => void role.refetch()} />;

  return <div className="mx-auto max-w-4xl space-y-6">
    <Button asChild variant="ghost"><Link to="/roles"><ArrowRight className="size-4" /> العودة للأدوار</Link></Button>
    <SectionHeader title={isNew ? "إضافة دور" : "تعديل الدور"} detail="اختر الصلاحيات المناسبة لكل دور لتحديد ما يمكن لمستخدميه الوصول إليه." />
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      {error && <p role="alert" className="rounded-lg border border-[#efbec6] bg-[#ffecf0] p-4 text-sm text-[#c73a4c]">{error}</p>}
      <section className="space-y-5 rounded-lg border bg-card p-6 ">
        <label className="block space-y-2"><span className={fieldLabel}>اسم الدور بالعربي <span className="text-destructive">*</span></span>
          <input className={fieldClass} value={nameAr} maxLength={150} onChange={(e) => setNameAr(e.target.value)} disabled={busy} aria-invalid={!!fieldError} />
          {fieldError && <span role="alert" className="text-xs text-destructive">{fieldError}</span>}
        </label>
        {role.data && <div className="border-t pt-4">
          <p className="mb-2 text-xs text-muted-foreground">المستخدمون المرتبطون</p>
          <p className="text-sm font-semibold">{role.data.usersCount}</p>
        </div>}
        <label className="block space-y-2"><span className={fieldLabel}>الحالة</span>
          <select className={fieldClass} value={status} disabled={busy || protectedAdmin} onChange={(e) => setStatus(Number(e.target.value) as 0 | 1)}>
            <option value={1}>نشط</option><option value={0}>غير نشط</option>
          </select>
          {protectedAdmin && <span className="block text-xs text-muted-foreground">دور مدير النظام محمي من التعطيل وتعديل صلاحياته، لكن يمكن تغيير اسمه الظاهر.</span>}
        </label>
      </section>
      <section className="space-y-4 rounded-lg border bg-card p-6 ">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-extrabold">الصلاحيات</h3>
            <p className="mt-1 text-xs leading-6 text-muted-foreground">
              اختر صلاحيات هذا الدور من قائمة النظام. المحدد: <strong>{selected.length.toLocaleString("ar-EG")}</strong> صلاحية.
            </p>
          </div>
          {!protectedAdmin && permissions.isSuccess && <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!visible.length || busy} onClick={() => selectVisible(true)}>تحديد الظاهر</Button>
            <Button type="button" variant="ghost" size="sm" disabled={!visible.length || busy} onClick={() => selectVisible(false)}>إلغاء الظاهر</Button>
          </div>}
        </div>
        {protectedAdmin && <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          <Info className="size-4" /> صلاحيات مدير النظام للعرض فقط ولا يمكن تغييرها من هنا.
        </p>}
        {permissions.isPending && <LoadingState />}
        {permissions.isError && <ErrorState error={permissions.error} retry={() => void permissions.refetch()} />}
        {permissions.isSuccess && <>
          <label className="relative block">
            <span className="sr-only">بحث في الصلاحيات</span>
            <Search className="pointer-events-none absolute right-3 top-3.5 size-4 text-muted-foreground" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className={fieldClass + " pr-10"} placeholder="ابحث عن صلاحية..." />
          </label>
          {unknown.length > 0 && !protectedAdmin && <p role="alert" className="rounded-lg border border-amber-200 bg-[#fff4df] p-3 text-xs text-[#a46b0b]">
            يوجد {unknown.length} صلاحيات مرتبطة بالدور لم تعد موجودة في القائمة. راجع بيانات الباك قبل الحفظ.
          </p>}
          <div className="grid max-h-[420px] grid-cols-1 gap-2 overflow-y-auto rounded-lg border bg-muted/20 p-3 sm:grid-cols-2">
            {visible.map((permission) => <label key={permission.value}
              className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card px-3 py-3 text-sm leading-6 hover:border-primary/40">
              <input
                type="checkbox"
                className="mt-1.5 size-4 shrink-0 accent-primary"
                checked={selected.includes(permission.value)}
                disabled={busy || protectedAdmin}
                onChange={() => toggle(permission.value)}
              />
              <span>{permission.label}</span>
            </label>)}
            {visible.length === 0 && <p className="col-span-full py-8 text-center text-sm text-muted-foreground">مفيش صلاحيات مطابقة للبحث.</p>}
          </div>
          {!protectedAdmin && <p className="text-xs text-muted-foreground">تقدر تحفظ دور من غير صلاحيات، أو تحدد المطلوب فقط. اختيارك هو اللي هيتحفظ في الباك.</p>}
        </>}
      </section>
      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild><Link to="/roles">إلغاء</Link></Button>
        <Button type="submit" disabled={!canSave}>{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}حفظ الدور</Button>
      </div>
      {role.data && <div className="flex justify-end"><IdentityStatus status={role.data.status} label={role.data.statusLabel} /></div>}
    </form>
  </div>;
}
