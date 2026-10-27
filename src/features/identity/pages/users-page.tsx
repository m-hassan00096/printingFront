import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Pencil, Plus, Trash2, UserRound, UserRoundCog } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { getApiErrorMessage } from "@/shared/api/http";
import { useDeleteUser, useRoles, useUpdateUser, useUsers } from "../hooks/use-identity";
import { ConfirmDialog, EmptyState, ErrorState, IdentityStatus, LoadingState, PaginationBar, SearchField, SectionHeader, fieldClass } from "../components/identity-ui";
import { toFilterPage } from "../lib/identity-helpers";
import type { IdentityUser } from "../types/identity.types";

export function UsersPage() {
  const { data: session } = useCurrentUser();
  const permissions = session?.permissions ?? [];
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const status = params.get("status") ?? "";
  const role = params.get("role") ?? "";
  const page = toFilterPage(params.get("page"));
  const [searchDraft, setSearchDraft] = useState(search);
  const [selected, setSelected] = useState<{ user: IdentityUser; operation: "status" | "delete" } | null>(null);
  const users = useUsers({ search, status, role, page });
  const mayViewRoles = permissions.includes("identity.roles.view");
  const roles = useRoles({ perPage: 100 }, mayViewRoles);
  const update = useUpdateUser();
  const remove = useDeleteUser();

  useEffect(() => { setSearchDraft(search); }, [search]);
  useEffect(() => {
    if (searchDraft === search) return;
    const timeout = window.setTimeout(() => {
      setParams((previous) => {
        const next = new URLSearchParams(previous);
        if (searchDraft.trim()) next.set("search", searchDraft.trim());
        else next.delete("search");
        next.delete("page");
        return next;
      });
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [searchDraft, search, setParams]);

  function change(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  }

  async function confirm() {
    if (!selected) return;
    try {
      if (selected.operation === "delete") {
        await remove.mutateAsync(selected.user.id);
        toast.success("تم حذف المستخدم.");
      } else {
        await update.mutateAsync({ id: selected.user.id, payload: { status: selected.user.status === 1 ? 0 : 1 } });
        toast.success("تم تحديث حالة المستخدم.");
      }
      setSelected(null);
    } catch (error: unknown) { toast.error(getApiErrorMessage(error)); }
  }

  return <div className="space-y-6">
    <SectionHeader title="المستخدمون" detail="إدارة حسابات الفريق والأدوار وحالة الوصول للنظام." actions={
      permissions.includes("identity.users.create") && <Button asChild><Link to="/users/new"><Plus className="size-4" /> إضافة مستخدم</Link></Button>
    } />
    <section className="overflow-hidden rounded-lg border bg-card ">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <SearchField value={searchDraft} onChange={setSearchDraft} placeholder="بحث بالاسم أو المستخدم أو الهاتف" />
        <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          الحالة
          <select aria-label="فلتر الحالة" className={fieldClass + " w-36"} value={status} onChange={(e) => change("status", e.target.value)}>
            <option value="">كل الحالات</option><option value="1">نشط</option><option value="0">غير نشط</option>
          </select>
        </label>
        {mayViewRoles && <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          الدور
          <select aria-label="فلتر الدور" className={fieldClass + " w-40"} value={role} onChange={(e) => change("role", e.target.value)}>
            <option value="">كل الأدوار</option>
            {roles.data?.roles.map((r) => <option key={r.id} value={r.key}>{r.name}</option>)}
          </select>
        </label>}
      </div>
      {users.isPending ? <LoadingState /> : users.isError ? <ErrorState error={users.error} retry={() => void users.refetch()} /> :
      users.data.users.length === 0 ? <EmptyState detail="لا يوجد مستخدمون يطابقون معايير البحث." /> :
      <>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[790px] text-right text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground"><tr>
              {["المستخدم", "اسم الدخول", "رقم الهاتف", "الدور", "الحالة", "الإجراءات"].map((h) => <th key={h} scope="col" className="px-5 py-4 font-bold">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y">
              {users.data.users.map((user) => <tr key={user.id} className="transition-colors hover:bg-muted/30">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {user.avatar ? <img src={user.avatar} alt="" className="size-10 rounded-lg object-cover" /> :
                    <span className="flex size-10 items-center justify-center rounded-lg bg-secondary text-primary"><UserRound className="size-5" /></span>}
                    <Link className="max-w-52 truncate font-bold hover:underline" to={`/users/${user.id}`}>{user.name}</Link>
                  </div>
                </td>
                <td dir="ltr" className="px-5 py-3.5 text-right text-muted-foreground">{user.username}</td>
                <td dir="ltr" className="px-5 py-3.5 text-right text-muted-foreground">{user.phone || "—"}</td>
                <td className="px-5 py-3.5">{user.role?.alias ?? "بدون دور"}</td>
                <td className="px-5 py-3.5"><IdentityStatus status={user.status} label={user.statusLabel} /></td>
                <td className="px-5 py-3.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {permissions.includes("identity.users.view") && <Button asChild size="icon-sm" variant="ghost" title="عرض التفاصيل"><Link aria-label={`عرض ${user.name}`} to={`/users/${user.id}`}><UserRound className="size-4" /></Link></Button>}
                    {permissions.includes("identity.users.update") && <>
                      <Button asChild size="icon-sm" variant="ghost" title="تعديل المستخدم"><Link aria-label={`تعديل ${user.name}`} to={`/users/${user.id}/edit`}><Pencil className="size-4" /></Link></Button>
                      {user.role?.name !== "admin" && <Button size="icon-sm" variant="ghost" title={user.status ? "تعطيل المستخدم" : "تفعيل المستخدم"} aria-label={user.status ? `تعطيل ${user.name}` : `تفعيل ${user.name}`} onClick={() => setSelected({ user, operation: "status" })}><UserRoundCog className="size-4" /></Button>}
                    </>}
                    {permissions.includes("identity.users.delete") && user.role?.name !== "admin" && <Button size="icon-sm" variant="ghost" title="حذف المستخدم" aria-label={`حذف ${user.name}`} onClick={() => setSelected({ user, operation: "delete" })}><Trash2 className="size-4 text-destructive" /></Button>}
                  </div>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
        <PaginationBar pagination={users.data.pagination} onPage={(p) => change("page", String(p))} />
      </>}
    </section>
    {selected && <ConfirmDialog
      title={selected.operation === "delete" ? "تأكيد حذف المستخدم" : selected.user.status === 1 ? "تعطيل حساب المستخدم؟" : "تفعيل حساب المستخدم؟"}
      description={selected.operation === "delete"
        ? `سيتم حذف حساب «${selected.user.name}» حذفًا منطقيًا. لن يتمكن من استخدامه بعد ذلك.`
        : `هل تريد ${selected.user.status ? "تعطيل" : "تفعيل"} حساب «${selected.user.name}»؟`}
      confirmText={selected.operation === "delete" ? "حذف المستخدم" : selected.user.status === 1 ? "تعطيل الحساب" : "تفعيل الحساب"}
      busy={update.isPending || remove.isPending}
      destructive={selected.operation === "delete" || selected.user.status === 1}
      onClose={() => setSelected(null)} onConfirm={() => void confirm()}
    />}
  </div>;
}
