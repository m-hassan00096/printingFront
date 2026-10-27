import { useEffect, useMemo, useState, type FormEvent, type MouseEvent } from "react";
import axios from "axios";
import { ArrowRight, ChevronDown, ChevronLeft, Info, LoaderCircle, Save, Search, ShieldCheck, UsersRound } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { uiMessages } from "@/shared/translations/ar/ui";
import { getApiErrorMessage } from "@/shared/api/http";
import type { ApiErrorResponse } from "@/shared/api/api-types";
import type { PermissionOption } from "../api/identity.api";
import { ErrorState, LoadingState, SectionHeader, fieldClass, fieldLabel } from "../components/identity-ui";
import { useCreateRole, usePermissionOptions, useRole, useUpdateRole } from "../hooks/use-identity";
import { parseIdentityId } from "../lib/identity-helpers";

type GroupKey = keyof typeof uiMessages.roles.groupLabels;
const groupOrder: GroupKey[] = [
  "orders", "production", "deliveries", "customers", "finance", "services", "identity", "other",
];

/** The Selects API only supplies {value,label}; grouping is presentational, not a permission rule. */
function categorize(label: string): GroupKey {
  if (/تسليم/.test(label)) return "deliveries";
  if (/تحصيل|مالي|محفظ|رصيد|بنكي|البنك|حساب|دفع|إيصال/.test(label)) return "finance";
  if (/مستخدم|أدوار|دور|صلاحي/.test(label)) return "identity";
  if (/عميل|العملاء/.test(label)) return "customers";
  if (/أوردر|طلب|مسودة/.test(label)) return "orders";
  if (/إنتاج|تصميم|طباعة|الطباعة|مرحلة/.test(label) && !/خدمة طباعة|خدمات الطباعة/.test(label)) return "production";
  if (/خدمة|منتج|إعداد|مطبعة|مكان|قيمة إعداد|نوع/.test(label)) return "services";
  return "other";
}

