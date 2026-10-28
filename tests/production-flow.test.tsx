import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";
import type { ProductionItem, ProductionStage } from "@/features/production/types/production.types";

const allPermissions=[
  "production.items.list","production.summary.view","production.history.view",
  "production.design.start","production.design.complete","production.printing.send",
  "production.printing.change_location","production.printing.complete","production.items.undo",
];
let permissions=[...allPermissions];
const originalAdapter=apiClient.defaults.adapter;
const pagination={currentPage:1,lastPage:1,perPage:20,total:1};
type Call={url:string;method:string;query:URLSearchParams;body:Record<string,unknown>;key:string|null};
let calls:Call[]=[];
let items:ProductionItem[]=[];
let histories:Record<number,unknown[]>= {};
function response(config:InternalAxiosRequestConfig, data:unknown, status=200):AxiosResponse {
  return {config,status,statusText:String(status),headers:{},data:{success:true,message:"",data}};
}
const adapter:AxiosAdapter=async(config)=>{
  const url=config.url??"";
  const query=config.params instanceof URLSearchParams ? config.params :
    new URLSearchParams(config.params as Record<string,string>);
  const body=typeof config.data==="string" ? JSON.parse(config.data) as Record<string,unknown> : {};
  const key=config.headers.get("Idempotency-Key")?.toString()??null;
  calls.push({url,query,body,method:config.method??"",key});
  if(url==="/auth/me") {
    const user:AuthUser={name:"Admin",username:"admin",role:"admin",roleAlias:"مدير النظام",
      status:1,statusLabel:"نشط",permissions};
    return response(config,user);
  }
  if(url==="/selects"&&query.get("selects")==="activeCustomers,printingServices,printingLocations") return response(config,[
    {label:"activeCustomers",options:[{value:5,label:"أحمد"},{value:6,label:"محمد"}]},
    {label:"printingServices",options:[{value:101,label:"رول أب"},{value:103,label:"كروت شخصية"}]},
    {label:"printingLocations",options:[{value:7,label:"المطبعة الرئيسية"},{value:8,label:"فرع آخر"}]},
  ]);
  if(url==="/production/summary") {
    const service=query.get("filter[serviceId]");
    const customer=query.get("filter[customerId]");
    const matching=items.filter(item=>(!service||item.serviceId===Number(service))&&
      (!customer||item.customerId===Number(customer)));
    const count=(stage:number)=>matching.filter(item=>item.productionStage===stage).length;
    return response(config,{
      notStartedCount:count(0), designInProgressCount:count(1),designCompletedCount:count(2),
      printingCount:count(3),readyCount:count(4),lateOrdersCount:1,
    });
  }
  if(url==="/production/items"&&config.method==="get") {
    const col=query.get("filter[column]")??"0";
    const stages=col==="0"?[0]:col==="1"?[1,2]:col==="2"?[3]:[4];
    let filtered=items.filter(item=>stages.includes(item.productionStage));
    const customer=query.get("filter[customerId]");
    if(customer) filtered=filtered.filter(item=>item.customerId===Number(customer));
    const service=query.get("filter[serviceId]");
    if(service) filtered=filtered.filter(item=>item.serviceId===Number(service));
    if(query.get("filter[lateOnly]")==="1")filtered=filtered.filter(item=>item.isLate);
    const search=(query.get("filter[search]")??"").trim();
    if(search)filtered=filtered.filter(item=>[item.orderNumber,item.customerName,item.customerPhone,item.serviceName].some(s=>s.includes(search)));
    return response(config,{items:filtered,pagination:{...pagination,total:filtered.length}});
  }
  const details=url.match(new RegExp("^/production/items/([0-9]+)/details$"));
  if(details){
    const item=items.find(x=>x.id===Number(details[1]));
    if(!item)throw Error("Unknown item");
    return response(config,{
      id:item.id,orderId:item.orderId,serviceName:item.serviceName,quantity:item.quantity,
      specifications:"وجه وظهر، ورق 300 جرام",
      files:[{id:1,name:"design.pdf",extension:"pdf",mimeType:"application/pdf",sizeBytes:1234,
        url:"http://localhost:8000/storage/orders/101/102/design.pdf",createdAt:null}],
    });
  }
  const history=url.match(/^\/production\/items\/(\d+)\/history$/);
  if(history) return response(config,{events:histories[Number(history[1])]??[],pagination});
  const action=url.match(/^\/production\/items\/(\d+)\/(start-design|complete-design|complete-and-send-to-printing|send-to-printing|printing-location|mark-ready|undo)$/);
  if(action) {
    const item=items.find(x=>x.id===Number(action[1]));
    if(!item)throw Error("Unknown item");
    const previous=item.productionStage;
    const target:ProductionStage=action[2]==="start-design"?1:action[2]==="complete-design"?2:
      action[2]==="complete-and-send-to-printing"||action[2]==="send-to-printing"?3:
      action[2]==="mark-ready"?4:action[2]==="undo"?
        (previous===4?3:previous===3?1:previous===2?1:0):previous;
    item.productionStage=target;
    if(typeof body.printingLocationId==="number")item.printingLocationId=body.printingLocationId;
    if(action[2]==="undo"&&previous===3)item.printingLocationId=null;
    return response(config,null);
  }
  if(url==="/production/items/send-to-printing"&&config.method==="post") {
    const ids=body.orderItemIds as number[];
    for(const item of items)if(ids.includes(item.id)){
      item.productionStage=3;item.printingLocationId=Number(body.printingLocationId);
    }
    return response(config,null);
  }
  throw Error(`Unmocked production request: ${config.method} ${url}`);
};
function fixture(id:number,productionStage:ProductionStage,orderId:number,serviceName:string):ProductionItem {
  return {id,orderId,orderNumber:`ORD-2026-${orderId}`,customerId:5,customerName:"أحمد",
    customerPhone:"01012345678",serviceId:id,serviceName,quantity:50,dueDate:"2026-10-27",isLate:false,
    productionStage,productionStageLabel:"",designerId:productionStage?1:null,
    designerName:productionStage?"محمد":null,designCompletedById:null,designCompletedByName:null,
    printingLocationId:productionStage>=3?7:null,printingLocationName:productionStage>=3?"المطبعة الرئيسية":null};
}
function visit() {window.history.replaceState({},"","/production");return render(<App/>);}
beforeEach(()=>{
  permissions=[...allPermissions];calls=[];
  items=[
    fixture(101,0,100,"رول أب"),
    fixture(102,1,101,"بنر"),
    fixture(103,2,101,"كروت شخصية"),
    fixture(104,3,102,"استيكرات"),
    fixture(105,4,102,"بوستر"),
    fixture(106,2,103,"فلاير"),
  ];
  histories={103:[{id:1,orderItemId:103,eventType:2,eventTypeLabel:"تم إنهاء التصميم",
    actorId:1,actorName:"محمد",fromStage:1,toStage:2,oldPrintingLocationId:null,newPrintingLocationId:null,
    oldPrintingLocationName:null,newPrintingLocationName:null,createdAt:"2026-10-25T12:00:00+00:00"}]};
  apiClient.defaults.adapter=adapter;
});
afterEach(()=>{apiClient.defaults.adapter=originalAdapter;});

