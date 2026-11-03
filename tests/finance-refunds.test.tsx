import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";

const original = apiClient.defaults.adapter;
let permissions = ["finance.refunds.view", "finance.refunds.create"];
let credit = "150.00";
let refundableCredit: string | null = null;
const originalRecord = {id: 91, refundNumber: "REF-2026-00091", customerId: 7, customerName: "أحمد خالد", amount: "40.00", paymentMethod: 0, paymentMethodLabel: "نقدي", paymentDestinationId: null, destinationLabel: null, reason: "تم رد المبلغ", refundedOn: "2026-10-26", createdBy: 1, createdAt: "2026-10-26T12:00:00+03:00"};
let records = [{...originalRecord}];
let calls: {url: string; method: string; params: URLSearchParams; body: Record<string, unknown>; key: string | null}[] = [];
function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return {config, status: 200, statusText: "OK", headers: {}, data: {success: true, message: "", data}};
}
const adapter: AxiosAdapter = async config => {
  const url = config.url ?? "", method = config.method ?? "get";
  const params = config.params instanceof URLSearchParams ? config.params : new URLSearchParams(config.params as Record<string, string>);
  const body = typeof config.data === "string" ? JSON.parse(config.data) as Record<string, unknown> : {};
  calls.push({url, method, params, body, key: config.headers.get("Idempotency-Key")?.toString() ?? null});
  if (url === "/auth/me") {
    const user: AuthUser = {username: "admin", name: "محاسب", role: "admin", roleAlias: "محاسب", status: 1, statusLabel: "نشط", permissions};
    return ok(config, user);
  }
  if (url === "/selects" && params.get("selects") === "customers") return ok(config, [{label: "customers", options: [{value: 7, label: "أحمد خالد - 01012345678"}]}]);
  if (url === "/selects" && params.get("selects") === "bankAccounts,eWallets") return ok(config, [{label: "bankAccounts", options: [{value: 3, label: "حساب بنك مصر"}]}, {label: "eWallets", options: [{value: 4, label: "فودافون كاش"}]}]);
  if (url === "/finance/customers/7/balance") return ok(config, {customerId: 7, amount: credit, type: Number(credit) === 0 ? 0 : 2, typeLabel: Number(credit) === 0 ? "متوازن" : "دائن", openingBalanceExists: true});
  if (url === "/finance/customers/7/opening-balance-status") return ok(config, {customerId: 7, openingBalanceExists: true});
  if (url === "/finance/customers/7/ledger") {
    const entries = records.filter(item => item.customerId === 7).map(item => ({
      id: 1000 + item.id, type: 5, typeLabel: "رد مبلغ للعميل",
      amount: item.amount, signedAmount: item.amount, effectiveDate: item.refundedOn,
      orderId: null, orderNumber: null, collectionId: null, receiptNumber: null,
      refundId: item.id, refundNumber: item.refundNumber, note: item.reason,
      runningBalance: {amount: credit, type: Number(credit) === 0 ? 0 : 2, typeLabel: "دائن"},
    }));
    const visible = params.get("filter[type]") === "5" || !params.get("filter[type]") ? entries : [];
    return ok(config, {entries: visible, balance: {amount: credit, type: Number(credit) === 0 ? 0 : 2,
      typeLabel: "دائن"}, openingBalanceExists: true,
      pagination: {currentPage: 1, lastPage: 1, perPage: 20, total: visible.length}});
  }
  if (url === "/finance/customer-balances") return ok(config, {accounts: [{customerId: 7, customerName: "أحمد خالد", customerPhone: "01012345678", amount: credit, type: 2, typeLabel: "دائن", openingBalanceExists: true}], pagination: {currentPage: 1, lastPage: 1, perPage: 20, total: 1}});
  if (url === "/finance/customers/7/refundable-credit") {const amount = refundableCredit ?? credit; return ok(config, {customerId: 7, availableCredit: amount, canRefund: Number(amount) > 0});}
  if (url === "/finance/refunds" && method === "get") {
    let found = records;
    if (params.get("filter[paymentMethod]")) found = found.filter(item => String(item.paymentMethod) === params.get("filter[paymentMethod]"));
    if (params.get("filter[customerId]")) found = found.filter(item => String(item.customerId) === params.get("filter[customerId]"));
    return ok(config, {refunds: found, pagination: {currentPage: 1, lastPage: 1, perPage: 20, total: found.length}});
  }
  if (url.startsWith("/finance/refunds/") && method === "get") {
    const item = records.find(record => String(record.id) === url.split("/").at(-1));
    if (!item) throw Error("Unknown refund record " + url);
    return ok(config, item);
  }
  if (url === "/finance/refunds" && method === "post") {
    const amount = String(body.amount ?? "0.00");
    const methodValue = Number(body.paymentMethod);
    const newRefund = {...originalRecord, id: 92, refundNumber: "REF-2026-00092",
      customerId: Number(body.customerId), amount,
      paymentMethod: methodValue as 0 | 1 | 2,
      paymentMethodLabel: methodValue === 1 ? "تحويل بنكي" : methodValue === 2 ? "محفظة إلكترونية" : "نقدي",
      paymentDestinationId: body.paymentDestinationId ? Number(body.paymentDestinationId) : null,
      reason: String(body.reason)};
    records = [newRefund, ...records];
    credit = (Number(credit) - Number(amount)).toFixed(2);
    return ok(config, {id: newRefund.id, refundNumber: newRefund.refundNumber});
  }
  throw Error("Unexpected request " + method + " " + url);
};
function visit(path = "/finance?tab=refunds") {window.history.replaceState({}, "", path); return render(<App/>);}
async function waitForAccount() {await screen.findByRole("region", {name: "بيانات حساب العميل"});}
beforeEach(() => {apiClient.defaults.adapter = adapter; permissions = ["finance.refunds.view", "finance.refunds.create"]; credit = "150.00"; refundableCredit = null; calls = []; records = [{...originalRecord}];});
afterEach(() => {apiClient.defaults.adapter = original;});

