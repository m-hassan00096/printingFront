import { afterEach,beforeEach,describe,expect,it } from "vitest";
import { render,screen,waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosAdapter,AxiosResponse,InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";
import type { DashboardData } from "@/features/dashboard/types/dashboard.types";

const original=apiClient.defaults.adapter;
let permissions=["orders.list","orders.view","orders.create","production.items.list","deliveries.list"];
let calls:string[]=[];
let data:DashboardData={
  asOfDate:"2026-10-26",
  metrics:{activeOrders:7,overdueOrders:6,readyForDelivery:3,dueToday:0},
  productionPressure:{notStarted:1,design:2,printing:4,ready:3},
  attentionOrders:[
    {id:15,orderNumber:"ORD-261015001",customerName:"أحمد",dueDate:"2026-10-24",
      productionStatus:1,productionStatusLabel:"في الإنتاج",isOverdue:true},
    {id:16,orderNumber:"ORD-261016001",customerName:"نورا",dueDate:"2026-10-26",
      productionStatus:3,productionStatusLabel:"جاهز للتسليم",isOverdue:false},
  ],
  latestOrders:[
    {id:16,orderNumber:"ORD-261016001",customerName:"نورا",dueDate:"2026-10-26",
      productionStatus:3,productionStatusLabel:"جاهز للتسليم",isOverdue:false},
  ],
};
function ok(config:InternalAxiosRequestConfig,value:unknown):AxiosResponse{
  return {config,status:200,statusText:"OK",headers:{},data:{success:true,message:"",data:value}};
}
const adapter:AxiosAdapter=async config=>{
  const path=config.url??"";
  calls.push(path);
  if(path==="/auth/me"){
    const user:AuthUser={username:"admin",name:"مدير",role:"admin",roleAlias:"مدير",
      status:1,statusLabel:"نشط",permissions};
    return ok(config,user);
  }
  if(path==="/dashboard")return ok(config,data);
  throw Error("Unexpected request: "+path);
};
function visit(){
  window.history.replaceState({},"","/");
  return render(<App/>);
}
beforeEach(()=>{
  apiClient.defaults.adapter=adapter;
  calls=[];
  permissions=["orders.list","orders.view","orders.create","production.items.list","deliveries.list"];
});
afterEach(()=>{apiClient.defaults.adapter=original;});

describe("Live dashboard contract",()=>{
  it("renders real order metrics, stage ITEM pressure, attention and latest entries",async()=>{
    visit();
    expect(await screen.findByText("ضغط الإنتاج")).toBeTruthy();
    expect(screen.getByText("الأوردرات النشطة")).toBeTruthy();
    expect(screen.getByText("الأوردرات المتأخرة")).toBeTruthy();
    expect(screen.getByText("جاهزة للتسليم")).toBeTruthy();
    expect(screen.getByText("تسليمات اليوم")).toBeTruthy();
    expect(screen.getAllByText(/ORD-261015001/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("ORD-261016001").length).toBeGreaterThan(0);
    expect(screen.getByRole("meter",{name:"الطباعة"}).getAttribute("aria-valuenow")).toBe("4");
    expect(screen.getByText("10")).toBeTruthy();
    expect(screen.getAllByRole("link",{name:/أوردر جديد/}).length).toBeGreaterThan(0);
    expect(calls.filter(x=>x==="/dashboard")).toHaveLength(1);
  });
  it("handles an empty day without mock/demo orders",async()=>{
    data={...data,metrics:{activeOrders:0,overdueOrders:0,readyForDelivery:0,dueToday:0},
      productionPressure:{notStarted:0,design:0,printing:0,ready:0},
      attentionOrders:[],latestOrders:[]};
    visit();
    expect(await screen.findByText("لا توجد أوردرات بمواعيد تسليم تحتاج المتابعة حاليًا.")).toBeTruthy();
    expect(screen.getByText("لا توجد أوردرات مؤَكدة حتى الآن.")).toBeTruthy();
    expect(screen.getByRole("meter",{name:"التصميم"}).getAttribute("aria-valuenow")).toBe("0");
  });
  it("hides all order data and does not call dashboard API for users without orders.list",async()=>{
    permissions=["production.items.list"];
    visit();
    expect(await screen.findByText(/ملخص الأوردرات يحتاج صلاحية عرض قائمة الأوردرات/)).toBeTruthy();
    expect(screen.queryByText("الأوردرات النشطة")).toBeNull();
    expect(screen.queryByText("آخر الأوردرات")).toBeNull();
    expect(screen.getAllByRole("link",{name:/لوحة الإنتاج/}).length).toBeGreaterThan(0);
    expect(calls.includes("/dashboard")).toBe(false);
  });
  it("only shows permitted quick links and re-fetches on refresh",async()=>{
    permissions=["orders.list"];
    visit();
    const user=userEvent.setup();
    await screen.findByText("ضغط الإنتاج");
    expect(screen.queryByRole("link",{name:/أوردر جديد/})).toBeNull();
    expect(screen.queryByRole("link",{name:/لوحة الإنتاج/})).toBeNull();
    await user.click(screen.getByRole("button",{name:"تحديث"}));
    await waitFor(()=>expect(calls.filter(x=>x==="/dashboard").length).toBeGreaterThan(1));
  });
});
