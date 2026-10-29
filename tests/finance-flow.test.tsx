import { afterEach,beforeEach,describe,expect,it } from "vitest";
import { render,screen,waitFor,within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosAdapter,AxiosResponse,InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";

const original=apiClient.defaults.adapter;
let permissions=["finance.balances.view","finance.ledger.view","finance.opening_balances.create"];
let balance={customerId:7,amount:"250.00",type:1,typeLabel:"مدين"};
let hasOpening=false;
const ledgerEntries=[{
  id:100,type:2,typeLabel:"تحصيل",amount:"50.00",signedAmount:"-50.00",
  orderId:4,orderNumber:"ORD-261026004",collectionId:12,receiptNumber:"COL-2026-00012",refundId:null,refundNumber:null,effectiveDate:"2026-10-26",
  note:"سداد دين",createdAt:"2026-10-26T10:00:00+03:00",
  runningBalance:{amount:"250.00",type:1,typeLabel:"مدين"},
}];
let calls:{url:string;method:string;params:URLSearchParams;body:Record<string,unknown>}[]=[];
function ok(config:InternalAxiosRequestConfig,data:unknown):AxiosResponse{
  return {config,status:200,statusText:"OK",headers:{},data:{success:true,message:"",data}};
}
const adapter:AxiosAdapter=async config=>{
  const url=config.url??"";
  const method=config.method??"get";
  const params=config.params instanceof URLSearchParams?config.params:new URLSearchParams(config.params as Record<string,string>);
  const body=typeof config.data==="string"?JSON.parse(config.data) as Record<string,unknown>:{};
  calls.push({url,method,params,body});
  if(url==="/auth/me") {
    const auth:AuthUser={username:"admin",name:"مدير",role:"admin",roleAlias:"مدير",
      status:1,statusLabel:"نشط",permissions};
    return ok(config,auth);
  }
  if(url==="/selects"&&params.get("selects")==="customers")return ok(config,[
    {label:"customers",options:[{value:7,label:"أحمد خالد - 01012345678"},{value:8,label:"مؤسسة النور - 01112345678"}]},
  ]);
  if(url==="/finance/customer-balances"&&method==="get"){
    let accounts=[
      {customerId:7,customerName:"أحمد خالد",customerPhone:"01012345678",amount:balance.amount,type:balance.type,typeLabel:balance.typeLabel,openingBalanceExists:hasOpening},
      {customerId:8,customerName:"مؤسسة النور",customerPhone:"01112345678",amount:"20.00",type:2,typeLabel:"دائن",openingBalanceExists:true},
    ];
    const search=params.get("filter[search]");
    if(search)accounts=accounts.filter(x=>(x.customerName+" "+x.customerPhone).includes(search));
    const type=params.get("filter[type]");
    if(type!==null)accounts=accounts.filter(x=>String(x.type)===type);
    return ok(config,{accounts,pagination:{currentPage:1,lastPage:1,perPage:20,total:accounts.length}});
  }
  if(url==="/finance/customers/7/opening-balance-status"&&method==="get")
    return ok(config,{customerId:7,openingBalanceExists:hasOpening});
  if(url==="/finance/customers/7/balance"&&method==="get")return ok(config,{...balance,openingBalanceExists:hasOpening,
    openingBalance:hasOpening?{amount:"500.00",type:1,typeLabel:"مدين"}:null});
  if(url==="/finance/customers/7/ledger"&&method==="get")return ok(config,{
    entries:params.get("filter[type]")==="6"?[]:ledgerEntries,
    balance:{amount:balance.amount,type:balance.type,typeLabel:balance.typeLabel},
    openingBalanceExists:hasOpening,
    pagination:{currentPage:1,lastPage:1,perPage:20,total:params.get("filter[type]")==="6"?0:1},
  });
  if(url==="/finance/customers/7/opening-balance"&&method==="post"){
    hasOpening=true;
    balance={customerId:7,amount:String(body.amount),type:Number(body.type),typeLabel:Number(body.type)===1?"مدين":"دائن"};
    return ok(config,null);
  }
  throw Error("Unknown request "+method+" "+url);
};
function visit(customerId="7"){
  window.history.replaceState({},"",`/finance${customerId?"?customerId="+customerId:""}`);
  return render(<App/>);
}
beforeEach(()=>{
  apiClient.defaults.adapter=adapter;
  permissions=["finance.balances.view","finance.ledger.view","finance.opening_balances.create"];
  balance={customerId:7,amount:"250.00",type:1,typeLabel:"مدين"};
  calls=[];
  hasOpening=false;
});
afterEach(()=>{apiClient.defaults.adapter=original;});
describe("Finance account page against Laravel existing contracts",()=>{
  it("shows current debit balance and paginated ledger with signed debit/credit distinction",async()=>{
    visit();
    expect(await screen.findByRole("tab",{name:"حسابات العملاء"})).toBeTruthy();
    expect(await screen.findByText("سداد دين")).toBeTruthy();
    expect(screen.getAllByText("250.00 ج.م").length).toBeGreaterThan(0);
    expect(screen.getByText("50.00 ج.م")).toBeTruthy();
    expect(screen.getByText("26/10/2026")).toBeTruthy();
    expect(calls.some(c=>c.url==="/finance/customers/7/balance")).toBe(true);
    expect(calls.some(c=>c.url==="/finance/customers/7/ledger")).toBe(true);
  });
  it("sends the backend-specific ledger type filter and no unsupported sort",async()=>{
    visit();
    const user=userEvent.setup();
    await screen.findByText("سداد دين");
    await user.selectOptions(screen.getByRole("combobox",{name:"نوع الحركة المالية"}),"6");
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/customers/7/ledger"&&c.params.get("filter[type]")==="6")).toBe(true));
    expect(calls.filter(c=>c.url==="/finance/customers/7/ledger").every(c=>!c.params.has("sort"))).toBe(true);
  });
  it("allows authorized opening without read permission but requires explicit one-time confirmation",async()=>{
    permissions=["finance.opening_balances.create"];
    visit();
    const user=userEvent.setup();
    expect(await screen.findByRole("button",{name:"رصيد افتتاحي"})).toBeTruthy();
    expect(calls.some(c=>c.url==="/finance/customers/7/ledger")).toBe(false);
    expect(calls.some(c=>c.url==="/finance/customers/7/balance")).toBe(false);
    await user.click(screen.getByRole("button",{name:"رصيد افتتاحي"}));
    const dialog=await screen.findByRole("dialog",{name:"تسجيل الرصيد الافتتاحي"});
    await user.selectOptions(within(dialog).getByRole("combobox",{name:"نوع الرصيد"}),"2");
    await user.type(within(dialog).getByRole("textbox",{name:"قيمة الرصيد"}),"150.50");
    expect(within(dialog).getByRole("button",{name:"تأكيد الرصيد الافتتاحي"}).hasAttribute("disabled")).toBe(true);
    await user.click(within(dialog).getByRole("checkbox",{name:"تأكيد تسجيل الرصيد الافتتاحي"}));
    await user.click(within(dialog).getByRole("button",{name:"تأكيد الرصيد الافتتاحي"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/customers/7/opening-balance"&&c.method==="post")).toBe(true));
    expect(calls.find(c=>c.url==="/finance/customers/7/opening-balance"&&c.method==="post")?.body)
      .toEqual({type:2,amount:"150.50"});
  });
  it("combines customer selection and account summary while explaining why debit customers cannot receive refunds",async()=>{
    permissions=["finance.balances.view","finance.ledger.view","finance.refunds.create"];
    visit();
    const card=await screen.findByRole("region",{name:"بيانات حساب العميل"});
    expect(within(card).getByRole("combobox",{name:"اختيار حساب العميل"})).toBeTruthy();
    expect(screen.queryByRole("region",{name:"اختيار حساب العميل"})).toBeNull();
    const button=within(card).getByRole("button",{name:"رد رصيد للعميل"});
    await within(card).findByText("لا يمكن رد رصيد: العميل عليه مديونية حاليًا.");
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(within(card).getByText("أحمد خالد")).toBeTruthy();
    expect(calls.some(c=>c.url==="/finance/refunds"&&c.method==="post")).toBe(false);
  });
  it("lists financial accounts with search, debit/credit filters, sorting and opens selected statement",async()=>{
    visit("");const user=userEvent.setup();
    const section=await screen.findByRole("region",{name:"قائمة حسابات العملاء"});
    expect(await within(section).findByText("أحمد خالد")).toBeTruthy();
    expect(await within(section).findByText("مؤسسة النور")).toBeTruthy();
    expect(screen.queryByRole("combobox",{name:"اختيار حساب العميل"})).toBeNull();
    expect(calls.some(c=>c.url==="/finance/customer-balances")).toBe(true);
    await user.selectOptions(within(section).getByRole("combobox",{name:"حالة الرصيد"}),"2");
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/customer-balances"&&c.params.get("filter[type]")==="2")).toBe(true));
    expect(within(section).queryByText("أحمد خالد")).toBeNull();
    await user.selectOptions(within(section).getByRole("combobox",{name:"حالة الرصيد"}),"");
    await user.selectOptions(within(section).getByRole("combobox",{name:"الترتيب"}),"balance");
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/customer-balances"&&c.params.get("sort")==="balance")).toBe(true));
    await user.type(within(section).getByRole("textbox",{name:"ابحث باسم العميل أو رقم الهاتف"}),"أحمد");
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/customer-balances"&&c.params.get("filter[search]")==="أحمد")).toBe(true));
    await user.click(within(section).getByRole("button",{name:"كشف الحساب"}));
    expect(await screen.findByText("سداد دين")).toBeTruthy();
    expect(screen.getByRole("button",{name:"العودة إلى الحسابات"})).toBeTruthy();
    expect(screen.getByRole("combobox",{name:"اختيار حساب العميل"})).toBeTruthy();
  });
  it("navigates back to the account list and allows switching customers",async()=>{
    visit("");const user=userEvent.setup();
    const section=await screen.findByRole("region",{name:"قائمة حسابات العملاء"});
    await user.click((await within(section).findAllByRole("button",{name:"كشف الحساب"}))[0]);
    await screen.findByText("سداد دين");
    await user.click(screen.getByRole("combobox",{name:"اختيار حساب العميل"}));
    expect(await screen.findByRole("option",{name:/مؤسسة النور/})).toBeTruthy();
    await user.click(screen.getByRole("button",{name:"العودة إلى الحسابات"}));
    expect(await screen.findByRole("region",{name:"قائمة حسابات العملاء"})).toBeTruthy();
  });
  it("hides a previously registered opening balance, without relying on a disabled submit",async()=>{
    hasOpening=true;
    visit();
    expect(await screen.findByText("500.00 ج.م")).toBeTruthy();
    expect(screen.queryByRole("button",{name:"رصيد افتتاحي"})).toBeNull();
    expect(calls.some(c=>c.url==="/finance/customers/7/opening-balance-status")).toBe(true);
  });
  it("links ledger movements to real receipt and linked order and opens complete notes",async()=>{
    permissions=["finance.balances.view","finance.ledger.view","finance.collections.view","orders.view"];
    visit();const user=userEvent.setup();
    await screen.findByText("سداد دين");
    const receipt=screen.getByRole("link",{name:"COL-2026-00012"});
    expect(receipt.getAttribute("href")).toBe("/collections?receiptId=12");
    expect(screen.getByRole("link",{name:/ORD-261026004/}).getAttribute("href")).toBe("/orders/4");
    await user.click(screen.getByRole("button",{name:"عرض الملاحظة كاملة"}));
    expect(within(screen.getByRole("dialog",{name:"تفاصيل الحركة المالية"})).getByText("سداد دين")).toBeTruthy();
  });
  it("shows server-calculated running balances rather than summing filtered rows",async()=>{
    visit();
    await screen.findByText("سداد دين");
    expect(screen.getByText("الرصيد بعد الحركة")).toBeTruthy();
    expect(screen.getAllByText(/250.00 ج.م/).length).toBeGreaterThan(0);
  });
  it("keeps account selection independent from Customers read permission",async()=>{
    permissions=["finance.ledger.view"];
    visit("");
    const user=userEvent.setup();
    expect(await screen.findByRole("combobox",{name:"اختيار حساب العميل"})).toBeTruthy();
    await user.click(screen.getByRole("combobox",{name:"اختيار حساب العميل"}));
    await user.click(await screen.findByRole("option",{name:/أحمد خالد/}));
    expect(await screen.findByText("سداد دين")).toBeTruthy();
    expect(screen.queryByText("ملف العميل")).toBeNull();
    expect(calls.some(c=>c.url==="/finance/customers/7/balance")).toBe(false);
  });
});
