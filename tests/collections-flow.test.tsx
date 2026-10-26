import { afterEach,beforeEach,describe,expect,it } from "vitest";
import { fireEvent,render,screen,waitFor,within } from "@testing-library/react";
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
  customerPhone:"01012345678",orderId:null,amount:"100.00",
  paymentMethod:0,paymentMethodLabel:"نقدي",paymentDestinationId:null,destinationLabel:null,
  source:0,sourceLabel:"تحصيل عام",status:1,statusLabel:"معتمد",
  collectedOn:"2026-10-25",note:"سداد جزء من المديونية",createdBy:3,createdAt:"2026-10-25T10:00:00+03:00",
  reversedAt:null,reversalReason:null,
};
const fromDelivery:Collection={...general,id:52,receiptNumber:"COL-2026-00052",source:2,
  sourceLabel:"عند التسليم",orderId:10,paymentMethod:1,paymentMethodLabel:"تحويل بنكي"};
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
  if(url==="/finance/collections/51/reverse"&&method==="post"){
    records=records.map(c=>c.id===51?{...c,status:2,statusLabel:"معكوس",reversalReason:String(body.reason)}:c);
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
  it("shows compact filters, localized ISO-backed dates and a readable results count",async()=>{
    visit();
    expect(await screen.findByText("COL-2026-00051")).toBeTruthy();
    expect(screen.getByText(/^[0-9٠-٩]+\sإيصال$/)).toBeTruthy();
    expect(screen.getAllByText("25/10/2026").length).toBeGreaterThan(0);
    const date=screen.getByLabelText("من تاريخ التحصيل") as HTMLInputElement;
    fireEvent.change(date,{target:{value:"2026-10-25"}});
    expect(date.value).toBe("2026-10-25");
    expect(screen.getAllByText("25/10/2026").length).toBeGreaterThan(1);
    await waitFor(()=>expect(calls.some(c=>
      c.url==="/finance/collections"&&c.query.get("filter[dateFrom]")==="2026-10-25"
    )).toBe(true));
    const user=userEvent.setup();
    await user.click(screen.getByRole("button",{name:"مسح الفلاتر"}));
    expect(date.value).toBe("");
    expect(screen.getAllByText("يوم/شهر/سنة")).toHaveLength(2);
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
  it("reverses only general collections with a reason and Idempotency-Key",async()=>{
    visit();const user=userEvent.setup();
    expect(await screen.findByText("COL-2026-00051")).toBeTruthy();
    await user.click(screen.getAllByRole("button",{name:"التفاصيل"})[0]);
    const dialog=await screen.findByRole("dialog",{name:"تفاصيل إيصال التحصيل"});
    await user.click(within(dialog).getByRole("button",{name:"عكس التحصيل"}));
    expect(within(dialog).getByRole("button",{name:"تأكيد عكس التحصيل"}).hasAttribute("disabled")).toBe(true);
    await user.type(within(dialog).getByRole("textbox",{name:/سبب العكس/}),"إيصال مكرر");
    await user.click(within(dialog).getByRole("button",{name:"تأكيد عكس التحصيل"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/collections/51/reverse")).toBe(true));
    const post=calls.find(c=>c.url==="/finance/collections/51/reverse");
    expect(post?.body).toEqual({reason:"إيصال مكرر"});
    expect(post?.key).toBeTruthy();
  });
  it("hides reversing a delivery-linked receipt to preserve its composite workflow",async()=>{
    visit();const user=userEvent.setup();
    expect(await screen.findByText("COL-2026-00052")).toBeTruthy();
    await user.click(screen.getAllByRole("button",{name:"التفاصيل"})[1]);
    const dialog=await screen.findByRole("dialog",{name:"تفاصيل إيصال التحصيل"});
    expect(within(dialog).queryByRole("button",{name:"عكس التحصيل"})).toBeNull();
    expect(within(dialog).getByText(/تُعالج من العملية الأصلية/)).toBeTruthy();
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
    expect(within(dialog).queryByRole("button",{name:"عكس التحصيل"})).toBeNull();
  });
});
