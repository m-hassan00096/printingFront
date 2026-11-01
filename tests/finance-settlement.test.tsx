import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";

const originalAdapter = apiClient.defaults.adapter;
let permissions = ["finance.balances.view", "finance.ledger.view"];
let calls: Array<{ url: string; params: URLSearchParams }> = [];

function response(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { config, status: 200, statusText: "OK", headers: {},
    data: { success: true, message: "", data } };
}

const adapter: AxiosAdapter = async config => {
  const url = config.url ?? "";
  const params = config.params instanceof URLSearchParams
    ? config.params : new URLSearchParams(config.params as Record<string, string>);
  calls.push({ url, params });
  if (url === "/auth/me") {
    const auth: AuthUser = { username: "admin", name: "Admin", role: "admin", roleAlias: "مدير",
      status: 1, statusLabel: "نشط", permissions };
    return response(config, auth);
  }
  if (url === "/selects") return response(config, [
    { label: "customers", options: [{ value: 7, label: "شركة النور - 01012345678" }] },
  ]);
  if (url === "/finance/customers/7/balance") return response(config, {
    customerId: 7, amount: "650.00", type: 1, typeLabel: "مدين",
    openingBalanceExists: false, openingBalance: null,
  });
  if (url === "/finance/customers/7/ledger") return response(config, {
    entries: [], balance: { amount: "650.00", type: 1, typeLabel: "مدين" },
    openingBalanceExists: false,
    pagination: { currentPage: 1, perPage: 20, lastPage: 1, total: 0 },
  });
  if (url === "/finance/customers/7/settlement") return response(config, {
    customerId: 7, customerName: "شركة النور", customerPhone: "01012345678",
    dateFrom: params.get("dateFrom"), dateTo: params.get("dateTo"),
    openingBalance: "200.00", deliveredTotal: "350.00",
    paymentsTotal: "50.00", adjustmentsTotal: "0.00",
    closingBalance: "500.00", financeBalanceAsOf: "650.00",
    undeliveredDifference: "150.00",
    lines: [
      { key: "delivery:11:item:2", kind: "delivered_item", date: params.get("dateFrom"),
        description: "كروت شخصية — وجهين", orderId: 10, orderNumber: "ORD-10",
        receiptNumber: null, quantity: 3, unitPrice: "116.67",
        signedAmount: "350.00", runningBalance: "550.00" },
      { key: "finance:90", kind: "collection", date: params.get("dateTo"),
        description: "تحصيل من العميل", orderId: null, orderNumber: null,
        receiptNumber: "COL-90", quantity: null, unitPrice: null,
        signedAmount: "-50.00", runningBalance: "500.00" },
    ],
  });
  throw Error("Unexpected API: " + url);
};

function visit() {
  window.history.replaceState({}, "", "/finance?customerId=7");
  return render(<App />);
}
beforeEach(() => {
  apiClient.defaults.adapter = adapter;
  permissions = ["finance.balances.view", "finance.ledger.view"];
  calls = [];
});
afterEach(() => { apiClient.defaults.adapter = originalAdapter; });

describe("Customer settlement statement", () => {
  it("loads only after period confirmation and keeps existing ledger available", async () => {
    visit();
    const user = userEvent.setup();
    const action = await screen.findByRole("button", { name: "تصفية حساب" });
    expect(calls.some(call => call.url.endsWith("/settlement"))).toBe(false);

    await user.click(action);
    const panel = screen.getByRole("region", { name: "تصفية حساب العميل" });
    expect(within(panel).getByRole("button", { name: "عرض الكشف" })).toBeTruthy();
    expect(within(panel).queryByText("كروت شخصية — وجهين")).toBeNull();
    await user.click(within(panel).getByRole("button", { name: "عرض الكشف" }));

    expect(await within(panel).findByText("كروت شخصية — وجهين")).toBeTruthy();
    expect(within(panel).getByText("COL-90")).toBeTruthy();
    expect(within(panel).getByText(/الفرق عن كشف الشغل المستلم/)).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "طباعة / PDF" })).toBeTruthy();
    expect(within(panel).getByRole("button", { name: "Excel (CSV)" })).toBeTruthy();
    expect(calls.filter(call => call.url.endsWith("/settlement")).length).toBe(1);
    const call = calls.find(item => item.url.endsWith("/settlement"))!;
    expect(call.params.get("dateFrom")).toMatch(/^\d{4}-\d{2}-01$/);
    expect(call.params.get("dateTo")).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    await user.click(screen.getByRole("button", { name: "العودة لكشف الحساب" }));
    expect(screen.getByRole("region", { name: "كشف حساب العميل" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "تصفية حساب العميل" })).toBeNull();
  });

  it("requires finance ledger permission and never requests private statement otherwise", async () => {
    permissions = ["finance.balances.view"];
    visit();
    await screen.findByRole("region", { name: "بيانات حساب العميل" });
    expect(screen.queryByRole("button", { name: "تصفية حساب" })).toBeNull();
    expect(calls.some(call => call.url.endsWith("/settlement"))).toBe(false);
  });
});
