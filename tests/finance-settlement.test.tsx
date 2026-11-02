import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";
import type { SettlementRecord, SettlementRecordSummary } from "@/features/finance/types/settlement.types";

const originalAdapter = apiClient.defaults.adapter;
let permissions: string[] = [];
let calls: Array<{ url: string; method: string; params: URLSearchParams; body: Record<string, unknown> | null }> = [];
let savedRecord: SettlementRecord | null = null;

function response(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { config, status: 200, statusText: "OK", headers: {},
    data: { success: true, message: "", data } };
}

function preview(config: InternalAxiosRequestConfig, withNewMovements = false) {
  const params = config.params instanceof URLSearchParams ?
    config.params : new URLSearchParams(config.params as Record<string, string>);
  const from = params.get("dateFrom") ?? "2026-11-01";
  const to = params.get("dateTo") ?? "2026-11-02";
  return {
    customerId: 7, customerName: "شركة النور", customerPhone: "01012345678",
    dateFrom: from, dateTo: to,
    settlementOn: withNewMovements ? "2026-11-02" : undefined,
    openingBalance: "200.00", deliveredTotal: "350.00",
    paymentsTotal: withNewMovements ? "100.00" : "50.00",
    discountsTotal: withNewMovements ? "100.00" : "0.00",
    adjustmentsTotal: "0.00",
    closingBalance: withNewMovements ? "350.00" : "500.00",
    financeBalanceAsOf: "650.00", undeliveredDifference: "150.00",
    lines: [
      { key: "delivery:11:item:2", kind: "delivered_item", date: from,
        description: "كروت شخصية — وجهين", orderId: 10, orderNumber: "ORD-10",
        receiptNumber: null, quantity: 3, unitPrice: "116.6667",
        signedAmount: "350.00", runningBalance: "550.00" },
      { key: "finance:90", kind: "collection", date: to,
        description: "تحصيل من العميل", orderId: null, orderNumber: null,
        receiptNumber: "COL-90", quantity: null, unitPrice: null,
        signedAmount: "-50.00", runningBalance: "500.00" },
      ...(withNewMovements ? [
        { key: "finance:91", kind: "settlement_discount", date: to,
          description: "خصم تصفية حساب — خصم متفق عليه", orderId: null, orderNumber: null,
          receiptNumber: null, quantity: null, unitPrice: null,
          signedAmount: "-100.00", runningBalance: "400.00" },
        { key: "finance:92", kind: "collection", date: to,
          description: "تحصيل تصفية", orderId: null, orderNumber: null,
          receiptNumber: "COL-92", quantity: null, unitPrice: null,
          signedAmount: "-50.00", runningBalance: "350.00" },
      ] : []),
    ],
  };
}

const adapter: AxiosAdapter = async config => {
  const url = config.url ?? "";
  const method = (config.method ?? "get").toLowerCase();
  const params = config.params instanceof URLSearchParams
    ? config.params : new URLSearchParams(config.params as Record<string, string>);
  const body = config.data ? JSON.parse(String(config.data)) as Record<string, unknown> : null;
  calls.push({ url, method, params, body });

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
  if (url === "/finance/customers/7/settlement") return response(config, preview(config));

  if (url === "/finance/customers/7/settlement-records") {
    if (method === "get") {
      const entries: SettlementRecordSummary[] = savedRecord ? [savedRecord] : [];
      return response(config, {
        settlements: entries, nextDateFrom: savedRecord ? "2099-01-01" : null,
        pagination: { currentPage: 1, lastPage: 1, perPage: 15, total: entries.length },
      });
    }
    if (method === "post" && body) {
      savedRecord = {
        id: 12, number: "SET-2026-00012",
        dateFrom: String(body.dateFrom), dateTo: String(body.dateTo),
        settledOn: "2026-11-02", collectionReversed: false,
        createdByName: "Admin",
        createdAt: "2026-11-02 16:00:00",
        balanceBefore: "500.00", balanceAfter: "350.00",
        collectedAmount: String(body.collectedAmount), discountAmount: String(body.discountAmount),
        status: "partial", discountReason: String(body.discountReason), note: null,
        collectionId: 92,
        statement: preview({ ...config, params: new URLSearchParams({
          dateFrom: String(body.dateFrom), dateTo: String(body.dateTo),
        }) } as InternalAxiosRequestConfig, true),
      };
      return response(config, savedRecord);
    }
  }
  if (url === "/finance/customers/7/settlement-records/12" && savedRecord) {
    return response(config, savedRecord);
  }
  throw Error("Unexpected API: " + method + " " + url);
};

