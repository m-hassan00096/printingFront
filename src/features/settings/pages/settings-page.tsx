import { useState, type FormEvent } from "react";
import axios from "axios";
import { Banknote, CreditCard, LoaderCircle, MapPin, Pencil, Plus, Search, Trash2, UsersRound, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import type { ApiErrorResponse } from "@/shared/api/api-types";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { resolveParameterId } from "../api/settings.api";
import { useParameterGroups, useSettingsList, useSettingsMutations } from "../hooks/use-settings";
import {
  isParameterKind, settingsSections,
  type SettingsFilters, type SettingsKind, type SettingsPayload, type SettingsRecord,
} from "../types/settings.types";

const control = "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/20";
const fieldLabel = "mb-2 block text-sm font-bold";
const icons = [MapPin, UsersRound, Banknote, CreditCard];
const names: Record<SettingsKind, string> = {
  "printing-locations": "مكان طباعة",
  "customer-types": "نوع عميل",
  "bank-accounts": "حساب بنكي",
  "e-wallets": "محفظة إلكترونية",
};

function displayName(row: SettingsRecord): string {
  return "bankName" in row ? row.bankName : row.name;
}
function secondaryName(row: SettingsRecord): string | null {
  if ("accountNumber" in row) return row.accountNumber;
  if ("accountHolder" in row) return row.phone + " · " + row.accountHolder;
  return row.description;
}
function isDefault(row: SettingsRecord): boolean {
  return "isDefault" in row && row.isDefault === 1;
}
function formFromRow(row: SettingsRecord): SettingsPayload {
  if ("accountNumber" in row) return {
    status: row.status, bankName: row.bankName, accountNumber: row.accountNumber, isDefault: row.isDefault,
  };
  if ("accountHolder" in row) return {
    status: row.status, name: row.name, phone: row.phone,
    accountHolder: row.accountHolder, paymentLink: row.paymentLink, isDefault: row.isDefault,
  };
  return { status: row.status, name: row.name, description: row.description };
}
function blankForm(kind: SettingsKind): SettingsPayload {
  if (kind === "bank-accounts") return { bankName: "", accountNumber: "", isDefault: 0, status: 1 };
  if (kind === "e-wallets") return { name: "", phone: "", accountHolder: "", paymentLink: "", isDefault: 0, status: 1 };
  return { name: "", description: "", status: 1 };
}
type SettingsField = keyof SettingsPayload;
type FieldErrors = Partial<Record<SettingsField, string>>;

function validate(kind: SettingsKind, form: SettingsPayload): FieldErrors {
  const errors: FieldErrors = {};
  function required(field: SettingsField, value: string | undefined, label: string, max = 150) {
    if (!value?.trim()) errors[field] = `حقل ${label} مطلوب.`;
    else if (value.trim().length > max) errors[field] = `حقل ${label} يجب ألا يتجاوز ${max} حرفًا.`;
  }
  if (kind === "bank-accounts") {
    required("bankName", form.bankName, "اسم البنك");
    required("accountNumber", form.accountNumber, "رقم الحساب", 50);
  } else if (kind === "e-wallets") {
    required("name", form.name, "اسم المحفظة");
    required("accountHolder", form.accountHolder, "اسم صاحب الحساب");
    if (!form.phone?.trim()) errors.phone = "رقم المحفظة مطلوب.";
    else if (!/^01[0125][0-9]{8}$/.test(form.phone.trim()))
      errors.phone = "رقم المحفظة يجب أن يكون رقم موبايل مصري صحيح.";
  } else {
    required("name", form.name, "الاسم");
  }
  return errors;
}
function FieldError({ field, errors }: { field: SettingsField; errors: FieldErrors }) {
  return errors[field] ? <span role="alert" className="mt-1 block text-xs text-destructive">{errors[field]}</span> : null;
}
function cleanedForm(kind: SettingsKind, form: SettingsPayload): SettingsPayload {
  if (kind === "bank-accounts") return {
    bankName: form.bankName?.trim(), accountNumber: form.accountNumber?.trim(),
    isDefault: form.isDefault, status: form.status,
  };
  if (kind === "e-wallets") return {
    name: form.name?.trim(), phone: form.phone?.trim(), accountHolder: form.accountHolder?.trim(),
    paymentLink: form.paymentLink?.trim() || null, isDefault: form.isDefault, status: form.status,
  };
  return { name: form.name?.trim(), description: form.description?.trim() || null, status: form.status };
}
function Status({ value }: { value: 0 | 1 }) {
  return <span className={value === 1
    ? "inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
    : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600"}>
    {value === 1 ? "نشط" : "غير نشط"}
  </span>;
}
function ModalFrame({ title, onClose, busy, children }: {
  title: string; onClose: () => void; busy: boolean; children: React.ReactNode;
}) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
    onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title}
      onKeyDown={(e) => { if (e.key === "Escape" && !busy) onClose(); }}
      className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-2xl">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xl font-extrabold">{title}</h3>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onClose} disabled={busy} aria-label="إغلاق"><X /></Button>
      </div>
      {children}
    </section>
  </div>;
}

