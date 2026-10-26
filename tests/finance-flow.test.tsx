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
let ledgerEntries=[{
  id:100,type:2,typeLabel:"تحصيل",amount:"50.00",signedAmount:"-50.00",
  orderId:null,collectionId:12,refundId:null,effectiveDate:"2026-10-26",
  note:"سداد دين",createdAt:"2026-10-26T10:00:00+03:00",
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
  if(url==="/finance/customers/7/balance"&&method==="get")return ok(config,balance);
  if(url==="/finance/customers/7/ledger"&&method==="get")return ok(config,{
    entries:params.get("filter[type]")==="6"?[]:ledgerEntries,
    balance:{amount:balance.amount,type:balance.type,typeLabel:balance.typeLabel},
    pagination:{currentPage:1,lastPage:1,perPage:20,total:params.get("filter[type]")==="6"?0:1},
  });
  if(url==="/finance/customers/7/opening-balance"&&method==="post"){
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
});
afterEach(()=>{apiClient.defaults.adapter=original;});
describe("Finance account page against Laravel existing contracts",()=>{
  it("shows current debit balance and paginated ledger with signed debit/credit distinction",async()=>{
    visit();
    expect(await screen.findByText("حسابات العملاء")).toBeTruthy();
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
