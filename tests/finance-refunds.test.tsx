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
  if (url === "/finance/customers/7/ledger") return ok(config, {entries: [], balance: {amount: credit, type: 2, typeLabel: "دائن"}, openingBalanceExists: true, pagination: {currentPage: 1, lastPage: 1, perPage: 20, total: 0}});
  if (url === "/finance/customer-balances") return ok(config, {accounts: [{customerId: 7, customerName: "أحمد خالد", customerPhone: "01012345678", amount: credit, type: 2, typeLabel: "دائن", openingBalanceExists: true}], pagination: {currentPage: 1, lastPage: 1, perPage: 20, total: 1}});
  if (url === "/finance/customers/7/refundable-credit") return ok(config, {customerId: 7, availableCredit: credit, canRefund: Number(credit) > 0});
  if (url === "/finance/refunds" && method === "get") {
    let found = records;
    if (params.get("filter[paymentMethod]")) found = found.filter(item => String(item.paymentMethod) === params.get("filter[paymentMethod]"));
    if (params.get("filter[customerId]")) found = found.filter(item => String(item.customerId) === params.get("filter[customerId]"));
    return ok(config, {refunds: found, pagination: {currentPage: 1, lastPage: 1, perPage: 20, total: found.length}});
  }
  if (url === "/finance/refunds/91" && method === "get") return ok(config, records[0]);
  if (url === "/finance/refunds" && method === "post") {credit = "50.00"; return ok(config, {id: 92, refundNumber: "REF-2026-00092"});}
  throw Error("Unexpected request " + method + " " + url);
};
function visit(path = "/finance?tab=refunds") {window.history.replaceState({}, "", path); return render(<App/>);}
async function revealAccountActions() {await userEvent.setup().click(await screen.findByText("إجراءات أخرى"));}
beforeEach(() => {apiClient.defaults.adapter = adapter; permissions = ["finance.refunds.view", "finance.refunds.create"]; credit = "150.00"; calls = []; records = [{...originalRecord}];});
afterEach(() => {apiClient.defaults.adapter = original;});

