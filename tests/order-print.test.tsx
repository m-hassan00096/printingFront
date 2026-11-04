import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import { exactMoneyCents, depositedCents } from "@/features/orders/api/order-print.api";
import type { Order } from "@/features/orders/types/orders.types";
import type { Collection } from "@/features/collections/types/collections.types";

const original = apiClient.defaults.adapter;
const printed = vi.fn();
let allowed = true;
let isDraft = false;
let fails = false;
let records: Collection[] = [];
let requests: Array<{url:string;params:URLSearchParams}> = [];
const base: Order = {
  id:101,orderNumber:"ORD-2026-00991",customerId:5,customerName:"شركة النور",customerPhone:"01012345678",
  customerTypeId:null,customerTypeName:null,source:0,sourceLabel:"الفرع",status:1,statusLabel:"مؤكد",
  productionStatus:0,productionStatusLabel:"لم يبدأ",delayStatus:null,delayStatusLabel:null,
  dueDate:"2026-11-10",notes:null,itemsCount:2,totalAmount:"800.00",
  createdAt:"2026-11-02T10:00:00+02:00",updatedAt:null,confirmedAt:"2026-11-03T10:00:00+02:00",
  deliveredAt:null,cancelledAt:null,items:[
    {id:9,serviceId:11,serviceName:"كروت شخصية",customerTypeId:null,customerTypeName:null,quantity:100,
      agreedTotal:"350.00",unitPrice:"3.5000",pricingMethod:"quantity",widthCm:null,heightCm:null,
      pricingRateSnapshot:null,specifications:"ورق 350 جرام",productionStage:0,designerId:null,printingLocationId:null},
    {id:10,serviceId:12,serviceName:"بانر",customerTypeId:null,customerTypeName:null,quantity:5,
      agreedTotal:"450.00",unitPrice:"90.0000",pricingMethod:"square_meter",widthCm:"100",heightCm:"200",
      pricingRateSnapshot:null,specifications:"ألوان خارجية",productionStage:0,designerId:null,printingLocationId:null},
  ],
};
function receipt(id:number, change:Partial<Collection> = {}):Collection {
  return {id,receiptNumber:"COL-2026-"+id,actualReceiptNumber:null,customerId:5,customerName:"شركة النور",
    customerPhone:"01012345678",orderId:101,orderNumber:"ORD-2026-00991",correctedFromId:null,
    correctedToId:null,amount:"300.00",paymentMethod:0,paymentMethodLabel:"نقدي",paymentDestinationId:null,
    destinationLabel:null,source:1,sourceLabel:"عربون أوردر",status:1,statusLabel:"ساري",
    collectedOn:"2026-11-03",note:null,createdBy:1,createdAt:null,reversedAt:null,reversalReason:null,...change};
}
const adapter:AxiosAdapter = async (config:InternalAxiosRequestConfig) => {
  const url=config.url??"",params=config.params instanceof URLSearchParams
    ? config.params : new URLSearchParams(config.params as Record<string,string>);
  requests.push({url,params});
  const payload = (data:unknown) => ({config,status:200,statusText:"OK",headers:{},
    data:{success:true,message:"",data}});
  if(url==="/auth/me")return payload({name:"Admin",username:"admin",role:"admin",roleAlias:"مدير",
    status:1,statusLabel:"نشط",permissions:allowed
      ? ["orders.list","orders.view","finance.collections.view"]
      : ["orders.list","orders.view"]});
  if(url==="/orders")return payload({orders:[base],pagination:{currentPage:1,lastPage:1,perPage:15,total:1}});
  if(url==="/orders/101")return payload(isDraft?{...base,status:0,statusLabel:"مسودة",orderNumber:null,
    plannedDepositAmount:"500.00",confirmedAt:null}:base);
  if(url==="/finance/collections"){
    if(fails)throw Error("Could not verify receipts");
    return payload({collections:records,pagination:{currentPage:1,lastPage:1,perPage:100,total:records.length}});
  }
  throw Error("Unexpected request: "+url);
};
const visit=(path:string)=>{window.history.replaceState({},"",path);return render(<App/>);};
beforeEach(()=>{
  allowed=true;isDraft=false;fails=false;records=[receipt(31)];requests=[];printed.mockReset();
  vi.stubGlobal("print",printed);apiClient.defaults.adapter=adapter;
});
afterEach(()=>{apiClient.defaults.adapter=original;vi.unstubAllGlobals();});

