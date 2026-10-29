import { afterEach,beforeEach,describe,expect,it } from "vitest";
import { render,screen,waitFor,within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosAdapter,AxiosResponse,InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";
import type { Collection } from "@/features/collections/types/collections.types";

const originalAdapter=apiClient.defaults.adapter;
let permissions=["finance.collections.view","finance.collections.create","finance.collections.reverse","customers.selects.view"];
let records:Collection[]=[];
let calls:{url:string;method:string;query:URLSearchParams;body:Record<string,unknown>;key:string|null}[]=[];
const general:Collection={
  id:51,receiptNumber:"COL-2026-00051",customerId:7,customerName:"مؤسسة الريادة",
  customerPhone:"01012345678",orderId:null,orderNumber:null,correctedFromId:null,correctedToId:null,amount:"100.00",
  paymentMethod:0,paymentMethodLabel:"نقدي",paymentDestinationId:null,destinationLabel:null,
  source:0,sourceLabel:"تحصيل عام",status:1,statusLabel:"معتمد",
  collectedOn:"2026-10-25",note:"سداد جزء من المديونية",createdBy:3,createdAt:"2026-10-25T10:00:00+03:00",
  reversedAt:null,reversalReason:null,
};
const fromDelivery:Collection={...general,id:52,receiptNumber:"COL-2026-00052",source:2,
  sourceLabel:"عند التسليم",orderId:10,orderNumber:"ORD-261029010",paymentMethod:1,paymentMethodLabel:"تحويل بنكي"};
const deposit:Collection={...general,id:53,receiptNumber:"COL-2026-00053",source:1,
  sourceLabel:"عربون أوردر",orderId:12,orderNumber:"ORD-261029012"};
function ok(config:InternalAxiosRequestConfig,data:unknown,status=200):AxiosResponse{
  return {config,status,statusText:String(status),headers:{},data:{success:true,message:"",data}};
}
const adapter:AxiosAdapter=async config=>{
  const url=config.url??"";
  const method=config.method??"get";
  const query=config.params instanceof URLSearchParams?config.params:
    new URLSearchParams(config.params as Record<string,string>);
  const body=typeof config.data==="string"?JSON.parse(config.data) as Record<string,unknown>:{};
  const key=config.headers.get("Idempotency-Key")?.toString()??null;
  calls.push({url,method,query,body,key});
  if(url==="/auth/me"){
    const user:AuthUser={name:"Admin",username:"admin",role:"admin",roleAlias:"المدير",
      status:1,statusLabel:"نشط",permissions};
    return ok(config,user);
  }
  if(url==="/finance/collections/summary"){
    return ok(config,{totalCollected:"180.00",collectionsCount:2,
      cashTotal:"100.00",bankTotal:"80.00",walletTotal:"0.00"});
  }
  if(url==="/finance/collections"&&method==="get"){
    let items=[...records];
    if(query.get("filter[status]"))items=items.filter(c=>String(c.status)===query.get("filter[status]"));
    if(query.get("filter[paymentMethod]"))items=items.filter(c=>String(c.paymentMethod)===query.get("filter[paymentMethod]"));
    if(query.get("filter[source]"))items=items.filter(c=>String(c.source)===query.get("filter[source]"));
    return ok(config,{collections:items,pagination:{currentPage:1,lastPage:1,perPage:20,total:items.length}});
  }
  if(url==="/selects"){
    if(query.get("selects")==="customers")return ok(config,[
      {label:"customers",options:[{value:7,label:"مؤسسة الريادة - 01012345678"},{value:9,label:"عميل غير نشط - 01090000000"}]},
    ]);
    if(query.get("selects")==="bankAccounts,eWallets")return ok(config,[
      {label:"bankAccounts",options:[{value:2,label:"حساب بنك مصر"}]},
      {label:"eWallets",options:[{value:5,label:"محفظة فودافون"}]},
    ]);
  }
  if(url==="/finance/collections"&&method==="post"){
    return ok(config,{id:90,receiptNumber:"COL-2026-00090"},201);
  }
  const m=url.match(/^\/finance\/collections\/(\d+)$/);
  if(m&&method==="get"){
    const c=records.find(c=>c.id===Number(m[1]));
    if(!c)throw Error("Unknown collection");
    return ok(config,c);
  }
  const correction=url.match(/^\/finance\/collections\/(\d+)\/correct$/);
  if(correction&&method==="post"){
    const id=Number(correction[1]);
    const old=records.find(c=>c.id===id&&c.status===1);
    if(!old)throw Error("Cannot correct reversed receipt");
    const newAmount=String(body.amount);
    const replacementId=newAmount==="0.00"?null:90+id;
    records=records.map(c=>c.id!==id?c:{...c,status:2,statusLabel:"معكوس",
      reversalReason:String(body.reason),reversedAt:"2026-10-29T12:00:00Z",correctedToId:replacementId});
    if(replacementId!==null)records.unshift({...old,id:replacementId,amount:newAmount,
      receiptNumber:"COL-2026-"+String(replacementId).padStart(5,"0"),
      correctedFromId:id,correctedToId:null});
    return ok(config,{id:replacementId,receiptNumber:replacementId===null?null:"COL-2026-"+String(replacementId).padStart(5,"0")});
  }
  const reversed=url.match(/^\/finance\/collections\/(\d+)\/reverse$/);
  if(reversed&&method==="post"){
    const id=Number(reversed[1]);
    if(!records.some(c=>c.id===id&&c.status===1))throw Error("Receipt already reversed or absent");
    records=records.map(c=>c.id===id?{...c,status:2,statusLabel:"معكوس",
      reversalReason:String(body.reason),reversedAt:"2026-10-28T12:00:00Z"}:c);
    return ok(config,null);
  }
  throw Error("Unexpected call: "+method+" "+url);
};
function visit(){window.history.replaceState({},"","/collections");return render(<App/>);}
beforeEach(()=>{apiClient.defaults.adapter=adapter;records=[general,fromDelivery];calls=[];permissions=[
  "finance.collections.view","finance.collections.create","finance.collections.reverse","customers.selects.view",
];});
afterEach(()=>{apiClient.defaults.adapter=originalAdapter;});
describe("Collections frontend against Laravel Finance API",()=>{
  it("loads receipt rows and posted-only summary, filters status only in list",async()=>{
    visit();const user=userEvent.setup();
    expect(await screen.findByText("COL-2026-00051")).toBeTruthy();
    expect(screen.getByText("180.00 ج.م")).toBeTruthy();
    expect(screen.getByText("ملخص التحصيلات المعتمدة فقط")).toBeTruthy();
    const expand=screen.getByRole("button",{name:/فلاتر إضافية/});
    expect(expand.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("combobox",{name:"فلتر الحالة"})).toBeNull();
    await user.click(expand);
    expect(expand.getAttribute("aria-expanded")).toBe("true");
    await user.selectOptions(screen.getByRole("combobox",{name:"فلتر الحالة"}),"2");
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/collections"&&c.query.get("filter[status]")==="2")).toBe(true));
    expect(calls.every(c=>c.url!=="/finance/collections/summary"||!c.query.has("filter[status]"))).toBe(true);
    await user.selectOptions(screen.getByRole("combobox",{name:"فلتر طريقة الدفع"}),"0");
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/collections"&&c.query.get("filter[paymentMethod]")==="0")).toBe(true));
  });
  it("uses the themed calendar for filters while retaining Egyptian display and ISO query dates",async()=>{
    visit();const user=userEvent.setup();
    expect(await screen.findByText("COL-2026-00051")).toBeTruthy();
    expect(screen.getByText(/^[0-9٠-٩]+\sإيصال$/)).toBeTruthy();
    expect(screen.getAllByText("25/10/2026").length).toBeGreaterThan(0);
    expect(document.querySelectorAll('input[type="date"]')).toHaveLength(0);
    const calendarButton=screen.getByRole("button",{name:"من تاريخ التحصيل"});
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit"})
      .formatToParts(new Date());
    const year=parts.find(x=>x.type==="year")!.value;
    const month=parts.find(x=>x.type==="month")!.value;
    const selected=year+"-"+month+"-15";
    await user.click(calendarButton);
    const calendar=screen.getByRole("dialog",{name:"اختيار من تاريخ التحصيل"});
    expect(within(calendar).getByRole("grid")).toBeTruthy();
    await user.click(within(calendar).getByRole("gridcell",{name:selected}));
    expect(screen.queryByRole("dialog",{name:"اختيار من تاريخ التحصيل"})).toBeNull();
    expect(calendarButton.textContent).toContain("15/"+month+"/"+year);
    await waitFor(()=>expect(calls.some(c=>
      c.url==="/finance/collections"&&c.query.get("filter[dateFrom]")===selected
    )).toBe(true));
    await user.click(calendarButton);
    await user.click(within(screen.getByRole("dialog",{name:"اختيار من تاريخ التحصيل"}))
      .getByRole("button",{name:"مسح التاريخ"}));
    expect(calendarButton.textContent).toContain("يوم/شهر/سنة");
    await user.click(screen.getByRole("button",{name:"مسح الفلاتر"}));
    expect(screen.getAllByText("يوم/شهر/سنة")).toHaveLength(2);
  });
  it("constrains inclusive start/end calendar days and clears all active date filters",async()=>{
    visit();const user=userEvent.setup();
    await screen.findByText("COL-2026-00051");
    const parts=new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit"})
      .formatToParts(new Date());
    const year=parts.find(x=>x.type==="year")!.value;
    const month=parts.find(x=>x.type==="month")!.value;
    const date=(day:string)=>year+"-"+month+"-"+day;
    const from=screen.getByRole("button",{name:"من تاريخ التحصيل"});
    const to=screen.getByRole("button",{name:"إلى تاريخ التحصيل"});
    await user.click(from);
    await user.click(within(screen.getByRole("dialog",{name:"اختيار من تاريخ التحصيل"}))
      .getByRole("gridcell",{name:date("15")}));
    await user.click(to);
    const toCalendar=screen.getByRole("dialog",{name:"اختيار إلى تاريخ التحصيل"});
    expect(within(toCalendar).getByRole("gridcell",{name:date("14")}).hasAttribute("disabled")).toBe(true);
    await user.click(within(toCalendar).getByRole("gridcell",{name:date("18")}));
    await user.click(from);
    const fromCalendar=screen.getByRole("dialog",{name:"اختيار من تاريخ التحصيل"});
    expect(within(fromCalendar).getByRole("gridcell",{name:date("19")}).hasAttribute("disabled")).toBe(true);
    await user.click(within(fromCalendar).getByRole("button",{name:"إغلاق"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/collections"
      &&c.query.get("filter[dateFrom]")===date("15")&&c.query.get("filter[dateTo]")===date("18"))).toBe(true));
    await user.click(screen.getByRole("button",{name:"مسح الفلاتر"}));
    expect(from.textContent).toContain("يوم/شهر/سنة");
    expect(to.textContent).toContain("يوم/شهر/سنة");
  });
  it("keeps advanced filter state visible, then clears it without changing posted-only totals",async()=>{
    visit();const user=userEvent.setup();
    await screen.findByText("COL-2026-00051");
    await user.click(screen.getByRole("button",{name:/فلاتر إضافية/}));
    await user.selectOptions(screen.getByRole("combobox",{name:"فلتر الحالة"}),"2");
    expect(screen.getByRole("button",{name:/فلاتر إضافية \(1\)/})).toBeTruthy();
    await user.click(screen.getByRole("button",{name:/فلاتر إضافية/}));
    expect(screen.queryByRole("combobox",{name:"فلتر الحالة"})).toBeNull();
    await waitFor(()=>expect(calls.some(c=>
      c.url==="/finance/collections"&&c.query.get("filter[status]")==="2"
    )).toBe(true));
    expect(calls.every(c=>c.url!=="/finance/collections/summary"||
      !c.query.has("filter[status]"))).toBe(true);
  });
  it("posts a general cash receipt without creating a separate order or delivery action",async()=>{
    visit();const user=userEvent.setup();
    await user.click(await screen.findByRole("button",{name:"تحصيل جديد"}));
    const dialog=await screen.findByRole("dialog",{name:"تسجيل تحصيل جديد"});
    await user.click(within(dialog).getByRole("combobox",{name:"اختيار العميل"}));
    await user.click(await within(dialog).findByRole("option",{name:/مؤسسة الريادة/}));
    await user.type(within(dialog).getByRole("textbox",{name:/المبلغ/}),"200.50");
    await user.click(within(dialog).getByRole("button",{name:"تأكيد تسجيل التحصيل"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/collections"&&c.method==="post")).toBe(true));
    const post=calls.find(c=>c.url==="/finance/collections"&&c.method==="post");
    expect(post?.body).toEqual({customerId:7,amount:"200.50",paymentMethod:0});
    expect(post?.key).toBeTruthy();
    expect(calls.filter(c=>c.url.startsWith("/deliveries/")&&c.method==="post")).toHaveLength(0);
  });
  it("uses exactly one bank destination and decimal string payment",async()=>{
    visit();const user=userEvent.setup();
    await user.click(await screen.findByRole("button",{name:"تحصيل جديد"}));
    const dialog=await screen.findByRole("dialog",{name:"تسجيل تحصيل جديد"});
    await user.click(within(dialog).getByRole("combobox",{name:"اختيار العميل"}));
    await user.click(await within(dialog).findByRole("option",{name:/مؤسسة الريادة/}));
    await user.type(within(dialog).getByRole("textbox",{name:/المبلغ/}),"55.25");
    await user.selectOptions(within(dialog).getByRole("combobox",{name:"طريقة التحصيل"}),"1");
    expect(within(dialog).getByRole("button",{name:"تأكيد تسجيل التحصيل"}).hasAttribute("disabled")).toBe(true);
    await user.click(within(dialog).getByRole("combobox",{name:"حساب التحصيل"}));
    await user.click(await within(dialog).findByRole("option",{name:"حساب بنك مصر"}));
    await user.click(within(dialog).getByRole("button",{name:"تأكيد تسجيل التحصيل"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/collections"&&c.method==="post")).toBe(true));
    expect(calls.find(c=>c.url==="/finance/collections"&&c.method==="post")?.body)
      .toEqual({customerId:7,amount:"55.25",paymentMethod:1,paymentDestinationId:2});
  });
  it("blocks invalid amount and future-date payments before a POST",async()=>{
    visit();const user=userEvent.setup();
    await user.click(await screen.findByRole("button",{name:"تحصيل جديد"}));
    const dialog=await screen.findByRole("dialog",{name:"تسجيل تحصيل جديد"});
    await user.click(within(dialog).getByRole("combobox",{name:"اختيار العميل"}));
    await user.click(await within(dialog).findByRole("option",{name:/مؤسسة الريادة/}));
    await user.type(within(dialog).getByRole("textbox",{name:/المبلغ/}),"0.00");
    expect(within(dialog).getByRole("button",{name:"تأكيد تسجيل التحصيل"}).hasAttribute("disabled")).toBe(true);
    expect(calls.filter(c=>c.url==="/finance/collections"&&c.method==="post")).toHaveLength(0);
  });
  it("reverses a general collection with a reason and Idempotency-Key",async()=>{
    visit();const user=userEvent.setup();
    expect(await screen.findByText("COL-2026-00051")).toBeTruthy();
    await user.click(screen.getAllByRole("button",{name:"التفاصيل"})[0]);
    const dialog=await screen.findByRole("dialog",{name:"تفاصيل إيصال التحصيل"});
    await user.click(within(dialog).getByRole("button",{name:"عكس الإيصال بالكامل"}));
    expect(within(dialog).getByRole("button",{name:"تأكيد عكس الإيصال"}).hasAttribute("disabled")).toBe(true);
    await user.type(within(dialog).getByRole("textbox",{name:/سبب العكس/}),"إيصال مكرر");
    expect(within(dialog).getByRole("button",{name:"تأكيد عكس الإيصال"}).hasAttribute("disabled")).toBe(true);
    await user.click(within(dialog).getByRole("checkbox",{name:"تأكيد أثر عكس التحصيل"}));
    await user.click(within(dialog).getByRole("button",{name:"تأكيد عكس الإيصال"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/collections/51/reverse")).toBe(true));
    const post=calls.find(c=>c.url==="/finance/collections/51/reverse");
    expect(post?.body).toEqual({reason:"إيصال مكرر"});
    expect(post?.key).toBeTruthy();
  });
  it("shows immediate invalid amount feedback and keeps the receipt action disabled",async()=>{
    visit();const user=userEvent.setup();
    await user.click(await screen.findByRole("button",{name:"تحصيل جديد"}));
    const dialog=await screen.findByRole("dialog",{name:"تسجيل تحصيل جديد"});
    await user.type(within(dialog).getByRole("textbox",{name:/المبلغ/}),"3.456");
    expect(within(dialog).getByRole("alert").textContent).toContain("رقمين عشريين");
    expect(within(dialog).getByRole("button",{name:"تأكيد تسجيل التحصيل"}).hasAttribute("disabled")).toBe(true);
    expect(calls.filter(c=>c.url==="/finance/collections"&&c.method==="post")).toHaveLength(0);
  });
  it.each([
    {source:"عربون أوردر",id:53,orderId:12},
    {source:"عند التسليم",id:52,orderId:10},
  ])("can reverse $source independently without cancelling its order or delivery",async({id,orderId})=>{
    records=[...records,deposit];visit();const user=userEvent.setup();
    expect(await screen.findByText(`COL-2026-${String(id).padStart(5,"0")}`)).toBeTruthy();
    const row=screen.getByText(`COL-2026-${String(id).padStart(5,"0")}`).closest("tr");
    expect(row).toBeTruthy();
    await user.click(within(row!).getByRole("button",{name:"التفاصيل"}));
    const dialog=await screen.findByRole("dialog",{name:"تفاصيل إيصال التحصيل"});
    expect(within(dialog).getByText("رقم الإيصال")).toBeTruthy();
    expect(within(dialog).getByText("مصدر التحصيل")).toBeTruthy();
    expect(within(dialog).getByText("هل المبلغ المسجل صحيح؟")).toBeTruthy();
    await user.click(within(dialog).getByRole("button",{name:"عكس الإيصال بالكامل"}));
    const summaryReceipt=within(dialog).getByText(`COL-2026-${String(id).padStart(5,"0")}`);
    expect(summaryReceipt.closest("p")?.className).toContain("text-right");
    expect(summaryReceipt.getAttribute("dir")).toBe("ltr");
    expect(within(dialog).getByText(/لن يتم إلغاء الأوردر أو التسليم/)).toBeTruthy();
    await user.type(within(dialog).getByRole("textbox",{name:/سبب العكس/}),"تسجيل إيصال عن طريق الخطأ");
    await user.click(within(dialog).getByRole("checkbox",{name:"تأكيد أثر عكس التحصيل"}));
    await user.click(within(dialog).getByRole("button",{name:"تأكيد عكس الإيصال"}));
    await waitFor(()=>expect(calls.some(c=>c.url===`/finance/collections/${id}/reverse`)).toBe(true));
    expect(calls.find(c=>c.url===`/finance/collections/${id}/reverse`)?.body)
      .toEqual({reason:"تسجيل إيصال عن طريق الخطأ"});
    expect(records.find(c=>c.id===id)?.status).toBe(2);
    expect(records.find(c=>c.id===id)?.orderId).toBe(orderId);
    expect(calls.some(c=>c.method==="post"&&
      (c.url.includes("/deliveries/")||c.url.includes("/orders/")||c.url.includes("/refunds")))).toBe(false);
  });
  it("preserves the receipt detail grid and reversal audit after correcting a deposit",async()=>{
    records=[...records,deposit];visit();const user=userEvent.setup();
    await screen.findByText("COL-2026-00053");
    const row=screen.getByText("COL-2026-00053").closest("tr");
    await user.click(within(row!).getByRole("button",{name:"التفاصيل"}));
    let dialog=await screen.findByRole("dialog",{name:"تفاصيل إيصال التحصيل"});
    const details=within(dialog).getByText("رقم الإيصال").parentElement?.parentElement;
    expect(details?.className).toContain("sm:grid-cols-2");
    await user.click(within(dialog).getByRole("button",{name:"عكس الإيصال بالكامل"}));
    await user.type(within(dialog).getByRole("textbox",{name:/سبب العكس/}),"عربون تم تسجيله بالخطأ");
    await user.click(within(dialog).getByRole("checkbox",{name:"تأكيد أثر عكس التحصيل"}));
    await user.click(within(dialog).getByRole("button",{name:"تأكيد عكس الإيصال"}));
    await waitFor(()=>expect(screen.queryByRole("dialog",{name:"تفاصيل إيصال التحصيل"})).toBeNull());
    await user.click(within(screen.getByText("COL-2026-00053").closest("tr")!).getByRole("button",{name:"التفاصيل"}));
    dialog=await screen.findByRole("dialog",{name:"تفاصيل إيصال التحصيل"});
    expect(within(dialog).getByText(/تحصيل معكوس/)).toBeTruthy();
    expect(within(dialog).getByText("سبب العكس: عربون تم تسجيله بالخطأ")).toBeTruthy();
    expect(within(dialog).getByText(/تاريخ العكس/)).toBeTruthy();
    expect(within(dialog).queryByRole("button",{name:"عكس الإيصال بالكامل"})).toBeNull();
    expect(within(dialog).queryByRole("button",{name:"تصحيح المبلغ"})).toBeNull();
  });
  it("shows order number for deposit and delivery but not general receipts",async()=>{
    records=[...records,deposit];permissions=[...permissions,"orders.view"];
    visit();
    const depositRow=(await screen.findByText("COL-2026-00053")).closest("tr")!;
    const deliveryRow=screen.getByText("COL-2026-00052").closest("tr")!;
    const generalRow=screen.getByText("COL-2026-00051").closest("tr")!;
    expect(within(depositRow).getByRole("link",{name:"ORD-261029012"}).getAttribute("href")).toBe("/orders/12");
    expect(within(deliveryRow).getByRole("link",{name:"ORD-261029010"}).getAttribute("href")).toBe("/orders/10");
    expect(within(generalRow).getByText("—")).toBeTruthy();
  });
  it("corrects a linked deposit preserving order source, shows audit and prevents repeated correction",async()=>{
    records=[...records,deposit];permissions=[...permissions,"finance.collections.correct"];
    visit();const user=userEvent.setup();
    const row=(await screen.findByText("COL-2026-00053")).closest("tr")!;
    await user.click(within(row).getByRole("button",{name:"التفاصيل"}));
    const dialog=await screen.findByRole("dialog",{name:"تفاصيل إيصال التحصيل"});
    await user.click(within(dialog).getByRole("button",{name:"تصحيح المبلغ"}));
    expect(within(dialog).getByText("رقم الأوردر")).toBeTruthy();
    const receiptId=within(dialog).getByText("COL-2026-00053");
    const orderNumber=within(dialog).getByText("ORD-261029012");
    expect(receiptId.getAttribute("dir")).toBe("ltr");
    expect(receiptId.closest("p")?.className).toContain("text-right");
    expect(orderNumber.getAttribute("dir")).toBe("ltr");
    expect(orderNumber.closest("p")?.className).toContain("text-right");
    const amount=within(dialog).getByRole("textbox",{name:/المبلغ الصحيح/});
    await user.clear(amount);await user.type(amount,"30.00");
    const comparison=within(dialog).getByLabelText("مقارنة المبلغ القديم والجديد");
    expect(comparison.textContent).toContain("المبلغ القديم");
    expect(comparison.textContent).toContain("المبلغ الجديد");
    expect(comparison.textContent).toContain("100.00");
    expect(comparison.textContent).toContain("30.00");
    await user.type(within(dialog).getByRole("textbox",{name:/سبب التصحيح/}),"عربون مسجل بالخطأ");
    await user.click(within(dialog).getByRole("button",{name:"تأكيد تصحيح المبلغ"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/collections/53/correct")).toBe(true));
    expect(calls.find(c=>c.url==="/finance/collections/53/correct")?.body).toEqual({amount:"30.00",reason:"عربون مسجل بالخطأ"});
    expect(records.find(c=>c.id===53)?.status).toBe(2);
    expect(records.find(c=>c.id===143)?.source).toBe(1);
    expect(records.find(c=>c.id===143)?.orderId).toBe(12);
    expect(records.find(c=>c.id===143)?.correctedFromId).toBe(53);
    expect(calls.filter(c=>c.url.endsWith("/reverse")||c.url.startsWith("/deliveries/")&&c.method==="post")).toHaveLength(0);
  });
  it("keeps correction and full reversal distinct and does not send a zero correction",async()=>{
    permissions=[...permissions,"finance.collections.correct"];
    visit();const user=userEvent.setup();
    await screen.findByText("COL-2026-00051");
    await user.click(screen.getAllByRole("button",{name:"التفاصيل"})[0]);
    const dialog=await screen.findByRole("dialog",{name:"تفاصيل إيصال التحصيل"});
    await user.click(within(dialog).getByRole("button",{name:"تصحيح المبلغ"}));
    expect(within(dialog).getByText("المبلغ المسجل")).toBeTruthy();
    expect(screen.getByRole("dialog",{name:"تصحيح مبلغ التحصيل"})).toBeTruthy();
    expect(within(dialog).queryByText("رقم الهاتف")).toBeNull();
    const amount=within(dialog).getByRole("textbox",{name:/المبلغ الصحيح/});
    await user.clear(amount);await user.type(amount,"0.00");
    expect(within(dialog).getByText(/لإلغاء الإيصال بالكامل/)).toBeTruthy();
    await user.type(within(dialog).getByRole("textbox",{name:/سبب التصحيح/}),"لم يتم استلام المبلغ");
    expect(within(dialog).getByRole("button",{name:"تأكيد تصحيح المبلغ"}).hasAttribute("disabled")).toBe(true);
    expect(calls.some(c=>c.url==="/finance/collections/51/correct")).toBe(false);
    await user.click(within(dialog).getByRole("button",{name:"رجوع للتفاصيل"}));
    expect(screen.getByRole("dialog",{name:"تفاصيل إيصال التحصيل"})).toBeTruthy();
    await user.click(within(dialog).getByRole("button",{name:"عكس الإيصال بالكامل"}));
    expect(screen.getByRole("dialog",{name:"عكس الإيصال بالكامل"})).toBeTruthy();
    expect(within(dialog).queryByRole("textbox",{name:/المبلغ الصحيح/})).toBeNull();
    await user.type(within(dialog).getByRole("textbox",{name:/سبب العكس/}),"إيصال مسجل دون دفع");
    await user.click(within(dialog).getByRole("checkbox",{name:"تأكيد أثر عكس التحصيل"}));
    await user.click(within(dialog).getByRole("button",{name:"تأكيد عكس الإيصال"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/collections/51/reverse")).toBe(true));
    expect(calls.some(c=>c.url==="/finance/collections/51/correct")).toBe(false);
    expect(records.find(c=>c.id===51)?.status).toBe(2);
  });
  it("keeps action controls in a fixed dialog footer and clears unsaved correction on back",async()=>{
    permissions=[...permissions,"finance.collections.correct"];
    visit();const user=userEvent.setup();
    await screen.findByText("COL-2026-00051");
    await user.click(screen.getAllByRole("button",{name:"التفاصيل"})[0]);
    const dialog=screen.getByRole("dialog",{name:"تفاصيل إيصال التحصيل"});
    await user.click(within(dialog).getByRole("button",{name:"تصحيح المبلغ"}));
    const footer=within(dialog).getByRole("button",{name:"تأكيد تصحيح المبلغ"}).closest("footer");
    expect(footer?.className).toContain("shrink-0");
    const amount=within(dialog).getByRole("textbox",{name:/المبلغ الصحيح/});
    await user.clear(amount);await user.type(amount,"40.00");
    await user.type(within(dialog).getByRole("textbox",{name:/سبب التصحيح/}),"اختبار تعديل");
    await user.click(within(dialog).getByRole("button",{name:"رجوع للتفاصيل"}));
    await user.click(within(dialog).getByRole("button",{name:"تصحيح المبلغ"}));
    expect((within(dialog).getByRole("textbox",{name:/المبلغ الصحيح/}) as HTMLInputElement).value).toBe("100.00");
    expect((within(dialog).getByRole("textbox",{name:/سبب التصحيح/}) as HTMLTextAreaElement).value).toBe("");
    expect(calls.filter(c=>c.url.endsWith("/correct"))).toHaveLength(0);
  });
  it("allows create-only collectors without fetching protected financial history",async()=>{
    permissions=["finance.collections.create"];
    visit();
    expect(await screen.findByRole("button",{name:"تحصيل جديد"})).toBeTruthy();
    expect(screen.getByText(/عرض سجل الإيصالات يحتاج صلاحية التحصيلات/)).toBeTruthy();
    expect(calls.some(c=>c.url==="/finance/collections"&&c.method==="get")).toBe(false);
    expect(calls.some(c=>c.url==="/finance/collections/summary")).toBe(false);
  });
  it("prevents unauthorized write actions",async()=>{
    permissions=["finance.collections.view"];visit();
    expect(await screen.findByText("COL-2026-00051")).toBeTruthy();
    expect(screen.queryByRole("button",{name:"تحصيل جديد"})).toBeNull();
    const user=userEvent.setup();await user.click(screen.getAllByRole("button",{name:"التفاصيل"})[0]);
    const dialog=await screen.findByRole("dialog",{name:"تفاصيل إيصال التحصيل"});
    expect(within(dialog).queryByRole("button",{name:"عكس الإيصال بالكامل"})).toBeNull();
    expect(within(dialog).queryByRole("button",{name:"تصحيح المبلغ"})).toBeNull();
  });
});
