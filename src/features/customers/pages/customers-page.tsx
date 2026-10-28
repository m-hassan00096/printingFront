import { useEffect, useState } from "react";
import { Eye, Pencil, Plus, Trash2, UsersRound } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { uiMessages } from "@/shared/translations/ar/ui";
import { getApiErrorMessage } from "@/shared/api/http";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import {
  ConfirmDialog, EmptyState, ErrorState, IdentityStatus, LoadingState, PaginationBar, SearchField, SectionHeader, fieldClass,
} from "@/features/identity/components/identity-ui";
import { CustomerFormModal } from "../components/customer-form-modal";
import { useCustomerMutations, useCustomers, useCustomerTypes } from "../hooks/use-customers";
import type { Customer, CustomerFilters } from "../types/customers.types";

function positivePage(raw: string | null): number {
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 1;
}

export function CustomersPage() {
  const { data: session } = useCurrentUser();
  const permissions = session?.permissions ?? [];
  const canCreate = permissions.includes("customers.create");
  const canEdit = permissions.includes("customers.update");
  const canDelete = permissions.includes("customers.delete");

  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const [draftSearch, setDraftSearch] = useState(search);
  const filters: CustomerFilters = {
    search, status: params.get("status") ?? "",
    customerTypeId: params.get("customerTypeId") ?? "",
    sort: params.get("sort") ?? "-id", page: positivePage(params.get("page")),
  };
  const list = useCustomers(filters);
  const types = useCustomerTypes(true);
  const mutations = useCustomerMutations();
  const [editing, setEditing] = useState<Customer | "new" | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);

  useEffect(() => { setDraftSearch(search); }, [search]);
  useEffect(() => {
    if (draftSearch === search) return;
    const timer = window.setTimeout(() => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (draftSearch.trim()) next.set("search", draftSearch.trim());
        else next.delete("search");
        next.delete("page");
        return next;
      });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [draftSearch, search, setParams]);
  function filter(name: string, value: string) {
    setParams((old) => {
      const next = new URLSearchParams(old);
      if (value) next.set(name, value);
      else next.delete(name);
      if (name !== "page") next.delete("page");
      return next;
    });
  }
  async function remove() {
    if (!deleting) return;
    try {
      await mutations.remove.mutateAsync(deleting.id);
      toast.success("تم حذف العميل.");
      setDeleting(null);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "تعذّر حذف العميل. قد يكون مرتبطًا بطلبات أو حركات مالية."));
    }
  }

  return <div className="space-y-6">
    <SectionHeader title="العملاء" detail="قائمة العملاء وبيانات التواصل والحالات وأنواع العملاء."
      actions={canCreate && <Button onClick={() => setEditing("new")}><Plus /> إضافة عميل</Button>} />
    <section className="overflow-hidden rounded-lg border bg-card ">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <SearchField value={draftSearch} onChange={setDraftSearch} placeholder="بحث باسم العميل أو رقم الهاتف" />
        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">نوع العميل
          <select className={fieldClass + " w-40"} aria-label="فلتر نوع العميل" value={filters.customerTypeId}
            onChange={(e) => filter("customerTypeId", e.target.value)}>
            <option value="">كل الأنواع</option>
            {types.data?.map((type) => <option value={type.value} key={type.value}>{type.label}</option>)}
            {types.isError && <option disabled>تعذّر تحميل الأنواع</option>}
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">الحالة
          <select className={fieldClass + " w-32"} aria-label="فلتر الحالة" value={filters.status}
            onChange={(e) => filter("status", e.target.value)}>
            <option value="">كل الحالات</option><option value="1">نشط</option><option value="0">غير نشط</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">الترتيب
          <select className={fieldClass + " w-44"} aria-label="ترتيب العملاء" value={filters.sort}
            onChange={(e) => filter("sort", e.target.value)}>
            <option value="-id">الأحدث أولًا</option>
            <option value="id">الأقدم أولًا</option>
            <option value="name">الاسم تصاعديًا</option>
            <option value="-name">الاسم تنازليًا</option>
          </select>
        </label>
      </div>
      {list.isPending ? <LoadingState /> : list.isError ? <ErrorState error={list.error} retry={() => void list.refetch()} /> :
      list.data.customers.length === 0 ? <EmptyState detail="لا يوجد عملاء مطابقون للبحث أو الفلاتر." /> :
      <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
              {["اسم العميل", "رقم الهاتف", "نوع العميل", "الحالة", "الإجراءات"].map((name) =>
                <th key={name} scope="col" className="px-5 py-4 font-bold">{name}</th>)}
            </tr></thead>
            <tbody className="divide-y">
              {list.data.customers.map((customer) => <tr key={customer.id} className="hover:bg-muted/30">
                <td className="px-5 py-4"><div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary"><UsersRound className="size-5" /></span>
                  <Link to={`/customers/${customer.id}`} className="font-bold hover:underline">{customer.name}</Link>
                </div></td>
                <td dir="ltr" className="px-5 py-4 text-right text-muted-foreground">{customer.phone}</td>
                <td className="px-5 py-4">{customer.customerType?.name ?? uiMessages.customers.unclassified}</td>
                <td className="px-5 py-4"><IdentityStatus status={customer.status} label={customer.statusLabel} /></td>
                <td className="px-5 py-4"><div className="flex flex-wrap gap-1">
                  <Button size="icon-sm" variant="ghost" asChild title="تفاصيل العميل">
                    <Link aria-label={`عرض ${customer.name}`} to={`/customers/${customer.id}`}><Eye /></Link>
                  </Button>
                  {canEdit && <Button size="icon-sm" variant="ghost" aria-label={`تعديل ${customer.name}`} title="تعديل العميل" onClick={() => setEditing(customer)}><Pencil /></Button>}
                  {canDelete && <Button size="icon-sm" variant="ghost" aria-label={`حذف ${customer.name}`} title="حذف العميل" onClick={() => setDeleting(customer)}><Trash2 className="text-destructive" /></Button>}
                </div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={list.data.pagination} onPage={(p) => filter("page", String(p))} />
      </>}
    </section>
    {editing && <CustomerFormModal key={editing === "new" ? "create" : editing.id}
      customer={editing === "new" ? undefined : editing} onClose={() => setEditing(null)} />}
    {deleting && <ConfirmDialog
      title="تأكيد حذف العميل" description={`هل تريد حذف «${deleting.name}»؟ يتم الحذف منطقيًا، وقد يمنعه النظام إذا كان العميل مرتبطًا بطلبات أو حركات مالية.`}
      confirmText="حذف العميل" destructive busy={mutations.remove.isPending}
      onClose={() => setDeleting(null)} onConfirm={() => void remove()} />}
  </div>;
}
