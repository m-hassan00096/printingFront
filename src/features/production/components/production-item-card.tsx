import { useState } from "react";
import { Eye, MoreHorizontal, Undo2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { StagePill } from "./production-dialogs";
import type { ProductionAction, ProductionItem } from "../types/production.types";

type Props = {
  item:ProductionItem;
  permissions:readonly string[];
  selected:boolean;
  busy:boolean;
  onSelect:(id:number,checked:boolean)=>void;
  onAction:(action:ProductionAction,item:ProductionItem)=>void;
  onDetails:(item:ProductionItem)=>void;
};
export function ProductionItemCard({item,permissions,selected,busy,onSelect,onAction,onDetails}:Props) {
  const may=(name:string)=>permissions.includes(name);
  const stage=item.productionStage;
  const completed=stage===2;
  const printSend=may("production.printing.send");
  const [expanded,setExpanded]=useState(false);
  return <article aria-label={`عنصر ${item.serviceName}`} className="space-y-3 border-t px-3 py-3 first:border-t-0">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm font-bold">{item.serviceName}</p>
        <p className="text-xs text-muted-foreground">الكمية: {item.quantity.toLocaleString("ar-EG")}</p>
        {(stage===1||completed) && item.designerName && <p className="text-xs text-muted-foreground">المصمم: {item.designerName}</p>}
        {stage===3 && <p className="text-xs text-muted-foreground">مكان الطباعة: {item.printingLocationName??"—"}</p>}
      </div>
      <StagePill stage={stage}/>
    </div>
    <div className="flex flex-wrap items-center gap-2">
      {completed && printSend && <label className="flex cursor-pointer items-center gap-1 text-xs" title="تحديد للإرسال الجماعي">
        <input type="checkbox" aria-label={`تحديد ${item.serviceName} للإرسال`} checked={selected}
          disabled={busy} onChange={e=>onSelect(item.id,e.target.checked)} /> تحديد
      </label>}
      <Button type="button" variant="outline" size="sm" disabled={busy}
        onClick={()=>onDetails(item)}><Eye className="size-4"/> التفاصيل</Button>
    </div>
    <div className="flex flex-wrap gap-2">
      {stage===0 && may("production.design.start") && <Button size="sm" disabled={busy}
        onClick={()=>onAction("start-design",item)}>بدء التصميم</Button>}
      {stage===1 && may("production.design.complete") && <Button size="sm" disabled={busy}
        onClick={()=>onAction("complete-design",item)}>إنهاء التصميم</Button>}
      {stage===1 && may("production.design.complete") && printSend && <Button size="sm" variant="outline" disabled={busy}
        onClick={()=>onAction("complete-and-send-to-printing",item)}>إنهاء وإرسال للطباعة</Button>}
      {completed && printSend && <Button size="sm" disabled={busy}
        onClick={()=>onAction("send-to-printing",item)}>إرسال للطباعة</Button>}
      {stage===3 && may("production.printing.complete") && <Button size="sm" disabled={busy}
        onClick={()=>onAction("mark-ready",item)}>جاهز للتسليم</Button>}
      {(stage===3 && may("production.printing.change_location") || stage>0 && may("production.items.undo")) &&
        <div className="relative">
          <Button type="button" variant="outline" size="icon-sm" disabled={busy}
            aria-label={`المزيد للعنصر ${item.id}`} aria-expanded={expanded}
            onClick={()=>setExpanded(!expanded)}><MoreHorizontal className="size-4"/></Button>
          {expanded && <div className="absolute left-0 top-full z-10 mt-1 min-w-44 rounded-xl border bg-card p-1 shadow-xl">
            {stage===3 && may("production.printing.change_location") && <button type="button"
              className="block w-full rounded-lg px-3 py-2 text-right text-xs hover:bg-muted"
              onClick={()=>{setExpanded(false);onAction("change-location",item);}}>تغيير مكان الطباعة</button>}
            {stage>0 && may("production.items.undo") && <button type="button"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-xs hover:bg-muted"
              onClick={()=>{setExpanded(false);onAction("undo",item);}}><Undo2 className="size-3.5"/> تراجع خطوة</button>}
          </div>}
        </div>}
    </div>
  </article>;
}