describe("Finance refunds within the account workspace", () => {
  it("keeps the global refund register in Finance navigation, not in the customer action header", async () => {
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.refunds.view"];
    visit("/finance?customerId=7");
    const banner = await screen.findByRole("banner");
    expect(within(banner).queryByText("مساحة العمل")).toBeNull();
    expect(await screen.findByRole("heading", {level: 1, name: "حسابات العملاء"})).toBeTruthy();
    expect(screen.queryByRole("button", {name: "سجل ردود الأموال"})).toBeNull();
    expect(screen.queryByRole("button", {name: "عرض ردود رصيد العميل"})).toBeNull();
    const report = screen.getByRole("link", {name: "سجل ردود الأموال"});
    expect(report.getAttribute("href")).toBe("/finance/refunds");
    await userEvent.setup().click(report);
    expect(window.location.pathname).toBe("/finance/refunds");
    expect(await screen.findByRole("heading", {level: 1, name: "سجل ردود الأموال"})).toBeTruthy();
    expect(await screen.findByRole("region", {name: "سجل ردود الأموال"})).toBeTruthy();
    expect(screen.queryByRole("region", {name: "بيانات حساب العميل"})).toBeNull();
  });
  it("lists refunds with filters and immutable details without fetching unauthorized accounts", async () => {
    permissions = ["finance.refunds.view"]; visit("/finance");
    expect(await screen.findByText("REF-2026-00091")).toBeTruthy();
    expect(screen.getByText("26/10/2026")).toBeTruthy();
    expect(screen.queryByRole("tablist", {name: "أقسام حسابات العملاء"})).toBeNull();
    expect(await screen.findByRole("heading", {level: 1, name: "سجل ردود الأموال"})).toBeTruthy();
    expect(screen.getByRole("region", {name: "سجل ردود الأموال"})).toBeTruthy();
    expect(screen.queryByRole("button", {name: "رد رصيد دائن"})).toBeNull();
    expect(calls.some(call => call.url === "/finance/customer-balances" || call.url === "/selects")).toBe(false);
    const user = userEvent.setup();
    await user.selectOptions(screen.getByRole("combobox", {name: "فلتر طريقة رد الأموال"}), "1");
    await waitFor(() => expect(calls.some(call => call.url === "/finance/refunds" && call.params.get("filter[paymentMethod]") === "1")).toBe(true));
    await user.selectOptions(screen.getByRole("combobox", {name: "فلتر طريقة رد الأموال"}), "");
    await user.click(await screen.findByRole("button", {name: "التفاصيل"}));
    const dialog = await screen.findByRole("dialog", {name: "تفاصيل رد الرصيد"});
    expect(within(dialog).getByText("تم رد المبلغ")).toBeTruthy();
    expect(within(dialog).queryByRole("button", {name: /حذف|تعديل/})).toBeNull();
  });
  it("rejects excess credit and requires physical-refund acknowledgement before posting", async () => {
    permissions = ["finance.refunds.create"]; visit(); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", {name: "رد رصيد دائن"}));
    expect(calls.some(call => call.url === "/finance/refunds" && call.method === "get")).toBe(false);
    const dialog = await screen.findByRole("dialog", {name: "رد رصيد دائن للعميل"});
    await user.click(within(dialog).getByRole("combobox", {name: "عميل رد الرصيد"}));
    await user.click(await within(dialog).findByRole("option", {name: /أحمد خالد/}));
    await within(dialog).findByText("الرصيد المتاح للرد حاليًا");
    const amount = within(dialog).getByRole("textbox", {name: "مبلغ رد الرصيد"});
    await user.type(amount, "200.00");
    expect(within(dialog).getByText("المبلغ يتجاوز الرصيد الدائن المتاح.")).toBeTruthy();
    expect(within(dialog).getByRole("button", {name: "تأكيد رد الرصيد"}).hasAttribute("disabled")).toBe(true);
    await user.clear(amount); await user.type(amount, "100.00");
    await user.type(within(dialog).getByRole("textbox", {name: "سبب رد الرصيد"}), "طلب العميل");
    expect(within(dialog).getByRole("button", {name: "تأكيد رد الرصيد"}).hasAttribute("disabled")).toBe(true);
    await user.click(within(dialog).getByRole("checkbox", {name: "تأكيد رد الأموال فعليًا"}));
    await user.click(within(dialog).getByRole("button", {name: "تأكيد رد الرصيد"}));
    await waitFor(() => expect(calls.some(call => call.url === "/finance/refunds" && call.method === "post")).toBe(true));
    const post = calls.find(call => call.url === "/finance/refunds" && call.method === "post");
    expect(post?.body).toEqual({customerId: 7, amount: "100.00", paymentMethod: 0, reason: "طلب العميل"});
    expect(post?.key).toBeTruthy();
    expect(calls.filter(call => call.url === "/finance/collections" && call.method === "post")).toHaveLength(0);
  });
  it("shows refund directly beside collection, without duplicate refund history actions", async () => {
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.collections.create",
      "finance.opening_balances.create", "finance.refunds.view", "finance.refunds.create"];
    visit("/finance?customerId=7"); const user = userEvent.setup();
    const card = await screen.findByRole("region", {name: "بيانات حساب العميل"});
    const actions = within(card).getByLabelText("إجراءات حساب العميل");
    const refund = within(actions).getByRole("button", {name: "رد رصيد للعميل"});
    expect(within(actions).getByRole("button", {name: "تسجيل تحصيل"})).toBeTruthy();
    expect(refund).toBeTruthy();
    await waitFor(() => expect(refund.hasAttribute("disabled")).toBe(false));
    expect(within(actions).queryByRole("button", {name: "عرض ردود رصيد العميل"})).toBeNull();
    expect(screen.queryByRole("button", {name: "سجل ردود الأموال"})).toBeNull();
    expect(screen.getByRole("link", {name: "سجل ردود الأموال"})).toBeTruthy();
    expect(screen.queryByText("المزيد")).toBeNull(); // No opening-balance action when already registered
    expect(window.location.search).not.toContain("view=refunds");
    await user.click(refund);
    const dialog = await screen.findByRole("dialog", {name: "رد رصيد دائن للعميل"});
    expect(within(dialog).getByRole("combobox", {name: "عميل رد الرصيد"}).getAttribute("aria-disabled")).not.toBe("true");
    await within(dialog).findByText("الرصيد المتاح للرد حاليًا");
  });
  it("keeps authorized refunds disabled when no customer credit is available", async () => {
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.refunds.create"]; credit = "0.00";
    visit("/finance?customerId=7"); await waitForAccount();
    const refund = await screen.findByRole("button", {name: "رد رصيد للعميل"});
    await screen.findByText("لا يمكن رد رصيد: حساب العميل متوازن وليس له رصيد دائن.");
    expect(refund.getAttribute("aria-describedby")).toBe("account-refund-unavailable");
    expect(refund.hasAttribute("disabled")).toBe(true);
    await userEvent.setup().click(refund);
    expect(screen.queryByRole("dialog", {name: "رد رصيد دائن للعميل"})).toBeNull();
    expect(calls.some(call => call.url === "/finance/refunds" && call.method === "post")).toBe(false);
  });
  it("uses the server refundable-credit result even if the ledger shows a positive credit balance", async () => {
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.refunds.create"];
    credit = "150.00"; refundableCredit = "0.00";
    visit("/finance?customerId=7");
    const card = await screen.findByRole("region", {name: "بيانات حساب العميل"});
    const refund = within(card).getByRole("button", {name: "رد رصيد للعميل"});
    await screen.findByText("لا يوجد رصيد دائن متاح للرد.");
    expect(refund.hasAttribute("disabled")).toBe(true);
    expect(calls.some(call => call.url === "/finance/customers/7/refundable-credit")).toBe(true);
    expect(screen.queryByRole("dialog", {name: "رد رصيد دائن للعميل"})).toBeNull();
  });

  it("hides refund action from unauthorized staff but retains view-only register access", async () => {
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.refunds.view"];
    visit("/finance?customerId=7");
    const card = await screen.findByRole("region", {name: "بيانات حساب العميل"});
    expect(within(card).queryByRole("button", {name: "رد رصيد للعميل"})).toBeNull();
    expect(screen.getByRole("link", {name: "سجل ردود الأموال"})).toBeTruthy();
    expect(calls.some(call => call.url === "/finance/customers/7/refundable-credit")).toBe(false);
  });
  it("opens the global register through Finance navigation and returns to accounts", async () => {
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.refunds.view"];
    visit("/finance?customerId=7");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("link", {name: "سجل ردود الأموال"}));
    expect(window.location.pathname).toBe("/finance/refunds");
    expect(await screen.findByRole("heading", {name: "سجل ردود الأموال"})).toBeTruthy();
    expect(await screen.findByText("REF-2026-00091")).toBeTruthy();
    expect(screen.getByRole("button", {name: "العودة لحسابات العملاء"})).toBeTruthy();
    await user.click(screen.getByRole("button", {name: "العودة لحسابات العملاء"}));
    expect(window.location.pathname).toBe("/finance");
    expect(window.location.search).not.toContain("tab=refunds");
    expect(await screen.findByRole("region", {name: "قائمة حسابات العملاء"})).toBeTruthy();
  });
  it("preserves legacy customer-specific refund deep links without showing duplicate account actions", async () => {
    records = [...records, {...originalRecord, id: 92, refundNumber: "REF-2026-00092", customerId: 8, customerName: "مؤسسة النور"}];
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.refunds.view"];
    visit("/finance?customerId=7&view=refunds");
    const user = userEvent.setup();
    expect(await screen.findByText("REF-2026-00091")).toBeTruthy();
    expect(screen.queryByText("REF-2026-00092")).toBeNull();
    expect(screen.queryByRole("button", {name: "عرض ردود رصيد العميل"})).toBeNull();
    await user.click(screen.getByRole("link", {name: "سجل ردود الأموال"}));
    expect(window.location.pathname).toBe("/finance/refunds");
    expect(await screen.findByText("REF-2026-00092")).toBeTruthy();
    expect(calls.some(call => call.url === "/finance/refunds" && !call.params.has("filter[customerId]"))).toBe(true);
  });
  it("opens global refund deep links without loading a selected account until requested", async () => {
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.refunds.view"];
    visit("/finance?customerId=7&tab=refunds");
    expect(await screen.findByRole("heading", {level: 1, name: "سجل ردود الأموال"})).toBeTruthy();
    expect(screen.queryByRole("tab", {name: "سجل الردود العام"})).toBeNull();
    await screen.findByText("REF-2026-00091");
    expect(screen.queryByRole("region", {name: "بيانات حساب العميل"})).toBeNull();
    expect(calls.some(call => call.url === "/finance/customers/7/balance")).toBe(false);
    await userEvent.setup().click(screen.getByRole("button", {name: "العودة لحسابات العملاء"}));
    expect(await screen.findByRole("region", {name: "بيانات حساب العميل"})).toBeTruthy();
    expect(window.location.search).toContain("customerId=7");
  });
  it("keeps Create Refund working and shows the posted movement in the customer's ledger with one-click filtering", async () => {
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.refunds.view", "finance.refunds.create"];
    visit("/finance?customerId=7");
    const user = userEvent.setup();
    await waitForAccount();
    const create = await screen.findByRole("button", {name: "رد رصيد للعميل"});
    await waitFor(() => expect(create.hasAttribute("disabled")).toBe(false));
    await user.click(create);
    const dialog = await screen.findByRole("dialog", {name: "رد رصيد دائن للعميل"});
    await within(dialog).findByText("الرصيد المتاح للرد حاليًا");
    await user.type(within(dialog).getByRole("textbox", {name: "مبلغ رد الرصيد"}), "40.00");
    await user.type(within(dialog).getByRole("textbox", {name: "سبب رد الرصيد"}), "رد متفق عليه للعميل");
    await user.click(within(dialog).getByRole("checkbox", {name: "تأكيد رد الأموال فعليًا"}));
    await user.click(within(dialog).getByRole("button", {name: "تأكيد رد الرصيد"}));
    await waitFor(() => expect(calls.filter(call => call.url === "/finance/refunds" && call.method === "post")).toHaveLength(1));
    const post = calls.find(call => call.url === "/finance/refunds" && call.method === "post")!;
    expect(post.body).toEqual({customerId: 7, amount: "40.00", paymentMethod: 0, reason: "رد متفق عليه للعميل"});
    expect(post.key).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("dialog", {name: "رد رصيد دائن للعميل"})).toBeNull());
    const filter = screen.getByRole("button", {name: "ردود الأموال فقط"});
    await user.click(filter);
    expect(filter.getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("combobox", {name: "نوع الحركة المالية"}) as HTMLSelectElement).value).toBe("5");
    await waitFor(() => expect(calls.some(call =>
      call.url === "/finance/customers/7/ledger" && call.params.get("filter[type]") === "5")).toBe(true));
    const newReceipt = await screen.findByRole("button", {name: "REF-2026-00092"});
    expect(screen.getAllByText("40.00 ج.م").length).toBeGreaterThan(0);
    await user.click(newReceipt);
    const details = await screen.findByRole("dialog", {name: "تفاصيل رد الرصيد"});
    expect(await within(details).findByText("رد متفق عليه للعميل")).toBeTruthy();
    await user.click(within(details).getAllByRole("button", {name: "إغلاق"})[0]);
    expect(calls.filter(call => call.url === "/finance/refunds" && call.method === "post")).toHaveLength(1);
    await user.click(filter);
    expect(filter.getAttribute("aria-pressed")).toBe("false");
  });

  it("offers a single create-refund action within the secondary global history, with no account tab required", async () => {
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.refunds.view", "finance.refunds.create"];
    visit("/finance/refunds");
    await screen.findByText("REF-2026-00091");
    expect(screen.queryByRole("tablist", {name: "أقسام حسابات العملاء"})).toBeNull();
    const create = screen.getAllByRole("button", {name: "رد رصيد دائن"});
    expect(create).toHaveLength(1);
    await userEvent.setup().click(create[0]);
    expect(await screen.findByRole("dialog", {name: "رد رصيد دائن للعميل"})).toBeTruthy();
    expect(calls.some(call => call.url === "/finance/refunds" && call.method === "post")).toBe(false);
  });

  it("requires an active bank or wallet destination before recording a refund", async () => {
    visit(); const user = userEvent.setup();
    await user.click(await screen.findByRole("button", {name: "رد رصيد دائن"}));
    const dialog = await screen.findByRole("dialog", {name: "رد رصيد دائن للعميل"});
    await user.click(within(dialog).getByRole("combobox", {name: "عميل رد الرصيد"}));
    await user.click(await within(dialog).findByRole("option", {name: /أحمد خالد/}));
    await within(dialog).findByText("الرصيد المتاح للرد حاليًا");
    await user.type(within(dialog).getByRole("textbox", {name: "مبلغ رد الرصيد"}), "70.00");
    await user.type(within(dialog).getByRole("textbox", {name: "سبب رد الرصيد"}), "رد متفق عليه");
    await user.selectOptions(within(dialog).getByRole("combobox", {name: "طريقة رد الرصيد"}), "1");
    await user.click(within(dialog).getByRole("checkbox", {name: "تأكيد رد الأموال فعليًا"}));
    expect(within(dialog).getByRole("button", {name: "تأكيد رد الرصيد"}).hasAttribute("disabled")).toBe(true);
    await user.click(within(dialog).getByRole("combobox", {name: "حساب رد الأموال"}));
    await user.click(await within(dialog).findByRole("option", {name: "حساب بنك مصر"}));
    await user.click(within(dialog).getByRole("checkbox", {name: "تأكيد رد الأموال فعليًا"}));
    await user.click(within(dialog).getByRole("button", {name: "تأكيد رد الرصيد"}));
    await waitFor(() => expect(calls.some(call => call.url === "/finance/refunds" && call.method === "post")).toBe(true));
    expect(calls.find(call => call.url === "/finance/refunds" && call.method === "post")?.body).toEqual({customerId: 7, amount: "70.00", paymentMethod: 1, paymentDestinationId: 3, reason: "رد متفق عليه"});
  });
});
