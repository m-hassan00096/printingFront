import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
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
  if (url === "/finance/customers/7/ledger") return response(config, {entries: [{
    id: 90, type: 2, typeLabel: "تحصيل", signedAmount: "-100.00", amount: "100.00", effectiveDate: "2026-10-26",
    runningBalance: {amount: "4950.00", type: 1, typeLabel: "مدين"}, collectionId: 90, receiptNumber: "COL-90",
    refundId: null, refundNumber: null, orderId: null, orderNumber: null, note: "ملاحظة تجريبية للحركة",
  }], balance: {amount: "4950.00", type: 1, typeLabel: "مدين"}, openingBalanceExists: true,
    pagination: {currentPage: 1, perPage: 20, lastPage: 1, total: 1}});
  if (url === "/finance/customers/7/settlements" && (config.method ?? "get") === "get") return response(config, {settlements: [], pagination: {currentPage: 1, perPage: 15, lastPage: 1, total: 0}});
  if (url === "/finance/customers/7/settlements/preview") return response(config, {
    customerId: 7, customerName: "شركة النور", customerPhone: "01012345678",
    dateTo: params.get("dateTo"), paymentsThrough: params.get("dateTo"),
    scope: "cumulative_delivered_work", previewHash: "a".repeat(64),
    openingBalance: "5000.00", deliveredTotal: "50.00",
    grossCollections: "4500.00", collectionReversals: "1400.00", refundsTotal: "0.00",
    netPayments: "3100.00", advancesForOtherWork: "0.00",
    balanceBefore: "1950.00", dueNow: "1950.00", creditInScope: "0.00",
    accountBalance: "4950.00", outsideBalance: "3000.00",
    hasWork: true, items: [], payments: [],
  });
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

describe("Simple two-tab customer accounts and settlement reporting", () => {
  it("shows only the ledger and settlement tabs, without a delivered-work report action", async () => {
    visit();
    await screen.findByRole("tabpanel", {name: "كشف الحساب"});
    const details = await screen.findByRole("region", {name: "تفاصيل الحساب"});
    const tabs = within(details).getByRole("tablist", {name: "تفاصيل حساب العميل"});
    expect(within(tabs).getAllByRole("tab").map(tab => tab.textContent)).toEqual([
      "كشف الحساب", "تصفية الحساب",
    ]);
    expect(screen.queryByRole("tab", {name: "الشغل المستلّم"})).toBeNull();
    expect(screen.queryByRole("button", {name: "تقرير الشغل فقط"})).toBeNull();
    const user = userEvent.setup();
    await user.click(within(tabs).getByRole("tab", {name: "تصفية الحساب"}));
    expect(within(details).getByRole("tabpanel", {name: "تصفية الحساب"})).toBeTruthy();
    expect(within(details).getByRole("button", {name: "تصفية جديدة"})).toBeTruthy();
    expect(within(details).queryByText("مستندات وإثباتات")).toBeNull();
    expect(calls.some(call => call.url.endsWith("/settlement"))).toBe(false);
    await user.click(within(tabs).getByRole("tab", {name: "كشف الحساب"}));
    expect(within(details).getByRole("tabpanel", {name: "كشف الحساب"})).toBeTruthy();
  });

  it("keeps the ledger readable with five columns, receipt and note details", async () => {
    visit();
    const ledger = await screen.findByRole("tabpanel", {name: "كشف الحساب"});
    const table = await within(ledger).findByRole("table");
    expect(within(table).getAllByRole("columnheader").map(header => header.textContent)).toEqual([
      "التاريخ", "العملية والتفاصيل", "زيادة على الحساب (+)", "دفعة / تخفيض (−)", "الرصيد بعد الحركة",
    ]);
    expect(within(table).getByText("COL-90")).toBeTruthy();
    await userEvent.setup().click(within(table).getByRole("button", {name: "عرض الملاحظة كاملة"}));
    expect(within(screen.getByRole("dialog", {name: "تفاصيل الحركة المالية"})).getByText("ملاحظة تجريبية للحركة")).toBeTruthy();
  });

  it("redirects old delivered-work URLs to settlement without rendering the retired report", async () => {
    visit("customerId=7&view=delivered");
    await waitFor(() => expect(window.location.search).toContain("view=settlements"));
    expect(await screen.findByRole("tabpanel", {name: "تصفية الحساب"})).toBeTruthy();
    expect(screen.queryByRole("button", {name: "تقرير الشغل فقط"})).toBeNull();
    expect(screen.queryByRole("region", {name: "كشف الشغل المسلّم للعميل"})).toBeNull();
    expect(calls.some(call => call.url.endsWith("/settlement"))).toBe(false);
  });

  it("links to the general ledger from a new settlement without posting or losing the customer", async () => {
    visit("customerId=7&view=settlements");
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", {name: "تصفية جديدة"}));
    await user.click(await screen.findByText("عرض تفاصيل الحساب والشغل"));
    expect(screen.getByText("صافي دفعات العميل السابقة")).toBeTruthy();
    const link = screen.getByRole("link", {name: "عرض حركات الدفعات في كشف الحساب"});
    expect(link.getAttribute("href")).toBe("/finance?customerId=7&view=ledger");
    await user.click(link);
    const ledger = await screen.findByRole("tabpanel", {name: "كشف الحساب"});
    expect(await within(ledger).findByText("COL-90")).toBeTruthy();
    expect(window.location.search).toContain("view=ledger");
    expect(calls.some(call => call.method === "post")).toBe(false);
  });

  it("does not expose settlement or work-report actions without ledger permission", async () => {
    permissions = ["finance.balances.view"];
    visit("customerId=7&view=delivered");
    await screen.findByRole("region", {name: "بيانات حساب العميل"});
    expect(screen.queryByRole("tab", {name: "تصفية الحساب"})).toBeNull();
    expect(screen.queryByRole("tab", {name: "الشغل المستلّم"})).toBeNull();
    expect(screen.queryByRole("button", {name: "تقرير الشغل فقط"})).toBeNull();
    expect(calls.some(call => call.url.endsWith("/settlement") || call.url.includes("/settlements"))).toBe(false);
  });
});
