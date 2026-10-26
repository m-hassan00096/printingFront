import { afterEach,beforeEach,describe,expect,it } from "vitest";
import { render,screen,waitFor,within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosAdapter,AxiosResponse,InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";

const original=apiClient.defaults.adapter;
let permissions=["finance.refunds.view","finance.refunds.create"];
let credit="150.00";
let records=[{
  id:91,refundNumber:"REF-2026-00091",customerId:7,customerName:"أحمد خالد",
  amount:"40.00",paymentMethod:0,paymentMethodLabel:"نقدي",
  paymentDestinationId:null,destinationLabel:null,reason:"تم رد المبلغ",
  refundedOn:"2026-10-26",createdBy:1,createdAt:"2026-10-26T12:00:00+03:00",
}];
let calls:{url:string;method:string;params:URLSearchParams;body:Record<string,unknown>;key:string|null}[]=[];
function ok(config:InternalAxiosRequestConfig,data:unknown):AxiosResponse{
  return {config,status:200,statusText:"OK",headers:{},data:{success:true,message:"",data}};
}
const adapter:AxiosAdapter=async config=>{
  const url=config.url??"";
  const method=config.method??"get";
  const params=config.params instanceof URLSearchParams?config.params:new URLSearchParams(config.params as Record<string,string>);
  const body=typeof config.data==="string"?JSON.parse(config.data) as Record<string,unknown>:{};
  const key=config.headers.get("Idempotency-Key")?.toString()??null;
  calls.push({url,method,params,body,key});
  if(url==="/auth/me"){
    const user:AuthUser={username:"admin",name:"محاسب",role:"admin",roleAlias:"محاسب",
      status:1,statusLabel:"نشط",permissions};
    return ok(config,user);
  }
  if(url==="/selects"&&params.get("selects")==="customers")return ok(config,[
    {label:"customers",options:[{value:7,label:"أحمد خالد - 01012345678"}]},
  ]);
  if(url==="/selects"&&params.get("selects")==="bankAccounts,eWallets")return ok(config,[
    {label:"bankAccounts",options:[{value:3,label:"حساب بنك مصر"}]},
    {label:"eWallets",options:[{value:4,label:"فودافون كاش"}]},
  ]);
  if(url==="/finance/customers/7/refundable-credit")return ok(config,{
    customerId:7,availableCredit:credit,canRefund:Number(credit)>0,
  });
  if(url==="/finance/refunds"&&method==="get"){
    let found=records;
    if(params.get("filter[paymentMethod]"))found=found.filter(x=>String(x.paymentMethod)===params.get("filter[paymentMethod]"));
    return ok(config,{refunds:found,pagination:{currentPage:1,lastPage:1,perPage:20,total:found.length}});
  }
  if(url==="/finance/refunds/91"&&method==="get")return ok(config,records[0]);
  if(url==="/finance/refunds"&&method==="post"){
    credit="50.00";
    return ok(config,{id:92,refundNumber:"REF-2026-00092"});
  }
  throw Error("Unexpected request "+method+" "+url);
};
function visit(path="/finance?tab=refunds"){
  window.history.replaceState({},"",path);
  return render(<App/>);
}
beforeEach(()=>{
  apiClient.defaults.adapter=adapter;
  permissions=["finance.refunds.view","finance.refunds.create"];
  credit="150.00";
  calls=[];
  records=[{
    id:91,refundNumber:"REF-2026-00091",customerId:7,customerName:"أحمد خالد",
    amount:"40.00",paymentMethod:0,paymentMethodLabel:"نقدي",
    paymentDestinationId:null,destinationLabel:null,reason:"تم رد المبلغ",
    refundedOn:"2026-10-26",createdBy:1,createdAt:"2026-10-26T12:00:00+03:00",
  }];
});
afterEach(()=>{apiClient.defaults.adapter=original;});
describe("Finance Refunds within the Accounts module",()=>{
  it("lists refunds with filters and immutable details without fetching unauthorized accounts",async()=>{
    permissions=["finance.refunds.view"];visit("/finance");
    expect(await screen.findByText("REF-2026-00091")).toBeTruthy();
    expect(screen.getByText("26/10/2026")).toBeTruthy();
    expect(screen.queryByRole("button",{name:"رد رصيد دائن"})).toBeNull();
    expect(calls.some(c=>c.url==="/finance/customer-balances")).toBe(false);
    expect(calls.some(c=>c.url==="/selects")).toBe(false);
    const user=userEvent.setup();
    await user.selectOptions(screen.getByRole("combobox",{name:"فلتر طريقة رد الأموال"}),"1");
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/refunds"&&c.params.get("filter[paymentMethod]")==="1")).toBe(true));
    await user.selectOptions(screen.getByRole("combobox",{name:"فلتر طريقة رد الأموال"}),"");
    await user.click(await screen.findByRole("button",{name:"التفاصيل"}));
    const dialog=await screen.findByRole("dialog",{name:"تفاصيل رد الرصيد"});
    expect(within(dialog).getByText("تم رد المبلغ")).toBeTruthy();
    expect(within(dialog).queryByRole("button",{name:/حذف|تعديل/})).toBeNull();
  });
  it("rejects excess credit and requires physical-refund acknowledgement before posting",async()=>{
    permissions=["finance.refunds.create"];visit();
    const user=userEvent.setup();
    expect(await screen.findByRole("button",{name:"رد رصيد دائن"})).toBeTruthy();
    expect(calls.some(c=>c.url==="/finance/refunds"&&c.method==="get")).toBe(false);
    await user.click(screen.getByRole("button",{name:"رد رصيد دائن"}));
    const dialog=await screen.findByRole("dialog",{name:"رد رصيد دائن للعميل"});
    await user.click(within(dialog).getByRole("combobox",{name:"عميل رد الرصيد"}));
    await user.click(await within(dialog).findByRole("option",{name:/أحمد خالد/}));
    expect(await within(dialog).findByText("الرصيد المتاح للرد حاليًا")).toBeTruthy();
    await user.type(within(dialog).getByRole("textbox",{name:"مبلغ رد الرصيد"}),"200.00");
    expect(within(dialog).getByText("المبلغ يتجاوز الرصيد الدائن المتاح.")).toBeTruthy();
    expect(within(dialog).getByRole("button",{name:"تأكيد رد الرصيد"}).hasAttribute("disabled")).toBe(true);
    await user.clear(within(dialog).getByRole("textbox",{name:"مبلغ رد الرصيد"}));
    await user.type(within(dialog).getByRole("textbox",{name:"مبلغ رد الرصيد"}),"100.00");
    await user.type(within(dialog).getByRole("textbox",{name:"سبب رد الرصيد"}),"طلب العميل");
    expect(within(dialog).getByRole("button",{name:"تأكيد رد الرصيد"}).hasAttribute("disabled")).toBe(true);
    await user.click(within(dialog).getByRole("checkbox",{name:"تأكيد رد الأموال فعليًا"}));
    await user.click(within(dialog).getByRole("button",{name:"تأكيد رد الرصيد"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/refunds"&&c.method==="post")).toBe(true));
    const post=calls.find(c=>c.url==="/finance/refunds"&&c.method==="post");
    expect(post?.body).toEqual({customerId:7,amount:"100.00",paymentMethod:0,reason:"طلب العميل"});
    expect(post?.key).toBeTruthy();
    expect(calls.filter(c=>c.url==="/finance/collections"&&c.method==="post")).toHaveLength(0);
  });
  it("requires bank or wallet destination from Settings before recording refund",async()=>{
    visit();const user=userEvent.setup();
    await user.click(await screen.findByRole("button",{name:"رد رصيد دائن"}));
    const dialog=await screen.findByRole("dialog",{name:"رد رصيد دائن للعميل"});
    await user.click(within(dialog).getByRole("combobox",{name:"عميل رد الرصيد"}));
    await user.click(await within(dialog).findByRole("option",{name:/أحمد خالد/}));
    await within(dialog).findByText("الرصيد المتاح للرد حاليًا");
    await user.type(within(dialog).getByRole("textbox",{name:"مبلغ رد الرصيد"}),"70.00");
    await user.type(within(dialog).getByRole("textbox",{name:"سبب رد الرصيد"}),"رد متفق عليه");
    await user.selectOptions(within(dialog).getByRole("combobox",{name:"طريقة رد الرصيد"}),"1");
    await user.click(within(dialog).getByRole("checkbox",{name:"تأكيد رد الأموال فعليًا"}));
    expect(within(dialog).getByRole("button",{name:"تأكيد رد الرصيد"}).hasAttribute("disabled")).toBe(true);
    await user.click(within(dialog).getByRole("combobox",{name:"حساب رد الأموال"}));
    await user.click(await within(dialog).findByRole("option",{name:"حساب بنك مصر"}));
    await user.click(within(dialog).getByRole("checkbox",{name:"تأكيد رد الأموال فعليًا"}));
    await user.click(within(dialog).getByRole("button",{name:"تأكيد رد الرصيد"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/finance/refunds"&&c.method==="post")).toBe(true));
    expect(calls.find(c=>c.url==="/finance/refunds"&&c.method==="post")?.body).toEqual({
      customerId:7,amount:"70.00",paymentMethod:1,paymentDestinationId:3,reason:"رد متفق عليه",
    });
  });
});
