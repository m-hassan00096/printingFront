import { useEffect, useState } from "react";
import { Eye, Pencil, Plus, Trash2, Printer } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import {
  ConfirmDialog, EmptyState, ErrorState, IdentityStatus,
  LoadingState, PaginationBar, SearchField, SectionHeader, fieldClass,
} from "@/features/identity/components/identity-ui";
import { usePrintingServices, usePrintingServiceMutations } from "../hooks/use-printing-services";
import type { PrintingService, ServiceFilters } from "../types/printing-service.types";

function pageNumber(value: string | null): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export function PrintingServicesPage() {
  const { data: user } = useCurrentUser();
  const permissions = user?.permissions ?? [];
  const canCreate = permissions.includes("printing_services.create");
  const canUpdate = permissions.includes("printing_services.update");
  const canDelete = permissions.includes("printing_services.delete");
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const [draftSearch, setDraftSearch] = useState(search);
  const filters: ServiceFilters = {
    search,
    status: params.get("status") ?? "",
    sort: params.get("sort") || "-id",
    page: pageNumber(params.get("page")),
  };
  const list = usePrintingServices(filters);
  const mutations = usePrintingServiceMutations();
  const [deleting, setDeleting] = useState<PrintingService | null>(null);

  useEffect(() => setDraftSearch(search), [search]);
  useEffect(() => {
    if (draftSearch === search) return;
    const timer = window.setTimeout(() => updateFilter("search", draftSearch.trim()), 350);
    return () => window.clearTimeout(timer);
    // updateFilter only delegates to the stable React Router setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftSearch, search, setParams]);

  function updateFilter(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  }
  async function confirmDelete() {
    if (!deleting) return;
    try {
      await mutations.remove.mutateAsync(deleting.id);
      toast.success("تم حذف خدمة الطباعة.");
      setDeleting(null);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "تعذّر الحذف؛ قد تكون الخدمة مستخدمة في أوردرات."));
    }
  }
  return <div className="space-y-6">
    <SectionHeader title="خدمات الطباعة" detail="إدارة أنواع الطباعة وأسعارها وشرائح الكميات وأنواع العملاء."
      actions={canCreate && <Button asChild><Link to="/printing-services/new"><Plus /> إضافة خدمة طباعة</Link></Button>} />
    <section className="overflow-hidden rounded-lg border bg-card ">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <SearchField value={draftSearch} onChange={setDraftSearch} placeholder="بحث باسم خدمة الطباعة" />
        <label className="flex items-center gap-2 text-xs font-bold">الحالة
          <select aria-label="فلتر الحالة" className={fieldClass + " w-36"} value={filters.status}
            onChange={(event) => updateFilter("status", event.target.value)}>
            <option value="">كل الحالات</option><option value="1">نشط</option><option value="0">غير نشط</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-xs font-bold">الترتيب
          <select aria-label="ترتيب الخدمات" className={fieldClass + " w-40"} value={filters.sort}
            onChange={(event) => updateFilter("sort", event.target.value)}>
            <option value="-id">الأحدث أولًا</option><option value="id">الأقدم أولًا</option>
            <option value="name">الاسم تصاعديًا</option><option value="-name">الاسم تنازليًا</option>
          </select>
        </label>
      </div>
      {list.isPending ? <LoadingState /> : list.isError ? <ErrorState error={list.error} retry={() => void list.refetch()} /> :
        list.data.printingServices.length === 0 ?
          <EmptyState title="لا توجد خدمات طباعة" detail="ابدأ بإضافة خدمة أو غيّر الفلاتر الحالية." /> :
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-right text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
                {["اسم الخدمة", "السعر الأساسي", "الحالة", "الإجراءات"].map((title) =>
                  <th scope="col" key={title} className="px-5 py-4 font-bold">{title}</th>)}
              </tr></thead>
              <tbody className="divide-y">{list.data.printingServices.map((service) =>
                <tr key={service.id} className="hover:bg-muted/30">
                  <td className="px-5 py-4"><Link className="inline-flex items-center gap-3 font-bold hover:underline"
                    to={`/printing-services/${service.id}`}>
                    <span className="rounded-lg bg-secondary p-2 text-primary"><Printer className="size-5" /></span>
                    {service.name}
                  </Link></td>
                  <td className="px-5 py-4 tabular-nums">{service.basePrice === null ? "غير محدد" : `${service.basePrice} ج.م`}</td>
                  <td className="px-5 py-4"><IdentityStatus status={service.status} label={service.status === 1 ? "نشط" : "غير نشط"} /></td>
                  <td className="px-5 py-4"><div className="flex gap-1">
                    <Button asChild variant="ghost" size="icon-sm" title="تفاصيل الخدمة">
                      <Link aria-label={`عرض ${service.name}`} to={`/printing-services/${service.id}`}><Eye /></Link>
                    </Button>
                    {canUpdate && <Button asChild variant="ghost" size="icon-sm" title="تعديل الخدمة">
                      <Link aria-label={`تعديل ${service.name}`} to={`/printing-services/${service.id}/edit`}><Pencil /></Link>
                    </Button>}
                    {canDelete && <Button variant="ghost" size="icon-sm" title="حذف الخدمة" aria-label={`حذف ${service.name}`}
                      onClick={() => setDeleting(service)}><Trash2 className="text-destructive" /></Button>}
                  </div></td>
                </tr>)}
              </tbody>
            </table>
          </div>
          <PaginationBar pagination={list.data.pagination} onPage={(page) => updateFilter("page", String(page))} />
        </>}
    </section>
    {deleting && <ConfirmDialog title="حذف خدمة طباعة" description={`هل تريد حذف «${deleting.name}»؟ لن يُسمح بالحذف إذا كانت مستخدمة في أوردرات سابقة.`}
      confirmText="تأكيد الحذف" destructive busy={mutations.remove.isPending}
      onConfirm={() => void confirmDelete()} onClose={() => setDeleting(null)} />}
  </div>;
}