export function SettingsPage() {
  const { data: user } = useCurrentUser();
  const permitted = user?.permissions ?? [];
  const available = settingsSections.filter((section) => permitted.includes(section.view));
  const [params, setParams] = useSearchParams();
  const selected = params.get("tab");
  const current = available.find((section) => section.key === selected) ?? available[0];
  const kind = current?.key ?? "printing-locations";
  const [form, setForm] = useState<SettingsPayload | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [savingError, setSavingError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [removing, setRemoving] = useState<SettingsRecord | null>(null);

  const filters: SettingsFilters = {
    search: params.get("search") ?? "",
    status: params.get("status") ?? "",
    page: Math.max(1, Number(params.get("page")) || 1),
  };
  const parameterKind = isParameterKind(kind);
  const groups = useParameterGroups(Boolean(current && parameterKind));
  const parameterId = resolveParameterId(groups.data ?? [], kind);
  const canFetch = Boolean(current && (!parameterKind || parameterId));
  const list = useSettingsList(kind, filters, parameterId, canFetch);
  const mutations = useSettingsMutations(kind);
  const busy = mutations.create.isPending || mutations.update.isPending;
  const canAdd = Boolean(current && permitted.includes(current.create));
  const canEdit = Boolean(current && permitted.includes(current.update));
  const canDelete = Boolean(current && permitted.includes(current.delete));

  function setFilter(key: "search" | "status" | "page", value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  }
  function switchTab(next: SettingsKind) {
    setParams({ tab: next });
    setForm(null);
    setRemoving(null);
  }
  function openForm(row?: SettingsRecord) {
    setEditing(row?.id ?? null);
    setForm(row ? formFromRow(row) : blankForm(kind));
    setSavingError(null);
    setFieldErrors({});
  }
  function change(changes: Partial<SettingsPayload>) {
    setForm((previous) => previous ? { ...previous, ...changes } : null);
    setFieldErrors((previous) => {
      const next = { ...previous };
      for (const field of Object.keys(changes) as SettingsField[]) delete next[field];
      return next;
    });
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const issues = validate(kind, form);
    setFieldErrors(issues);
    if (Object.keys(issues).length) { setSavingError(null); return; }
    setSavingError(null);
    const payload = cleanedForm(kind, form);
    try {
      if (editing !== null) await mutations.update.mutateAsync({ id: editing, payload });
      else await mutations.create.mutateAsync({ payload, parameterId });
      toast.success(editing !== null ? "تم حفظ التعديلات." : "تمت الإضافة بنجاح.");
      setForm(null);
    } catch (error: unknown) {
      const serverErrors = axios.isAxiosError<ApiErrorResponse>(error) && error.response?.status === 422
        ? error.response.data?.errors : null;
      if (serverErrors && Object.keys(serverErrors).length) {
        const next: FieldErrors = {};
        const other: string[] = [];
        for (const [key, messages] of Object.entries(serverErrors)) {
          if (["name", "description", "status", "bankName", "accountNumber",
            "phone", "accountHolder", "paymentLink", "isDefault"].includes(key)) {
            next[key as SettingsField] = messages[0];
          } else other.push(...messages);
        }
        setFieldErrors(next);
        setSavingError(other.length ? other.join(" ") : null);
      } else {
        setSavingError(getApiErrorMessage(error, "تعذّر حفظ الإعداد."));
      }
    }
  }
  async function confirmDelete() {
    if (!removing) return;
    try {
      await mutations.remove.mutateAsync(removing.id);
      toast.success("تم حذف العنصر.");
      setRemoving(null);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "تعذّر الحذف. قد يكون العنصر مستخدمًا في النظام."));
    }
  }

  if (!current) return <div role="alert" className="rounded-2xl border bg-card p-8 text-center text-sm">
    ليس لديك صلاحية عرض أي قسم من أقسام الإعدادات.
  </div>;

  return <div className="space-y-6">
    <header>
      <h2 className="text-2xl font-extrabold">الإعدادات</h2>
      <p className="mt-2 text-sm leading-7 text-muted-foreground">إدارة قوائم التشغيل ووسائل التحصيل. التغييرات تخضع لصلاحياتك وقواعد النظام.</p>
    </header>
    <div role="tablist" aria-label="أقسام الإعدادات" className="flex flex-wrap gap-2 border-b pb-4">
      {available.map((section) => {
        const Icon = icons[settingsSections.findIndex((item) => item.key === section.key)];
        return <button key={section.key} type="button" role="tab" aria-selected={kind === section.key}
          className={kind === section.key
            ? "flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground"
            : "flex items-center gap-2 rounded-xl border bg-card px-4 py-3 text-sm font-bold hover:bg-muted"}
          onClick={() => switchTab(section.key)}><Icon className="size-4" />{section.label}</button>;
      })}
    </div>
    <section role="tabpanel" className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b p-5">
        <div>
          <h3 className="text-lg font-extrabold">{current.label}</h3>
          <p className="mt-1 text-xs text-muted-foreground">إضافة وتعديل وتعطيل العناصر حسب الحاجة.</p>
        </div>
        {canAdd && <Button type="button" onClick={() => openForm()}><Plus /> إضافة {names[kind]}</Button>}
      </div>
      <div className="flex flex-wrap gap-3 border-b p-4">
        <label className="relative block min-w-52 flex-1">
          <span className="sr-only">بحث في {current.label}</span>
          <Search className="pointer-events-none absolute right-3 top-3.5 size-4 text-muted-foreground" />
          <input className={control + " pr-10"} placeholder="ابحث بالاسم أو البيانات..." value={filters.search}
            onChange={(e) => setFilter("search", e.target.value)} />
        </label>
        <label className="flex items-center gap-2 text-xs font-bold">الحالة
          <select aria-label="فلتر الحالة" className={control + " w-40"} value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}>
            <option value="">كل الحالات</option><option value="1">نشط</option><option value="0">غير نشط</option>
          </select>
        </label>
      </div>
      {parameterKind && (groups.isPending || groups.isError || !parameterId)
        ? <div className="p-8 text-center text-sm">
          {groups.isPending ? "جاري تحميل مجموعات الإعدادات..." :
            <><p role="alert" className="mb-4 text-destructive">تعذّر تحديد مجموعة الإعدادات من الخادم. تأكد من تحديث Backend.</p>
              <Button type="button" variant="outline" onClick={() => void groups.refetch()}>إعادة المحاولة</Button></>}
        </div>
        : list.isPending ? <div role="status" className="flex items-center justify-center gap-2 p-14 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> جاري التحميل...</div>
        : list.isError ? <div role="alert" className="p-8 text-center text-sm">
          <p className="mb-4 text-destructive">{getApiErrorMessage(list.error, "تعذّر تحميل القائمة.")}</p>
          <Button type="button" variant="outline" onClick={() => void list.refetch()}>إعادة المحاولة</Button>
        </div>
        : list.data?.items.length === 0 ? <p className="p-14 text-center text-sm text-muted-foreground">لا توجد نتائج في هذا القسم.</p>
        : <div className="divide-y">
          {list.data?.items.map((row) => <div key={row.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted/30">
            <div className="min-w-0 space-y-1">
              <p className="break-words text-sm font-bold">{displayName(row)}</p>
              {secondaryName(row) && <p className="break-all text-xs text-muted-foreground">{secondaryName(row)}</p>}
            </div>
            <div className="flex items-center gap-3">
              <Status value={row.status} />
              {isDefault(row) && <span className="rounded-full bg-secondary px-2 py-1 text-xs font-semibold">افتراضي</span>}
              {canEdit && <Button size="icon-sm" variant="ghost" aria-label={`تعديل ${displayName(row)}`} title="تعديل" onClick={() => openForm(row)}><Pencil /></Button>}
              {canDelete && <Button size="icon-sm" variant="ghost" aria-label={`حذف ${displayName(row)}`} title="حذف" onClick={() => setRemoving(row)}><Trash2 className="text-destructive" /></Button>}
            </div>
          </div>)}
        </div>}
      {list.data && list.data.pagination.total > 0 && <footer className="flex flex-wrap items-center justify-between gap-4 border-t p-4 text-xs text-muted-foreground">
        <span>إجمالي النتائج: {list.data.pagination.total.toLocaleString("ar-EG")}</span>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" disabled={filters.page <= 1}
            onClick={() => setFilter("page", String(filters.page - 1))}>السابق</Button>
          <span>{list.data.pagination.currentPage} / {Math.max(1, list.data.pagination.lastPage)}</span>
          <Button type="button" variant="outline" size="sm" disabled={filters.page >= list.data.pagination.lastPage}
            onClick={() => setFilter("page", String(filters.page + 1))}>التالي</Button>
        </div>
      </footer>}
    </section>
    {form && <ModalFrame title={editing !== null ? `تعديل ${names[kind]}` : `إضافة ${names[kind]}`} busy={busy} onClose={() => setForm(null)}>
      <form onSubmit={(event) => void save(event)} className="space-y-4" noValidate>
        {kind === "bank-accounts" ? <>
          <label className="block"><span className={fieldLabel}>اسم البنك *</span><input className={control} required maxLength={150} value={form.bankName ?? ""} onChange={(e) => change({ bankName: e.target.value })} disabled={busy} aria-invalid={!!fieldErrors.bankName} /><FieldError field="bankName" errors={fieldErrors} /></label>
          <label className="block"><span className={fieldLabel}>رقم الحساب *</span><input dir="ltr" className={control} required maxLength={50} value={form.accountNumber ?? ""} onChange={(e) => change({ accountNumber: e.target.value })} disabled={busy} aria-invalid={!!fieldErrors.accountNumber} /><FieldError field="accountNumber" errors={fieldErrors} /></label>
        </> : kind === "e-wallets" ? <>
          <label className="block"><span className={fieldLabel}>اسم المحفظة *</span><input className={control} required maxLength={150} value={form.name ?? ""} onChange={(e) => change({ name: e.target.value })} disabled={busy} aria-invalid={!!fieldErrors.name} /><FieldError field="name" errors={fieldErrors} /></label>
          <label className="block"><span className={fieldLabel}>رقم المحفظة *</span><input dir="ltr" className={control} required inputMode="tel" value={form.phone ?? ""} onChange={(e) => change({ phone: e.target.value })} disabled={busy} aria-invalid={!!fieldErrors.phone} /><FieldError field="phone" errors={fieldErrors} /></label>
          <label className="block"><span className={fieldLabel}>اسم صاحب الحساب *</span><input className={control} required maxLength={150} value={form.accountHolder ?? ""} onChange={(e) => change({ accountHolder: e.target.value })} disabled={busy} aria-invalid={!!fieldErrors.accountHolder} /><FieldError field="accountHolder" errors={fieldErrors} /></label>
          <label className="block"><span className={fieldLabel}>رابط الدفع (اختياري)</span><input dir="ltr" className={control} value={form.paymentLink ?? ""} onChange={(e) => change({ paymentLink: e.target.value })} disabled={busy} aria-invalid={!!fieldErrors.paymentLink} /><FieldError field="paymentLink" errors={fieldErrors} /></label>
        </> : <>
          <label className="block"><span className={fieldLabel}>الاسم *</span><input className={control} required maxLength={150} value={form.name ?? ""} onChange={(e) => change({ name: e.target.value })} disabled={busy} aria-invalid={!!fieldErrors.name} /><FieldError field="name" errors={fieldErrors} /></label>
          <label className="block"><span className={fieldLabel}>الوصف (اختياري)</span><textarea className={control + " min-h-24 py-3"} value={form.description ?? ""} onChange={(e) => change({ description: e.target.value })} disabled={busy} aria-invalid={!!fieldErrors.description} /><FieldError field="description" errors={fieldErrors} /></label>
        </>}
        <label className="block"><span className={fieldLabel}>الحالة</span><select className={control} value={form.status}
          onChange={(e) => change({ status: Number(e.target.value) as 0 | 1 })} disabled={busy}>
          <option value={1}>نشط</option><option value={0}>غير نشط</option>
        </select><FieldError field="status" errors={fieldErrors} /></label>
        {!parameterKind && <label className="flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold">
          <input type="checkbox" checked={form.isDefault === 1}
            onChange={(e) => change({ isDefault: e.target.checked ? 1 : 0 })} disabled={busy} />
          تعيين كوسيلة دفع افتراضية
          <FieldError field="isDefault" errors={fieldErrors} />
        </label>}
        {savingError && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{savingError}</p>}
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="outline" disabled={busy} onClick={() => setForm(null)}>إلغاء</Button>
          <Button type="submit" disabled={busy}>{busy && <LoaderCircle className="size-4 animate-spin" />}حفظ</Button>
        </div>
      </form>
    </ModalFrame>}
    {removing && <ModalFrame title="تأكيد الحذف" busy={mutations.remove.isPending} onClose={() => setRemoving(null)}>
      <p className="mb-5 text-sm leading-7">هل تريد حذف «{displayName(removing)}»؟ قد يمنع النظام الحذف إذا كان العنصر مرتبطًا بعمليات أخرى.</p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" disabled={mutations.remove.isPending} onClick={() => setRemoving(null)}>إلغاء</Button>
        <Button type="button" variant="destructive" disabled={mutations.remove.isPending} onClick={() => void confirmDelete()}>تأكيد الحذف</Button>
      </div>
    </ModalFrame>}
  </div>;
}