function groupPermissions(options: PermissionOption[]) {
  return groupOrder.map(key => ({
    key, title: uiMessages.roles.groupLabels[key],
    options: options.filter(option => categorize(option.label) === key),
  })).filter(group => group.options.length > 0);
}

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
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<GroupKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const copy = uiMessages.roles;

  useEffect(() => {
    if (role.data && !isNew) {
      setNameAr(role.data.nameAr ?? role.data.name);
      setStatus(role.data.status);
      setSelected(role.data.permissionIds ?? []);
    }
  }, [role.data, isNew]);

  const protectedAdmin = role.data?.key === "admin";
  const options = permissions.data ?? [];
  const filtered = useMemo(() => options.filter(option =>
    option.label.toLocaleLowerCase("ar").includes(search.trim().toLocaleLowerCase("ar")) &&
    (!selectedOnly || selected.includes(option.value))
  ), [options, search, selectedOnly, selected]);
  const groups = useMemo(() => groupPermissions(filtered), [filtered]);
  const unknown = selected.filter(value => !options.some(option => option.value === value));
  const busy = create.isPending || update.isPending;
  const ready = isNew
    ? permissions.isSuccess
    : protectedAdmin || (permissions.isSuccess && Array.isArray(role.data?.permissionIds));
  const canSave = !busy && ready && unknown.length === 0;

  const dirty = isNew
    ? nameAr.trim() !== "" || status !== 1 || selected.length > 0
    : Boolean(role.data && (
      nameAr !== (role.data.nameAr ?? role.data.name) ||
      status !== role.data.status ||
      JSON.stringify([...selected].sort((a, b) => a - b)) !==
      JSON.stringify([...(role.data.permissionIds ?? [])].sort((a, b) => a - b))
    ));

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function guardCancel(event: MouseEvent<HTMLAnchorElement>) {
    if (dirty && !window.confirm(copy.unsaved)) event.preventDefault();
  }
  function toggle(value: number) {
    setSelected(previous => previous.includes(value)
      ? previous.filter(item => item !== value)
      : [...previous, value]);
  }
  function selectGroup(values: number[], add: boolean) {
    const ids = new Set(values);
    setSelected(previous => add
      ? [...new Set([...previous, ...ids])]
      : previous.filter(value => !ids.has(value)));
  }
  function toggleGroup(key: GroupKey) {
    setCollapsed(previous => previous.includes(key)
      ? previous.filter(item => item !== key)
      : [...previous, key]);
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
        await create.mutateAsync({ nameAr: label, status, permissionIds: selected });
        toast.success("تم إنشاء الدور بنجاح.");
      } else {
        await update.mutateAsync({
          id,
          payload: protectedAdmin ? { nameAr: label } : { nameAr: label, status, permissionIds: selected },
        });
        toast.success("تم تحديث الدور وصلاحياته.");
      }
      navigate("/roles", { replace: true });
    } catch (failure: unknown) {
      if (axios.isAxiosError<ApiErrorResponse>(failure) && failure.response?.status === 422) {
        const message = failure.response.data?.errors?.nameAr?.[0];
        if (message) { setFieldError(message); return; }
      }
      setError(getApiErrorMessage(failure, "تعذّر حفظ الدور."));
    }
  }

  if (!isNew && !id) return <ErrorState error={null} retry={() => undefined} />;
  if (!isNew && role.isPending) return <LoadingState />;
  if (!isNew && role.isError) return <ErrorState error={role.error} retry={() => void role.refetch()} />;

  return <div className="mx-auto max-w-5xl space-y-6">
    <Button asChild variant="ghost"><Link to="/roles" onClick={guardCancel}><ArrowRight className="size-4" /> العودة للأدوار</Link></Button>
    <SectionHeader title={isNew ? "إضافة دور" : "تعديل الدور"}
      detail="اختر الصلاحيات المناسبة لكل دور لتحديد ما يمكن لمستخدميه الوصول إليه." />
    <form onSubmit={(event) => void submit(event)} className="space-y-5">
      {error && <p role="alert" className="rounded-lg border border-[#efbec6] bg-[#ffecf0] p-4 text-sm text-[#c73a4c]">{error}</p>}
      <section className="rounded-xl border bg-card p-5 shadow-[0_4px_18px_#29376b08] sm:p-6">
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_220px]">
          <label className="block space-y-2">
            <span className={fieldLabel}>اسم الدور بالعربي <span className="text-destructive">*</span></span>
            <input className={fieldClass} value={nameAr} maxLength={150}
              onChange={event => { setNameAr(event.target.value); setFieldError(null); }}
              disabled={busy} aria-invalid={!!fieldError} />
            {fieldError && <span role="alert" className="text-xs text-destructive">{fieldError}</span>}
          </label>
          <label className="block space-y-2">
            <span className={fieldLabel}>الحالة</span>
            <select className={fieldClass} value={status} disabled={busy || protectedAdmin}
              onChange={event => setStatus(Number(event.target.value) as 0 | 1)}>
              <option value={1}>نشط</option><option value={0}>غير نشط</option>
            </select>
          </label>
        </div>
        {role.data && <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-4">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UsersRound className="size-4" aria-hidden="true" />
          </div>
          <span className="text-xs text-muted-foreground">{copy.usersCount}</span>
          <strong className="text-sm tabular-nums">{role.data.usersCount.toLocaleString("ar-EG")}</strong>
        </div>}
        {protectedAdmin && <p className="mt-4 flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
          <Info className="size-4" /> صلاحيات مدير النظام للعرض فقط ولا يمكن تغييرها من هنا.
        </p>}
      </section>
      <section className="space-y-4 rounded-xl border bg-card p-5 shadow-[0_4px_18px_#29376b08] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-primary" />
              <h3 className="text-base font-bold">الصلاحيات</h3>
              <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary">
                {selected.length.toLocaleString("ar-EG")} / {options.length.toLocaleString("ar-EG")}
              </span>
            </div>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              اختر صلاحيات هذا الدور من مجموعات النظام. {copy.selectedCount}: {selected.length.toLocaleString("ar-EG")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setCollapsed([])}>{copy.expandAll}</Button>
            <Button type="button" size="sm" variant="outline"
              onClick={() => setCollapsed(groupOrder)}>{copy.collapseAll}</Button>
          </div>
        </div>
        {permissions.isPending && <LoadingState />}
        {permissions.isError && <ErrorState error={permissions.error} retry={() => void permissions.refetch()} />}
        {permissions.isSuccess && <>
          <div className="flex flex-wrap items-center gap-3">
            <label className="relative block min-w-[180px] flex-1">
              <span className="sr-only">بحث في الصلاحيات</span>
              <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={event => setSearch(event.target.value)}
                className={fieldClass + " pr-10"} placeholder="ابحث عن صلاحية..." />
            </label>
            <Button type="button" variant={selectedOnly ? "secondary" : "outline"} size="sm"
              aria-pressed={selectedOnly} onClick={() => setSelectedOnly(previous => !previous)}>
              {selectedOnly ? copy.showAll : copy.selectedOnly}
            </Button>
          </div>
          {unknown.length > 0 && !protectedAdmin && <p role="alert" className="rounded-lg border border-amber-200 bg-[#fff4df] p-3 text-xs text-[#a46b0b]">
            يوجد {unknown.length} صلاحيات مرتبطة بالدور لم تعد موجودة في القائمة. راجع بيانات الباك قبل الحفظ.
          </p>}
          <div className="space-y-2" aria-label="مجموعات الصلاحيات">
            {groups.map(group => {
              const count = group.options.filter(option => selected.includes(option.value)).length;
              const open = search.trim() !== "" || !collapsed.includes(group.key);
              return <div key={group.key} role="group" aria-label={group.title}
                className="overflow-hidden rounded-xl border border-border bg-[#fcfcff]">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/35 px-3 py-3 sm:px-4">
                  <button type="button" aria-expanded={open} aria-label={group.title}
                    onClick={() => toggleGroup(group.key)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-right text-sm font-bold text-foreground">
                    {open ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" /> :
                      <ChevronLeft className="size-4 shrink-0 text-muted-foreground" />}
                    <span>{group.title}</span>
                    <span className="rounded-md bg-white px-2 py-0.5 text-[11px] text-muted-foreground">
                      {count.toLocaleString("ar-EG")} / {group.options.length.toLocaleString("ar-EG")}
                    </span>
                  </button>
                  {!protectedAdmin && <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={busy}
                      aria-label={`${copy.groupSelect} ${group.title}`}
                      onClick={() => selectGroup(group.options.map(option => option.value), true)}>
                      {search ? copy.selectVisibleInGroup : copy.groupSelect}
                    </Button>
                    <Button type="button" variant="ghost" size="sm" disabled={busy || count === 0}
                      aria-label={`${copy.groupClear} ${group.title}`}
                      onClick={() => selectGroup(group.options.map(option => option.value), false)}>
                      {search ? copy.clearVisibleInGroup : copy.groupClear}
                    </Button>
                  </div>}
                </div>
                {open && <div className="grid grid-cols-1 gap-2 p-3 sm:grid-cols-2 sm:p-4">
                  {group.options.map(permission => <label key={permission.value}
                    className={"flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-3 text-sm leading-6 transition-colors " +
                      (selected.includes(permission.value) ? "border-primary/25 bg-primary/5" : "border-border bg-white hover:border-primary/35")}>
                    <input type="checkbox" className="size-4 shrink-0 accent-primary"
                      checked={selected.includes(permission.value)} disabled={busy || protectedAdmin}
                      onChange={() => toggle(permission.value)} />
                    <span>{permission.label}</span>
                  </label>)}
                </div>}
              </div>;
            })}
            {!groups.length && <p className="rounded-lg border border-dashed px-4 py-8 text-center text-xs text-muted-foreground">{copy.noResults}</p>}
          </div>
          {!protectedAdmin && <p className="text-xs text-muted-foreground">
            تقدر تحفظ دور من غير صلاحيات. التحديد ده هو اللي هيتحفظ في الباك، والمجموعات للعرض فقط.
          </p>}
        </>}
      </section>
      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white/95 px-4 py-3 shadow-[0_10px_32px_#27396b15] backdrop-blur-sm">
        <span className="text-xs text-muted-foreground">
          {selected.length.toLocaleString("ar-EG")} {copy.selectedCount}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild><Link to="/roles" onClick={guardCancel}>إلغاء</Link></Button>
          <Button type="submit" disabled={!canSave}>
            {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
            حفظ الدور
          </Button>
        </div>
      </div>
    </form>
  </div>;
}
