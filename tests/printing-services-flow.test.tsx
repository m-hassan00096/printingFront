import { beforeEach, afterEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";
import type { PrintingService } from "@/features/printing-services/types/printing-service.types";

const oldAdapter = apiClient.defaults.adapter;
const rights = ["printing_services.view", "printing_services.create", "printing_services.update",
  "printing_services.delete", "printing_services.price_preview.view"];
let permissions: string[];
let calls: Array<{ method: string; url: string; query: URLSearchParams; body: Record<string, unknown> }>;
let services: PrintingService[];
function result(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { config, status, statusText: String(status), headers: {}, data: { success: true, message: "", data } };
}
const adapter: AxiosAdapter = async (config) => {
  const url = config.url ?? "";
  const query = config.params instanceof URLSearchParams
    ? config.params : new URLSearchParams(config.params as Record<string, string>);
  const body = typeof config.data === "string" ? JSON.parse(config.data) as Record<string, unknown> : {};
  calls.push({ method: config.method ?? "", url, query, body });
  if (url === "/auth/me") {
    const user: AuthUser = { name: "Admin", username: "admin", role: "admin", roleAlias: "مدير النظام",
      status: 1, statusLabel: "نشط", permissions };
    return result(config, user);
  }
  if (url === "/selects" && query.get("selects") === "customerTypes")
    return result(config, [{ label: "customerTypes", options: [
      { value: 21, label: "شركة" }, { value: 22, label: "فرد" },
    ] }]);
  if (url === "/printing-services" && config.method === "get")
    return result(config, { printingServices: services.map(({ priceTiers: _ignored, ...item }) => {
      void _ignored;
      return item;
    }), pagination: { currentPage: 1, lastPage: 1, perPage: 15, total: services.length } });
  if (url === "/printing-services/11" && config.method === "get") return result(config, services[0]);
  if (url === "/printing-services" && config.method === "post") {
    const saved: PrintingService = {
      id: 12, name: String(body.name), status: Number(body.status) as 0 | 1,
      basePrice: body.basePrice === null ? null : String(body.basePrice),
      priceTiers: (body.priceTiers as Array<{customerTypeId:number|null;minQuantity:number|null;maxQuantity:number|null;price:string}>)
        .map((tier, i) => ({ ...tier, priceTierId: 600 + i })),
    };
    services.push(saved);
    return result(config, saved, 201);
  }
  if (url === "/printing-services/11" && config.method === "patch") {
    const updated = services[0];
    const commands = body.priceTiers as Array<Record<string, unknown>> | undefined;
    for (const command of commands ?? []) {
      if (command.actionStatus === 2)
        updated.priceTiers = (updated.priceTiers ?? []).map((t) =>
          t.priceTierId === command.priceTierId ? {
            ...t, price: String(command.price), minQuantity: command.minQuantity as number|null,
            maxQuantity: command.maxQuantity as number|null, customerTypeId: command.customerTypeId as number|null,
          } : t);
      if (command.actionStatus === 3)
        updated.priceTiers = updated.priceTiers?.filter((t) => t.priceTierId !== command.priceTierId);
      if (command.actionStatus === 1)
        updated.priceTiers = [...(updated.priceTiers ?? []), {
          priceTierId: 999, price: String(command.price), minQuantity: command.minQuantity as number|null,
          maxQuantity: command.maxQuantity as number|null, customerTypeId: command.customerTypeId as number|null,
        }];
    }
    if (body.name) updated.name = String(body.name);
    return result(config, updated);
  }
  if (url === "/printing-services/price-preview" && config.method === "post")
    return result(config, { serviceId: body.serviceId, quantity: body.quantity,
      source: "customerTypeQuantityTier", suggestedUnitPrice: "5.50",
      suggestedTotal: "1100.00", requiresManualTotal: false });
  throw new Error(`Unhandled ${config.method} ${url}`);
};
function visit(path: string) {
  window.history.replaceState({}, "", path);
  return render(<App />);
}
beforeEach(() => {
  permissions = [...rights];
  calls = [];
  services = [{
    id: 11, name: "كروت شخصية", status: 1, basePrice: "10.00",
    priceTiers: [{ priceTierId: 501, customerTypeId: null,
      minQuantity: 100, maxQuantity: 500, price: "5.50" }],
  }];
  apiClient.defaults.adapter = adapter;
});
afterEach(() => { apiClient.defaults.adapter = oldAdapter; });

describe("Printing Services API integration", () => {
  it("loads the paginated catalog with Laravel search and status filters", async () => {
    visit("/printing-services");
    expect(await screen.findByText("كروت شخصية")).toBeTruthy();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("بحث باسم خدمة الطباعة"), "كروت");
    await waitFor(() => expect(calls.some((c) => c.url === "/printing-services" &&
      c.query.get("filter[search]") === "كروت")).toBe(true));
    await user.selectOptions(screen.getByRole("combobox", { name: "فلتر الحالة" }), "1");
    await waitFor(() => expect(calls.some((c) => c.url === "/printing-services" &&
      c.query.get("filter[status]") === "1")).toBe(true));
  });

  it("creates a service with typed customer-type quantity tiers", async () => {
    visit("/printing-services/new");
    expect(await screen.findByRole("heading", { name: "إضافة خدمة طباعة" })).toBeTruthy();
    const user = userEvent.setup();
    await user.type(await screen.findByRole("textbox", { name: "اسم الخدمة" }), "بوسترات");
    await user.type(screen.getByRole("textbox", { name: "السعر الأساسي" }), "10.00");
    await user.click(screen.getByRole("button", { name: "إضافة شريحة" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "نوع عميل الشريحة 1" }), "21");
    await user.type(screen.getByRole("spinbutton", { name: "الكمية من للشريحة 1" }), "100");
    await user.type(screen.getByRole("spinbutton", { name: "الكمية إلى للشريحة 1" }), "500");
    await user.type(screen.getByRole("textbox", { name: "سعر الشريحة 1" }), "5.50");
    await user.click(screen.getByRole("button", { name: "حفظ الخدمة" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/printing-services" && c.method === "post")).toBe(true));
    const request = calls.find((c) => c.url === "/printing-services" && c.method === "post");
    expect(request?.body).toMatchObject({
      name: "بوسترات", basePrice: "10.00", status: 1, priceTiers: [
        { customerTypeId: 21, minQuantity: 100, maxQuantity: 500, price: "5.50" },
      ],
    });
  });

  it("edits only the modified tier with actionStatus 2 and real tier ID", async () => {
    visit("/printing-services/11/edit");
    expect(await screen.findByRole("heading", { name: "تعديل خدمة طباعة" })).toBeTruthy();
    const user = userEvent.setup();
    const price = await screen.findByRole("textbox", { name: "سعر الشريحة 1" });
    await user.clear(price);
    await user.type(price, "6.25");
    await user.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
    await waitFor(() => expect(calls.some((c) => c.url === "/printing-services/11" && c.method === "patch")).toBe(true));
    const body = calls.find((c) => c.url === "/printing-services/11" && c.method === "patch")?.body;
    expect(body).toEqual({ priceTiers: [{
      actionStatus: 2, priceTierId: 501, customerTypeId: null,
      minQuantity: 100, maxQuantity: 500, price: "6.25",
    }] });
  });

  it("shows compact pricing only, with no preview UI or preview API calls", async () => {
    visit("/printing-services/11");
    expect(await screen.findByRole("heading", { name: "كروت شخصية" })).toBeTruthy();
    const section = screen.getByRole("region", { name: "أسعار الخدمة" });
    expect(within(section).queryByText("شرائح الأسعار")).toBeNull();
    expect(within(section).getByText("سعر الوحدة")).toBeTruthy();
    expect(within(section).getByText("5.50 ج.م")).toBeTruthy();
    expect(within(section).getByText("10.00 ج.م")).toBeTruthy();
    expect(screen.queryByText("معاينة السعر المقترح")).toBeNull();
    expect(screen.queryByText("معاينة السعر المقترح")).toBeNull();
    expect(calls.some((c) => c.url === "/printing-services/price-preview")).toBe(false);
  });

  it("hides update actions without permission and never renders a price preview", async () => {
    permissions = ["printing_services.view"];
    visit("/printing-services/11");
    expect(await screen.findByRole("heading", { name: "كروت شخصية" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /تعديل الخدمة/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "حساب السعر المقترح" })).toBeNull();
    expect(calls.some((c) => c.url === "/printing-services/price-preview")).toBe(false);
  });
});