describe("Print order as PDF",()=>{
  it("places PDF actions in the order list",async()=>{
    visit("/orders");
    const link=await screen.findByRole("link",{name:"طباعة PDF للأوردر ORD-2026-00991"});
    expect(link.getAttribute("href")).toBe("/orders/101/print");
    expect(link.getAttribute("target")).toBe("_blank");
  });
  it("prints verified items, prices, amount, payment method and real receipt",async()=>{
    visit("/orders/101/print");
    expect(await screen.findByRole("heading",{name:"بيان تفاصيل الأوردر"})).toBeTruthy();
    expect(screen.getByText("شركة النور")).toBeTruthy();
    const table=within(screen.getByRole("region",{name:"بنود الأوردر"})).getByRole("table");
    expect(within(table).getByText("كروت شخصية")).toBeTruthy();
    expect(within(table).getByText("بانر")).toBeTruthy();
    expect(within(table).getByText("100")).toBeTruthy();
    expect(within(table).getByText("450.00")).toBeTruthy();
    expect(screen.getByText("COL-2026-31")).toBeTruthy();
    expect(screen.getAllByText("800.00 ج.م")[0]).toBeTruthy();
    expect(screen.getAllByText("300.00 ج.م")[0]).toBeTruthy();
    expect(screen.getByText("مطبعة المصرية")).toBeTruthy();
    expect(screen.getByText("01012345678")).toBeTruthy();
    expect(screen.getByText("الباقي بعد العربون")).toBeTruthy();
    expect(screen.getByText("500.00 ج.م")).toBeTruthy();
    expect(screen.getByRole("heading",{name:"بنود الأوردر"})).toBeTruthy();
    expect(screen.getByRole("heading",{name:"ملخص الحساب"})).toBeTruthy();
    const summary=within(screen.getByRole("region",{name:"ملخص مبالغ الأوردر"}));
    expect(summary.getByText("العربون المدفوع فعليًا")).toBeTruthy();
    expect(summary.getByText("300.00 ج.م")).toBeTruthy();
    expect(summary.getByText("500.00 ج.م")).toBeTruthy();
    expect(screen.getAllByText("800.00 ج.م")).toHaveLength(1);
    expect(screen.queryByText("الإجمالي النهائي")).toBeNull();
    await userEvent.setup().click(screen.getByRole("button",{name:"طباعة / حفظ PDF"}));
    expect(printed).toHaveBeenCalled();
    expect(requests.some(r=>r.url==="/finance/collections" &&
      r.params.get("filter[source]")==="1" && r.params.get("filter[status]")==="1" &&
      r.params.get("filter[search]")==="ORD-2026-00991")).toBe(true);
  });
  it("excludes reversed, delivery and other-order receipts",async()=>{
    records=[receipt(31,{status:2}),receipt(32,{amount:"275.50"}),
      receipt(33,{source:2}),receipt(34,{orderId:500})];
    visit("/orders/101/print");
    expect(await screen.findByText("COL-2026-32")).toBeTruthy();
    expect(screen.queryByText("COL-2026-31")).toBeNull();
    expect(screen.queryByText("COL-2026-33")).toBeNull();
    expect(screen.getAllByText("275.50 ج.م")[0]).toBeTruthy();
    expect(screen.getByText("524.50 ج.م")).toBeTruthy();
  });
  it("never treats a planned draft deposit as paid",async()=>{
    isDraft=true;visit("/orders/101/print");
    expect(await screen.findByText("مسودة غير مؤكدة — لا توجد عملية تحصيل عربون مسجّلة.")).toBeTruthy();
    expect(screen.getByText("العربون المخطّط للمسودة ليس تحصيلًا فعليًا.")).toBeTruthy();
    expect(screen.getAllByText("800.00 ج.م")[0]).toBeTruthy();
    expect(requests.some(r=>r.url==="/finance/collections")).toBe(false);
  });
  it("does not silently print zero deposit on financial API failure",async()=>{
    fails=true;visit("/orders/101/print");
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.queryByRole("heading",{name:"بيان تفاصيل الأوردر"})).toBeNull();
    expect(printed).not.toHaveBeenCalled();
  });
  it("hides the action and protects the direct route without collection-view access",async()=>{
    allowed=false;visit("/orders");
    await screen.findByText("ORD-2026-00991");
    expect(screen.queryByRole("link",{name:/طباعة PDF للأوردر/})).toBeNull();
  });
  it("sums cents exactly",()=>{
    expect(exactMoneyCents("100.25")).toBe(10025);
    expect(depositedCents([receipt(1,{amount:"100.25"}),receipt(2,{amount:"200.35"})])).toBe(30060);
    expect(()=>exactMoneyCents("9.999")).toThrow();
  });
});
