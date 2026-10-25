import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";
import type { Order } from "@/features/orders/types/orders.types";

const originalAdapter = apiClient.defaults.adapter;
const permissions = ["orders.list", "orders.view", "orders.create", "orders.confirm", "orders.cancel",
  "orders.items.create", "orders.items.update", "orders.items.delete", "orders.files.list",
  "customers.view", "printing_services.view", "printing_services.price_preview.view"];
let calls: Array<{ url: string; method: string; query: URLSearchParams; body: Record<string, unknown>; key: string | null }>;
let orders: Order[];
const page = { currentPage: 1, lastPage: 1, perPage: 15, total: 1 };
function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { config, status, statusText: String(status), headers: {}, data: { success: true, message: "", data } };
}
const adapter: AxiosAdapter = async (config) => {
  const url = config.url ?? "";
  const query = config.params instanceof URLSearchParams
    ? config.params : new URLSearchParams(config.params as Record<string, string>);
  const body = typeof config.data === "string" ? JSON.parse(config.data) as Record<string, unknown> : {};
  const key = config.headers.get("Idempotency-Key");
  calls.push({url,method:config.method ?? "",query,body,key:key?.toString() ?? null});
  if (url === "/auth/me") {
    const user: AuthUser = { name: "Admin", username: "admin", role: "admin",
      roleAlias: "مدير النظام", status: 1, statusLabel: "نشط", permissions };
    return response(config, user);
  }
  if (url === "/orders" && config.method === "get") return response(config, { orders, pagination: page });
  if (url === "/orders" && config.method === "post") return response(config, null, 201);
  if (url === "/selects" && query.get("selects") === "activeCustomers,printingServices")
    return response(config, [
      { label:"activeCustomers", options:[{value:5,label:"أحمد - 01012345678"}] },
      { label:"printingServices", options:[{value:11,label:"كروت شخصية"}] },
    ]);
  if (url === "/customers/5" && config.method === "get")
    return response(config, {id:5,name:"أحمد",phone:"01012345678",customerTypeId:21,status:1});
  if (url === "/customers" && config.method === "get") return response(config, {
    customers: [{id:5,name:"أحمد",phone:"01012345678",address:null,status:1,statusLabel:"نشط",
      customerTypeId:21,customerType:{id:21,name:"شركة"}}], pagination:page,
  });
  if (url === "/printing-services" && config.method === "get") return response(config, {
    printingServices:[{id:11,name:"كروت شخصية",status:1,basePrice:"5.00"}],pagination:page,
  });
  if (url === "/printing-services/price-preview" && config.method === "post") return response(config, {
    serviceId: 11, quantity: 100, source: "basePrice",
    suggestedUnitPrice: "5.00", suggestedTotal: "500.00", requiresManualTotal: false,
  });
  if (url === "/orders/101" && config.method === "get") return response(config, {
    ...orders[0], items: [{id:9,serviceId:11,serviceName:"كروت شخصية",customerTypeId:21,
      customerTypeName:"شركة",quantity:100,agreedTotal:"350.00",unitPrice:"3.5000",
      specifications:null,productionStage:0,designerId:null,printingLocationId:null}],
  });
  if (url === "/orders/101/activities") return response(config, { activities:[], pagination:page });
  if (url === "/orders/101/items/9/files") return response(config, []);
  if (url === "/orders/101/confirm" && config.method === "post") {
    orders[0] = {...orders[0], status:1, statusLabel:"مؤكد", orderNumber:"ORD-2026-00001"};
    return response(config, null);
  }
  throw new Error(`Unexpected request ${config.method} ${url}`);
};
function visit(route: string) {window.history.replaceState({}, "", route);return render(<App />);}
beforeEach(() => {
  calls=[];
  orders=[{id:101,orderNumber:null,customerId:5,customerName:"أحمد",customerPhone:"01012345678",
    customerTypeId:21,customerTypeName:"شركة",source:0,sourceLabel:"الفرع",status:0,statusLabel:"مسودة",
    productionStatus:null,productionStatusLabel:null,delayStatus:null,delayStatusLabel:null,
    dueDate:null,notes:null,itemsCount:1,totalAmount:"350.00",createdAt:null,updatedAt:null,
    confirmedAt:null,deliveredAt:null,cancelledAt:null}];
  apiClient.defaults.adapter=adapter;
});
afterEach(() => {apiClient.defaults.adapter=originalAdapter;});

describe("Orders Laravel API workflow", () => {
  it("lists orders using the exact lateOnly and production filters", async () => {
    visit("/orders");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    const user=userEvent.setup();
    await user.click(screen.getByRole("checkbox", { name:"المتأخرة فقط" }));
    await waitFor(() => expect(calls.some(c=>c.url==="/orders" && c.query.get("filter[lateOnly]")==="1")).toBe(true));
    await user.selectOptions(screen.getByRole("combobox",{name:"حالة الإنتاج"}),"3");
    await waitFor(() => expect(calls.some(c=>c.url==="/orders" && c.query.get("filter[productionStatus]")==="3")).toBe(true));
  });

  it("creates a draft with registered customer, agreed total, source enum and idempotency key", async () => {
    visit("/orders/new");
    expect(await screen.findByRole("heading",{name:"إضافة أوردر"})).toBeTruthy();
    const user=userEvent.setup();
    await screen.findByRole("option", { name: /أحمد - 01012345678/ });
    await user.selectOptions(await screen.findByRole("combobox",{name:"اختيار العميل"}),"5");
    await screen.findByRole("option", { name: "كروت شخصية" });
    await user.selectOptions(await screen.findByRole("combobox",{name:"خدمة العنصر 1"}),"11");
    await user.clear(screen.getByRole("spinbutton",{name:"كمية العنصر 1"}));
    await user.type(screen.getByRole("spinbutton",{name:"كمية العنصر 1"}),"100");
    await user.type(screen.getByRole("textbox",{name:"إجمالي العنصر 1"}),"350.00");
    await user.click(screen.getByRole("button",{name:"حفظ مسودة الأوردر"}));
    await waitFor(() => expect(calls.some(c=>c.url==="/orders"&&c.method==="post")).toBe(true));
    const post=calls.find(c=>c.url==="/orders"&&c.method==="post");
    expect(post?.body).toMatchObject({customerId:5,source:0,status:0,items:[
      {serviceId:11,quantity:100,agreedTotal:"350.00"},
    ]});
    expect(post?.key?.length).toBeGreaterThan(0);
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
  });

  it("confirms a draft using a new idempotent backend operation", async () => {
    visit("/orders/101");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button",{name:"تأكيد الأوردر"}));
    expect(await screen.findByRole("dialog",{name:"تأكيد الأوردر"})).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button",{name:"تأكيد",exact:true}));
    await waitFor(() => expect(calls.some(c=>c.url==="/orders/101/confirm")).toBe(true));
    const confirm=calls.find(c=>c.url==="/orders/101/confirm");
    expect(confirm?.body).toEqual({});
    expect(confirm?.key?.length).toBeGreaterThan(0);
    expect(await screen.findByText("ORD-2026-00001")).toBeTruthy();
  });
});