function visit() {
  window.history.replaceState({}, "", "/finance?customerId=7");
  return render(<App />);
}

beforeEach(() => {
  apiClient.defaults.adapter = adapter;
  permissions = [
    "finance.balances.view", "finance.ledger.view", "finance.settlements.view",
    "finance.settlements.create", "finance.settlements.discount", "finance.collections.create",
  ];
  calls = [];
  savedRecord = null;
});
afterEach(() => { apiClient.defaults.adapter = originalAdapter; });

describe("Customer settlement records", () => {
  it("opens history first and only fetches a statement in the create dialog", async () => {
    visit();
    const user = userEvent.setup();
    const action = await screen.findByRole("button", { name: "تصفية حساب" });

    await user.click(action);
    const panel = screen.getByRole("region", { name: "تصفية حساب العميل" });
    expect(within(panel).getByText("سجل التصفيات")).toBeTruthy();
    expect(within(panel).getByText("لا توجد تصفيات سابقة")).toBeTruthy();
    expect(calls.some(call => call.url.endsWith("/settlement"))).toBe(false);
    expect(calls.some(call => call.url.endsWith("/settlement-records"))).toBe(true);

    await user.click(within(panel).getByRole("button", { name: "تصفية جديدة" }));
    const dialog = screen.getByRole("dialog", { name: "تصفية حساب جديدة" });
    expect(within(dialog).queryByText("كروت شخصية — وجهين")).toBeNull();
  });

  it("creates a fixed discount and a genuine cash collection, then shows immutable history", async () => {
    visit();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("button", { name: "تصفية حساب" }));
    await user.click(await screen.findByRole("button", { name: "تصفية جديدة" }));
    const dialog = screen.getByRole("dialog", { name: "تصفية حساب جديدة" });
    expect(await within(dialog).findByText("المستحق قبل التصفية")).toBeTruthy();

    const discount = within(dialog).getByRole("textbox", { name: "خصم ثابت" });
    await user.clear(discount);
    await user.type(discount, "100.00");
    await user.type(within(dialog).getByRole("textbox", { name: "سبب الخصم" }), "خصم متفق عليه");
    const collected = within(dialog).getByRole("textbox", { name: "المبلغ المحصل الآن" });
    await user.clear(collected);
    await user.type(collected, "50.00");
    await user.click(within(dialog).getByRole("button", { name: "حفظ وتسجيل التحصيل" }));

    await waitFor(() => expect(calls.some(call => call.method === "post" &&
      call.url.endsWith("/settlement-records"))).toBe(true));
    const sent = calls.find(call => call.method === "post" &&
      call.url.endsWith("/settlement-records"))!;
    expect(sent.body?.discountAmount).toBe("100.00");
    expect(sent.body?.collectedAmount).toBe("50.00");
    expect(sent.body?.paymentMethod).toBe(0);
    expect(sent.body?.discountReason).toBe("خصم متفق عليه");

    expect(await screen.findByText("SET-2026-00012")).toBeTruthy();
    expect(screen.getByRole("button", { name: "طباعة / PDF" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "تصدير Excel" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "العودة لسجل التصفيات" }));
    expect(await screen.findByText("SET-2026-00012")).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: "تصفية حساب جديدة" })).toBeNull();
  });

  it("respects read and write permissions without leaking private statements", async () => {
    permissions = ["finance.balances.view"];
    visit();
    await screen.findByRole("region", { name: "بيانات حساب العميل" });
    expect(screen.queryByRole("button", { name: "تصفية حساب" })).toBeNull();
    expect(calls.some(call => call.url.includes("settlement"))).toBe(false);
  });
});
