import { useState } from "react";
import { ClipboardCheck, FilePlus2, FileX2, History, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { useOrderActivities } from "../hooks/use-orders";
import type { OrderActivity as Activity } from "../types/orders.types";

const labels: Record<string, string> = {
  draft_created: "تم إنشاء مسودة الأوردر",
  draft_updated: "تم تعديل بيانات المسودة",
  item_added: "تم إضافة عنصر للأوردر",
  item_updated: "تم تعديل عنصر",
  item_removed: "تم حذف عنصر",
  item_service_replaced: "تم تغيير خدمة أحد العناصر",
  price_changed: "تم تعديل سعر عنصر",
  file_uploaded: "تم رفع ملف تصميم",
  file_removed: "تم نقل ملف إلى الأرشيف",
  order_confirmed: "تم تأكيد الأوردر",
  confirmed: "تم تأكيد الأوردر",
  order_cancelled: "تم إلغاء الأوردر",
  cancelled: "تم إلغاء الأوردر",
};
const icons: Record<string, typeof History> = {
  draft_created: FilePlus2, draft_updated: Pencil, item_added: Plus,
  item_updated: Pencil, item_removed: Trash2, item_service_replaced: Pencil,
  price_changed: Receipt, file_uploaded: FilePlus2, file_removed: FileX2,
  order_confirmed: ClipboardCheck, confirmed: ClipboardCheck,
};
function dateLabel(date: string | null) {
  if (!date) return "بدون وقت محدد";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.valueOf())) return "وقت غير متاح";
  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Cairo",
  }).format(parsed);
}
function ActivityRow({ activity }: { activity: Activity }) {
  const Icon = icons[activity.eventType] ?? History;
  return <li className="relative grid min-w-0 grid-cols-[36px_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
    <span aria-hidden="true" className="absolute right-[17px] top-8 bottom-0 w-px bg-border last:hidden" />
    <span className="relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/15 bg-primary/5">
      <Icon className="size-4 text-primary" />
    </span>
    <div className="min-w-0 rounded-lg border border-[#e8eaf2] bg-white px-3 py-2.5 sm:px-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm font-bold">{labels[activity.eventType] ?? "تم تحديث الأوردر"}</p>
        <time dateTime={activity.createdAt ?? undefined} className="text-xs text-muted-foreground">{dateLabel(activity.createdAt)}</time>
      </div>
    </div>
  </li>;
}
export function OrderActivityTimeline({ orderId, enabled }: { orderId: number; enabled: boolean }) {
  const activities = useOrderActivities(orderId, enabled);
  const [showAll, setShowAll] = useState(false);
  if (!enabled) return null;
  return <section className="rounded-xl border bg-card p-4 sm:p-5">
    <h2 className="mb-4 flex items-center gap-2 font-bold"><History className="size-4 text-primary" /> سجل النشاط</h2>
    {activities.isPending ? <p className="py-3 text-sm text-muted-foreground">جاري تحميل السجل...</p> :
      activities.isError ? <button type="button" onClick={() => void activities.refetch()}
        className="text-sm text-destructive underline">تعذّر تحميل السجل — إعادة المحاولة</button> :
      !activities.data?.activities.length ? <p className="py-3 text-sm text-muted-foreground">لا توجد أنشطة.</p> :
      <>
        <ul className="max-w-4xl">{(showAll ? activities.data.activities : activities.data.activities.slice(0, 5)).map((entry) =>
          <ActivityRow key={entry.id} activity={entry} />)}</ul>
        {activities.data.activities.length > 5 && <button type="button" onClick={() => setShowAll(!showAll)}
          className="mt-3 text-xs font-bold text-primary underline">
          {showAll ? "عرض آخر 5 أنشطة" : "عرض جميع الأنشطة المحمّلة"}
        </button>}
      </>}
  </section>;
}
