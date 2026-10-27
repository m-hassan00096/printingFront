import { useState } from "react";
import { ArrowRight, Clock3, FileText, Printer, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import { ErrorState, LoadingState, PaginationBar } from "@/features/identity/components/identity-ui";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { SearchableSelect } from "@/features/orders/components/searchable-select";
import { useProductionHistory, useProductionItemDetails, useProductionSelects } from "../hooks/use-production";
import type { ProductionAction, ProductionItem, SelectOption } from "../types/production.types";

export function StagePill({ stage }: { stage: number }) {
  const config = ({
    0:["لم يبدأ","bg-muted text-muted-foreground"],
    1:["قيد التصميم","bg-primary/10 text-[#4d5ac6]"],
    2:["تم التصميم","bg-[#e5f7ee] text-[#147c58]"],
    3:["في الطباعة","bg-primary/10 text-[#4d5ac6]"],
    4:["جاهز للتسليم","bg-[#dff6eb] text-[#147c58]"],
  } as Record<number,[string,string]>)[stage] ?? ["غير معروف","bg-muted text-foreground"];
  return <span className={`inline-flex items-center rounded-sm border border-border px-2 py-0.5 text-[11px] font-semibold ${config[1]}`}>{config[0]}</span>;
}
const stageNames: Record<number,string> = {
  0: "لم يبدأ", 1: "قيد التصميم", 2: "تم التصميم",
  3: "في الطباعة", 4: "جاهز للتسليم",
};
function stageName(stage: number | null): string {
  return stage === null ? "غير محدد" : (stageNames[stage] ?? "مرحلة غير معروفة");
}
function dateTime(raw: string | null) {
  if (!raw) return "—";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-EG",{
    dateStyle:"medium",timeStyle:"short",timeZone:"Africa/Cairo",
  }).format(date);
}

