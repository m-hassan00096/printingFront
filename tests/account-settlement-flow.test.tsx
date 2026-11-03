import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { apiClient } from "@/shared/api/http";
import { AccountSettlementPanel } from "@/features/finance/components/account-settlement-panel";
import { AccountCollectionDialog } from "@/features/finance/components/account-collection-dialog";
import { renderAccountSettlementEvidence } from "@/features/finance/lib/account-settlement-print";
import { cairoToday } from "@/features/finance/lib/account-display";
import { formatCollectionDate } from "@/features/collections/lib/collection-date-format";
import type { AccountSettlementPreview, AccountSettlementRecord } from "@/features/finance/types/account-settlement.types";

const original = apiClient.defaults.adapter;
let calls: {url: string; method: string; body: Record<string, unknown>; key: string | null}[];
let preview: AccountSettlementPreview;
let fail: "none" | "conflict" | "network";
let lastRecord: AccountSettlementRecord;
let previousSaved: AccountSettlementRecord | null;
let saved = false;
function ok(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return {config, status: 200, statusText: "OK", headers: {}, data: {success: true, message: "", data}};
}
const adapter: AxiosAdapter = async config => {
  const url = config.url ?? "";
  const method = config.method ?? "get";
  const body = typeof config.data === "string" ? JSON.parse(config.data) as Record<string, unknown> : {};
  calls.push({url, method, body, key: config.headers.get("Idempotency-Key")?.toString() ?? null});
  if (url.endsWith("/settlements/preview")) return ok(config, preview);
  if (url.endsWith("/settlements") && method === "get") {
    const settlements = [...(saved ? [lastRecord] : []), ...(previousSaved ? [previousSaved] : [])];
    return ok(config, {settlements, pagination: {currentPage: 1, lastPage: 1, perPage: 15, total: settlements.length}});
  }
  if (url.endsWith("/settlements/5")) return ok(config, lastRecord);
  if (url.endsWith("/settlements/3") && previousSaved) return ok(config, previousSaved);
  if (url.endsWith("/settlements") && method === "post") {
    if (fail === "conflict") throw new AxiosError("Changed account", "ERR_BAD_REQUEST", config, undefined, {...ok(config, null), status: 409, data: {success: false, message: "تغيّر حساب العميل. حدّث المراجعة."}});
    if (fail === "network") throw new AxiosError("Network unavailable", "ERR_NETWORK", config);
    const amount = String(body.amount);
    const discount = String(body.discountAmount ?? '0.00');
    const after = (Number(preview.balanceBefore) - Number(amount) - Number(discount)).toFixed(2);
    const status = Number(after) > 0 ? "partial" : Number(after) < 0 ? "credit" : "closed";
    lastRecord = {id: 5, number: "SET-2026-00005", customerId: 7, dateTo: preview.dateTo, settledOn: cairoToday(),
      status, originalStatus: status, statusLabel: status === "partial" ? "تصفية جزئية — يوجد متبقٍ" : status === "credit" ? "رصيد دائن محفوظ" : "مقفولة بالكامل ضمن النطاق",
      needsReview: false, balanceBefore: preview.balanceBefore, amountCollected: amount,
      discountAmount: discount, discountReason: body.discountReason ? String(body.discountReason) : null,
      discountLedgerEntryId: Number(discount) > 0 ? 91 : null, balanceAfter: after,
      accountBalanceAfter: (Number(preview.accountBalance) - Number(amount) - Number(discount)).toFixed(2), collectionId: Number(amount) > 0 ? 90 : null,
      receiptNumber: Number(amount) > 0 ? "COL-90" : null, createdAt: "2026-11-01T20:00:00Z", createdBy: 1, note: null,
      snapshot: {before: {...preview}, after: {...preview, balanceBefore: after, discountsTotal: (Number(preview.discountsTotal) + Number(discount)).toFixed(2)},  receiptNumber: Number(amount) > 0 ? "COL-90" : null}};
    saved = true;
    return ok(config, lastRecord);
  }
  if (url === "/selects") return ok(config, [
    {label: "bankAccounts", options: [{value: 3, label: "بنك مصر"}]},
    {label: "eWallets", options: [{value: 4, label: "فودافون كاش"}]},
  ]);
  if (url === "/finance/collections" && method === "post") return ok(config, {id: 90, receiptNumber: "COL-90"});
  throw Error("Unexpected request " + method + " " + url);
};
function shell(children: React.ReactNode) {
  const client = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  return render(<QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>);
}
function visit(canConfirm = true, canDiscount = true) {return shell(<AccountSettlementPanel customerId={7} customerName="شركة النور" canConfirm={canConfirm} canDiscount={canDiscount} canViewCollections={true}/>);}
async function openCreate(): Promise<void> {
  const user = userEvent.setup();
  await user.click(await screen.findByRole("button", {name: "تصفية جديدة"}));
  await screen.findByRole("dialog", {name: "تصفية حساب جديدة"});
}
const posts = () => calls.filter(call => call.method === "post");

function mockClientStatementDownload() {
  const descriptor = Object.getOwnPropertyDescriptor(URL, "createObjectURL");
  const create = vi.fn(() => "blob:customer-statement");
  Object.defineProperty(URL, "createObjectURL", {configurable: true, writable: true, value: create});
  const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  return {create, restore() {
    if (descriptor) Object.defineProperty(URL, "createObjectURL", descriptor);
    else Reflect.deleteProperty(URL, "createObjectURL");
    click.mockRestore();
  }};
}

