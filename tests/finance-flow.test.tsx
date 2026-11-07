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
let ledgerTotal=1;
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
  if(url==="/finance/customers/7/refundable-credit"&&method==="get") return ok(config, {customerId:7, availableCredit: balance.type === 2 ? balance.amount : "0.00", canRefund: balance.type === 2 && Number(balance.amount) > 0});
  if(url==="/finance/customers/7/opening-balance-status"&&method==="get")
    return ok(config,{customerId:7,openingBalanceExists:hasOpening});
  if(url==="/finance/customers/7/balance"&&method==="get")return ok(config,{...balance,openingBalanceExists:hasOpening,
    openingBalance:hasOpening?{amount:"500.00",type:1,typeLabel:"مدين"}:null});
  if(url==="/finance/customers/7/ledger"&&method==="get"){
    const page=Number(params.get("page")??"1"),perPage=Number(params.get("perPage")??"20");
    const total=params.get("filter[type]")==="6"?0:ledgerTotal;
    const entries=total===0?[]:total===1?ledgerEntries:Array.from({length:total},(_,i)=>({
      ...ledgerEntries[0],id:100+i,note:"حركة "+(i+1),
      runningBalance:{amount:(1000+i).toFixed(2),type:1,typeLabel:"مدين"},
    })).slice((page-1)*perPage,page*perPage);
    return ok(config,{
      entries,balance:{amount:balance.amount,type:balance.type,typeLabel:balance.typeLabel},
      openingBalanceExists:hasOpening,
      pagination:{currentPage:page,lastPage:Math.max(1,Math.ceil(total/perPage)),perPage,total},
    });
  }
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
  ledgerTotal=1;
  ledgerEntries[0].createdAt="2026-10-26T10:00:00+03:00";
});
afterEach(()=>{apiClient.defaults.adapter=original;});
describe("Finance account page against Laravel existing contracts",()=>{
  it("shows current debit balance and paginated ledger with signed debit/credit distinction",async()=>{
    visit();
    expect(await screen.findByRole("heading",{level:1,name:"حسابات العملاء"})).toBeTruthy();
    expect(await screen.findByText("سداد دين")).toBeTruthy();
    expect(screen.getAllByText("250.00 ج.م").length).toBeGreaterThan(0);
    expect(screen.getByText("50.00 ج.م")).toBeTruthy();
    expect(screen.getByText("26/10/2026")).toBeTruthy();
    expect(screen.getByText("10:00 ص")).toBeTruthy();
    expect(screen.getByTitle("وقت تسجيل الحركة فعليًا بتوقيت القاهرة").textContent).toContain("الساعة");
    expect(calls.some(c=>c.url==="/finance/customers/7/balance")).toBe(true);
    expect(calls.some(c=>c.url==="/finance/customers/7/ledger")).toBe(true);
  });
  it("shows accounting date separately when a payment was registered on a different day",async()=>{
    ledgerEntries[0].createdAt="2026-11-03T09:14:00Z";
    visit();
    const ledger=await screen.findByRole("tabpanel",{name:"كشف الحساب"});
    expect(await within(ledger).findByText("26/10/2026")).toBeTruthy();
    const posting=within(ledger).getByTitle("وقت تسجيل الحركة فعليًا بتوقيت القاهرة");
    expect(posting.textContent).toContain("سُجّلت");
    expect(posting.textContent).toContain("03/11/2026");
    expect(posting.textContent).toContain("11:14 ص");
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
  it("uses server pagination and keeps per-movement running balances across pages",async()=>{
    ledgerTotal=45;
    visit();
    const user=userEvent.setup();
    const size=await screen.findByRole("combobox",{name:"عدد الحركات في الصفحة"});
    expect((size as HTMLSelectElement).value).toBe("20");
    expect(await screen.findByText("حركة 1")).toBeTruthy();
    expect(screen.getByText("1–20")).toBeTruthy();
    expect(screen.getByRole("button",{name:"الصفحة السابقة"}).hasAttribute("disabled")).toBe(true);
    await user.click(screen.getByRole("button",{name:"الصفحة التالية"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/customers/7/ledger"
      &&c.params.get("page")==="2"&&c.params.get("perPage")==="20")).toBe(true));
    const secondPageRow=await screen.findByText("حركة 21");
    expect(secondPageRow.closest("tr")?.textContent).toContain("1,020.00");
    expect(screen.queryByText("حركة 1")).toBeNull();
    expect(screen.getByText("21–40")).toBeTruthy();
    const updatedSize=screen.getByRole("combobox",{name:"عدد الحركات في الصفحة"});
    await user.selectOptions(updatedSize,"50");
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/customers/7/ledger"
      &&c.params.get("page")==="1"&&c.params.get("perPage")==="50")).toBe(true));
    expect(await screen.findByText("حركة 45")).toBeTruthy();
    expect(screen.getByText("1–45")).toBeTruthy();
    expect(screen.getByRole("button",{name:"الصفحة التالية"}).hasAttribute("disabled")).toBe(true);
  });

  it("resets ledger page to one after changing movement type, preserving page size",async()=>{
    ledgerTotal=45;
    visit();
    const user=userEvent.setup();
    await screen.findByText("حركة 1");
    await user.click(screen.getByRole("button",{name:"الصفحة التالية"}));
    await screen.findByText("حركة 21");
    await user.selectOptions(screen.getByRole("combobox",{name:"نوع الحركة المالية"}),"6");
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/customers/7/ledger"
      &&c.params.get("page")==="1"&&c.params.get("filter[type]")==="6")).toBe(true));
    expect(await screen.findByText("لا توجد حركات مالية")).toBeTruthy();
    expect(screen.queryByRole("button",{name:"ردود الأموال فقط"})).toBeNull();
  });

  it("allows authorized opening without read permission but requires explicit one-time confirmation",async()=>{
    permissions=["finance.opening_balances.create"];
    visit();
    const user=userEvent.setup();
    const openingButton=await screen.findByRole("button",{name:"رصيد افتتاحي"});
    await waitFor(()=>expect(openingButton.hasAttribute("disabled")).toBe(false));
    expect(within(await screen.findByRole("region",{name:"بيانات حساب العميل"})).queryByText("المزيد")).toBeNull();
    expect(calls.some(c=>c.url==="/finance/customers/7/ledger")).toBe(false);
    expect(calls.some(c=>c.url==="/finance/customers/7/balance")).toBe(false);
    await user.click(openingButton);
    const dialog=await screen.findByRole("dialog",{name:"تسجيل الرصيد الافتتاحي"});
    await user.selectOptions(within(dialog).getByRole("combobox",{name:"نوع الرصيد"}),"2");
    await user.type(within(dialog).getByRole("textbox",{name:"قيمة الرصيد"}),"150.50");
    expect(within(dialog).getByRole("button",{name:"تأكيد الرصيد الافتتاحي"}).hasAttribute("disabled")).toBe(true);
    await user.click(within(dialog).getByRole("checkbox",{name:"تأكيد تسجيل الرصيد الافتتاحي"}));
    await user.click(within(dialog).getByRole("button",{name:"تأكيد الرصيد الافتتاحي"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/customers/7/opening-balance"&&c.method==="post")).toBe(true));
    expect(calls.find(c=>c.url==="/finance/customers/7/opening-balance"&&c.method==="post")?.body)
      .toEqual({type:2,amount:"150.50"});
    await waitFor(()=>expect(openingButton.hasAttribute("disabled")).toBe(true));
    expect(screen.getByText("تم تسجيل الرصيد الافتتاحي لهذا العميل بالفعل.")).toBeTruthy();
    await user.click(openingButton);
    expect(screen.queryByRole("dialog",{name:"تسجيل الرصيد الافتتاحي"})).toBeNull();
    expect(calls.filter(c=>c.url==="/finance/customers/7/opening-balance"&&c.method==="post")).toHaveLength(1);
  });
  it("combines customer selection and account summary while explaining why debit customers cannot receive refunds",async()=>{
    permissions=["finance.balances.view","finance.ledger.view","finance.refunds.create"];
    visit();
    const card=await screen.findByRole("region",{name:"بيانات حساب العميل"});
    expect(within(card).queryByRole("navigation",{name:"مسار حساب العميل"})).toBeNull();
    expect(within(card).queryByRole("link",{name:"أحمد خالد"})).toBeNull();
    expect(within(card).queryByRole("combobox",{name:"اختيار حساب العميل"})).toBeNull();
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
    expect(screen.queryByRole("navigation",{name:"مسار حساب العميل"})).toBeNull();
    expect(screen.queryByRole("button",{name:"العودة إلى الحسابات"})).toBeNull();
    expect(screen.queryByRole("combobox",{name:"اختيار حساب العميل"})).toBeNull();
  });
  it("shows an opening balance button beside كشف الحساب for every permitted account in the list",async()=>{
    visit(""); const user=userEvent.setup();
    const section=await screen.findByRole("region",{name:"قائمة حسابات العملاء"});
    const row=await within(section).findByRole("row",{name:/أحمد خالد/});
    const view=within(row).getByRole("button",{name:"كشف الحساب"});
    const opening=within(row).getByRole("button",{name:"رصيد افتتاحي للعميل أحمد خالد"});
    expect(view.closest("td")).toBe(opening.closest("td"));
    expect(opening.hasAttribute("disabled")).toBe(false);
    const existing=await within(section).findByRole("row",{name:/مؤسسة النور/});
    const disabled=within(existing).getByRole("button",{name:"رصيد افتتاحي للعميل مؤسسة النور"});
    expect(disabled.hasAttribute("disabled")).toBe(true);
    expect(disabled.getAttribute("aria-describedby")).toBe("opening-recorded-8");
    await user.click(disabled);
    expect(calls.some(c=>c.url==="/finance/customers/8/opening-balance-status")).toBe(false);
    await user.click(opening);
    const dialog=await screen.findByRole("dialog",{name:"تسجيل الرصيد الافتتاحي"});
    expect(within(dialog).getByText("أحمد خالد")).toBeTruthy();
    expect(calls.some(c=>c.url==="/finance/customers/7/opening-balance-status")).toBe(true);
    await user.type(within(dialog).getByRole("textbox",{name:"قيمة الرصيد"}),"90.00");
    await user.click(within(dialog).getByRole("checkbox",{name:"تأكيد تسجيل الرصيد الافتتاحي"}));
    await user.click(within(dialog).getByRole("button",{name:"تأكيد الرصيد الافتتاحي"}));
    await waitFor(()=>{
      const freshRow=within(section).getByRole("row",{name:/أحمد خالد/});
      expect(within(freshRow).getByRole("button",{name:"رصيد افتتاحي للعميل أحمد خالد"}).hasAttribute("disabled")).toBe(true);
    });
    expect(calls.filter(c=>c.url==="/finance/customers/7/opening-balance"&&c.method==="post")).toHaveLength(1);
  });
  it("does not expose the opening balance action in the list without its permission",async()=>{
    permissions=["finance.balances.view","finance.ledger.view"];
    visit("");
    const section=await screen.findByRole("region",{name:"قائمة حسابات العملاء"});
    await within(section).findByRole("row",{name:/أحمد خالد/});
    expect(within(section).queryByRole("button",{name:/رصيد افتتاحي للعميل/})).toBeNull();
    expect(calls.some(c=>c.url.includes("opening-balance-status"))).toBe(false);
  });
  it("shows the opening balance action beside كشف الحساب in a phone account card",async()=>{
    const previous=window.innerWidth;
    try {
      window.innerWidth=375;
      visit("");
      const section=await screen.findByRole("region",{name:"قائمة حسابات العملاء"});
      const cards=await within(section).findByLabelText("قائمة حسابات العملاء للموبايل");
      const account=within(cards).getByText("أحمد خالد").closest("article");
      expect(account).not.toBeNull();
      expect(within(account!).getByRole("button",{name:"رصيد افتتاحي للعميل أحمد خالد"})).toBeTruthy();
      expect(within(account!).getByRole("button",{name:"كشف الحساب"})).toBeTruthy();
      const second=within(cards).getByText("مؤسسة النور").closest("article");
      expect(second).not.toBeNull();
      expect(within(second!).getByRole("button",{name:"رصيد افتتاحي للعميل مؤسسة النور"}).hasAttribute("disabled")).toBe(true);
    } finally {
      window.innerWidth=previous;
      window.dispatchEvent(new Event("resize"));
    }
  });
  it("opens the selected account without duplicate customer switch or back navigation",async()=>{
    visit("");const user=userEvent.setup();
    const section=await screen.findByRole("region",{name:"قائمة حسابات العملاء"});
    await user.click((await within(section).findAllByRole("button",{name:"كشف الحساب"}))[0]);
    await screen.findByText("سداد دين");
    expect(await screen.findByRole("region",{name:"بيانات حساب العميل"})).toBeTruthy();
    expect(screen.queryByRole("navigation",{name:"مسار حساب العميل"})).toBeNull();
    expect(screen.queryByRole("button",{name:"العودة إلى الحسابات"})).toBeNull();
    expect(screen.queryByRole("combobox",{name:"اختيار حساب العميل"})).toBeNull();
  });
  it("makes the customer name itself an underlined profile link only with Customers permission",async()=>{
    permissions=["finance.balances.view","finance.ledger.view","customers.view"];
    visit();
    const card=await screen.findByRole("region",{name:"بيانات حساب العميل"});
    const link=await within(card).findByRole("link",{name:"أحمد خالد"});
    expect(link.getAttribute("href")).toBe("/customers/7");
    expect(link.className).toContain("underline");
    expect(within(card).queryByText("ملف العميل")).toBeNull();
    expect(within(card).queryByRole("navigation",{name:"مسار حساب العميل"})).toBeNull();
  });
  it("keeps the opening balance button visible but disabled when already registered",async()=>{
    hasOpening=true;
    visit();
    await screen.findByRole("region",{name:"بيانات حساب العميل"});
    const tabs=await screen.findByRole("tablist",{name:"تفاصيل حساب العميل"});
    const openingButton=screen.getByRole("button",{name:"رصيد افتتاحي"});
    expect(tabs.parentElement?.contains(openingButton)).toBe(true);
    expect(within(tabs).queryByRole("button",{name:"رصيد افتتاحي"})).toBeNull();
    await waitFor(()=>expect(openingButton.hasAttribute("disabled")).toBe(true));
    expect(openingButton.getAttribute("aria-describedby")).toBe("account-opening-disabled-reason");
    expect(screen.getByText("تم تسجيل الرصيد الافتتاحي لهذا العميل بالفعل.")).toBeTruthy();
    expect(screen.queryByText("500.00 ج.م")).toBeNull();
    expect(within(screen.getByRole("region",{name:"بيانات حساب العميل"})).queryByText("المزيد")).toBeNull();
    await userEvent.setup().click(openingButton);
    expect(screen.queryByRole("dialog",{name:"تسجيل الرصيد الافتتاحي"})).toBeNull();
    expect(calls.filter(c=>c.url==="/finance/customers/7/opening-balance"&&c.method==="post")).toHaveLength(0);
    expect(calls.some(c=>c.url==="/finance/customers/7/opening-balance-status")).toBe(true);
  });
  it("shows the direct opening balance action next to the account tabs when authorized",async()=>{
    visit();
    const tabs=await screen.findByRole("tablist",{name:"تفاصيل حساب العميل"});
    const openingButton=screen.getByRole("button",{name:"رصيد افتتاحي"});
    expect(tabs.parentElement?.contains(openingButton)).toBe(true);
    await waitFor(()=>expect(openingButton.hasAttribute("disabled")).toBe(false));
    expect(within(tabs).getByRole("tab",{name:"كشف الحساب"})).toBeTruthy();
  });
  it("does not expose opening balance action or fetch its status without permission",async()=>{
    permissions=["finance.balances.view","finance.ledger.view"];
    visit();
    await screen.findByText("سداد دين");
    expect(screen.queryByRole("button",{name:"رصيد افتتاحي"})).toBeNull();
    expect(calls.some(c=>c.url==="/finance/customers/7/opening-balance-status")).toBe(false);
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
    expect(screen.queryByRole("navigation",{name:"مسار حساب العميل"})).toBeNull();
    expect(screen.queryByRole("link",{name:"أحمد خالد"})).toBeNull();
    expect(screen.queryByRole("combobox",{name:"اختيار حساب العميل"})).toBeNull();
    expect(calls.some(c=>c.url==="/finance/customers/7/balance")).toBe(false);
  });
});
