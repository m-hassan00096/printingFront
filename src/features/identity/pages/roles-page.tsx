import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { getApiErrorMessage } from "@/shared/api/http";
import { ConfirmDialog, EmptyState, ErrorState, IdentityStatus, LoadingState, PaginationBar, SearchField, SectionHeader, fieldClass } from "../components/identity-ui";
import { useDeleteRole, useRoles } from "../hooks/use-identity";
import { toFilterPage } from "../lib/identity-helpers";
import type { IdentityRole } from "../types/identity.types";

export function RolesPage() {
  const { data: session } = useCurrentUser();
  const permissions = session?.permissions ?? [];
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const status = params.get("status") ?? "";
  const page = toFilterPage(params.get("page"));
  const [draft, setDraft] = useState(search);
  const [deleting, setDeleting] = useState<IdentityRole | null>(null);
  const list = useRoles({ search, status, page });
  const removal = useDeleteRole();

  useEffect(() => { setDraft(search); }, [search]);
  useEffect(() => {
    if (draft === search) return;
    const timeout = window.setTimeout(() => setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (draft.trim()) next.set("search", draft.trim());
      else next.delete("search");
      next.delete("page");
      return next;
    }), 350);
    return () => window.clearTimeout(timeout);
  }, [draft, search, setParams]);

  function change(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  }
  async function remove() {
    if (!deleting) return;
    try {
      await removal.mutateAsync(deleting.id);
      toast.success("تم حذف الدور.");
      setDeleting(null);
    } catch (error: unknown) { toast.error(getApiErrorMessage(error)); }
  }
  return <div className="space-y-6">
    <SectionHeader title="الأدوار والصلاحيات" detail="إدارة أدوار الفريق وحالة كل دور وعدد المستخدمين المرتبطين به."
      actions={permissions.includes("identity.roles.create") && <Button asChild><Link to="/roles/new"><Plus className="size-4" /> إضافة دور</Link></Button>}
    />
    <section className="overflow-hidden rounded-lg border bg-card ">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <SearchField value={draft} onChange={setDraft} placeholder="بحث باسم الدور" />
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          الحالة
          <select aria-label="فلتر حالة الأدوار" className={fieldClass + " w-36"} value={status} onChange={(e) => change("status", e.target.value)}>
            <option value="">كل الحالات</option><option value="1">نشط</option><option value="0">غير نشط</option>
          </select>
        </label>
      </div>
      {list.isPending ? <LoadingState /> : list.isError ? <ErrorState error={list.error} retry={() => void list.refetch()} /> :
      list.data.roles.length === 0 ? <EmptyState detail="لم يتم العثور على أدوار بهذه المعايير." /> :
      <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[650px] text-right text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
              {["اسم الدور", "المستخدمون", "الحالة", "الإجراءات"].map((h) => <th key={h} scope="col" className="px-5 py-4 font-bold">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y">
              {list.data.roles.map((role) => <tr key={role.id} className="hover:bg-muted/30">
                <td className="px-5 py-4"><div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary"><ShieldCheck className="size-5" /></span>
                  <p className="font-bold">{role.name}</p>
                </div></td>
                <td className="px-5 py-4 text-muted-foreground">{role.usersCount.toLocaleString("ar-EG")}</td>
                <td className="px-5 py-4"><IdentityStatus status={role.status} label={role.statusLabel} /></td>
                <td className="px-5 py-4"><div className="flex items-center gap-1">
                  {permissions.includes("identity.roles.update") && <Button asChild size="icon-sm" variant="ghost" title="تعديل الدور">
                    <Link to={`/roles/${role.id}/edit`} aria-label={`تعديل دور ${role.name}`}><Pencil className="size-4" /></Link>
                  </Button>}
                  {permissions.includes("identity.roles.delete") && role.key !== "admin" && role.usersCount === 0 &&
                    <Button size="icon-sm" variant="ghost" title="حذف الدور" aria-label={`حذف دور ${role.name}`} onClick={() => setDeleting(role)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>}
                </div></td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={list.data.pagination} onPage={(page) => change("page", String(page))} />
      </>}
    </section>
    {deleting && <ConfirmDialog title="حذف الدور؟" description={`سيتم حذف دور «${deleting.name}» نهائيًا. تأكد أنه غير مستخدم في أي حساب.`}
      confirmText="حذف الدور" busy={removal.isPending} destructive
      onConfirm={() => void remove()} onClose={() => setDeleting(null)} />}
  </div>;
}
