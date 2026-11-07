import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useMobileListLayout } from "@/shared/hooks/use-mobile-list-layout";
import { Button } from "@/shared/components/ui/button";
import { MoneyAmount } from "@/shared/components/money-amount";
import { getApiErrorMessage } from "@/shared/api/http";
import { EmptyState, ErrorState, LoadingState, PaginationBar } from "@/features/identity/components/identity-ui";
import { uiMessages } from "@/shared/translations/ar/ui";
import { financeOpeningStatus } from "../api/finance.api";
import { OpeningBalanceDialog } from "./opening-balance-dialog";
import { useFinanceAccounts, financeKeys } from "../hooks/use-finance";
import { accountTypeLabel } from "../lib/account-display";
import type { AccountListFilters, FinanceAccount } from "../types/finance.types";

const copy = uiMessages.financeAccounts;
const initial: AccountListFilters = {search: "", type: "", sort: "-balance", page: 1};
const inputClass = "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/20";
export function FinanceAccountsOverview({onSelect, canOpening = false}: {
  onSelect: (id: number) => void;
  canOpening?: boolean;
}) {
  const mobile = useMobileListLayout();
  const qc = useQueryClient();
  const [openingCustomer, setOpeningCustomer] = useState<FinanceAccount | null>(null);
  const [checkingCustomerId, setCheckingCustomerId] = useState<number | null>(null);
  const [registeredIds, setRegisteredIds] = useState<number[]>([]);
  const [filters, setFilters] = useState<AccountListFilters>(initial);
  const [search, setSearch] = useState("");
  const query = useFinanceAccounts(filters, true);
  useEffect(() => {
    const timer = setTimeout(() => setFilters(previous => ({...previous, search: search.trim(), page: 1})), 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    if (query.data?.pagination.lastPage && filters.page > query.data.pagination.lastPage)
      setFilters(previous => ({...previous, page: query.data!.pagination.lastPage}));
  }, [filters.page, query.data]);
  const hasFilters = Boolean(search || filters.search || filters.type || filters.sort !== initial.sort);

  const alreadyRegistered = (account: FinanceAccount): boolean =>
    account.openingBalanceExists || registeredIds.includes(account.customerId);

  // The list flag keeps the button disabled; recheck the live state on click
  // so a stale list never opens a second opening balance dialog.
  async function startOpening(account: FinanceAccount) {
    if (!canOpening || alreadyRegistered(account) || checkingCustomerId !== null) return;
    setCheckingCustomerId(account.customerId);
    try {
      const status = await qc.fetchQuery({
        queryKey: financeKeys.opening(account.customerId),
        queryFn: () => financeOpeningStatus(account.customerId),
        staleTime: 0,
      });
      if (status.openingBalanceExists) {
        setRegisteredIds(previous => previous.includes(account.customerId)
          ? previous : [...previous, account.customerId]);
        void qc.invalidateQueries({queryKey: financeKeys.overview});
        return;
      }
      setOpeningCustomer(account);
    } catch (error: unknown) {
      toast.error(getApiErrorMessage(error, "تعذّر التحقق من الرصيد الافتتاحي. حاول مرة أخرى."));
    } finally {
      setCheckingCustomerId(null);
    }
  }

  function openingButton(account: FinanceAccount) {
    if (!canOpening) return null;
    const exists = alreadyRegistered(account);
    const disabled = exists || checkingCustomerId !== null;
    return <span className="inline-flex flex-col gap-1"
      title={exists ? "تم تسجيل الرصيد الافتتاحي لهذا العميل بالفعل." : undefined}>
      <Button type="button" variant="outline" size="sm" disabled={disabled}
        aria-label={`رصيد افتتاحي للعميل ${account.customerName}`}
        aria-describedby={exists ? `opening-recorded-${account.customerId}` : undefined}
        onClick={() => { void startOpening(account); }}>
        <Plus className="size-4" /> {checkingCustomerId === account.customerId ? "جاري التحقق..." : "رصيد افتتاحي"}
      </Button>
      {exists && <span id={`opening-recorded-${account.customerId}`}
        className="text-[11px] leading-4 text-muted-foreground">مسجّل بالفعل</span>}
    </span>;
  }

  function openingSaved(customerId: number) {
    setRegisteredIds(previous => previous.includes(customerId)
      ? previous : [...previous, customerId]);
    setOpeningCustomer(null);
    void qc.invalidateQueries({queryKey: financeKeys.overview});
  }

  return <section aria-label={copy.accountsTitle} className="space-y-3">
    <div className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-3">
      <label className="space-y-1.5 text-sm font-semibold"><span>{copy.accountsSearch}</span>
        <input className={inputClass} aria-label={copy.accountsSearch} value={search} maxLength={200} onChange={event => setSearch(event.target.value)} placeholder={copy.accountsSearch}/>
      </label>
      <label className="space-y-1.5 text-sm font-semibold"><span>{copy.accountStatus}</span>
        <select aria-label={copy.accountStatus} className={inputClass} value={filters.type} onChange={event => setFilters(previous => ({...previous, type: event.target.value, page: 1}))}>
          <option value="">كل الحسابات</option><option value="1">عملاء عليهم مبالغ</option><option value="2">عملاء لهم رصيد</option><option value="0">حسابات متعادلة</option>
        </select>
      </label>
      <label className="space-y-1.5 text-sm font-semibold"><span>{copy.sortBy}</span>
        <select aria-label={copy.sortBy} className={inputClass} value={filters.sort} onChange={event => setFilters(previous => ({...previous, sort: event.target.value as AccountListFilters["sort"], page: 1}))}>
          <option value="-balance">أكبر مبلغ على العميل</option><option value="balance">أكبر رصيد للعميل</option><option value="-id">{copy.newest}</option><option value="name">{copy.nameOrder}</option>
        </select>
      </label>
      {hasFilters && <div className="md:col-span-3"><Button size="sm" variant="ghost" onClick={() => {setFilters(initial); setSearch("");}}>{copy.clearFilters}</Button></div>}
    </div>
    {query.isPending ? <LoadingState/> : query.isError ? <ErrorState error={query.error} retry={() => void query.refetch()}/> : query.data?.accounts.length ?
      <div className="overflow-hidden rounded-xl border bg-card">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b p-4"><h2 className="font-bold">{copy.accountsTitle}</h2><span className="text-sm text-muted-foreground">{query.data.pagination.total.toLocaleString("ar-EG")} {copy.customer}</span></header>

        {mobile && <div className="divide-y md:hidden" aria-label="قائمة حسابات العملاء للموبايل">
          {query.data.accounts.map(account => <article key={account.customerId} className="space-y-3 px-3 py-4">
            <div className="min-w-0">
              <button type="button" className="break-words text-right text-sm font-bold text-primary underline-offset-2 hover:underline"
                onClick={() => onSelect(account.customerId)}>{account.customerName}</button>
              <p className="mt-1 text-xs text-muted-foreground"><bdi dir="ltr">{account.customerPhone}</bdi></p>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/40 p-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">الرصيد الكلي حتى الآن</p>
                <p className={"mt-1 break-words text-sm font-bold " +
                  (account.type===1?"text-destructive":account.type===2?"text-emerald-700":"")}>
                  {accountTypeLabel(account.type)} · <MoneyAmount amount={account.amount}/>
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => onSelect(account.customerId)}>
                  {copy.viewAccount}
                </Button>
                {openingButton(account)}
              </div>
            </div>
          </article>)}
        </div>}
        {!mobile && <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[600px] text-right text-sm">
          <thead className="bg-muted/50"><tr>{[copy.customer, copy.phone, "الرصيد الكلي حتى الآن", copy.actions].map(title => <th key={title} scope="col" className="px-4 py-3 text-xs font-semibold">{title}</th>)}</tr></thead>
          <tbody className="divide-y">{query.data.accounts.map(account => <tr key={account.customerId} className="hover:bg-muted/20">
            <td className="px-4 py-4 font-semibold"><button type="button" className="text-start hover:text-primary hover:underline" onClick={() => onSelect(account.customerId)}>{account.customerName}</button></td>
            <td className="px-4 py-4"><span dir="ltr" className="inline-block tabular-nums">{account.customerPhone}</span></td>
            <td className={"whitespace-nowrap px-4 py-4 font-semibold " + (account.type === 1 ? "text-destructive" : account.type === 2 ? "text-emerald-700" : "")}>
              {accountTypeLabel(account.type)} · <MoneyAmount amount={account.amount}/>
            </td>
            <td className="px-4 py-4"><div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => onSelect(account.customerId)}>{copy.viewAccount}</Button>
              {openingButton(account)}
            </div></td>
          </tr>)}</tbody>
        </table></div>}
        <p className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">الرصيد يشمل الأوردرات المؤكدة حتى لو لم تُسلّم. افتح الحساب لمراجعة التفاصيل أو تسجيل تحصيل أو تصفية الشغل المسلّم.</p>
      </div> : <EmptyState title={copy.noAccounts} detail={copy.noAccountsHint}/>}
    {query.data && query.data.pagination.lastPage > 1 && <PaginationBar pagination={query.data.pagination} onPage={page => setFilters(previous => ({...previous, page}))}/>}
    {openingCustomer && canOpening && <OpeningBalanceDialog key={openingCustomer.customerId}
      customerId={openingCustomer.customerId} customerName={openingCustomer.customerName}
      onClose={() => setOpeningCustomer(null)}
      onSuccess={() => openingSaved(openingCustomer.customerId)}/>}
  </section>;
}
