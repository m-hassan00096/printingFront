import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Clock3, Layers3, RotateCw, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { ErrorState, LoadingState, PaginationBar, SectionHeader, fieldClass } from "@/features/identity/components/identity-ui";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { SearchableSelect } from "@/features/orders/components/searchable-select";
import { useProductionActions, useProductionColumn, useProductionSelects, useProductionSummary } from "../hooks/use-production";
import { ProductionItemCard } from "../components/production-item-card";
import { ProductionActionDialog, ProductionDetailDialog, type ProductionPendingAction } from "../components/production-dialogs";
import { PRODUCTION_COLUMNS, type ProductionColumnId, type ProductionFilters, type ProductionItem } from "../types/production.types";
import { getApiErrorMessage } from "@/shared/api/http";

const initialPages: Record<ProductionColumnId,number> = {0:1,1:1,2:1,3:1};
const summaryCounts = (summary:ReturnType<typeof useProductionSummary>["data"],id:ProductionColumnId):number|null => {
  if (!summary) return null;
  if (id===0) return summary.notStartedCount;
  if (id===1) return summary.designInProgressCount+summary.designCompletedCount;
  if (id===2) return summary.printingCount;
  return summary.readyCount;
};
const successMessages: Record<Exclude<ProductionPendingAction["action"],"batch">,string> = {
  "start-design":"تم بدء التصميم.",
  "complete-design":"تم إنهاء التصميم.",
  "complete-and-send-to-printing":"تم إنهاء التصميم وإرساله للطباعة.",
  "send-to-printing":"تم إرسال العنصر للطباعة.",
  "change-location":"تم تغيير المطبعة.",
  "mark-ready":"أصبح العنصر جاهزًا للتسليم.",
  undo:"تم التراجع عن المرحلة السابقة.",
};

