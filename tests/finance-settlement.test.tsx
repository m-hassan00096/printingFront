import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";

const originalAdapter = apiClient.defaults.adapter;
let permissions = ["finance.balances.view", "finance.ledger.view"];
let calls: Array<{url: string; method: string; params: URLSearchParams}> = [];
function response(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return {config, status: 200, statusText: "OK", headers: {}, data: {success: true, message: "", data}};
}
const adapter: AxiosAdapter = async config => {
  const url = config.url ?? "";
  const params = config.params instanceof URLSearchParams ? config.params : new URLSearchParams(config.params as Record<string, string>);
  calls.push({url, method: config.method ?? "get", params});
  if (url === "/auth/me") {
    const auth: AuthUser = {username: "admin", name: "Admin", role: "admin", roleAlias: "مدير", status: 1, statusLabel: "نشط", permissions};
    return response(config, auth);
  }
  if (url === "/selects") return response(config, [{label: "customers", options: [{value: 7, label: "شركة النور - 01012345678"}]}]);
  if (url === "/finance/customers/7/balance") return response(config, {customerId: 7, amount: "4950.00", type: 1, typeLabel: "مدين", openingBalanceExists: true, openingBalance: null});
  if (url === "/finance/customers/7/ledger") return response(config, {entries: [], balance: {amount: "4950.00", type: 1, typeLabel: "مدين"}, openingBalanceExists: true, pagination: {currentPage: 1, perPage: 20, lastPage: 1, total: 0}});
  if (url === "/finance/customers/7/settlement") return response(config, {
    customerId: 7, customerName: "شركة النور", customerPhone: "01012345678",
    dateFrom: params.get("dateFrom"), dateTo: params.get("dateTo"),
    openingBalance: "0.00", deliveredTotal: "50.00", paymentsTotal: "100.00", adjustmentsTotal: "5000.00",
    closingBalance: "4950.00", financeBalanceAsOf: "4950.00", undeliveredDifference: "0.00",
    lines: [
      {key: "opening:1", kind: "opening_balance", date: params.get("dateFrom"), description: "رصيد افتتاحي", orderId: null, orderNumber: null, receiptNumber: null, quantity: null, unitPrice: null, signedAmount: "5000.00", runningBalance: "5000.00"},
      {key: "delivery:11:item:2", kind: "delivered_item", date: params.get("dateFrom"), description: "كروت شخصية — وجهين", orderId: 10, orderNumber: "ORD-10", receiptNumber: null, quantity: 100, unitPrice: "0.5000", signedAmount: "50.00", runningBalance: "5050.00"},
      {key: "finance:90", kind: "collection", date: params.get("dateTo"), description: "تحصيل من العميل", orderId: null, orderNumber: null, receiptNumber: "COL-90", quantity: null, unitPrice: null, signedAmount: "-100.00", runningBalance: "4950.00"},
    ],
  });
  throw Error("Unexpected API: " + url);
};
function visit(query = "customerId=7") {window.history.replaceState({}, "", "/finance?" + query); return render(<App/>);}
beforeEach(() => {apiClient.defaults.adapter = adapter; permissions = ["finance.balances.view", "finance.ledger.view"]; calls = [];});
afterEach(() => {apiClient.defaults.adapter = originalAdapter;});

describe("Read-only delivered work statement", () => {
  it("loads the default month when its tab opens and never creates a payment or settlement", async () => {
    visit();
    const user = userEvent.setup();
    const tab = await screen.findByRole("tab", {name: "الشغل المستلّم"});
    expect(calls.some(call => call.url.endsWith("/settlement"))).toBe(false);
    await user.click(tab);
    const panel = screen.getByRole("region", {name: "كشف الشغل المسلّم للعميل"});
    expect(await within(panel).findByText("كروت شخصية — وجهين")).toBeTruthy();
    expect(within(panel).getByText("COL-90")).toBeTruthy();
    expect(within(panel).getByRole("button", {name: "طباعة / PDF"})).toBeTruthy();
    expect(within(panel).getByRole("button", {name: "تصدير Excel"})).toBeTruthy();
    const call = calls.find(item => item.url.endsWith("/settlement"))!;
    expect(call.params.get("dateFrom")).toMatch(/^\d{4}-\d{2}-01$/);
    expect(call.params.get("dateTo")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(calls.some(call => call.method === "post")).toBe(false);
    await user.click(screen.getByRole("tab", {name: "كشف الحساب"}));
    expect(screen.getByRole("tabpanel", {name: "كشف الحساب"})).toBeTruthy();
    expect(screen.queryByRole("region", {name: "كشف الشغل المسلّم للعميل"})).toBeNull();
  });
  it("includes in-period opening adjustments in the visible reconciliation summary", async () => {
    visit("customerId=7&view=delivered");
    await screen.findByText("كروت شخصية — وجهين");
    const summary = screen.getByLabelText("ملخص حساب الفترة");
    expect(within(summary).getByText("رصيد افتتاحي سُجل داخل الفترة")).toBeTruthy();
    expect(within(summary).getByText("5,000.00 ج.م")).toBeTruthy();
    expect(within(summary).getByText("4,950.00 ج.م")).toBeTruthy();
    expect(screen.getByText(/هذا رصيد تاريخي وليس أمرًا بتحصيله الآن/)).toBeTruthy();
  });
  it("requires ledger permission even for a direct delivered-report URL", async () => {
    permissions = ["finance.balances.view"];
    visit("customerId=7&view=delivered");
    await screen.findByRole("region", {name: "بيانات حساب العميل"});
    expect(screen.queryByRole("tab", {name: "الشغل المستلّم"})).toBeNull();
    expect(screen.queryByRole("tab", {name: "تصفية الحساب"})).toBeNull();
    expect(calls.some(call => call.url.endsWith("/settlement") || call.url.includes("/settlements"))).toBe(false);
  });
});