describe("Finance refunds within the account workspace", () => {
  it("keeps the finance title only in the page, removes redundant header labels and adds space below tabs", async () => {
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.refunds.view"];
    visit("/finance?customerId=7");
    const banner = await screen.findByRole("banner");
    expect(within(banner).queryByText("مساحة العمل")).toBeNull();
    expect(within(banner).queryByText("الحسابات")).toBeNull();
    expect(screen.getByRole("heading", {level: 1, name: "حسابات العملاء"})).toBeTruthy();
    expect(screen.queryByText("اعرف الرصيد، سجّل تحصيل، وراجع حساب الشغل المستلّم في مكان واحد.")).toBeNull();
    const tabs = screen.getByRole("tablist", {name: "أقسام حسابات العملاء"});
    expect(tabs.parentElement?.className).toContain("pb-2");
    await userEvent.setup().click(within(tabs).getByRole("tab", {name: "سجل الردود العام"}));
    expect(tabs.parentElement?.className).toContain("pb-2");
    expect(within(banner).queryByText("مساحة العمل")).toBeNull();
  });
  it("lists refunds with filters and immutable details without fetching unauthorized accounts", async () => {
    permissions = ["finance.refunds.view"]; visit("/finance");
    expect(await screen.findByText("REF-2026-00091")).toBeTruthy();
    expect(screen.getByText("26/10/2026")).toBeTruthy();
    expect(screen.queryByRole("tab", {name: "حسابات العملاء"})).toBeNull();
    expect(screen.getByRole("tab", {name: "سجل الردود العام"}).getAttribute("aria-selected")).toBe("true");
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
  it("keeps refund actions secondary and stores customer-history navigation in the URL", async () => {
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.opening_balances.create", "finance.refunds.view", "finance.refunds.create"];
    visit("/finance?customerId=7"); const user = userEvent.setup();
    await revealAccountActions();
    const refund = await screen.findByRole("button", {name: "رد رصيد للعميل"});
    await screen.findByText(/الرصيد الدائن المتاح للرد/);
    await waitFor(() => expect(refund.hasAttribute("disabled")).toBe(false));
    const tabs = screen.getByRole("tablist", {name: "أقسام حسابات العملاء"});
    expect(within(tabs).getByRole("tab", {name: "حسابات العملاء"}).getAttribute("aria-selected")).toBe("true");
    expect(within(tabs).getByRole("tab", {name: "سجل الردود العام"}).getAttribute("aria-selected")).toBe("false");
    expect(screen.queryByRole("button", {name: "رصيد افتتاحي"})).toBeNull();
    expect(window.location.search).not.toContain("view=refunds");
    await user.click(screen.getByRole("button", {name: "عرض ردود رصيد العميل"}));
    expect(window.location.search).toContain("view=refunds");
    expect(await screen.findByText("REF-2026-00091")).toBeTruthy();
    expect(calls.some(call => call.url === "/finance/refunds" && call.params.get("filter[customerId]") === "7")).toBe(true);
    await user.click(refund);
    const dialog = await screen.findByRole("dialog", {name: "رد رصيد دائن للعميل"});
    expect(within(dialog).getByRole("combobox", {name: "عميل رد الرصيد"}).getAttribute("aria-disabled")).not.toBe("true");
    await within(dialog).findByText("الرصيد المتاح للرد حاليًا");
  });
  it("keeps authorized refunds disabled when no customer credit is available", async () => {
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.refunds.create"]; credit = "0.00";
    visit("/finance?customerId=7"); await revealAccountActions();
    const refund = await screen.findByRole("button", {name: "رد رصيد للعميل"});
    await screen.findByText("لا يمكن رد رصيد: حساب العميل متوازن وليس له رصيد دائن.");
    expect(refund.hasAttribute("disabled")).toBe(true);
    await userEvent.setup().click(refund);
    expect(screen.queryByRole("dialog", {name: "رد رصيد دائن للعميل"})).toBeNull();
    expect(calls.some(call => call.url === "/finance/refunds" && call.method === "post")).toBe(false);
  });
  it("never renders refund actions without refund permission", async () => {
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.refunds.view"];
    visit("/finance?customerId=7"); await revealAccountActions();
    expect(screen.queryByRole("button", {name: "رد رصيد للعميل"})).toBeNull();
    expect(screen.getByRole("button", {name: "عرض ردود رصيد العميل"})).toBeTruthy();
  });
  it("shows account and refund tabs as text with an underline only on the active tab", async () => {
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.refunds.view"];
    visit("/finance?customerId=7");
    const user = userEvent.setup();
    const tabs = await screen.findByRole("tablist", {name: "أقسام حسابات العملاء"});
    const accounts = within(tabs).getByRole("tab", {name: "حسابات العملاء"});
    const refunds = within(tabs).getByRole("tab", {name: "سجل الردود العام"});
    expect(tabs.className).toContain("border-b");
    expect(accounts.className).toContain("border-primary");
    expect(accounts.className).toContain("text-primary");
    expect(accounts.className).not.toContain("bg-primary");
    expect(refunds.className).toContain("border-transparent");
    expect(refunds.getAttribute("aria-selected")).toBe("false");

    await user.click(refunds);
    expect(refunds.getAttribute("aria-selected")).toBe("true");
    expect(refunds.className).toContain("border-primary");
    expect(refunds.className).toContain("text-primary");
    expect(refunds.className).not.toContain("bg-primary");
    expect(accounts.className).toContain("border-transparent");

    await user.click(accounts);
    expect(accounts.getAttribute("aria-selected")).toBe("true");
    expect(accounts.className).toContain("border-primary");
    expect(refunds.className).toContain("border-transparent");
  });
  it("separates customer refunds from the global register and preserves customer context", async () => {
    records = [...records, {...originalRecord, id: 92, refundNumber: "REF-2026-00092", customerId: 8, customerName: "مؤسسة النور"}];
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.refunds.view"];
    visit("/finance?customerId=7"); const user = userEvent.setup(); await revealAccountActions();
    await user.click(screen.getByRole("button", {name: "عرض ردود رصيد العميل"}));
    expect(await screen.findByText("REF-2026-00091")).toBeTruthy();
    expect(screen.queryByText("REF-2026-00092")).toBeNull();
    await user.click(screen.getByRole("tab", {name: "سجل الردود العام"}));
    expect(window.location.search).toContain("tab=refunds");
    expect(window.location.search).toContain("customerId=7");
    expect(await screen.findByText("REF-2026-00092")).toBeTruthy();
    expect(calls.some(call => call.url === "/finance/refunds" && !call.params.has("filter[customerId]"))).toBe(true);
    await user.click(screen.getByRole("tab", {name: "حسابات العملاء"}));
    expect(window.location.search).not.toContain("tab=refunds");
    expect(window.location.search).toContain("customerId=7");
    expect(await screen.findByText("REF-2026-00091")).toBeTruthy();
    expect(screen.queryByText("REF-2026-00092")).toBeNull();
  });
  it("opens global refund deep links without loading a selected account until requested", async () => {
    permissions = ["finance.balances.view", "finance.ledger.view", "finance.refunds.view"];
    visit("/finance?customerId=7&tab=refunds");
    expect((await screen.findByRole("tab", {name: "سجل الردود العام"})).getAttribute("aria-selected")).toBe("true");
    await screen.findByText("REF-2026-00091");
    expect(screen.queryByRole("region", {name: "بيانات حساب العميل"})).toBeNull();
    expect(calls.some(call => call.url === "/finance/customers/7/balance")).toBe(false);
    await userEvent.setup().click(screen.getByRole("tab", {name: "حسابات العملاء"}));
    expect(await screen.findByRole("region", {name: "بيانات حساب العميل"})).toBeTruthy();
    expect(window.location.search).toContain("customerId=7");
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