describe("Production board against Laravel API contracts",()=>{
  it("loads independent board columns and accurate summary counts",async()=>{
    visit();
    expect(await screen.findByRole("heading",{name:"لوحة الإنتاج"})).toBeTruthy();
    expect(await screen.findByText("رول أب")).toBeTruthy();
    await waitFor(()=>expect(calls.filter(c=>c.url==="/production/items").length).toBeGreaterThanOrEqual(4));
    expect(new Set(calls.filter(c=>c.url==="/production/items").map(c=>c.query.get("filter[column]"))))
      .toEqual(new Set(["0","1","2","3"]));
    expect(await screen.findByText("تصميم مكتمل")).toBeTruthy();
    expect(screen.getByRole("link",{name:"الإنتاج"})).toBeTruthy();
  });

  it("defaults to operational priority and offers explicit chronological alternatives", async()=>{
    visit();await screen.findByText("رول أب");
    await waitFor(()=>expect(calls.some(c=>c.url==="/production/items"
      && c.query.get("sort")==="priority")).toBe(true));
    const sort=screen.getByRole("combobox",{name:"ترتيب عناصر الإنتاج"});
    expect((sort as HTMLSelectElement).value).toBe("priority");
    expect(within(sort).getByRole("option",{name:"الأولوية التشغيلية"})).toBeTruthy();
    const user=userEvent.setup();
    await user.selectOptions(sort,"-dueDate");
    await waitFor(()=>expect(calls.some(c=>c.url==="/production/items"
      && c.query.get("sort")==="-dueDate")).toBe(true));
    await user.click(screen.getByRole("button",{name:"مسح الفلاتر"}));
    expect((sort as HTMLSelectElement).value).toBe("priority");
  });

  it("marks overdue and Cairo-due-today orders distinctly on their cards",async()=>{
    const parts=new Intl.DateTimeFormat("en-GB",{
      timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit",
    }).formatToParts(new Date());
    const part=(type:string)=>parts.find(x=>x.type===type)?.value??"";
    items[0].dueDate=`${part("year")}-${part("month")}-${part("day")}`;
    items[0].isLate=false;
    items[1].isLate=true;
    visit();
    const notStarted=await screen.findByRole("region",{name:"عمود لم يبدأ"});
    expect(await within(notStarted).findByText("تسليم اليوم")).toBeTruthy();
    const design=screen.getByRole("region",{name:"عمود التصميم"});
    expect(await within(design).findByText("متأخر")).toBeTruthy();
    expect(within(design).queryByText("تسليم اليوم")).toBeNull();
  });

  it("groups four stage KPIs and lets an operator apply overdue filter via the metric",async()=>{
    visit();await screen.findByText("رول أب");
    const overview=await screen.findByRole("region",{name:"ملخص مراحل الإنتاج"});
    expect(within(overview).getByText("التصميم")).toBeTruthy();
    expect(within(overview).getByText("جارٍ")).toBeTruthy();
    expect(within(overview).getByText("مكتمل")).toBeTruthy();
    const user=userEvent.setup();
    const overdue=within(overview).getByRole("button",{name:"عرض الأوردرات المتأخرة فقط"});
    await user.click(overdue);
    expect(overdue.getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("checkbox",{name:"المتأخرة فقط"}) as HTMLInputElement).checked).toBe(true);
    await waitFor(()=>expect(calls.some(c=>c.url==="/production/items" &&
      c.query.get("filter[lateOnly]")==="1")).toBe(true));
  });

  it("starts design using authenticated actor and a fresh idempotency key",async()=>{
    visit();const user=userEvent.setup();
    await user.click(await screen.findByRole("button",{name:"بدء التصميم"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/production/items/101/start-design")).toBe(true));
    const request=calls.find(c=>c.url==="/production/items/101/start-design");
    expect(request?.body).toEqual({});
    expect(request?.key?.length).toBeGreaterThan(0);
    expect(items.find(x=>x.id===101)?.productionStage).toBe(1);
  });

  it("allows completing design in place without requiring a printing location",async()=>{
    visit();const user=userEvent.setup();
    await user.click(await screen.findByRole("button",{name:"إنهاء التصميم",exact:true}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/production/items/102/complete-design")).toBe(true));
    expect(calls.find(c=>c.url==="/production/items/102/complete-design")?.body).toEqual({});
    expect(items.find(x=>x.id===102)?.productionStage).toBe(2);
  });

  it("selects an active printing location before sending a completed item",async()=>{
    visit();const user=userEvent.setup();
    await user.click((await screen.findAllByRole("button",{name:"إرسال للطباعة"}))[0]);
    const dialog=await screen.findByRole("dialog",{name:"إرسال للطباعة"});
    expect(within(dialog).getByRole("button",{name:"تأكيد العملية"}).hasAttribute("disabled")).toBe(true);
    await user.click(within(dialog).getByRole("combobox",{name:"اختيار المطبعة"}));
    await user.click(within(dialog).getByRole("option",{name:"المطبعة الرئيسية"}));
    await user.click(within(dialog).getByRole("button",{name:"تأكيد العملية"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/production/items/103/send-to-printing")).toBe(true));
    expect(calls.find(c=>c.url==="/production/items/103/send-to-printing")?.body).toEqual({printingLocationId:7});
  });

  it("sends completed design items across different orders as one atomic batch",async()=>{
    visit();const user=userEvent.setup();
    await user.click((await screen.findAllByRole("checkbox",{name:/للإرسال/}))[0]);
    await user.click((await screen.findAllByRole("checkbox",{name:/للإرسال/}))[1]);
    await user.click(screen.getByRole("button",{name:"إرسال المحدد للطباعة"}));
    const dialog=await screen.findByRole("dialog",{name:"إرسال العناصر المحددة للطباعة"});
    await user.click(within(dialog).getByRole("combobox",{name:"اختيار المطبعة"}));
    await user.click(within(dialog).getByRole("option",{name:"المطبعة الرئيسية"}));
    await user.click(within(dialog).getByRole("button",{name:"تأكيد العملية"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/production/items/send-to-printing")).toBe(true));
    expect(calls.find(c=>c.url==="/production/items/send-to-printing")?.body)
      .toEqual({orderItemIds:[103,106],printingLocationId:7});
    expect(calls.find(c=>c.url==="/production/items/send-to-printing")?.key).toBeTruthy();
  });

  it("displays item history on demand with Arabic audit text",async()=>{
    visit();const user=userEvent.setup();
    const design=await screen.findByRole("region",{name:"عمود التصميم"});
    await user.click(within(design).getAllByRole("button",{name:"التفاصيل"})[1]);
    const dialog=await screen.findByRole("dialog",{name:"تفاصيل عنصر الإنتاج"});
    await user.click(within(dialog).getByRole("tab",{name:"سجل الحركات"}));
    expect(await within(dialog).findByText("تم إنهاء التصميم")).toBeTruthy();
    expect(within(dialog).getByText("من قيد التصميم إلى تم التصميم")).toBeTruthy();
    expect(within(dialog).queryByText("1 ← 2")).toBeNull();
    expect(calls.some(c=>c.url==="/production/items/103/history")).toBe(true);
  });

  it("keeps the API quantity identical on a Kanban card and in its details",async()=>{
    visit();const user=userEvent.setup();
    const design=await screen.findByRole("region",{name:"عمود التصميم"});
    const card=await within(design).findByRole("article",{name:"عنصر بنر"});
    expect(within(card).getByText("الكمية: 50")).toBeTruthy();
    await user.click(within(card).getByRole("button",{name:"التفاصيل"}));
    const dialog=await screen.findByRole("dialog",{name:"تفاصيل عنصر الإنتاج"});
    expect(within(dialog).getByText("50")).toBeTruthy();
  });

  it("shows production-only designers the item specifications and files without order access",async()=>{
    permissions=["production.items.list","production.summary.view","production.history.view",
      "production.design.start","production.design.complete","production.printing.send",
      "production.printing.change_location","production.printing.complete"];
    visit();const user=userEvent.setup();
    const design=await screen.findByRole("region",{name:"عمود التصميم"});
    const card=await within(design).findByRole("article",{name:"عنصر بنر"});
    await user.click(within(card).getByRole("button",{name:"التفاصيل"}));
    const dialog=await screen.findByRole("dialog",{name:"تفاصيل عنصر الإنتاج"});
    expect(await within(dialog).findByText("وجه وظهر، ورق 300 جرام")).toBeTruthy();
    const link=within(dialog).getByRole("link",{name:"فتح الملف"});
    expect(link.getAttribute("href")).toContain("/storage/orders/");
    expect(within(dialog).getByText("design.pdf")).toBeTruthy();
    expect(within(dialog).queryByRole("link",{name:"فتح الأوردر"})).toBeNull();
    expect(calls.some(c=>c.url==="/production/items/102/details")).toBe(true);
    expect(calls.some(c=>c.url.startsWith("/orders/"))).toBe(false);
    expect(screen.queryByRole("link",{name:"التسليمات"})).toBeNull();
  });

  it("does not render unusable paging arrows on single-page or empty columns",async()=>{
    visit();
    const design=await screen.findByRole("region",{name:"عمود التصميم"});
    expect(await within(design).findByText("بنر")).toBeTruthy();
    expect(within(design).queryByRole("button",{name:"الصفحة التالية"})).toBeNull();
    const ready=screen.getByRole("region",{name:"عمود جاهز للتسليم"});
    expect(within(ready).queryByRole("button",{name:"الصفحة التالية"})).toBeNull();
  });

  it("hides unauthorized production transitions and history controls",async()=>{
    permissions=["production.items.list"];
    visit();
    expect(await screen.findByText("رول أب")).toBeTruthy();
    expect(screen.queryByRole("button",{name:"بدء التصميم"})).toBeNull();
    expect(screen.queryByRole("button",{name:"إرسال للطباعة"})).toBeNull();
    const user=userEvent.setup();
    await user.click((await screen.findAllByRole("button",{name:"التفاصيل"}))[0]);
    const dialog=await screen.findByRole("dialog",{name:"تفاصيل عنصر الإنتاج"});
    expect(within(dialog).queryByRole("tab",{name:"سجل الحركات"})).toBeNull();
    expect(calls.some(c=>c.url==="/production/summary")).toBe(false);
  });

  it("filters production cards and summary counts by selected searchable printing service", async()=>{
    visit();
    const user=userEvent.setup();
    expect(await screen.findByText("رول أب")).toBeTruthy();
    await user.click(screen.getByRole("combobox",{name:"تصفية حسب الخدمة"}));
    await user.click(await screen.findByRole("option",{name:"كروت شخصية"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/production/items" &&
      c.query.get("filter[serviceId]")==="103")).toBe(true));
    await waitFor(()=>expect(calls.some(c=>c.url==="/production/summary" &&
      c.query.get("filter[serviceId]")==="103")).toBe(true));
    const design=screen.getByRole("region",{name:"عمود التصميم"});
    expect(await within(design).findByText("كروت شخصية")).toBeTruthy();
    await waitFor(()=>expect(within(design).queryByText("بنر")).toBeNull());
    expect(within(design).queryByText("فلاير")).toBeNull();
    // Changing this filter clears page selection and supports resetting all filters.
    await user.click(screen.getByRole("button",{name:"مسح الفلاتر"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/production/items" &&
      c.query.has("filter[serviceId]")===false)).toBe(true));
    expect(screen.getByRole("combobox",{name:"تصفية حسب الخدمة"}).getAttribute("value")??"").toBe("");
  });

  it("passes customer, late-only and personal-work filters exactly as required",async()=>{
    visit();const user=userEvent.setup();
    await screen.findByText("رول أب");
    await user.click(screen.getByRole("checkbox",{name:"المتأخرة فقط"}));
    await user.selectOptions(screen.getByRole("combobox",{name:"عملي في التصميم"}),"2");
    await waitFor(()=>expect(calls.some(c=>c.url==="/production/items" &&
      c.query.get("filter[lateOnly]")==="1"&&c.query.get("filter[myDesignWork]")==="2")).toBe(true));
    await user.click(screen.getByRole("combobox",{name:"تصفية حسب العميل"}));
    await user.click(screen.getByRole("option",{name:"أحمد"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/production/items"&&
      c.query.get("filter[customerId]")==="5")).toBe(true));
  });
});