beforeEach(() => {
  apiClient.defaults.adapter = adapter;
  calls = []; fail = "none"; saved = false; previousSaved = null;
  preview = {customerId: 7, customerName: "شركة النور", customerPhone: "01012345678", dateTo: cairoToday(), paymentsThrough: cairoToday(),
    scope: "cumulative_delivered_work", previewHash: "a".repeat(64), openingBalance: "0.00", deliveredTotal: "1000.00",
    grossCollections: "700.00", collectionReversals: "0.00", refundsTotal: "0.00", netPayments: "700.00", discountsTotal: "0.00", advancesForOtherWork: "0.00",
    balanceBefore: "300.00", dueNow: "300.00", creditInScope: "0.00", accountBalance: "2300.00", outsideBalance: "2000.00", hasWork: true,
    items: [{id: 1, orderId: 10, orderNumber: "ORD-10", deliveryDate: cairoToday(), description: "استيكر", specifications: null,
      quantity: 10, unitPrice: "100.0000", amount: "1000.00", pricingMethod: "square_meter", widthCm: "20.0000", heightCm: "15.0000"}], payments: []};
});
afterEach(() => {apiClient.defaults.adapter = original;});

describe("Financial settlement workspace", () => {
  it("automatically starts the next client statement after the last settlement cutoff", async () => {
    const today = cairoToday();
    const date = new Date(today + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() - 1);
    const previousCutoff = date.toISOString().slice(0, 10);
    const prior: AccountSettlementPreview = {
      ...preview, dateTo: previousCutoff,
      sourceManifest: {ledgerMaxId: 90, creditEntryIds: [], deliveryIds: [], orderIds: []},
    };
    previousSaved = {
      id: 3, number: "SET-2026-00003", customerId: 7, dateTo: previousCutoff,
      settledOn: previousCutoff, status: "partial", originalStatus: "partial",
      statusLabel: "تصفية جزئية", needsReview: false,
      balanceBefore: "300.00", amountCollected: "0.00", discountAmount: "0.00",
      discountReason: null, discountLedgerEntryId: null, balanceAfter: "300.00",
      accountBalanceAfter: "2300.00", collectionId: null, receiptNumber: null,
      createdAt: previousCutoff + "T12:00:00Z", createdBy: 1, note: null,
      snapshot: {before: prior, after: prior, receiptNumber: null},
    };
    visit(); await openCreate();
    const dialog = screen.getByRole("dialog", {name: "تصفية حساب جديدة"});
    await waitFor(() => expect(within(dialog).getByText("SET-2026-00003")).toBeTruthy());
    expect(within(dialog).getByRole("button", {name: "من تاريخ التقرير"}).textContent)
      .toContain(formatCollectionDate(today));
    expect(within(dialog).getByRole("button", {name: "الشغل المستلّم حتى"}).textContent)
      .toContain(formatCollectionDate(today));
    expect(posts()).toHaveLength(0);
    expect(screen.getByRole<HTMLInputElement>("textbox", {name: "مبلغ التصفية المستلم"}).value).toBe("");
  });

  it("defaults the customer statement period to the first of the month without changing the settlement cutoff", async () => {
    visit(); await openCreate();
    const dialog = screen.getByRole("dialog", {name: "تصفية حساب جديدة"});
    const start = within(dialog).getByRole("button", {name: "من تاريخ التقرير"});
    expect(start.textContent).toContain(formatCollectionDate(cairoToday().slice(0, 8) + "01"));
    expect(within(dialog).getByRole("button", {name: "الشغل المستلّم حتى"}).textContent)
      .toContain(formatCollectionDate(cairoToday()));
    const user = userEvent.setup();
    await user.click(start);
    expect(screen.getByRole("dialog", {name: "اختيار من تاريخ التقرير"})).toBeTruthy();
    await user.click(screen.getByRole("gridcell", {name: cairoToday().slice(0, 8) + "01"}));
    expect(posts()).toHaveLength(0);
    expect(screen.getByRole<HTMLInputElement>("textbox", {name: "مبلغ التصفية المستلم"}).value).toBe("");
  });

  it("exports the fresh draft statement with one click and no settlement POST or receipt", async () => {
    const download = mockClientStatementDownload();
    try {
      visit(); await openCreate();
      const button = await screen.findByRole("button", {name: "تقرير التصفية Excel"});
      const count = calls.filter(call => call.url.endsWith("/settlements/preview")).length;
      await userEvent.setup().click(button);
      await waitFor(() => expect(download.create).toHaveBeenCalledTimes(1));
      expect(calls.filter(call => call.url.endsWith("/settlements/preview")).length).toBe(count + 1);
      expect(posts()).toHaveLength(0);
      expect(screen.getByRole<HTMLInputElement>("textbox", {name: "مبلغ التصفية المستلم"}).value).toBe("");
    } finally {
      download.restore();
    }
  });

  it("refuses to export an entered settlement proposal if the live preview changed", async () => {
    const download = mockClientStatementDownload();
    try {
      visit(); await openCreate();
      const user = userEvent.setup();
      await user.type(screen.getByRole("textbox", {name: "مبلغ التصفية المستلم"}), "100");
      preview = {...preview, previewHash: "b".repeat(64), balanceBefore: "200.00", dueNow: "200.00"};
      await user.click(screen.getByRole("button", {name: "تقرير التصفية Excel"}));
      expect(await screen.findByText(/تغير حساب العميل بعد إدخال المبالغ/)).toBeTruthy();
      expect(download.create).not.toHaveBeenCalled();
      expect(posts()).toHaveLength(0);
      expect(screen.getByRole("button", {name: "تأكيد تحصيل 100.00 ج.م"}).hasAttribute("disabled")).toBe(true);
    } finally {
      download.restore();
    }
  });

  it("exports saved settlement history in one click using the full saved snapshot", async () => {
    const download = mockClientStatementDownload();
    try {
      visit(); await openCreate();
      const user = userEvent.setup();
      await user.type(screen.getByRole("textbox", {name: "مبلغ التصفية المستلم"}), "50");
      await user.click(screen.getByRole("button", {name: "تأكيد تحصيل 50.00 ج.م"}));
      const result = await screen.findByRole("region", {name: "نتيجة التصفية"});
      expect(within(result).getByRole("button", {name: "تقرير التصفية Excel"})).toBeTruthy();
      await user.click(screen.getByRole("button", {name: "التصفيات السابقة"}));
      await user.click(await screen.findByRole("button", {name: "تقرير التصفية Excel"}));
      await waitFor(() => expect(download.create).toHaveBeenCalledTimes(1));
      expect(calls.some(call => call.url.endsWith("/settlements/5") && call.method === "get")).toBe(true);
      expect(posts()).toHaveLength(1); // only the initial explicit settlement, never a new posting
    } finally {
      download.restore();
    }
  });

  it("does not post while previewing and confirms only the unpaid balance with one settlement request", async () => {
    visit(); await openCreate();
    const confirm = await screen.findByRole("button", {name: "تأكيد التصفية"});
    expect(posts()).toHaveLength(0);
    const amount = screen.getByRole<HTMLInputElement>("textbox", {name: "مبلغ التصفية المستلم"});
    expect(amount.value).toBe("");
    expect(confirm.hasAttribute("disabled")).toBe(true);
    await userEvent.setup().type(amount, "300.00");
    await userEvent.setup().click(confirm);
    expect(await screen.findByRole("region", {name: "نتيجة التصفية"})).toBeTruthy();
    expect(posts()).toHaveLength(1);
    expect(posts()[0].url).toBe("/finance/customers/7/settlements");
    expect(posts()[0].body).toMatchObject({dateTo: cairoToday(), previewHash: "a".repeat(64), amount: "300.00", paymentMethod: 0});
    expect(posts()[0].key).toBeTruthy();
    expect(screen.getByRole("link", {name: /إيصال التحصيل COL-90/}).getAttribute("href")).toBe("/collections?receiptId=90");
    expect(screen.getByText("2,000.00 ج.م")).toBeTruthy();
  });
  it("only posts after explicit entry, and the full-balance shortcut is not a payment", async () => {
    visit(); await openCreate(); const user = userEvent.setup();
    const confirm = await screen.findByRole("button", {name: "تأكيد التصفية"});
    const amount = screen.getByRole<HTMLInputElement>("textbox", {name: "مبلغ التصفية المستلم"});
    expect(amount.value).toBe("");
    expect(confirm.hasAttribute("disabled")).toBe(true);
    expect(posts()).toHaveLength(0);
    await user.click(screen.getByRole("button", {name: "دفع كامل المتبقي بعد الخصم"}));
    expect(amount.value).toBe("300.00");
    expect(posts()).toHaveLength(0);
    await user.click(confirm);
    expect(await screen.findByRole("region", {name: "نتيجة التصفية"})).toBeTruthy();
    expect(posts()).toHaveLength(1);
  });
  it("shows the selected customer and keeps confirmation anchored below the scrollable modal", async () => {
    visit(); await openCreate();
    await screen.findByRole("region", {name: "إتمام التصفية"});
    const dialog = screen.getByRole("dialog", {name: "تصفية حساب جديدة"});
    expect(within(dialog).getByText("تصفية حساب — شركة النور")).toBeTruthy();
    const footer = dialog.querySelector('footer[aria-label="إجراءات التصفية"]');
    if (!footer) throw new Error("Settlement actions footer is missing");
    expect(footer.parentElement).toBe(dialog);
    expect(footer.className).toContain("shrink-0");
    const scrollingBody = dialog.querySelector(".overflow-y-auto");
    expect(scrollingBody).toBeTruthy();
    expect(scrollingBody?.contains(footer)).toBe(false);
    expect(within(footer as HTMLElement).getByRole("button", {name: "تأكيد التصفية"}).hasAttribute("disabled")).toBe(true);
    expect(posts()).toHaveLength(0);
  });

  it("opens as one compact cash flow without discount fields or the financial details", async () => {
    visit(); await openCreate();
    const dialog = screen.getByRole("dialog", {name: "تصفية حساب جديدة"});
    expect(dialog.className).toContain("max-w-4xl");
    expect(within(dialog).getByText("تصفية حساب — شركة النور")).toBeTruthy();
    expect(within(dialog).getByText("المستحق على العميل")).toBeTruthy();
    expect(within(dialog).getByRole("textbox", {name: "مبلغ التصفية المستلم"})).toBeTruthy();
    expect(within(dialog).queryByRole("textbox", {name: "خصم ثابت"})).toBeNull();
    expect(within(dialog).getByRole("combobox", {name: "طريقة التحصيل"})).toBeTruthy();
    const addDiscount = within(dialog).getByRole("button", {name: "إضافة خصم"});
    expect(addDiscount.getAttribute("aria-expanded")).toBe("false");
    const details = within(dialog).getByText("عرض تفاصيل الحساب والشغل").closest("details");
    expect(details?.open).toBe(false);
    expect(within(dialog).getByRole("region", {name: "ملخص التصفية المتوقع"})).toBeTruthy();
    expect(posts()).toHaveLength(0);
  });

  it("discarding an optional discount clears its reason and never submits a hidden discount", async () => {
    visit(); await openCreate(); const user = userEvent.setup();
    await user.click(screen.getByRole("button", {name: "إضافة خصم"}));
    const discount = screen.getByRole<HTMLInputElement>("textbox", {name: "خصم ثابت"});
    await user.clear(discount); await user.type(discount, "100");
    await user.type(screen.getByRole("textbox", {name: "سبب الخصم"}), "اتفاق مع العميل");
    expect(screen.getByRole("button", {name: "إلغاء الخصم"}).getAttribute("aria-expanded")).toBe("true");
    await user.click(screen.getByRole("button", {name: "إلغاء الخصم"}));
    expect(screen.queryByRole("textbox", {name: "خصم ثابت"})).toBeNull();
    expect(screen.queryByRole("textbox", {name: "سبب الخصم"})).toBeNull();
    await user.type(screen.getByRole("textbox", {name: "مبلغ التصفية المستلم"}), "50.00");
    await user.click(screen.getByRole("button", {name: "تأكيد تحصيل 50.00 ج.م"}));
    await screen.findByRole("region", {name: "نتيجة التصفية"});
    expect(posts()).toHaveLength(1);
    expect(posts()[0].body.discountAmount).toBeUndefined();
    expect(posts()[0].body.discountReason).toBeUndefined();
    expect(lastRecord.amountCollected).toBe("50.00");
    expect(lastRecord.discountAmount).toBe("0.00");
  });

  it("keeps the breakdown hidden until the user asks, and opens settlement history from one place", async () => {
    visit(); await openCreate(); const user = userEvent.setup();
    const breakdown = await screen.findByText("عرض تفاصيل الحساب والشغل");
    expect(breakdown.closest("details")?.open).toBe(false);
    await user.click(breakdown);
    expect(breakdown.closest("details")?.open).toBe(true);
    expect(screen.getByText("صافي دفعات العميل السابقة")).toBeTruthy();
    expect(screen.queryByText("تفصيل الدفعات والمقدمات")).toBeNull();
    expect(screen.queryByText("التحصيلات المسجلة:")).toBeNull();
    const ledgerLink = screen.getByRole("link", {name: "عرض حركات الدفعات في كشف الحساب"});
    expect(ledgerLink.getAttribute("href")).toBe("/finance?customerId=7&view=ledger");
    expect(posts()).toHaveLength(0);
    const work = screen.getByText("الشغل المشمول (1 بند)");
    expect(work.closest("details")?.open).toBe(false);
    await user.click(work);
    expect(screen.getByText("استيكر")).toBeTruthy();
    expect(screen.getByRole("dialog", {name: "تصفية حساب جديدة"})).toBeTruthy();
    await user.click(screen.getByRole("button", {name: "إغلاق"}));
    expect(await screen.findByText("لا توجد تصفيات مسجلة لهذا العميل.")).toBeTruthy();
    await user.click(screen.getByRole("button", {name: "تصفية جديدة"}));
    expect(await screen.findByRole("region", {name: "إتمام التصفية"})).toBeTruthy();
  });
  it("shows a labeled date field defaulting to today's Cairo date, within the financial layout", async () => {
    visit(); await openCreate();
    const dialog = screen.getByRole("dialog", {name: "تصفية حساب جديدة"});
    const dateField = within(dialog).getByRole("button", {name: "الشغل المستلّم حتى"});
    expect(dateField.textContent).toContain(formatCollectionDate(cairoToday()));
    expect(dateField.getAttribute("aria-expanded")).toBe("false");
    expect(within(dialog).queryByRole("button", {name: "تغيير التاريخ"})).toBeNull();
    expect(within(dialog).getByText("الدفعات محسوبة حتى اليوم")).toBeTruthy();
    const balanceSection = within(dialog).getByText("المستحق على العميل").parentElement?.parentElement;
    expect(balanceSection?.className).toContain("bg-primary/5");
    expect(within(dialog).getByRole("region", {name: "تسجيل التصفية"})).toBeTruthy();
    const summary = within(dialog).getByRole("region", {name: "ملخص التصفية المتوقع"});
    expect(summary.className).toContain("bg-muted/40");
    expect(summary.className).toContain("border");
    expect(posts()).toHaveLength(0);
  });

  it("uses the date field's calendar, resets draft entries and restores today's default for a new settlement", async () => {
    visit(); await openCreate(); const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", {name: "مبلغ التصفية المستلم"}), "100");
    await user.click(screen.getByRole("button", {name: "إضافة خصم"}));
    const discount = screen.getByRole<HTMLInputElement>("textbox", {name: "خصم ثابت"});
    await user.clear(discount); await user.type(discount, "50");
    await user.type(screen.getByRole("textbox", {name: "سبب الخصم"}), "خصم متفق عليه");
    const dateField = screen.getByRole("button", {name: "الشغل المستلّم حتى"});
    expect(dateField.textContent).toContain(formatCollectionDate(cairoToday()));
    await user.click(dateField);
    expect(screen.getByRole("dialog", {name: "اختيار الشغل المستلّم حتى"})).toBeTruthy();
    const prev = new Date(cairoToday() + "T12:00:00Z");
    prev.setUTCDate(prev.getUTCDate() - 1);
    const previousDay = prev.toISOString().slice(0, 10);
    await user.click(screen.getByRole("gridcell", {name: previousDay}));
    expect(dateField.textContent).toContain(formatCollectionDate(previousDay));
    expect(screen.queryByRole("textbox", {name: "خصم ثابت"})).toBeNull();
    expect(screen.getByRole<HTMLInputElement>("textbox", {name: "مبلغ التصفية المستلم"}).value).toBe("");
    expect(posts()).toHaveLength(0);
    await user.type(screen.getByRole("textbox", {name: "مبلغ التصفية المستلم"}), "100");
    await user.click(screen.getByRole("button", {name: "تأكيد تحصيل 100.00 ج.م"}));
    await screen.findByRole("region", {name: "نتيجة التصفية"});
    expect(posts()[0].body.dateTo).toBe(previousDay);
    await user.click(screen.getByRole("button", {name: "التصفيات السابقة"}));
    await user.click(screen.getByRole("button", {name: "تصفية جديدة"}));
    expect(screen.getByRole("button", {name: "الشغل المستلّم حتى"}).textContent).toContain(formatCollectionDate(cairoToday()));
  });

  it("gives the discount input full width before a positive value reveals the reason", async () => {
    visit(); await openCreate(); const user = userEvent.setup();
    await user.click(screen.getByRole("button", {name: "إضافة خصم"}));
    const group = document.getElementById("settlement-discount-fields");
    if (!group) throw new Error("Missing discount group");
    expect(group.className).toContain("grid-cols-1");
    expect(group.className).not.toContain("sm:grid-cols-2");
    const discount = screen.getByRole<HTMLInputElement>("textbox", {name: "خصم ثابت"});
    expect(screen.queryByRole("textbox", {name: "سبب الخصم"})).toBeNull();
    await user.clear(discount); await user.type(discount, "100");
    expect(group.className).toContain("sm:grid-cols-2");
    expect(screen.getByRole("textbox", {name: "سبب الخصم"})).toBeTruthy();
    await user.clear(discount); await user.type(discount, "0");
    expect(group.className).toContain("grid-cols-1");
    expect(screen.queryByRole("textbox", {name: "سبب الخصم"})).toBeNull();
    expect(posts()).toHaveLength(0);
  });

  it("guides the operator to enter a payment or explicitly choose no collection", async () => {
    visit(); await openCreate(); const user = userEvent.setup();
    const summary = screen.getByRole("region", {name: "ملخص التصفية المتوقع"});
    expect(within(summary).getByText("أدخل المبلغ أو اختر «بدون تحصيل»")).toBeTruthy();
    expect(screen.getByRole("button", {name: "تأكيد التصفية"}).hasAttribute("disabled")).toBe(true);
    await user.click(screen.getByRole("button", {name: "بدون تحصيل الآن"}));
    expect(within(summary).getByText("300.00 ج.م")).toBeTruthy();
    expect(screen.queryByText("أدخل المبلغ أو اختر «بدون تحصيل»")).toBeNull();
    expect(posts()).toHaveLength(0);
  });

  it("shows the historical amount remaining after a partial settlement in the history table", async () => {
    visit(); await openCreate(); const user = userEvent.setup();
    await user.type(await screen.findByRole("textbox", {name: "مبلغ التصفية المستلم"}), "100.00");
    await user.click(screen.getByRole("button", {name: "تأكيد تحصيل 100.00 ج.م"}));
    const result = await screen.findByRole("region", {name: "نتيجة التصفية"});
    expect(within(result).getByText("200.00 ج.م")).toBeTruthy();
    await user.click(screen.getByRole("button", {name: "التصفيات السابقة"}));
    const table = await screen.findByRole("table");
    expect(within(table).getByRole("columnheader", {name: "المتبقي بعد العملية"})).toBeTruthy();
    expect(within(table).getByText("200.00 ج.م")).toBeTruthy();
    expect(screen.getByText(/رصيد التصفية وقت تسجيلها/)).toBeTruthy();
  });
  it("labels the saved settlement report separately from internal proofs and keeps the latter collapsed", async () => {
    visit(); await openCreate();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", {name: "مبلغ التصفية المستلم"}), "100.00");
    await user.click(screen.getByRole("button", {name: "تأكيد تحصيل 100.00 ج.م"}));
    const result = await screen.findByRole("region", {name: "نتيجة التصفية"});
    expect(within(result).getByRole("button", {name: "تقرير التصفية Excel"})).toBeTruthy();
    expect(within(result).queryByRole("button", {name: "كشف حساب للعميل Excel"})).toBeNull();
    const proofSection = within(result).getByText("مستندات وإثباتات").closest("details");
    if (!proofSection) throw new Error("Internal proof section is missing");
    expect(proofSection.open).toBe(false);
    await user.click(within(result).getByText("مستندات وإثباتات"));
    expect(proofSection.open).toBe(true);
    expect(within(proofSection).getByRole("button", {name: "طباعة إثبات التصفية"})).toBeTruthy();
    expect(within(proofSection).getByRole("button", {name: "إثبات التصفية Excel"})).toBeTruthy();
    expect(within(proofSection).getByText("مستندات التوثيق والمراجعة الداخلية.")).toBeTruthy();
    expect(posts()).toHaveLength(1);
  });

  it("shows the inferred delivered-work report period in history without presenting it as a stored debt boundary", async () => {
    visit(); await openCreate();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", {name: "مبلغ التصفية المستلم"}), "100.00");
    await user.click(screen.getByRole("button", {name: "تأكيد تحصيل 100.00 ج.م"}));
    await screen.findByRole("region", {name: "نتيجة التصفية"});
    const date = new Date(cairoToday() + "T00:00:00Z");
    date.setUTCDate(date.getUTCDate() - 1);
    const previousDate = date.toISOString().slice(0, 10);
    previousSaved = {
      ...lastRecord, id: 3, number: "SET-2026-00003",
      dateTo: previousDate, settledOn: previousDate,
    };
    await user.click(screen.getByRole("button", {name: "التصفيات السابقة"}));
    const history = await screen.findByRole("table");
    expect(within(history).getByRole("columnheader", {name: "فترة التقرير"})).toBeTruthy();
    expect(within(history).queryByRole("columnheader", {name: "الشغل حتى"})).toBeNull();
    expect(within(history).getByText("من: " + formatCollectionDate(cairoToday()))).toBeTruthy();
    expect(within(history).getByText("إلى: " + formatCollectionDate(cairoToday()))).toBeTruthy();
    expect(within(history).getByText("من: من بداية الحساب")).toBeTruthy();
    expect(within(history).getAllByRole("button", {name: "تقرير التصفية Excel"})).toHaveLength(2);
    expect(within(history).getAllByRole("button", {name: "عرض التفاصيل"})).toHaveLength(2);
    expect(screen.getByText(/فترة التقرير تبدأ افتراضيًا/)).toBeTruthy();
    expect(posts()).toHaveLength(1);
  });

  it("labels a smaller amount as partial and never presents it as a full close", async () => {
    visit(); await openCreate(); const user = userEvent.setup();
    const amount = await screen.findByRole("textbox", {name: "مبلغ التصفية المستلم"});
    await user.clear(amount); await user.type(amount, "100.00");
    expect(screen.getByRole("button", {name: "تأكيد تحصيل 100.00 ج.م"})).toBeTruthy();
    await user.click(screen.getByRole("button", {name: "تأكيد تحصيل 100.00 ج.م"}));
    const result = await screen.findByRole("region", {name: "نتيجة التصفية"});
    expect(within(result).getByText("تصفية جزئية — يوجد متبقٍ")).toBeTruthy();
    expect(within(result).getByText("200.00 ج.م")).toBeTruthy();
  });
  it("blocks overpayment and requires an active noncash destination", async () => {
    visit(); await openCreate(); const user = userEvent.setup();
    const amount = await screen.findByRole("textbox", {name: "مبلغ التصفية المستلم"});
    await user.clear(amount); await user.type(amount, "301.00");
    expect(screen.getByRole("button", {name: "تأكيد التصفية"}).hasAttribute("disabled")).toBe(true);
    await user.clear(amount); await user.type(amount, "300.00");
    await user.selectOptions(screen.getByRole("combobox", {name: "طريقة التحصيل"}), "1");
    expect(screen.getByRole("button", {name: "تأكيد تحصيل 300.00 ج.م"}).hasAttribute("disabled")).toBe(true);
    await screen.findByRole("option", {name: "بنك مصر"});
    await user.selectOptions(screen.getByRole("combobox", {name: "حساب التحصيل"}), "3");
    await user.click(screen.getByRole("button", {name: "تأكيد تحصيل 300.00 ج.م"}));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].body).toMatchObject({paymentMethod: 1, paymentDestinationId: 3});
  });
  it("documents already-paid work without creating another collection", async () => {
    preview = {...preview, dueNow: "0.00", balanceBefore: "0.00", netPayments: "1000.00"};
    visit(); await openCreate();
    const button = await screen.findByRole("button", {name: "حفظ مراجعة الحساب بدون تحصيل"});
    expect(screen.queryByRole("textbox", {name: "مبلغ التصفية المستلم"})).toBeNull();
    await userEvent.setup().click(button);
    await screen.findByRole("region", {name: "نتيجة التصفية"});
    expect(posts()).toHaveLength(1);
    expect(posts()[0].body).toEqual({dateTo: cairoToday(), previewHash: "a".repeat(64), amount: "0.00"});
    expect(screen.getByText("لم يُسجّل تحصيل جديد في هذه العملية.")).toBeTruthy();
  });
  it("rejects a stale preview visibly and requires refresh before another confirmation", async () => {
    fail = "conflict"; visit(); await openCreate(); const user = userEvent.setup();
    await user.type(await screen.findByRole("textbox", {name: "مبلغ التصفية المستلم"}), "300.00");
    await user.click(screen.getByRole("button", {name: "تأكيد تحصيل 300.00 ج.م"}));
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("button", {name: "تأكيد تحصيل 300.00 ج.م"}).hasAttribute("disabled")).toBe(true);
    expect(posts()).toHaveLength(1);
    preview = {...preview, previewHash: "b".repeat(64), balanceBefore: "200.00", dueNow: "200.00"}; fail = "none";
    await user.click(within(screen.getByRole("alert")).getByRole("button", {name: "تحديث المراجعة"}));
    await waitFor(() => expect((screen.getByRole("textbox", {name: "مبلغ التصفية المستلم"}) as HTMLInputElement).value).toBe(""));
    await user.type(screen.getByRole("textbox", {name: "مبلغ التصفية المستلم"}), "200.00");
    await user.click(screen.getByRole("button", {name: "تأكيد تحصيل 200.00 ج.م"}));
    await screen.findByRole("region", {name: "نتيجة التصفية"});
    expect(posts()[1].body.previewHash).toBe("b".repeat(64));
    expect(posts()[1].key).not.toBe(posts()[0].key);
  });
  it("reuses the idempotency key after an uncertain network response", async () => {
    fail = "network"; visit(); await openCreate(); const user = userEvent.setup();
    await user.type(await screen.findByRole("textbox", {name: "مبلغ التصفية المستلم"}), "300.00");
    await user.click(screen.getByRole("button", {name: "تأكيد تحصيل 300.00 ج.م"}));
    await screen.findByRole("alert"); fail = "none";
    await user.click(screen.getByRole("button", {name: "تأكيد تحصيل 300.00 ج.م"}));
    await screen.findByRole("region", {name: "نتيجة التصفية"});
    expect(posts()).toHaveLength(2);
    expect(posts()[1].key).toBe(posts()[0].key);
  });
  it("keeps read-only reviewers from payment controls and all POST requests", async () => {
    visit(false); await openCreate();
    await screen.findByRole("region", {name: "إتمام التصفية"});
    expect(screen.getByText(/تسجيل التصفية يحتاج صلاحية تسجيل التحصيل/)).toBeTruthy();
    expect(screen.queryByRole("textbox", {name: "مبلغ التصفية المستلم"})).toBeNull();
    expect(posts()).toHaveLength(0);
  });
  it("uses the existing general-collection endpoint from the fixed customer account", async () => {
    shell(<AccountCollectionDialog customerId={7} customerName="شركة النور" onClose={() => {}} onSuccess={() => {}}/>);
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", {name: "المبلغ المستلم الآن"}), "125.50");
    await user.click(screen.getByRole("button", {name: /تأكيد تحصيل/}));
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(posts()[0].url).toBe("/finance/collections");
    expect(posts()[0].body).toMatchObject({customerId: 7, amount: "125.50", paymentMethod: 0, collectedOn: cairoToday()});
    expect(posts()[0].key).toBeTruthy();
  });
  it("keeps draft numbers separate from the posted settlement and updates only after confirmation", async () => {
    visit(); await openCreate();
    const user = userEvent.setup();
    await user.type(screen.getByRole("textbox", {name: "مبلغ التصفية المستلم"}), "100.00");
    const previewBox = screen.getByRole("region", {name: "ملخص التصفية المتوقع"});
    expect(within(previewBox).getByText("المتبقي المتوقع")).toBeTruthy();
    expect(within(previewBox).getByText("200.00 ج.م")).toBeTruthy();
    expect(screen.queryByRole("region", {name: "نتيجة التصفية"})).toBeNull();
    expect(posts()).toHaveLength(0);
    await user.click(screen.getByRole("button", {name: "تأكيد تحصيل 100.00 ج.م"}));
    const posted = await screen.findByRole("region", {name: "نتيجة التصفية"});
    expect(within(posted).getByText("المتبقي بعد التصفية")).toBeTruthy();
    expect(screen.queryByRole("region", {name: "ملخص التصفية المتوقع"})).toBeNull();
    expect(posts()).toHaveLength(1);
  });

  it("opens saved history first and does not request a financial preview until the modal is opened", async () => {
    visit();
    expect(await screen.findByText("لا توجد تصفيات مسجلة لهذا العميل.")).toBeTruthy();
    expect(calls.filter(x => x.url.endsWith("/settlements/preview"))).toHaveLength(0);
    await openCreate();
    expect(await screen.findByRole("region", {name: "إتمام التصفية"})).toBeTruthy();
    expect(calls.some(x => x.url.endsWith("/settlements/preview"))).toBe(true);
    expect(posts()).toHaveLength(0);
  });

  it("saves an agreed fixed discount of 100 without recording any cash", async () => {
    visit(); await openCreate();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", {name: "إضافة خصم"}));
    const field = await screen.findByRole("textbox", {name: "خصم ثابت"});
    await user.clear(field);
    await user.type(field, "100.00");
    expect(screen.queryByRole("button", {name: "حفظ الخصم بدون تحصيل"})).toBeNull();
    await user.type(screen.getByRole("textbox", {name: "سبب الخصم"}), "اتفاق مع العميل");
    await user.click(screen.getByRole("button", {name: "بدون تحصيل الآن"}));
    expect(screen.getByText(/المتبقي المتوقع/)).toBeTruthy();
    await user.click(screen.getByRole("button", {name: "حفظ الخصم بدون تحصيل"}));
    const saved = await screen.findByRole("region", {name: "نتيجة التصفية"});
    expect(within(saved).getByText("100.00 ج.م")).toBeTruthy();
    expect(within(saved).getByText("200.00 ج.م")).toBeTruthy();
    expect(posts()).toHaveLength(1);
    expect(posts()[0].body).toMatchObject({
      amount: "0.00", discountAmount: "100.00", discountReason: "اتفاق مع العميل",
    });
    expect(screen.getByText("لم يُسجّل تحصيل جديد في هذه العملية.")).toBeTruthy();
    await user.click(screen.getByRole("button", {name: "التصفيات السابقة"}));
    const history = await screen.findByRole("table");
    expect(within(history).getByRole("columnheader", {name: "الخصم"})).toBeTruthy();
    expect(within(history).getByText("100.00 ج.م")).toBeTruthy();
  });

  it("reveals payment method only for actual cash and requires bank destination", async () => {
    visit(); await openCreate(); const user = userEvent.setup();
    expect(screen.getByRole("combobox", {name: "طريقة التحصيل"})).toBeTruthy();
    const cash = screen.getByRole<HTMLInputElement>("textbox", {name: "مبلغ التصفية المستلم"});
    await user.type(cash, "200.00");
    await user.selectOptions(screen.getByRole("combobox", {name: "طريقة التحصيل"}), "1");
    expect(screen.getByRole("button", {name: "تأكيد تحصيل 200.00 ج.م"}).hasAttribute("disabled")).toBe(true);
    await screen.findByRole("option", {name: "بنك مصر"});
    await user.selectOptions(screen.getByRole("combobox", {name: "حساب التحصيل"}), "3");
    expect(screen.getByRole("button", {name: "تأكيد تحصيل 200.00 ج.م"}).hasAttribute("disabled")).toBe(false);
    await user.clear(cash); await user.type(cash, "0");
    expect((screen.getByRole("combobox", {name: "طريقة التحصيل"}) as HTMLSelectElement).disabled).toBe(true);
    expect(posts()).toHaveLength(0);
  });

  it("shows only the missing discount reason error for a valid discount", async () => {
    preview = {...preview, balanceBefore: "1950.00", dueNow: "1950.00", accountBalance: "1950.00",
      deliveredTotal: "1950.00", netPayments: "0.00", grossCollections: "0.00", outsideBalance: "0.00"};
    visit(); await openCreate();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", {name: "إضافة خصم"}));
    const discount = await screen.findByRole("textbox", {name: "خصم ثابت"});
    await user.clear(discount);
    await user.type(discount, "950");
    await user.type(screen.getByRole("textbox", {name: "مبلغ التصفية المستلم"}), "1000");
    expect(screen.getByText("اكتب سبب الخصم قبل التأكيد (3 أحرف على الأقل).")).toBeTruthy();
    expect(screen.queryByText(/أدخل خصمًا صحيحًا لا يتجاوز/)).toBeNull();
    expect(screen.getByRole("textbox", {name: "سبب الخصم"}).getAttribute("aria-invalid")).toBe("true");
    const summary = screen.getByRole("region", {name: "ملخص التصفية المتوقع"});
    expect(within(summary).getByText("المتبقي المتوقع")).toBeTruthy();
    expect(within(summary).getByText("نتيجة تقديرية فقط، لم تُسجَّل بعد.")).toBeTruthy();
    expect(within(summary).getAllByText("0.00 ج.م")).toHaveLength(1);
    expect(screen.queryByText("تمت تسوية الشغل المشمول")).toBeNull();
    expect(screen.getByRole("button", {name: "تأكيد الخصم والتحصيل"}).hasAttribute("disabled")).toBe(true);
    expect(posts()).toHaveLength(0);
    await user.type(screen.getByRole("textbox", {name: "سبب الخصم"}), "خصم متفق عليه");
    expect(screen.queryByText("اكتب سبب الخصم قبل التأكيد (3 أحرف على الأقل).")).toBeNull();
    expect(screen.getByRole("button", {name: "تأكيد الخصم والتحصيل"}).hasAttribute("disabled")).toBe(false);
    expect(posts()).toHaveLength(0);
  });

  it("shows the discount amount error separately when it exceeds the real customer debt", async () => {
    visit(); await openCreate();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", {name: "إضافة خصم"}));
    const discount = await screen.findByRole("textbox", {name: "خصم ثابت"});
    await user.clear(discount);
    await user.type(discount, "301");
    await user.type(screen.getByRole("textbox", {name: "سبب الخصم"}), "خصم متفق عليه");
    expect(screen.getByText("أدخل خصمًا صحيحًا لا يتجاوز المستحق أو مديونية العميل.")).toBeTruthy();
    expect(screen.queryByText("اكتب سبب الخصم قبل التأكيد (3 أحرف على الأقل).")).toBeNull();
    expect(discount.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("button", {name: "تأكيد التصفية"}).hasAttribute("disabled")).toBe(true);
    expect(posts()).toHaveLength(0);
  });

  it("shows the correct 2500 - 1000 discount - 500 cash settlement remainder", async () => {
    preview = {...preview, deliveredTotal: "2500.00", netPayments: "0.00", grossCollections: "0.00",
      dueNow: "2500.00", balanceBefore: "2500.00", accountBalance: "2500.00", outsideBalance: "0.00"};
    visit(); await openCreate();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", {name: "إضافة خصم"}));
    const discount = await screen.findByRole("textbox", {name: "خصم ثابت"});
    await user.clear(discount);
    await user.type(discount, "1000.00");
    await user.type(screen.getByRole("textbox", {name: "سبب الخصم"}), "خصم متفق عليه");
    await user.type(screen.getByRole("textbox", {name: "مبلغ التصفية المستلم"}), "500.00");
    await user.click(screen.getByRole("button", {name: "تأكيد الخصم والتحصيل"}));
    const result = await screen.findByRole("region", {name: "نتيجة التصفية"});
    const balanceCard = within(result).getByText("المتبقي بعد التصفية").parentElement;
    if (!balanceCard) throw new Error("Missing remaining balance card");
    expect(within(balanceCard).getByText("1,000.00 ج.م")).toBeTruthy();
    expect(posts()).toHaveLength(1);
    expect(posts()[0].body).toMatchObject({
      discountAmount: "1000.00", amount: "500.00", discountReason: "خصم متفق عليه", paymentMethod: 0,
    });
    expect(lastRecord.balanceAfter).toBe("1000.00");
    expect(lastRecord.collectionId).toBe(90);
  });

  it("reduces remaining debt by the sum of a fixed discount and a real partial payment", async () => {
    visit(); await openCreate();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", {name: "إضافة خصم"}));
    const discount = await screen.findByRole("textbox", {name: "خصم ثابت"});
    await user.clear(discount);
    await user.type(discount, "100.00");
    await user.type(screen.getByRole("textbox", {name: "سبب الخصم"}), "تعويض عن التأخير");
    const cash = screen.getByRole("textbox", {name: "مبلغ التصفية المستلم"});
    await user.type(cash, "50.00");
    expect(screen.getByText(/المتبقي المتوقع/)).toBeTruthy();
    await user.click(screen.getByRole("button", {name: "تأكيد الخصم والتحصيل"}));
    await screen.findByRole("region", {name: "نتيجة التصفية"});
    expect(posts()).toHaveLength(1);
    expect(posts()[0].body).toMatchObject({
      amount: "50.00", discountAmount: "100.00",
      discountReason: "تعويض عن التأخير", paymentMethod: 0,
    });
    expect(screen.getByText("150.00 ج.م")).toBeTruthy();
  });

  it("does not expose the optional discount action to staff without discount permission", async () => {
    visit(true, false); await openCreate();
    expect(screen.queryByRole("button", {name: "إضافة خصم"})).toBeNull();
    expect(screen.queryByRole("textbox", {name: "خصم ثابت"})).toBeNull();
    expect(posts()).toHaveLength(0);
  });

  it("allows an explicit zero-cash partial settlement without inventing a receipt", async () => {
    visit(); await openCreate();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", {name: "بدون تحصيل الآن"}));
    const save = screen.getByRole("button", {name: "حفظ مراجعة الحساب بدون تحصيل"});
    expect(save.hasAttribute("disabled")).toBe(false);
    await user.click(save);
    const result = await screen.findByRole("region", {name: "نتيجة التصفية"});
    expect(within(result).getByText("300.00 ج.م")).toBeTruthy();
    expect(posts()).toHaveLength(1);
    expect(posts()[0].body).toMatchObject({amount: "0.00"});
    expect(posts()[0].body.discountAmount).toBeUndefined();
    expect(lastRecord.balanceAfter).toBe("300.00");
    expect(lastRecord.collectionId).toBeNull();
  });

  it("prints escaped immutable evidence with an explicit warning after a later reversal", async () => {
    preview.customerName = '<script>alert(1)</script>';
    visit(); await openCreate();
    await userEvent.setup().type(await screen.findByRole("textbox", {name: "مبلغ التصفية المستلم"}), "300.00");
    await userEvent.setup().click(screen.getByRole("button", {name: "تأكيد تحصيل 300.00 ج.م"}));
    await screen.findByRole("region", {name: "نتيجة التصفية"});
    const html = renderAccountSettlementEvidence({...lastRecord, status: "needs_review", statusLabel: "تحتاج مراجعة", needsReview: true});
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
    expect(html).toContain("ليست إثباتًا بأن الرصيد الحالي مسدد");
    expect(html).toContain("COL-90");
    expect(html).toContain("20.0000 × 15.0000 سم");
  });
});