function ProductionColumn({ column, filters, page, onPage, count, countLoading,
  selected, permissions, busy, onSelect, onAction, onDetails, visible }: {
  column:ProductionColumnId;
  filters:ProductionFilters;
  page:number;
  onPage:(page:number)=>void;
  count:number|null;
  countLoading:boolean;
  selected:ReadonlySet<number>;
  permissions:readonly string[];
  busy:boolean;
  onSelect:(id:number,checked:boolean)=>void;
  onAction:(item:ProductionItem,action:ProductionPendingAction["action"])=>void;
  onDetails:(item:ProductionItem)=>void;
  visible:boolean;
}) {
  const result=useProductionColumn(column,filters,page);
  useEffect(()=>{
    const lastPage=result.data?.pagination.lastPage;
    if(lastPage && page>lastPage)onPage(lastPage);
  },[page,result.data?.pagination.lastPage,onPage]);
  const groups=new Map<number,ProductionItem[]>();
  for(const item of result.data?.items??[]) {
    const group=groups.get(item.orderId)??[];
    group.push(item);
    groups.set(item.orderId,group);
  }
  const label=PRODUCTION_COLUMNS.find(x=>x.id===column)?.label ?? "مرحلة";
  return <section aria-label={`عمود ${label}`} className={`min-w-0 rounded-xl border border-[#e6e9f3] bg-[#f8f9fd] shadow-[0_4px_20px_#27396b08] ${visible?"block":"hidden lg:block"}`}>
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 rounded-t-xl border-b border-[#e6e9f3] bg-white px-4 py-3">
      <h3 className="text-sm font-bold">{label}</h3>
      <span className="min-w-7 rounded-md bg-[#edf0ff] px-2 py-1 text-primary text-center text-xs font-bold tabular-nums"
        aria-label={`عدد عناصر ${label}`}>{countLoading?"…":count??"—"}</span>
    </header>
    <div className="space-y-2 p-2.5">
      {result.isPending ? <LoadingState/> : result.isError ?
        <ErrorState error={result.error} retry={()=>void result.refetch()}/> :
        groups.size===0 ?
          <div className="rounded-lg border border-dashed border-[#dfe3ef] bg-white p-6 text-center text-xs text-muted-foreground">
            لا توجد عناصر في هذه المرحلة.
          </div> :
        [...groups.entries()].map(([orderId,items])=>
          <div key={orderId} className="overflow-hidden rounded-lg border border-[#e6e9f3] bg-white shadow-[0_2px_9px_#26396b07]">
            <header className="space-y-0.5 border-b bg-card px-3 py-2.5">
              <p className="font-mono text-xs font-medium text-primary" dir="auto">{items[0].orderNumber}</p>
              <p className="truncate text-xs font-semibold" title={items[0].customerName}>{items[0].customerName}</p>
              <p className="text-xs text-muted-foreground">{items[0].customerPhone}</p>
              {items[0].isLate && <span className="inline-flex rounded-full bg-[#fff0f2] px-2 py-0.5 text-xs font-bold text-[#c8384a]">متأخر</span>}
              {items[0].dueDate && <p className="text-xs text-muted-foreground">التسليم: {items[0].dueDate}</p>}
            </header>
            {items.map(item=><ProductionItemCard key={item.id} item={item} permissions={permissions}
              selected={selected.has(item.id)} busy={busy}
              onSelect={onSelect} onDetails={onDetails}
              onAction={(action,i)=>onAction(i,action)}/>)}
          </div>)}
    </div>
    {result.data && result.data.pagination.lastPage>1 &&
      <PaginationBar pagination={result.data.pagination} onPage={onPage}/>}
    {result.data && result.data.pagination.lastPage<=1 && result.data.pagination.total>0 &&
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        إجمالي النتائج: {result.data.pagination.total.toLocaleString("ar-EG")}
      </p>}
  </section>;
}

export function ProductionPage() {
  const qc=useQueryClient();
  const session=useCurrentUser();
  const permissions=session.data?.permissions??[];
  const can=(key:string)=>permissions.includes(key);
  const [searchInput,setSearchInput]=useState("");
  const [search,setSearch]=useState("");
  const [customerId,setCustomerId]=useState("");
  const [serviceId,setServiceId]=useState("");
  const [myDesignWork,setMyDesignWork]=useState<ProductionFilters["myDesignWork"]>("");
  const [lateOnly,setLateOnly]=useState(false);
  const [sort,setSort]=useState<ProductionFilters["sort"]>("dueDate");
  const [activeColumn,setActiveColumn]=useState<ProductionColumnId>(0);
  const [pages,setPages]=useState(initialPages);
  const [selected,setSelected]=useState<ReadonlySet<number>>(new Set());
  const [pending,setPending]=useState<ProductionPendingAction|null>(null);
  const [detail,setDetail]=useState<ProductionItem|null>(null);
  const actions=useProductionActions();
  const busy=actions.single.isPending||actions.batch.isPending;
  const filters:ProductionFilters={
    search,customerId:customerId?Number(customerId):null,
    serviceId:serviceId?Number(serviceId):null,myDesignWork,lateOnly,sort,
  };
  const summary=useProductionSummary(filters,can("production.summary.view"));
  const selects=useProductionSelects(true);

  useEffect(()=>{
    const timer=setTimeout(()=>setSearch(searchInput.trim()),350);
    return ()=>clearTimeout(timer);
  },[searchInput]);
  useEffect(()=>{
    setPages({0:1,1:1,2:1,3:1});
    setSelected(new Set());
  },[search,customerId,serviceId,myDesignWork,lateOnly,sort]);

  function choose(id:number,checked:boolean) {
    setSelected(previous=>{
      const next=new Set(previous);
      if(checked)next.add(id);else next.delete(id);
      return next;
    });
  }
  async function move(item:ProductionItem,action:ProductionPendingAction["action"]) {
    if(action==="batch")return;
    if(action==="start-design"||action==="complete-design") {
      try {
        await actions.single.mutateAsync({itemId:item.id,action});
        toast.success(successMessages[action]);
      } catch(e:unknown) {
        toast.error(getApiErrorMessage(e,"تعذّر تغيير مرحلة العنصر، قم بتحديث اللوحة."));
      }
      return;
    }
    setPending({action,item});
  }
  async function execute(printingLocationId?:number) {
    if (!pending) return;
    if (pending.action==="batch") {
      if(!printingLocationId||!pending.ids?.length)return;
      await actions.batch.mutateAsync({itemIds:pending.ids,printingLocationId});
      setSelected(new Set());
      toast.success("تم إرسال العناصر المحددة للطباعة.");
    } else if(pending.item) {
      await actions.single.mutateAsync({
        itemId:pending.item.id,
        action:pending.action,
        printingLocationId,
      });
      toast.success(successMessages[pending.action]);
    }
    setPending(null);
  }
  function reset() {
    setSearchInput("");setSearch("");setCustomerId("");setServiceId("");setMyDesignWork("");setLateOnly(false);setSort("dueDate");
  }
  return <div className="space-y-5">
    <SectionHeader title="لوحة الإنتاج" detail="متابعة عناصر الأوردرات المؤكدة من بدء التصميم حتى الجاهزية للتسليم."
      actions={<Button type="button" variant="outline" disabled={busy}
        onClick={()=>{
          void qc.invalidateQueries({queryKey:["production"]});
        }}><RotateCw className="size-4"/> تحديث</Button>}/>
    <section aria-label="فلاتر الإنتاج" className="space-y-3 rounded-xl border bg-white p-4 shadow-[0_5px_18px_#26396b08] sm:p-5">
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(240px,1.4fr)_repeat(3,minmax(155px,1fr))]">
        <label className="relative block">
          <span className="sr-only">البحث في الإنتاج</span>
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
          <input className={fieldClass+" pr-10"} value={searchInput} onChange={e=>setSearchInput(e.target.value)}
            placeholder="رقم الأوردر، العميل، الهاتف، الخدمة..."/>
        </label>
        <SearchableSelect label="تصفية حسب العميل" placeholder="كل العملاء — ابحث..."
          options={selects.data?.customers??[]} value={customerId} onChange={setCustomerId}
          loading={selects.isPending}/>
        <SearchableSelect label="تصفية حسب الخدمة" placeholder="كل الخدمات — ابحث..."
          options={selects.data?.services??[]} value={serviceId} onChange={setServiceId}
          loading={selects.isPending} disabled={selects.isError}/>
        <select className={fieldClass} aria-label="فلتر أعمال التصميم" value={myDesignWork}
          onChange={e=>setMyDesignWork(e.target.value as ProductionFilters["myDesignWork"])}>
          <option value="">كل أعمال التصميم</option>
          <option value="1">بدأتها أنا</option>
          <option value="2">أنهيتها أنا</option>
        </select>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={lateOnly} onChange={e=>setLateOnly(e.target.checked)}/>
          المتأخرة فقط
        </label>
        <label className="flex items-center gap-2 text-sm">الترتيب
          <select className={fieldClass+" !h-9 min-w-36"} aria-label="ترتيب عناصر الإنتاج" value={sort}
            onChange={e=>setSort(e.target.value as ProductionFilters["sort"])}>
            <option value="dueDate">الأقرب تسليمًا</option>
            <option value="-dueDate">الأبعد تسليمًا</option>
            <option value="-id">الأحدث</option>
            <option value="id">الأقدم</option>
          </select>
        </label>
        <Button variant="ghost" size="sm" onClick={reset}>مسح الفلاتر</Button>
      </div>
      {selects.isError && <div role="alert" className="text-xs text-destructive">
        تعذّر تحميل قوائم العملاء والخدمات والمطابع.
        <button className="mr-2 underline" type="button" onClick={()=>void selects.refetch()}>إعادة المحاولة</button>
      </div>}
    </section>
    {can("production.summary.view") && summary.data && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {[
        ["لم يبدأ",summary.data.notStartedCount],
        ["تصميم جارٍ",summary.data.designInProgressCount],
        ["تصميم مكتمل",summary.data.designCompletedCount],
        ["في الطباعة",summary.data.printingCount],
        ["جاهز للتسليم",summary.data.readyCount],
        ["أوردرات متأخرة",summary.data.lateOrdersCount],
      ].map(([label,n])=><div key={label} className="rounded-xl border border-[#e8eaf2] bg-white p-4 shadow-[0_3px_12px_#27396b07]">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-1 text-xl font-bold tabular-nums">{n}</p>
      </div>)}
    </div>}
    {can("production.summary.view") && summary.isError && <div className="rounded-lg border p-2">
      <ErrorState error={summary.error} retry={()=>void summary.refetch()}/>
    </div>}
    {can("production.printing.send") && selected.size>0 && <aside className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/25 bg-card p-3">
      <p className="text-sm font-semibold"><CheckCheck className="ml-2 inline size-4"/>تم تحديد {selected.size} عنصر مكتمل التصميم</p>
      <div className="flex gap-2">
        <Button disabled={busy} size="sm" onClick={()=>setPending({action:"batch",ids:[...selected]})}>إرسال المحدد للطباعة</Button>
        <Button disabled={busy} variant="outline" size="sm" onClick={()=>setSelected(new Set())}>إلغاء التحديد</Button>
      </div>
    </aside>}
    <div className="lg:hidden">
      <label className="block text-sm font-semibold">مرحلة الإنتاج</label>
      <select className={fieldClass+" mt-2"} aria-label="عرض مرحلة الإنتاج" value={activeColumn}
        onChange={e=>setActiveColumn(Number(e.target.value) as ProductionColumnId)}>
        {PRODUCTION_COLUMNS.map(x=><option value={x.id} key={x.id}>{x.label}</option>)}
      </select>
    </div>
    <div className="overflow-x-auto">
      <div className="grid min-w-0 gap-4 lg:min-w-[1120px] lg:grid-cols-4">
        {PRODUCTION_COLUMNS.map(column=><ProductionColumn key={column.id} column={column.id}
          filters={filters} page={pages[column.id]} onPage={page=>setPages(previous=>({...previous,[column.id]:page}))}
          count={summaryCounts(summary.data,column.id)}
          countLoading={can("production.summary.view")&&summary.isPending}
          selected={selected} permissions={permissions} busy={busy} onSelect={choose}
          onAction={(item,action)=>void move(item,action)} onDetails={setDetail}
          visible={column.id===activeColumn}/>)}
      </div>
    </div>
    {!can("production.summary.view") && <p className="text-xs text-muted-foreground">
      أعداد المراحل التفصيلية تحتاج صلاحية عرض ملخص الإنتاج.
    </p>}
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <Layers3 className="size-4"/> كل عنصر يتحرك منفردًا؛ اكتمال كل العناصر فقط يجعل الأوردر جاهزًا للتسليم.
      <Clock3 className="size-4"/> المواعيد المتأخرة محددة بالاسم وليس باللون فقط.
    </p>
    {pending && <ProductionActionDialog key={`${pending.action}:${pending.item?.id??"batch"}`}
      intent={pending} busy={busy} onClose={()=>setPending(null)} onConfirm={execute}/>}
    {detail && <ProductionDetailDialog key={detail.id} item={detail} onClose={()=>setDetail(null)}/>}
  </div>;
}
