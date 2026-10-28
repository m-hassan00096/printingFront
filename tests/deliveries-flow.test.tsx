import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError } from "axios";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";
import type { ReadyOrder, DeliveryRecord } from "@/features/deliveries/types/deliveries.types";
import { estimatedBalance, parseCents, centsToMoney } from "@/features/deliveries/lib/delivery-money";

const original=apiClient.defaults.adapter;
const allPermissions=[
  "deliveries.ready.view","deliveries.list","deliveries.view","deliveries.create",
  "deliveries.cancel","finance.collections.create","finance.balances.view",
  "finance.collections.view","orders.view",
];
let permissions=[...allPermissions];
let failDeliveryValidation=false;
let orders:ReadyOrder[]=[];
let records:DeliveryRecord[]=[];
let calls:{url:string;method:string;body:Record<string,unknown>;query:URLSearchParams;key:string|null}[]=[];
const pages={currentPage:1,lastPage:1,perPage:20,total:0};
const fullyReady:ReadyOrder={
  orderId:10,orderNumber:"ORD-261026001",customerId:7,customerName:"أحمد",
  customerPhone:"01000000000",dueDate:"2026-10-28",orderTotal:"350.00",
  productionStatus:3,productionStatusLabel:"جاهز للتسليم",readyItemsCount:2,totalItemsCount:2,
  isReadyForDelivery:true,canDeliver:true,customerBalance:{amount:"100.00",type:1,typeLabel:"مدين"},
  items:[{id:100,serviceName:"رول أب",quantity:50,productionStage:4,productionStageLabel:"جاهز للتسليم"},
    {id:101,serviceName:"بنر",quantity:10,productionStage:4,productionStageLabel:"جاهز للتسليم"}],
};
const partial:ReadyOrder={
  ...fullyReady,orderId:11,orderNumber:"ORD-261026002",readyItemsCount:1,totalItemsCount:2,
  isReadyForDelivery:false,canDeliver:false,productionStatus:2,productionStatusLabel:"جاهز جزئيًا",
  items:[{id:102,serviceName:"استيكرات",quantity:100,productionStage:4,productionStageLabel:"جاهز للتسليم"},
    {id:103,serviceName:"فلاير",quantity:15,productionStage:3,productionStageLabel:"في الطباعة"}],
};
const delivered:DeliveryRecord={
  id:90,orderId:10,orderNumber:"ORD-261026001",customerId:7,customerName:"أحمد",
  customerPhone:"01000000000",deliveredById:1,deliveredByName:"مدير الفرع",receiverName:"أحمد",
  receivedAmount:"80.00",effectiveReceivedAmount:"80.00",
  collectionId:8,receiptNumber:"R-0008",collectionStatus:1,
  status:1,statusLabel:"تم التسليم",deliveredAt:"2026-10-26T15:00:00+03:00",
  deliveredLocalDate:"2026-10-26",cancelledAt:null,cancelledByName:null,cancellationReason:null,
};
function response(config:InternalAxiosRequestConfig,data:unknown):AxiosResponse {
  return {config,status:200,statusText:"OK",headers:{},data:{success:true,message:"",data}};
}
const adapter:AxiosAdapter=async config=>{
  const url=config.url??"";
  const query=config.params instanceof URLSearchParams?config.params:
    new URLSearchParams(config.params as Record<string,string>);
  const body=typeof config.data==="string"?JSON.parse(config.data) as Record<string,unknown>:{};
  const method=config.method??"get";
  const key=config.headers.get("Idempotency-Key")?.toString()??null;
  calls.push({url,query,body,method,key});
  if(url==="/auth/me") {
    const session:AuthUser={name:"Admin",username:"admin",status:1,statusLabel:"نشط",
      role:"admin",roleAlias:"مدير",permissions};
    return response(config,session);
  }
  if(url==="/deliveries/ready"&&method==="get") {
    let found=orders;
    const search=query.get("filter[search]");
    if(search)found=found.filter(x=>[x.orderNumber,x.customerName,x.customerPhone].some(v=>v.includes(search)));
    const customerId=query.get("filter[customerId]");
    if(customerId)found=found.filter(x=>x.customerId===Number(customerId));
    return response(config,{orders:found,pagination:{...pages,total:found.length}});
  }
  if(url==="/deliveries"&&method==="get") {
    let found=records;
    const status=query.get("filter[status]");
    if(status)found=found.filter(x=>x.status===Number(status));
    const customerId=query.get("filter[customerId]");
    if(customerId)found=found.filter(x=>x.customerId===Number(customerId));
    return response(config,{deliveries:found,pagination:{...pages,total:found.length}});
  }
  if(url==="/deliveries/ready/10") return response(config,{
    order:fullyReady,customerBalance:fullyReady.customerBalance,
    canDeliver:true,canCollect:permissions.includes("finance.collections.create"),
  });
  if(url==="/deliveries/90"&&method==="get")return response(config,{
    delivery:{...delivered,canCancel:permissions.includes("deliveries.cancel"),
      orderTotal:"350.00",collection:{
        id:8,amount:"80.00",receiptNumber:"R-0008",source:2,status:1,statusLabel:"معتمد",
        paymentMethod:0,paymentMethodLabel:"نقدي",paymentDestinationId:null,destinationLabel:null,
      }},
  });
  if(url==="/selects"&&query.get("selects")==="deliveryCustomers")return response(config,[
    {label:"deliveryCustomers",options:
      query.get("params[deliveryCustomers]")==="history"
        ? [{value:7,label:"أحمد - 01000000000"},{value:8,label:"منى - 01122223333"}]
        : [{value:7,label:"أحمد - 01000000000"},{value:8,label:"منى - 01122223333"}]},
  ]);
  if(url==="/selects"&&query.get("selects")==="bankAccounts,eWallets")return response(config,[
    {label:"bankAccounts",options:[{value:3,label:"حساب بنك القاهرة"}]},
    {label:"eWallets",options:[{value:5,label:"محفظة فودافون"}]},
  ]);
  if(url==="/deliveries/orders/10/deliver"&&method==="post") {
    if(failDeliveryValidation) throw new AxiosError("Invalid request","ERR_BAD_REQUEST",config,undefined,{
      ...response(config,null),status:422,statusText:"Unprocessable Entity",
      data:{message:"بيانات التسليم غير صحيحة",errors:{receiverName:["أدخل اسم مستلم صحيحًا."]}},
    });
    orders=orders.filter(o=>o.orderId!==10);
    records=[delivered];
    return response(config,null);
  }
  if(url==="/deliveries/90/cancel"&&method==="post") {
    records=[{...delivered,status:2,statusLabel:"ملغي",effectiveReceivedAmount:"0.00",collectionStatus:2}];
    return response(config,null);
  }
  throw Error("Unexpected request "+method+" "+url);
};
function visit(){window.history.replaceState({},"","/deliveries");return render(<App/>);}
beforeEach(()=>{
  calls=[];failDeliveryValidation=false;permissions=[...allPermissions];orders=[fullyReady,partial];records=[delivered];
  apiClient.defaults.adapter=adapter;
});
afterEach(()=>{apiClient.defaults.adapter=original;});
describe("Deliveries frontend against the existing Laravel contract",()=>{
  it("shows fully and partially ready orders without allowing partial handover",async()=>{
    visit();
    const user=userEvent.setup();
    expect(await screen.findByText(/رول أب · كمية 50/)).toBeTruthy();
    expect(screen.getByText("جاهز جزئيًا")).toBeTruthy();
    expect(screen.getAllByRole("button",{name:"تسليم الأوردر"})).toHaveLength(1);
    await user.click(screen.getByRole("button",{name:"تسليم الأوردر"}));
    const dialog=await screen.findByRole("dialog",{name:"تسليم الأوردر"});
    expect(within(dialog).getByText("350.00 ج.م")).toBeTruthy();
    expect(within(dialog).getByText("2 من 2")).toBeTruthy();
  });
  it("labels the customer name and phone explicitly inside a ready order card",async()=>{
    visit();
    const article=await screen.findByRole("article",{name:"الأوردر ORD-261026001"});
    expect(within(article).getByText("العميل")).toBeTruthy();
    expect(within(article).getByText("الهاتف")).toBeTruthy();
    expect(within(article).getByText("أحمد")).toBeTruthy();
    expect(within(article).getByText("01000000000")).toBeTruthy();
  });

  it("filters ready orders by a searchable customer selection and resets the filter",async()=>{
    orders=[fullyReady,{...partial,customerId:8,customerName:"منى",customerPhone:"01122223333"}];
    visit();const user=userEvent.setup();
    expect(await screen.findByText("أحمد")).toBeTruthy();
    const select=await screen.findByRole("combobox",{name:"العميل"});
    await user.click(select);
    await user.type(select,"0112222");
    await user.click(await screen.findByRole("option",{name:"منى - 01122223333"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/deliveries/ready"&&c.query.get("filter[customerId]")==="8")).toBe(true));
    expect(screen.getByText("منى")).toBeTruthy();
    expect(screen.queryByText("أحمد")).toBeNull();
    await user.click(screen.getByRole("button",{name:"مسح الفلاتر"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/deliveries/ready"&&!c.query.has("filter[customerId]"))).toBe(true));
    expect((screen.getByRole("combobox",{name:"العميل"}) as HTMLInputElement).value).toBe("");
    expect(screen.getByText("أحمد")).toBeTruthy();
  });

  it("filters delivery history by customer independently of customers.view permission",async()=>{
    permissions=["deliveries.list"];
    records=[delivered,{...delivered,id:91,customerId:8,customerName:"منى",customerPhone:"01122223333"}];
    visit();const user=userEvent.setup();
    expect((await screen.findAllByText("مدير الفرع")).length).toBeGreaterThan(0);
    const select=await screen.findByRole("combobox",{name:"العميل"});
    await user.click(select);
    await user.click(await screen.findByRole("option",{name:"منى - 01122223333"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/deliveries"&&c.query.get("filter[customerId]")==="8")).toBe(true));
    expect(screen.getByText("منى")).toBeTruthy();
    expect(screen.queryByText("أحمد")).toBeNull();
    expect(calls.some(c=>c.url==="/customers")).toBe(false);
    expect(calls.some(c=>c.url==="/selects"&&
      c.query.get("params[deliveryCustomers]")==="history")).toBe(true);
    await user.click(screen.getByRole("button",{name:"مسح الفلاتر"}));
    expect((screen.getByRole("combobox",{name:"العميل"}) as HTMLInputElement).value).toBe("");
  });

  it("submits a zero-payment delivery without a separate Finance collection",async()=>{
    visit();const user=userEvent.setup();
    await user.click(await screen.findByRole("button",{name:"تسليم الأوردر"}));
    const modal=await screen.findByRole("dialog",{name:"تسليم الأوردر"});
    await user.click(within(modal).getByRole("button",{name:"تأكيد التسليم"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/deliveries/orders/10/deliver")).toBe(true));
    const post=calls.find(c=>c.url==="/deliveries/orders/10/deliver");
    expect(post?.body).toEqual({receiverName:null,collectedAmount:"0.00"});
    expect(post?.key).toBeTruthy();
    expect(calls.filter(c=>c.method==="post"&&c.url.includes("finance"))).toHaveLength(0);
  });
  it("requires explicit credit approval and correct bank destination before paid delivery",async()=>{
    visit();const user=userEvent.setup();
    await user.click(await screen.findByRole("button",{name:"تسليم الأوردر"}));
    const modal=await screen.findByRole("dialog",{name:"تسليم الأوردر"});
    await user.clear(within(modal).getByRole("textbox",{name:/تحصيل عند التسليم/}));
    await user.type(within(modal).getByRole("textbox",{name:/تحصيل عند التسليم/}),"150.00");
    await user.selectOptions(within(modal).getByRole("combobox",{name:"طريقة التحصيل"}),"1");
    expect(within(modal).getByRole("button",{name:"تأكيد التسليم"}).hasAttribute("disabled")).toBe(true);
    await user.click(within(modal).getByRole("combobox",{name:"حساب التحصيل"}));
    await user.click(await within(modal).findByRole("option",{name:"حساب بنك القاهرة"}));
    expect(within(modal).getByRole("button",{name:"تأكيد التسليم"}).hasAttribute("disabled")).toBe(true);
    await user.click(within(modal).getByRole("checkbox",{name:"تأكيد الرصيد الدائن"}));
    await user.click(within(modal).getByRole("button",{name:"تأكيد التسليم"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/deliveries/orders/10/deliver")).toBe(true));
    const request=calls.find(c=>c.url==="/deliveries/orders/10/deliver");
    expect(request?.body).toEqual({
      receiverName:null,collectedAmount:"150.00",paymentMethod:1,paymentDestinationId:3,
      confirmCreditBalance:true,
    });
  });
  it("clarifies the prior account balance and presets the order amount without auto-posting",async()=>{
    visit();const user=userEvent.setup();
    await user.click(await screen.findByRole("button",{name:"تسليم الأوردر"}));
    const dialog=await screen.findByRole("dialog",{name:"تسليم الأوردر"});
    expect(within(dialog).getByText(/رصيد حساب العميل يشمل جميع الأوردرات/)).toBeTruthy();
    expect(within(dialog).getByRole("region",{name:"ملخص الحساب بعد التسليم"})).toBeTruthy();
    await user.click(within(dialog).getByRole("button",{name:"قيمة الأوردر"}));
    const amount=within(dialog).getByRole("textbox",{name:/تحصيل عند التسليم/}) as HTMLInputElement;
    expect(amount.value).toBe("350.00");
    expect(within(dialog).getByRole("combobox",{name:"طريقة التحصيل"})).toBeTruthy();
    expect(calls.some(c=>c.method==="post"&&c.url.includes("/deliver"))).toBe(false);
    await user.click(within(dialog).getByRole("button",{name:"بدون تحصيل"}));
    expect(amount.value).toBe("0.00");
    expect(within(dialog).queryByRole("combobox",{name:"طريقة التحصيل"})).toBeNull();
  });
  it("keeps ready queue filters compact and resets them together",async()=>{
    visit();const user=userEvent.setup();
    expect(await screen.findByText(/رول أب · كمية 50/)).toBeTruthy();
    expect(screen.getByRole("button",{name:"مسح الفلاتر"}).hasAttribute("disabled")).toBe(true);
    await user.selectOptions(screen.getByRole("combobox",{name:"ترتيب الأوردرات الجاهزة"}),"-id");
    expect(screen.getByRole("button",{name:"مسح الفلاتر"}).hasAttribute("disabled")).toBe(false);
    await user.click(screen.getByRole("button",{name:"مسح الفلاتر"}));
    expect((screen.getByRole("combobox",{name:"ترتيب الأوردرات الجاهزة"}) as HTMLSelectElement).value).toBe("dueDate");
  });
  it("uses theme calendars for the history date range",async()=>{
    visit();const user=userEvent.setup();
    await user.click(await screen.findByRole("tab",{name:"سجل التسليمات"}));
    await user.click(screen.getByRole("button",{name:"من تاريخ"}));
    const calendar=await screen.findByRole("dialog",{name:"اختيار من تاريخ"});
    expect(within(calendar).getByRole("grid")).toBeTruthy();
    expect(screen.queryByRole("textbox",{name:"من تاريخ"})).toBeNull();
  });
  it("shows server field errors below the relevant control and focuses it",async()=>{
    failDeliveryValidation=true;visit();const user=userEvent.setup();
    await user.click(await screen.findByRole("button",{name:"تسليم الأوردر"}));
    const dialog=await screen.findByRole("dialog",{name:"تسليم الأوردر"});
    await user.click(within(dialog).getByRole("button",{name:"تأكيد التسليم"}));
    expect(await within(dialog).findByText("أدخل اسم مستلم صحيحًا.")).toBeTruthy();
    const receiver=within(dialog).getByRole("textbox",{name:"اسم المستلم (اختياري)"});
    await waitFor(()=>expect(document.activeElement).toBe(receiver));
    expect(receiver.getAttribute("aria-invalid")).toBe("true");
    expect(within(dialog).getByRole("button",{name:"تأكيد التسليم"})).toBeTruthy();
  });
  it("filters historical deliveries with canonical date and status params",async()=>{
    visit();const user=userEvent.setup();
    await user.click(await screen.findByRole("tab",{name:"سجل التسليمات"}));
    expect(await screen.findByText("مدير الفرع")).toBeTruthy();
    await user.selectOptions(screen.getByRole("combobox",{name:"حالة التسليم"}),"2");
    await waitFor(()=>expect(calls.some(c=>c.url==="/deliveries"&&c.query.get("filter[status]")==="2")).toBe(true));
  });
  it("requires cancellation reason and physical funds confirmation before reversing linked collection",async()=>{
    visit();const user=userEvent.setup();
    await user.click(await screen.findByRole("tab",{name:"سجل التسليمات"}));
    await user.click(await screen.findByRole("button",{name:"التفاصيل"}));
    const modal=await screen.findByRole("dialog",{name:"تفاصيل التسليم"});
    await user.click(within(modal).getByRole("button",{name:"إلغاء التسليم"}));
    await user.type(within(modal).getByRole("textbox",{name:/سبب الإلغاء/}),"طلب العميل");
    expect(within(modal).getByRole("button",{name:"تأكيد إلغاء التسليم"}).hasAttribute("disabled")).toBe(true);
    await user.click(within(modal).getByRole("checkbox",{name:"تأكيد التسوية الفعلية للأموال"}));
    await user.click(within(modal).getByRole("button",{name:"تأكيد إلغاء التسليم"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/deliveries/90/cancel")).toBe(true));
    const request=calls.find(c=>c.url==="/deliveries/90/cancel");
    expect(request?.body).toEqual({reason:"طلب العميل",fundsReturnConfirmed:true});
    expect(request?.key).toBeTruthy();
    expect(calls.filter(c=>c.url.includes("/finance/"))).toHaveLength(0);
  });
  it("hides unauthorized ready queue and financial actions",async()=>{
    permissions=["deliveries.list"];visit();
    expect(await screen.findByText("مدير الفرع")).toBeTruthy();
    expect(screen.queryByRole("tab",{name:"جاهزة للتسليم"})).toBeNull();
    expect(screen.queryByRole("button",{name:"التفاصيل"})).toBeNull();
    expect(calls.some(c=>c.url==="/deliveries/ready")).toBe(false);
  });
});
describe("Delivery cents and balance estimates",()=>{
  it("computes debit, credit and zero precisely",()=>{
    expect(parseCents("100.01")).toBe(10001);
    expect(parseCents("0.001")).toBeNull();
    expect(centsToMoney(10001)).toBe("100.01");
    expect(estimatedBalance({type:1,typeLabel:"مدين",amount:"100.00"},"150.00")).toBe(-5000);
    expect(estimatedBalance({type:2,typeLabel:"دائن",amount:"20.00"},"10.00")).toBe(-3000);
  });
});
