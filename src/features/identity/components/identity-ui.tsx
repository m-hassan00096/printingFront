import { useEffect, useRef, type ReactNode } from "react";
import { AlertCircle, ChevronLeft, ChevronRight, LoaderCircle, Search, UsersRound } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import type { Pagination } from "../types/identity.types";

export const fieldClass = "h-11 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/20";
export const fieldLabel = "block text-sm font-bold text-foreground";
export function SectionHeader({ title, detail, actions }: { title: string; detail: string; actions?: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-4">
    <div><h2 className="text-2xl font-extrabold tracking-tight">{title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p></div>
    {actions}
  </div>;
}
export function LoadingState() {
  return <div role="status" className="flex min-h-52 items-center justify-center gap-2 text-sm text-muted-foreground">
    <LoaderCircle className="size-5 animate-spin" /> جاري تحميل البيانات...
  </div>;
}
export function ErrorState({ error, retry }: { error: unknown; retry: () => void }) {
  return <div role="alert" className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl border bg-card p-6 text-center">
    <AlertCircle className="size-7 text-destructive" />
    <p className="text-sm font-bold">{getApiErrorMessage(error, "تعذّر تحميل البيانات. حاول مرة أخرى.")}</p>
    <Button variant="outline" onClick={retry}>إعادة المحاولة</Button>
  </div>;
}
export function EmptyState({ title = "لا توجد نتائج", detail = "جرّب تغيير البحث أو الفلاتر." }: { title?: string; detail?: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-6 text-center">
    <UsersRound className="size-8 text-muted-foreground" />
    <p className="text-sm font-extrabold">{title}</p><p className="text-sm text-muted-foreground">{detail}</p>
  </div>;
}
export function PaginationBar({ pagination, onPage }: { pagination: Pagination; onPage: (page: number) => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
    <span>إجمالي النتائج: {pagination.total.toLocaleString("ar-EG")}</span>
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon-sm" disabled={pagination.currentPage <= 1} aria-label="الصفحة السابقة" onClick={() => onPage(pagination.currentPage - 1)}><ChevronRight className="size-4" /></Button>
      <span className="min-w-22 text-center tabular-nums">{pagination.currentPage} / {Math.max(1, pagination.lastPage)}</span>
      <Button variant="outline" size="icon-sm" disabled={pagination.currentPage >= pagination.lastPage} aria-label="الصفحة التالية" onClick={() => onPage(pagination.currentPage + 1)}><ChevronLeft className="size-4" /></Button>
    </div>
  </div>;
}
export function SearchField({ value, onChange, placeholder = "بحث..." }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <label className="relative block w-full max-w-sm">
    <span className="sr-only">{placeholder}</span>
    <Search className="pointer-events-none absolute inset-y-0 right-3 my-auto size-4 text-muted-foreground" />
    <input className={fieldClass + " pr-10"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
  </label>;
}
export function ConfirmDialog({
  title, description, confirmText, busy, onConfirm, onClose, destructive = false,
}: { title: string; description: string; confirmText: string; busy: boolean; onConfirm: () => void; onClose: () => void; destructive?: boolean }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="confirm-heading" aria-describedby="confirm-desc"
      onKeyDown={(e) => { if (e.key === "Escape" && !busy) onClose(); }}
      className="w-full max-w-md space-y-5 rounded-2xl bg-card p-6 shadow-2xl">
      <div><h3 id="confirm-heading" className="text-lg font-extrabold">{title}</h3><p id="confirm-desc" className="mt-2 text-sm leading-7 text-muted-foreground">{description}</p></div>
      <div className="flex flex-wrap justify-end gap-2">
        <Button ref={first} type="button" variant="outline" onClick={onClose} disabled={busy}>رجوع</Button>
        <Button type="button" variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={busy}>{busy && <LoaderCircle className="size-4 animate-spin" />}{confirmText}</Button>
      </div>
    </div>
  </div>;
}
export function IdentityStatus({ status, label }: { status: number; label: string }) {
  return <span className={"inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-xs font-bold " +
    (status === 1 ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600")}>
    <span className={"size-1.5 rounded-full " + (status === 1 ? "bg-emerald-600" : "bg-slate-500")} />{label}
  </span>;
}
