import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, MoreHorizontal, Undo2, UserRound } from "lucide-react";
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
  const [menuPosition,setMenuPosition]=useState({top:0,left:0});
  const triggerRef=useRef<HTMLButtonElement>(null);
  const menuRef=useRef<HTMLDivElement>(null);
  const menuId=useId();
  const canChangeLocation=stage===3 && may("production.printing.change_location");
  const canUndo=stage>0 && may("production.items.undo");

  useEffect(()=>{
    if(!expanded)return;
    const padding=8;
    const menuWidth=208;
    function placeMenu() {
      const trigger=triggerRef.current;
      if(!trigger)return;
      const rect=trigger.getBoundingClientRect();
      const menuHeight=menuRef.current?.getBoundingClientRect().height ||
        8+(Number(canChangeLocation)+Number(canUndo))*40;
      const maxLeft=Math.max(padding,window.innerWidth-menuWidth-padding);
      const left=Math.min(Math.max(padding,rect.right-menuWidth),maxLeft);
      const fitsBelow=rect.bottom+6+menuHeight+padding<=window.innerHeight;
      const fitsAbove=rect.top-6-menuHeight>=padding;
      const top=fitsBelow || !fitsAbove
        ? Math.min(Math.max(padding,rect.bottom+6),Math.max(padding,window.innerHeight-menuHeight-padding))
        : Math.max(padding,rect.top-menuHeight-6);
      setMenuPosition({top,left});
    }
    function outside(event:PointerEvent) {
      if(event.target instanceof Node && !menuRef.current?.contains(event.target) &&
        !triggerRef.current?.contains(event.target))setExpanded(false);
    }
    function keydown(event:KeyboardEvent) {
      if(event.key==="Escape") {
        event.preventDefault();
        setExpanded(false);
        triggerRef.current?.focus();
      }
    }
    placeMenu();
    menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus();
    document.addEventListener("pointerdown",outside);
    document.addEventListener("scroll",placeMenu,true);
    window.addEventListener("resize",placeMenu);
    window.addEventListener("keydown",keydown);
    return ()=>{
      document.removeEventListener("pointerdown",outside);
      document.removeEventListener("scroll",placeMenu,true);
      window.removeEventListener("resize",placeMenu);
      window.removeEventListener("keydown",keydown);
    };
  },[expanded,canChangeLocation,canUndo]);
  return <article aria-label={`عنصر ${item.serviceName}`}
    className="min-w-0 space-y-2 rounded-lg border border-[#e3e7f0] bg-white px-2.5 py-2.5 shadow-[0_2px_6px_#27396b06]">
    <div className="flex min-w-0 items-start justify-between gap-2">
      <p className="min-w-0 truncate text-[13px] font-bold leading-5"
        title={item.serviceName}>{item.serviceName}</p>
      <StagePill stage={stage}/>
    </div>
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-1 text-[11px]">
      <span className="shrink-0 text-[11px] font-medium text-muted-foreground tabular-nums">الكمية: {item.quantity.toLocaleString("en-US")}</span>
      {(stage===1 || completed) && <span className="inline-flex min-w-0 items-center gap-1 text-muted-foreground"
        aria-label="مسؤول التصميم" title={item.designerName??"غير محدد"}>
        <UserRound className="size-3.5 shrink-0 text-primary" aria-hidden="true"/>
        <span className="shrink-0">المصمم المسؤول</span>
        <span className="min-w-0 truncate font-semibold text-foreground" dir="auto">{item.designerName||"غير محدد"}</span>
      </span>}
    </div>
    {completed && item.designCompletedByName && item.designCompletedByName !== item.designerName &&
      <p className="text-[11px] text-muted-foreground">أنهى التصميم: <span dir="auto">{item.designCompletedByName}</span></p>}
    {stage===3 && <p className="text-[11px] text-muted-foreground">المطبعة: {item.printingLocationName??"—"}</p>}
    <div className="flex min-w-0 items-center gap-1 border-t border-[#edf0f7] pt-2">
      {completed && printSend && <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 text-[11px]"
        title="تحديد للإرسال الجماعي">
        <input type="checkbox" aria-label={`تحديد ${item.serviceName} للإرسال`} checked={selected}
          disabled={busy} onChange={e=>onSelect(item.id,e.target.checked)} /> تحديد
      </label>}
      {stage===1 && may("production.design.complete") && printSend &&
        <Button type="button" size="sm" className="min-w-0 px-1.5 text-[11px]"
          aria-label="إنهاء وإرسال للطباعة" title="إنهاء التصميم وإرسال العنصر للطباعة"
          disabled={busy} onClick={()=>onAction("complete-and-send-to-printing",item)}>إنهاء وإرسال</Button>}
      {stage===1 && may("production.design.complete") &&
        <Button type="button" variant={printSend?"outline":"default"} size="sm"
          className="min-w-0 px-1.5 text-[11px]" aria-label="إنهاء التصميم"
          title="إنهاء التصميم فقط دون نقله للطباعة" disabled={busy}
          onClick={()=>onAction("complete-design",item)}>{printSend?"إنهاء فقط":"إنهاء التصميم"}</Button>}
      {stage===0 && may("production.design.start") &&
        <Button type="button" size="sm" className="min-w-0 px-2 text-[11px]"
          disabled={busy} onClick={()=>onAction("start-design",item)}>بدء التصميم</Button>}
      {completed && printSend &&
        <Button type="button" size="sm" className="min-w-0 px-2 text-[11px]"
          disabled={busy} onClick={()=>onAction("send-to-printing",item)}>إرسال للطباعة</Button>}
      {stage===3 && may("production.printing.complete") &&
        <Button type="button" size="sm" className="min-w-0 px-2 text-[11px]"
          disabled={busy} onClick={()=>onAction("mark-ready",item)}>جاهز للتسليم</Button>}
      <span className="min-w-0 flex-1" aria-hidden="true"/>
      <Button type="button" variant="outline" size="icon-sm" className="shrink-0"
        title="التفاصيل" aria-label="التفاصيل" disabled={busy}
        onClick={()=>onDetails(item)}><Eye className="size-4"/></Button>
      {(canChangeLocation || canUndo) && <div className="shrink-0">
        <Button ref={triggerRef} type="button" variant="outline" size="icon-sm" disabled={busy}
          aria-label={`المزيد للعنصر ${item.id}`} aria-haspopup="menu" aria-controls={expanded?menuId:undefined}
          aria-expanded={expanded} onClick={()=>setExpanded(current=>!current)}>
          <MoreHorizontal className="size-4"/>
        </Button>
        {expanded && createPortal(
          <div ref={menuRef} role="menu" id={menuId} dir="rtl"
            aria-label={`عمليات إضافية للعنصر ${item.id}`}
            className="fixed z-[100] rounded-lg border bg-card p-1 shadow-xl"
            style={{top:menuPosition.top,left:menuPosition.left,width:208}}
            onKeyDown={(event)=>{
              if(event.key!=="ArrowDown"&&event.key!=="ArrowUp"&&event.key!=="Home"&&event.key!=="End")return;
              event.preventDefault();
              const entries=Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')??[]);
              if(!entries.length)return;
              const index=entries.indexOf(document.activeElement as HTMLButtonElement);
              const next=event.key==="Home"?0:event.key==="End"?entries.length-1:
                (index+(event.key==="ArrowDown"?1:-1)+entries.length)%entries.length;
              entries[next].focus();
            }}>
            {canChangeLocation && <button type="button" role="menuitem"
              className="block w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              onClick={()=>{setExpanded(false);onAction("change-location",item);}}>تغيير المطبعة</button>}
            {canUndo && <button type="button" role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-right text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
              onClick={()=>{setExpanded(false);onAction("undo",item);}}>
              <Undo2 className="size-4"/> تراجع خطوة
            </button>}
          </div>,document.body)}
      </div>}
    </div>
  </article>;
}