export type ProductionPendingAction = {
  action: ProductionAction | "batch";
  item?: ProductionItem;
  ids?: number[];
};
const modalTitles:Record<ProductionPendingAction["action"],string> = {
  "start-design":"بدء التصميم",
  "complete-design":"إنهاء التصميم",
  "complete-and-send-to-printing":"إنهاء التصميم والإرسال للطباعة",
  "send-to-printing":"إرسال للطباعة",
  "change-location":"تغيير مكان الطباعة",
  "mark-ready":"إنهاء الطباعة وتجهيز العنصر",
  undo:"التراجع عن آخر مرحلة",
  batch:"إرسال العناصر المحددة للطباعة",
};
export function ProductionActionDialog({ intent, busy, onClose, onConfirm }: {
  intent: ProductionPendingAction; busy:boolean; onClose:()=>void;
  onConfirm:(printingLocationId?:number)=>Promise<void>;
}) {
  const requiresLocation=["complete-and-send-to-printing","send-to-printing","change-location","batch"].includes(intent.action);
  const selects=useProductionSelects(requiresLocation);
  const [locationId,setLocationId]=useState("");
  const [error,setError]=useState("");
  const choices:SelectOption[]=(selects.data?.locations ?? []).filter(option=>
    intent.action!=="change-location" || option.value!==intent.item?.printingLocationId);
  async function submit() {
    if (requiresLocation && !choices.some(option=>String(option.value)===locationId)) {
      setError("اختر مكان طباعة نشطًا.");return;
    }
    setError("");
    try {await onConfirm(requiresLocation?Number(locationId):undefined);}
    catch(e:unknown){setError(getApiErrorMessage(e,"تعذّر تنفيذ العملية. حاول مرة أخرى."));}
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d2b51]/35 p-4">
    <section role="dialog" aria-modal="true" aria-label={modalTitles[intent.action]}
      className="w-full max-w-md space-y-4 rounded-lg bg-card p-5 shadow-xl sm:p-6"
      onKeyDown={(e)=>{if(e.key==="Escape"&&!busy)onClose();}}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">{modalTitles[intent.action]}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {intent.action==="batch" ? `عدد العناصر المحددة: ${intent.ids?.length ?? 0}` :
              intent.item ? `${intent.item.serviceName} — ${intent.item.customerName}` : ""}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="إغلاق" disabled={busy} onClick={onClose}>
          <X className="size-4"/>
        </Button>
      </div>
      {intent.action==="undo" && <p className="rounded-xl bg-[#fff5df] p-3 text-sm text-[#a36a0d]">
        سيتم إرجاع العنصر خطوة حسب قواعد الإنتاج، مع الحفاظ على سجل الحركات.
        {intent.item?.productionStage===3 && " سيعود للتصميم من أجل إعادة العمل."}
      </p>}
      {intent.action==="mark-ready" && <p className="text-sm text-muted-foreground">
        سيتم نقل العنصر إلى «جاهز للتسليم». لن يتم تسليم الأوردر للعميل من هذه الشاشة.
      </p>}
      {requiresLocation && <div className="space-y-2">
        <label className="block text-sm font-bold">مكان الطباعة *</label>
        <SearchableSelect label="اختيار مكان الطباعة" placeholder="ابحث عن مكان طباعة..."
          options={choices} loading={selects.isPending} value={locationId} onChange={(v)=>{setLocationId(v);setError("");}}
          disabled={busy || selects.isError}/>
        {selects.isError && <div role="alert" className="text-sm text-destructive">
          تعذّر تحميل أماكن الطباعة.
          <button type="button" className="mr-2 underline" onClick={()=>void selects.refetch()}>إعادة المحاولة</button>
        </div>}
        {!selects.isPending && !selects.isError && choices.length===0 && <p className="text-sm text-muted-foreground">
          لا توجد أماكن طباعة نشطة متاحة. أضف مكانًا من الإعدادات أولًا.
        </p>}
      </div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex items-center gap-2 border-t pt-4">
        <Button disabled={busy || (requiresLocation && (selects.isPending || selects.isError || !choices.some(x=>String(x.value)===locationId)))}
          onClick={()=>void submit()}>{busy?"جاري التنفيذ...":"تأكيد العملية"}</Button>
        <Button variant="outline" disabled={busy} onClick={onClose}>إلغاء</Button>
      </div>
    </section>
  </div>;
}
export function ProductionDetailDialog({ item, onClose }: { item:ProductionItem;onClose:()=>void }) {
  const [tab,setTab]=useState<"details"|"history">("details");
  const [page,setPage]=useState(1);
  const session=useCurrentUser();
  const permissions=session.data?.permissions??[];
  const canHistory=permissions.includes("production.history.view");
  const canViewOrder=permissions.includes("orders.view");
  const history=useProductionHistory(item.id,page,tab==="history"&&canHistory);
  const itemDetails=useProductionItemDetails(item.id,tab==="details");
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d2b51]/35 p-4">
    <section role="dialog" aria-modal="true" aria-label="تفاصيل عنصر الإنتاج"
      onKeyDown={(e)=>{if(e.key==="Escape")onClose();}}
      className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-lg bg-card shadow-xl">
      <header className="flex items-start justify-between gap-3 border-b px-5 py-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{item.serviceName}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{item.customerName} · {item.orderNumber}</p>
        </div>
        <Button variant="ghost" size="icon-sm" aria-label="إغلاق" onClick={onClose}><X className="size-4"/></Button>
      </header>
      <div className="flex gap-1 border-b px-5 pt-3" role="tablist" aria-label="أقسام تفاصيل العنصر">
        <button type="button" role="tab" aria-selected={tab==="details"} onClick={()=>setTab("details")}
          className={`rounded-t-lg px-4 py-2 text-sm ${tab==="details"?"bg-muted font-bold":"text-muted-foreground"}`}>بيانات العنصر</button>
        {canHistory && <button type="button" role="tab" aria-selected={tab==="history"} onClick={()=>setTab("history")}
          className={`rounded-t-lg px-4 py-2 text-sm ${tab==="history"?"bg-muted font-bold":"text-muted-foreground"}`}>سجل الحركات</button>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-5">
        {tab==="details" ? <div className="space-y-5">
          <dl className="grid gap-3 rounded-xl bg-muted/40 p-4 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">الكمية</dt><dd className="font-bold">{item.quantity.toLocaleString("en-US")}</dd></div>
            <div><dt className="text-muted-foreground">المرحلة</dt><dd className="mt-1"><StagePill stage={item.productionStage}/></dd></div>
            <div><dt className="text-muted-foreground">موعد التسليم</dt><dd className="font-bold">{item.dueDate??"غير محدد"}{item.isLate?" · متأخر":""}</dd></div>
            <div><dt className="text-muted-foreground">المصمم</dt><dd className="font-bold">{item.designerName??"لم يُحدد"}</dd></div>
            <div><dt className="text-muted-foreground">أنهى التصميم</dt><dd className="font-bold">{item.designCompletedByName??"—"}</dd></div>
            <div><dt className="text-muted-foreground">مكان الطباعة</dt><dd className="font-bold">{item.printingLocationName??"لم يُحدد"}</dd></div>
          </dl>
          {canViewOrder && <Link to={`/orders/${item.orderId}`} className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline">
            <ArrowRight className="size-4"/> فتح الأوردر
          </Link>}
          {itemDetails.isPending?<LoadingState/>:itemDetails.isError?
            <ErrorState error={itemDetails.error} retry={()=>void itemDetails.refetch()}/>:
            itemDetails.data&&<div className="space-y-4">
              <section className="space-y-2">
                <h3 className="text-sm font-bold">مواصفات العنصر</h3>
                <p className="whitespace-pre-wrap rounded-xl border bg-muted/30 p-3 text-sm leading-6">
                  {itemDetails.data.specifications||"لا توجد مواصفات إضافية."}
                </p>
              </section>
              <section className="space-y-2">
                <h3 className="text-sm font-bold">ملفات التصميم ({itemDetails.data.files.length})</h3>
                {itemDetails.data.files.length===0?
                  <p className="text-sm text-muted-foreground">لا توجد ملفات مرفقة بالعنصر.</p>:
                  <div className="divide-y overflow-hidden rounded-xl border">
                    {itemDetails.data.files.map(file=><div key={file.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                      <span className="min-w-0 break-all text-sm font-semibold">{file.name}</span>
                      {file.url?<a className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-primary underline"
                        href={file.url} target="_blank" rel="noopener noreferrer">فتح الملف</a>:
                        <span className="text-xs text-muted-foreground">الرابط غير متاح</span>}
                    </div>)}
                  </div>}
              </section>
            </div>}
        </div> : canHistory ? (
          history.isPending ? <LoadingState/> : history.isError ?
            <ErrorState error={history.error} retry={()=>void history.refetch()}/> :
            <div className="space-y-3">
              {!history.data?.events.length && <p className="py-10 text-center text-sm text-muted-foreground">لا توجد حركات مسجلة للعنصر.</p>}
              {history.data?.events.map(event=><article key={event.id} className="flex gap-3 rounded-xl border p-3">
                {event.eventType===3||event.eventType===4?<Printer className="mt-1 size-4 shrink-0 text-primary"/>:
                  event.eventType===6?<Clock3 className="mt-1 size-4 shrink-0 text-primary"/>:
                  <FileText className="mt-1 size-4 shrink-0 text-primary"/>}
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-bold">{event.eventTypeLabel}</p>
                  <p className="text-xs text-muted-foreground">{event.actorName??"موظف"} · {dateTime(event.createdAt)}</p>
                  {event.oldPrintingLocationId !== event.newPrintingLocationId &&
                    <p className="text-xs text-muted-foreground">
                      مكان الطباعة: من <span dir="auto">{event.oldPrintingLocationName??"غير محدد"}</span> إلى{" "}
                      <span dir="auto">{event.newPrintingLocationName??"غير محدد"}</span>
                    </p>}
                  {event.fromStage !== event.toStage &&
                    <p className="text-xs text-muted-foreground">
                      من {stageName(event.fromStage)} إلى {stageName(event.toStage)}
                    </p>}
                </div>
              </article>)}
              {history.data && history.data.pagination.lastPage > 1 && <PaginationBar pagination={history.data.pagination} onPage={setPage}/>}
            </div>
        ) : null}
      </div>
      <footer className="flex justify-end border-t p-4"><Button variant="outline" onClick={onClose}>إغلاق</Button></footer>
    </section>
  </div>;
}
