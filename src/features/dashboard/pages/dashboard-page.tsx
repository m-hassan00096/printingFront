import { Link, Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowUpLeft, CalendarDays, CheckCircle2, ClipboardList,
  Factory, Layers3, Plus, RefreshCw, Truck, Wallet, Clock3,
} from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { SectionHeader, LoadingState, ErrorState } from "@/features/identity/components/identity-ui";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { formatCollectionDate } from "@/features/collections/components/collection-date-field";
import { dashboardKey,useDashboard } from "../hooks/use-dashboard";
import type { DashboardData,DashboardOrder } from "../types/dashboard.types";

const integer = (n:number)=>n.toLocaleString("ar-EG");
function DateLabel({value}:{value:string|null}){
  return <span className="tabular-nums">{value?formatCollectionDate(value):"بدون موعد"}</span>;
}
function MetricCard({label,value,detail,icon:Icon,tone}:{
  label:string;value:number;detail:string;icon:typeof ClipboardList;
  tone:"blue"|"red"|"green"|"amber";
}){
  const colors={
    blue:"bg-primary/10 text-[#4d5ac6]",
    red:"bg-[#fff0f2] text-[#c8384a]",
    green:"bg-[#e5f7ee] text-[#147c58]",
    amber:"bg-[#fff5df] text-[#a36a0d]",
  };
  return <article className="rounded-xl border border-border bg-card p-5 shadow-[0_6px_25px_#26396c08] sm:p-6">
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className={"flex size-10 items-center justify-center rounded-lg "+colors[tone]}>
        <Icon className="size-5" aria-hidden="true"/>
      </span>
    </div>
    <div className="mt-4 text-[28px] font-bold leading-9 tracking-tight tabular-nums">{integer(value)}</div>
    <p className="mt-1 text-[11px] text-muted-foreground">{detail}</p>
  </article>;
}
function SectionTitle({title,detail,link,label}:{title:string;detail:string;link?:string;label?:string}){
  return <div className="flex flex-wrap items-start justify-between gap-3">
    <div><h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1 text-xs text-foreground/65">{detail}</p></div>
    {link&&<Link to={link} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
      {label??"عرض الكل"} <ArrowUpLeft className="size-3.5"/>
    </Link>}
  </div>;
}
function OrderSummary({order,allowView}:{order:DashboardOrder;allowView:boolean}){
  const content=<>
    <div className="flex min-w-0 flex-1 items-center gap-3">
      <span className={"flex size-9 shrink-0 items-center justify-center rounded-xl "+
        (order.isOverdue?"bg-[#fff0f2] text-[#c8384a]":"bg-secondary text-primary")}>
        {order.isOverdue?<AlertTriangle className="size-4"/>:<ClipboardList className="size-4"/>}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold">
          <span dir="ltr" className="inline-block font-mono text-xs">{order.orderNumber??"أوردر"}</span>
          <span className="mx-1 text-foreground/30">·</span>{order.customerName}
        </p>
        <p className="mt-1 text-xs text-foreground/65">
          موعد التسليم: <DateLabel value={order.dueDate}/>
        </p>
      </div>
    </div>
    <span className={"shrink-0 rounded-lg px-2 py-1 text-[11px] font-bold "+
      (order.isOverdue?"bg-[#fff0f2] text-[#c8384a]":"bg-muted text-foreground/70")}>
      {order.isOverdue?"متأخر":order.productionStatusLabel??"قيد المتابعة"}
    </span>
    {allowView&&<ArrowUpLeft className="size-4 shrink-0 text-muted-foreground"/>}
  </>;
  return allowView
    ? <Link to={`/orders/${order.id}`} className="flex items-center gap-2 rounded-lg px-2 py-3 transition-colors hover:bg-muted/40">{content}</Link>
    : <div className="flex items-center gap-2 px-2 py-3">{content}</div>;
}
function PressureCard({data,canProduction}:{data:DashboardData["productionPressure"];canProduction:boolean}){
  const stages=[
    {name:"لم يبدأ",value:data.notStarted,bar:"bg-muted-foreground"},
    {name:"التصميم",value:data.design,bar:"bg-[#7580e0]"},
    {name:"الطباعة",value:data.printing,bar:"bg-primary/100"},
    {name:"جاهز للتسليم",value:data.ready,bar:"bg-[#e5f7ee]0"},
  ];
  const max=Math.max(...stages.map(s=>s.value),1);
  const total=stages.reduce((sum,s)=>sum+s.value,0);
  return <section aria-label="ضغط الإنتاج" className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-[0_6px_25px_#26396c08] sm:p-6">
    <SectionTitle title="ضغط الإنتاج" detail="عدد بنود الطلبات النشطة في كل مرحلة"
      link={canProduction?"/production":undefined} label="فتح لوحة الإنتاج"/>
    <div className="space-y-3">
      {stages.map(stage=><div key={stage.name} className="grid grid-cols-[90px_minmax(0,1fr)_42px] items-center gap-2 sm:grid-cols-[105px_minmax(0,1fr)_48px]">
        <span className="text-xs font-semibold text-foreground/75">{stage.name}</span>
        <div className="h-2.5 overflow-hidden rounded-full bg-muted" role="meter"
          aria-label={stage.name} aria-valuenow={stage.value} aria-valuemin={0} aria-valuemax={max}>
          <div className={"h-full rounded-full "+stage.bar} style={{width:`${stage.value/max*100}%`}}/>
        </div>
        <span className="text-start text-xs font-bold tabular-nums">{integer(stage.value)}</span>
      </div>)}
    </div>
    <p className="border-t pt-3 text-xs text-foreground/65">
      إجمالي البنود: <strong className="text-foreground">{integer(total)}</strong> · العدد لا يمثل كمية النسخ المطبوعة
    </p>
  </section>;
}
function QuickActions({permissions}:{permissions:readonly string[]}){
  const links=[
    {label:"أوردر جديد",to:"/orders/new",icon:Plus,allow:permissions.includes("orders.create")},
    {label:"لوحة الإنتاج",to:"/production",icon:Factory,allow:permissions.includes("production.items.list")},
    {label:"التسليمات",to:"/deliveries",icon:Truck,allow:permissions.some(p=>["deliveries.ready.view","deliveries.list"].includes(p))},
    {label:"التحصيلات",to:"/collections",icon:Wallet,allow:permissions.some(p=>["finance.collections.view","finance.collections.create"].includes(p))},
  ].filter(x=>x.allow);
  if(!links.length)return null;
  return <section aria-label="إجراءات سريعة" className="space-y-3 rounded-lg border bg-card p-4  sm:p-5">
    <SectionTitle title="إجراءات سريعة" detail="اختصارات لمهامك اليومية"/>
    <div className="grid grid-cols-2 gap-2">
      {links.map(link=><Link to={link.to} key={link.to} className="flex min-h-20 flex-col justify-between rounded-lg border border-[#e8ebf5] bg-[#fafbff] p-3 text-sm font-semibold hover:border-primary/35 hover:bg-muted/30">
        <link.icon className="size-5 text-primary" aria-hidden="true"/>
        <span>{link.label}</span>
      </Link>)}
    </div>
  </section>;
}
export function DashboardPage(){
  const session=useCurrentUser();
  const permissions=session.data?.permissions??[];
  const canOrders=permissions.includes("orders.list");
  const canOrderDetail=permissions.includes("orders.view");
  const canProduction=permissions.includes("production.items.list");
  const query=useDashboard(canOrders);
  const qc=useQueryClient();
  const data=query.data;
  // Designers work only in production; skip the order KPI home page entirely.
  if(!canOrders&&canProduction)return <Navigate to="/production" replace/>;
  return <div className="space-y-5">
    <SectionHeader title="لوحة التحكم" detail="ملخص العمل اليومي، الأوردرات التي تحتاج متابعة، وحالة الإنتاج."
      actions={<div className="flex flex-wrap gap-2">
        <Button variant="outline" type="button" onClick={()=>void qc.invalidateQueries({queryKey:dashboardKey})}
          disabled={!canOrders||query.isFetching}>
          <RefreshCw className={"size-4 "+(query.isFetching?"animate-spin":"")}/> تحديث
        </Button>
        {permissions.includes("orders.create")&&<Button asChild><Link to="/orders/new"><Plus className="size-4"/> أوردر جديد</Link></Button>}
      </div>}/>
    {!canOrders&&<div className="rounded-lg border bg-card p-6 text-sm text-foreground/75">
      ملخص الأوردرات يحتاج صلاحية عرض قائمة الأوردرات. الاختصارات المتاحة لك موجودة أدناه.
    </div>}
    {canOrders&&(query.isPending?<LoadingState/>:query.isError?
      <ErrorState error={query.error} retry={()=>void query.refetch()}/>:
      data&&<>
        <div className="flex flex-wrap items-center gap-2 text-xs text-foreground/65">
          <Clock3 className="size-4"/> تحديث البيانات حسب تاريخ القاهرة: <DateLabel value={data.asOfDate}/>
        </div>
        <section aria-label="المؤشرات الرئيسية" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="الأوردرات النشطة" value={data.metrics.activeOrders}
            detail="مؤكدة ولم يتم تسليمها" icon={ClipboardList} tone="blue"/>
          <MetricCard label="الأوردرات المتأخرة" value={data.metrics.overdueOrders}
            detail="تجاوزت موعد التسليم" icon={AlertTriangle} tone="red"/>
          <MetricCard label="جاهزة للتسليم" value={data.metrics.readyForDelivery}
            detail="بانتظار التسليم الفعلي" icon={CheckCircle2} tone="green"/>
          <Link to="/orders?readyDueToday=1" aria-label={uiMessages.orders.dashboardReadyDueTodayLink}
            className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
            <MetricCard label={uiMessages.orders.readyDueTodayDashboard} value={data.metrics.readyDueToday}
              detail={uiMessages.orders.readyDueTodayDetail} icon={CalendarDays} tone="amber"/>
          </Link>
        </section>
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(310px,1fr)]">
          <div className="space-y-4">
            <section aria-label="أوردرات تحتاج المتابعة" className="rounded-lg border bg-card p-4  sm:p-5">
              <SectionTitle title="أوردرات تحتاج المتابعة" detail="الأقرب في موعد التسليم، مع إظهار المتأخر أولًا"
                link="/orders?lateOnly=1" label="عرض المتأخرة"/>
              {data.attentionOrders.length
                ? <div className="mt-3 divide-y">{data.attentionOrders.map(o=>
                    <OrderSummary order={o} allowView={canOrderDetail} key={o.id}/>)}</div>
                : <div className="mt-3 rounded-xl border border-dashed p-6 text-center text-sm text-foreground/65">
                    لا توجد أوردرات بمواعيد تسليم تحتاج المتابعة حاليًا.
                  </div>}
            </section>
            <section aria-label="آخر الأوردرات" className="overflow-hidden rounded-lg border bg-card ">
              <div className="p-4 sm:p-5">
                <SectionTitle title="آخر الأوردرات" detail="أحدث الأوردرات المؤكدة" link="/orders"/>
              </div>
              {data.latestOrders.length?<div className="overflow-x-auto">
                <table className="w-full min-w-[570px] text-right text-sm">
                  <thead className="bg-muted/50 text-xs text-foreground/65">
                    <tr>{["الأوردر","العميل","موعد التسليم","حالة الإنتاج"].map(h=>
                      <th key={h} className="px-4 py-3 font-mono text-xs font-medium">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y">{data.latestOrders.map(o=><tr key={o.id} className="hover:bg-muted/30">
                    <td className="px-4 py-3 font-mono text-xs font-semibold">{canOrderDetail?<Link className="text-[#4d5ac6] hover:underline"
                      to={`/orders/${o.id}`}>{o.orderNumber??`#${o.id}`}</Link>:
                      o.orderNumber??`#${o.id}`}</td>
                    <td className="px-4 py-3">{o.customerName}</td>
                    <td className="whitespace-nowrap px-4 py-3"><DateLabel value={o.dueDate}/></td>
                    <td className="px-4 py-3"><span className={"rounded-lg px-2 py-1 text-xs font-semibold "+
                      (o.isOverdue?"bg-[#fff0f2] text-[#c8384a]":"bg-muted text-foreground/75")}>
                      {o.productionStatusLabel??"—"}</span></td>
                  </tr>)}</tbody>
                </table>
              </div>:<div className="p-6 text-center text-sm text-foreground/65">لا توجد أوردرات مؤَكدة حتى الآن.</div>}
            </section>
          </div>
          <div className="space-y-4">
            <PressureCard data={data.productionPressure} canProduction={canProduction}/>
            <QuickActions permissions={permissions}/>
            <div className="flex items-start gap-2 rounded-xl border border-primary/10 bg-primary/5 p-3 text-xs leading-6 text-foreground/70">
              <Layers3 className="mt-1 size-4 shrink-0 text-primary"/>
              المؤشرات مبنية على بيانات النظام المسجلة فقط؛ ولا تشمل المسودات أو الأوردرات الملغاة ضمن النشطة.
            </div>
          </div>
        </div>
      </>)}
    {!canOrders&&<QuickActions permissions={permissions}/>}
  </div>;
}
