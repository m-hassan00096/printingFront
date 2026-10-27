import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";
import type { Order } from "@/features/orders/types/orders.types";

const originalAdapter = apiClient.defaults.adapter;
const permissions = ["orders.list", "orders.view", "orders.create", "orders.confirm", "orders.cancel",
  "orders.items.create", "orders.items.update", "orders.items.delete", "orders.files.list", "orders.files.view", "orders.files.delete", "orders.update", "orders.activities.view",
  "customers.view", "customers.create", "customers.update", "printing_services.view", "printing_services.price_preview.view", "finance.balances.view"];
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
  if (url === "/selects" && query.get("selects") === "activeCustomers")
    return response(config, [{label:"activeCustomers",options:[
      {value:5,label:"أحمد — 01012345678"},
      {value:6,label:"عميل آخر — 01099999999"}
    ]}]);
  if (url === "/selects" && query.get("selects") === "printingServices")
    return response(config, [{label:"printingServices",options:[
      {value:11,label:"كروت شخصية"},{value:12,label:"رول أب"}
    ]}]);
  if (url === "/selects" && query.get("selects") === "bankAccounts,eWallets")
    return response(config, [
      { label:"bankAccounts", options:[{value:6,label:"بنك آخر",isDefault:0},{value:7,label:"بنك مصر - ****1234",isDefault:1}] },
      { label:"eWallets", options:[{value:8,label:"محفظة أخرى",isDefault:0},{value:9,label:"المحفظة - ****5678",isDefault:1}] },
    ]);
  if (url === "/selects" && query.get("selects") === "customerTypes")
    return response(config, [{label:"customerTypes",options:[{value:21,label:"شركة"}]}]);
  if (url === "/customers" && config.method === "post") return response(config, {
    id:6,name:String(body.name),phone:String(body.phone),status:1,statusLabel:"نشط",
    customerTypeId:21,customerType:{id:21,name:"شركة"},address:null,
  },201);
  if (url === "/finance/customers/5/balance" && config.method === "get")
    return response(config, { customerId:5, amount:"0.00",type:0,typeLabel:"رصيد صفر" });
  if (url === "/customers/5" && config.method === "get")
    return response(config, {id:5,name:"أحمد",phone:"01012345678",customerTypeId:21,status:1,
      address:null,statusLabel:"نشط",customerType:{id:21,name:"شركة"}});
  if (url === "/customers/5" && config.method === "patch") return response(config, null);
  if (url === "/orders/101" && config.method === "patch") {
    orders[0] = { ...orders[0],
      plannedDepositAmount: typeof body.plannedDepositAmount === "string"
        ? body.plannedDepositAmount : orders[0].plannedDepositAmount,
      plannedPaymentMethod: typeof body.plannedPaymentMethod === "number"
        ? body.plannedPaymentMethod as 0 | 1 | 2 : body.plannedPaymentMethod === null
          ? null : orders[0].plannedPaymentMethod,
      plannedPaymentDestinationId: typeof body.plannedPaymentDestinationId === "number"
        ? body.plannedPaymentDestinationId : body.plannedPaymentDestinationId === null
          ? null : orders[0].plannedPaymentDestinationId,
    };
    return response(config, null);
  }
  if (url === "/orders/101/items/9" && config.method === "patch") return response(config, null);
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
  if (url === "/orders/101/activities") return response(config, { activities:[
    {id:2,eventType:"file_uploaded",actorId:1,createdAt:"2026-10-25T22:32:49+00:00",context:null},
    {id:1,eventType:"draft_created",actorId:1,createdAt:"2026-10-25T22:32:12+00:00",context:null},
  ], pagination:page });
  if (url === "/orders/101/items/9/files") return response(config, [
    {id:31,name:"تصميم.png",extension:"png",mimeType:"image/png",sizeBytes:102400,
      url:"http://localhost:8000/storage/orders/101/9/preview.png",createdAt:null},
    {id:32,name:"ملف.pdf",extension:"pdf",mimeType:"application/pdf",sizeBytes:204800,url:null,createdAt:null},
    {id:33,name:"ملف.psd",extension:"psd",mimeType:"application/octet-stream",sizeBytes:512000,url:null,createdAt:null},
  ]);
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

  it("keeps historic lateness distinct from current overdue orders", async () => {
    visit("/orders?lateOnly=1&openOnly=1");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    const query=calls.find(c=>c.url==="/orders"&&c.query.get("filter[lateOnly]")==="1");
    expect(query?.query.get("filter[openOnly]")).toBe("1");
    const user=userEvent.setup();
    await user.click(screen.getByRole("checkbox",{name:"لم يتم تسليمها"}));
    await waitFor(()=>expect(calls.some(c=>c.url==="/orders"&&c.query.get("filter[lateOnly]")==="1"&&c.query.get("filter[openOnly]")===null)).toBe(true));
  });

  it("creates a draft with registered customer, agreed total, source enum and idempotency key", async () => {
    visit("/orders/new");
    expect(await screen.findByRole("heading",{name:"إضافة أوردر"})).toBeTruthy();
    const user=userEvent.setup();
    await user.click(await screen.findByRole("combobox",{name:"اختيار العميل"}));
    await user.click(await screen.findByRole("option", { name: /أحمد - 01012345678/ }));
    await user.click(await screen.findByRole("combobox",{name:"خدمة العنصر 1"}));
    await user.click(await screen.findByRole("option", { name: "كروت شخصية" }));
    await user.clear(screen.getByRole("spinbutton",{name:"كمية العنصر 1"}));
    await user.type(screen.getByRole("spinbutton",{name:"كمية العنصر 1"}),"100");
    await user.type(screen.getByRole("textbox",{name:"إجمالي العنصر 1"}),"350.00");
    await user.click(screen.getByRole("button",{name:"حفظ مسودة"}));
    await waitFor(() => expect(calls.some(c=>c.url==="/orders"&&c.method==="post")).toBe(true));
    const post=calls.find(c=>c.url==="/orders"&&c.method==="post");
    expect(post?.body).toMatchObject({customerId:5,source:0,status:0,items:[
      {serviceId:11,quantity:100,agreedTotal:"350.00"},
    ]});
    expect(post?.key?.length).toBeGreaterThan(0);
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
  });


  it("confirms a draft from a read-only review with no deposit", async () => {
    visit("/orders/101");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button",{name:"تأكيد الأوردر"}));
    const review = await screen.findByRole("dialog",{name:"تأكيد الأوردر"});
    expect(within(review).queryByRole("textbox",{name:"قيمة العربون"})).toBeNull();
    expect(within(review).getByText("بدون عربون")).toBeTruthy();
    await userEvent.setup().click(within(review).getByRole("button",{name:"تأكيد الأوردر"}));
    await waitFor(() => expect(calls.some(c=>c.url==="/orders/101/confirm")).toBe(true));
    const confirm=calls.find(c=>c.url==="/orders/101/confirm");
    expect(confirm?.body).toEqual({});
    expect(confirm?.key?.length).toBeGreaterThan(0);
    expect(await screen.findByText("ORD-2026-00001")).toBeTruthy();
  });


  it("shows the saved bank and its destination at review, without editable payment inputs", async () => {
    orders[0] = {...orders[0],plannedDepositAmount:"50.00",plannedPaymentMethod:1,plannedPaymentDestinationId:7};
    visit("/orders/101");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button",{name:"تأكيد الأوردر"}));
    const review = await screen.findByRole("dialog",{name:"تأكيد الأوردر"});
    expect(within(review).queryByRole("textbox",{name:"قيمة العربون"})).toBeNull();
    expect(within(review).getByText("تحويل بنكي")).toBeTruthy();
    expect(within(review).getByText("50.00 ج.م")).toBeTruthy();
    expect(await within(review).findByText("بنك مصر - ****1234")).toBeTruthy();
    await userEvent.setup().click(within(review).getByRole("button",{name:"تأكيد الأوردر وتحصيل العربون"}));
    await waitFor(() => expect(calls.some(c=>c.url==="/orders/101/confirm")).toBe(true));
    expect(calls.find(c=>c.url==="/orders/101/confirm")?.body)
      .toEqual({depositAmount:"50.00",paymentMethod:1,paymentDestinationId:7});
  });

  it("creates and selects a new customer without leaving the order form", async () => {
    visit("/orders/new");
    const user=userEvent.setup();
    await user.click(await screen.findByRole("combobox",{name:"اختيار العميل"}));
    await user.click(screen.getByRole("button",{name:"إضافة عميل جديد"}));
    expect(await screen.findByRole("dialog",{name:"إضافة عميل"})).toBeTruthy();
    await user.type(screen.getByRole("textbox",{name:"اسم العميل"}),"عميل جديد");
    await user.type(screen.getByRole("textbox",{name:"رقم الهاتف"}),"01088888888");
    await user.selectOptions(await screen.findByRole("combobox",{name:"نوع العميل"}),"21");
    await user.click(screen.getByRole("button",{name:"إضافة العميل"}));
    await waitFor(() => expect(calls.some(c=>c.url==="/customers" && c.method==="post")).toBe(true));
    expect(await screen.findByRole("combobox",{name:"اختيار العميل"})).toHaveProperty("value","عميل جديد - 01088888888");
  });

  it("confirms directly from creation with the default bank destination", async () => {
    visit("/orders/new");
    const user=userEvent.setup();
    await user.click(await screen.findByRole("combobox",{name:"اختيار العميل"}));
    await user.click(await screen.findByRole("option",{name:/أحمد - 01012345678/}));
    await user.click(await screen.findByRole("combobox",{name:"خدمة العنصر 1"}));
    await user.click(await screen.findByRole("option",{name:"كروت شخصية"}));
    await user.type(screen.getByRole("textbox",{name:"إجمالي العنصر 1"}),"350.00");
    await user.clear(screen.getByRole("textbox",{name:"المدفوع الآن"}));
    await user.type(screen.getByRole("textbox",{name:"المدفوع الآن"}),"100.00");
    await user.click(screen.getByRole("button",{name:"تحويل بنكي"}));
    await waitFor(() => expect((screen.getByRole("combobox",{name:"وجهة تحصيل العربون"}) as HTMLSelectElement).value).toBe("7"));
    await user.click(screen.getByRole("button",{name:"تأكيد الأوردر"}));
    await waitFor(() => expect(calls.some(c=>c.url==="/orders" && c.method==="post")).toBe(true));
    const created=calls.find(c=>c.url==="/orders" && c.method==="post");
    expect(created?.body).toMatchObject({
      status:1,customerId:5,depositAmount:"100.00",paymentMethod:1,paymentDestinationId:7,
    });
    expect(created?.key?.length).toBeGreaterThan(0);
  });

  it("switching to wallet automatically chooses its configured default", async () => {
    visit("/orders/new");
    const user=userEvent.setup();
    await user.clear(await screen.findByRole("textbox",{name:"المدفوع الآن"}));
    await user.type(screen.getByRole("textbox",{name:"المدفوع الآن"}),"5");
    await user.click(screen.getByRole("button",{name:"محفظة إلكترونية"}));
    await waitFor(() => expect((screen.getByRole("combobox",{name:"وجهة تحصيل العربون"}) as HTMLSelectElement).value).toBe("9"));
  });

  it("requires explicit acknowledgement for deposit exceeding the order", async () => {
    visit("/orders/new");
    const user=userEvent.setup();
    await user.click(await screen.findByRole("combobox",{name:"اختيار العميل"}));
    await user.click(await screen.findByRole("option",{name:/أحمد - 01012345678/}));
    await user.click(await screen.findByRole("combobox",{name:"خدمة العنصر 1"}));
    await user.click(await screen.findByRole("option",{name:"كروت شخصية"}));
    await user.type(screen.getByRole("textbox",{name:"إجمالي العنصر 1"}),"50.00");
    await user.clear(screen.getByRole("textbox",{name:"المدفوع الآن"}));
    await user.type(screen.getByRole("textbox",{name:"المدفوع الآن"}),"100.00");
    await user.click(screen.getByRole("button",{name:"تأكيد الأوردر"}));
    expect(await screen.findByText(/يجب تأكيد تحويل المبلغ الزائد/)).toBeTruthy();
    expect(calls.filter(c=>c.url==="/orders" && c.method==="post")).toHaveLength(0);
    await user.click(screen.getByRole("checkbox",{name:"تأكيد الزيادة عن قيمة الأوردر"}));
    await user.click(screen.getByRole("button",{name:"تأكيد الأوردر"}));
    await waitFor(() => expect(calls.filter(c=>c.url==="/orders" && c.method==="post")).toHaveLength(1));
  });


  it("reviews a saved wallet deposit using its stored destination, without changing it", async () => {
    orders[0] = {...orders[0],plannedDepositAmount:"75.00",plannedPaymentMethod:2,plannedPaymentDestinationId:9};
    visit("/orders/101");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button",{name:"تأكيد الأوردر"}));
    const review = await screen.findByRole("dialog",{name:"تأكيد الأوردر"});
    expect(within(review).getByText("محفظة إلكترونية")).toBeTruthy();
    expect(await within(review).findByText("المحفظة - ****5678")).toBeTruthy();
    await userEvent.setup().click(within(review).getByRole("button",{name:"تأكيد الأوردر وتحصيل العربون"}));
    await waitFor(() => expect(calls.some(c=>c.url==="/orders/101/confirm")).toBe(true));
    expect(calls.find(c=>c.url==="/orders/101/confirm")?.body)
      .toEqual({depositAmount:"75.00",paymentMethod:2,paymentDestinationId:9});
  });

  it("changes the customer attached to a draft using searchable Selects", async () => {
    visit("/orders/101");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", {name:"تعديل البيانات"}));
    expect(await screen.findByRole("dialog", {name:"تعديل بيانات المسودة"})).toBeTruthy();
    await user.click(await screen.findByRole("combobox", {name:"اختيار عميل المسودة"}));
    await user.click(await screen.findByRole("option", {name:"عميل آخر — 01099999999"}));
    await user.click(screen.getByRole("button", {name:"حفظ التعديلات"}));
    await waitFor(() => expect(calls.some(c=>c.url==="/orders/101" && c.method==="patch")).toBe(true));
    expect(calls.find(c=>c.url==="/orders/101" && c.method==="patch")?.body).toEqual({customerId:6});
  });

  it("can change an existing draft item service without entering a technical ID", async () => {
    visit("/orders/101");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", {name:"تعديل العنصر 9"}));
    expect(await screen.findByRole("dialog", {name:"تعديل عنصر"})).toBeTruthy();
    await user.click(await screen.findByRole("combobox", {name:"خدمة الطباعة للعنصر"}));
    await user.click(await screen.findByRole("option", {name:"رول أب"}));
    await user.click(screen.getByRole("button", {name:"حفظ",exact:true}));
    await waitFor(() => expect(calls.some(c=>c.url==="/orders/101/items/9" && c.method==="patch")).toBe(true));
    expect(calls.find(c=>c.url==="/orders/101/items/9" && c.method==="patch")?.body).toEqual({serviceId:12});
  });

  it("shows image thumbnails, PDF/PSD file marks and readable Arabic activity", async () => {
    visit("/orders/101");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    expect(await screen.findByRole("button", {name:"معاينة تصميم.png"})).toBeTruthy();
    expect(await screen.findByLabelText("نوع الملف PDF")).toBeTruthy();
    expect(await screen.findByLabelText("نوع الملف PSD")).toBeTruthy();
    expect(screen.queryByText("تم رفع ملف تصميم")).toBeNull();
    await userEvent.setup().click(screen.getByRole("tab", {name:"سجل الأحداث"}));
    expect(await screen.findByText("تم رفع ملف تصميم")).toBeTruthy();
    expect(screen.queryByText(/file_uploaded —/)).toBeNull();
    await userEvent.setup().click(screen.getByRole("tab", {name:"تفاصيل الأوردر"}));
    await userEvent.setup().click(screen.getByRole("button", {name:"معاينة تصميم.png"}));
    expect(await screen.findByRole("dialog",{name:"معاينة تصميم.png"})).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button",{name:"إغلاق المعاينة"}));
    expect(screen.queryByRole("dialog",{name:"معاينة تصميم.png"})).toBeNull();
  });

  it("does not expose customer-profile modification on the order details screen", async () => {
    visit("/orders/101");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    expect(screen.queryByRole("button",{name:"تعديل بيانات العميل"})).toBeNull();
    expect(screen.getByRole("button",{name:"تعديل البيانات"})).toBeTruthy();
  });


  it("edits and saves intended deposit in the details tab without any collection", async () => {
    visit("/orders/101");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    const user=userEvent.setup();
    expect(screen.getByText("الدفع عند التأكيد")).toBeTruthy();
    await user.click(screen.getByRole("button",{name:"تعديل",exact:true}));
    expect(await screen.findByRole("dialog",{name:"تعديل بيانات العربون"})).toBeTruthy();
    await user.clear(screen.getByRole("textbox",{name:"قيمة العربون"}));
    await user.type(screen.getByRole("textbox",{name:"قيمة العربون"}),"100.00");
    await user.selectOptions(screen.getByRole("combobox",{name:"طريقة دفع العربون"}),"1");
    await waitFor(() => expect((screen.getByRole("combobox",{name:"وجهة تحصيل العربون"}) as HTMLSelectElement).value).toBe("7"));
    await user.click(screen.getByRole("button",{name:"حفظ بيانات العربون"}));
    await waitFor(() => expect(calls.some(c=>c.method==="patch" && c.url==="/orders/101")).toBe(true));
    expect(calls.find(c=>c.method==="patch"&&c.url==="/orders/101")?.body).toEqual({
      plannedDepositAmount:"100.00",plannedPaymentMethod:1,plannedPaymentDestinationId:7
    });
    expect(calls.filter(c=>c.url==="/orders/101/confirm")).toHaveLength(0);
    expect(await screen.findByText("الدفع عند التأكيد")).toBeTruthy();
  });


  it("allows returning from review to change the amount then resumes review before posting", async () => {
    orders[0] = {...orders[0],plannedDepositAmount:"10.00",plannedPaymentMethod:0,plannedPaymentDestinationId:null};
    visit("/orders/101");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    const user=userEvent.setup();
    await user.click(screen.getByRole("button",{name:"تأكيد الأوردر"}));
    let review=await screen.findByRole("dialog",{name:"تأكيد الأوردر"});
    expect(within(review).getByText("10.00 ج.م")).toBeTruthy();
    await user.click(within(review).getByRole("button",{name:"رجوع للتعديل"}));
    const edit=await screen.findByRole("dialog",{name:"تعديل بيانات العربون"});
    await user.clear(within(edit).getByRole("textbox",{name:"قيمة العربون"}));
    await user.type(within(edit).getByRole("textbox",{name:"قيمة العربون"}),"25.00");
    await user.click(within(edit).getByRole("button",{name:"حفظ بيانات العربون"}));
    review=await screen.findByRole("dialog",{name:"تأكيد الأوردر"});
    expect(within(review).getByText("25.00 ج.م")).toBeTruthy();
    expect(calls.filter(c=>c.url==="/orders/101/confirm")).toHaveLength(0);
    await user.click(within(review).getByRole("button",{name:"تأكيد الأوردر وتحصيل العربون"}));
    await waitFor(() => expect(calls.some(c=>c.url==="/orders/101/confirm")).toBe(true));
    expect(calls.find(c=>c.url==="/orders/101/confirm")?.body)
      .toEqual({depositAmount:"25.00",paymentMethod:0});
  });

  it("prevents confirmation when a saved bank destination is no longer active", async () => {
    orders[0] = {...orders[0],plannedDepositAmount:"50.00",plannedPaymentMethod:1,plannedPaymentDestinationId:999};
    visit("/orders/101");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button",{name:"تأكيد الأوردر"}));
    const review=await screen.findByRole("dialog",{name:"تأكيد الأوردر"});
    expect(await within(review).findByText(/حساب التحصيل المحفوظ غير متاح/)).toBeTruthy();
    expect(within(review).getByRole("button",{name:"تأكيد الأوردر وتحصيل العربون"}).hasAttribute("disabled")).toBe(true);
    expect(calls.filter(c=>c.url==="/orders/101/confirm")).toHaveLength(0);
  });

  it("shows planned payment only under order details, not the activity tab", async () => {
    orders[0] = {...orders[0],plannedDepositAmount:"30.00",plannedPaymentMethod:0};
    visit("/orders/101");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    expect(screen.getByText("الدفع عند التأكيد")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("tab",{name:"سجل الأحداث"}));
    expect(screen.queryByText("الدفع عند التأكيد")).toBeNull();
    await userEvent.setup().click(screen.getByRole("tab",{name:"تفاصيل الأوردر"}));
    expect(screen.getByText("الدفع عند التأكيد")).toBeTruthy();
  });

  it("stores a proposed cash deposit with draft creation rather than a posted deposit", async () => {
    visit("/orders/new");
    const user=userEvent.setup();
    await user.click(await screen.findByRole("combobox",{name:"اختيار العميل"}));
    await user.click(await screen.findByRole("option",{name:/أحمد - 01012345678/}));
    await user.click(await screen.findByRole("combobox",{name:"خدمة العنصر 1"}));
    await user.click(await screen.findByRole("option",{name:"كروت شخصية"}));
    await user.type(screen.getByRole("textbox",{name:"إجمالي العنصر 1"}),"350.00");
    await user.clear(screen.getByRole("textbox",{name:"المدفوع الآن"}));
    await user.type(screen.getByRole("textbox",{name:"المدفوع الآن"}),"100.00");
    await user.click(screen.getByRole("button",{name:"حفظ مسودة"}));
    await waitFor(() => expect(calls.some(c=>c.method==="post" && c.url==="/orders")).toBe(true));
    const created=calls.find(c=>c.method==="post"&&c.url==="/orders");
    expect(created?.body).toMatchObject({status:0,plannedDepositAmount:"100.00",plannedPaymentMethod:0,
      plannedPaymentDestinationId:null});
    expect(created?.body.depositAmount).toBeUndefined();
  });

  it("keeps both review actions in one row and closes from the header without posting", async () => {
    orders[0] = {...orders[0],plannedDepositAmount:"25.00",plannedPaymentMethod:0,plannedPaymentDestinationId:null};
    visit("/orders/101");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button",{name:"تأكيد الأوردر"}));
    const review = await screen.findByRole("dialog",{name:"تأكيد الأوردر"});
    const main = within(review).getByRole("button",{name:"تأكيد الأوردر وتحصيل العربون"});
    const back = within(review).getByRole("button",{name:"رجوع للتعديل"});
    expect(main.parentElement).toBe(back.parentElement);
    expect(main.parentElement?.className).toContain("grid-cols-[minmax(0,1fr)_auto]");
    expect(within(review).getByRole("button",{name:"إغلاق"})).toBeTruthy();
    await userEvent.setup().click(within(review).getByRole("button",{name:"إغلاق"}));
    expect(screen.queryByRole("dialog",{name:"تأكيد الأوردر"})).toBeNull();
    expect(calls.some(c=>c.url==="/orders/101/confirm")).toBe(false);
  });

  it("keeps the compact payment summary without repeating order total", async () => {
    orders[0] = {...orders[0],plannedDepositAmount:"500.00",plannedPaymentMethod:0};
    visit("/orders/101");
    expect(await screen.findByText("مسودة #101")).toBeTruthy();
    const payment = screen.getByRole("region",{name:"الدفع عند التأكيد"});
    expect(within(payment).getByText("العربون المحدد")).toBeTruthy();
    expect(within(payment).getByText("المتبقي المتوقع")).toBeTruthy();
    expect(within(payment).getByText("وسيلة الدفع")).toBeTruthy();
    expect(within(payment).queryByText("إجمالي الأوردر")).toBeNull();
    expect(within(payment).getByText("500.00 ج.م")).toBeTruthy();
    // Mocked order total is 350.00; remainder cannot be negative.
    expect(within(payment).getByText("0.00 ج.م")).toBeTruthy();
  });

});
