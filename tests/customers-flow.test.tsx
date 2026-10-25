import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";
import type { Customer } from "@/features/customers/types/customers.types";

const original = apiClient.defaults.adapter;
const fullPermissions = [
  "customers.view", "customers.create", "customers.update", "customers.delete",
  "finance.balances.view", "finance.ledger.view",
];
let permissions: string[];
let requests: Array<{ method: string; path: string; query: URLSearchParams; body: Record<string, unknown> }>;
let customers: Customer[];
let rejectDuplicate: boolean;

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { config, status, statusText: String(status), headers: {}, data: { success: true, message: "", data } };
}
const api: AxiosAdapter = async (config) => {
  const path = config.url ?? "";
  const body: Record<string, unknown> = typeof config.data === "string" ? JSON.parse(config.data) as Record<string, unknown> : {};
  const query = config.params instanceof URLSearchParams
    ? config.params : new URLSearchParams(config.params as Record<string, string>);
  requests.push({ method: config.method ?? "", path, query, body });
  if (path === "/auth/me") {
    const user: AuthUser = { name: "Admin", username: "admin", role: "admin", roleAlias: "مدير النظام",
      status: 1, statusLabel: "نشط", permissions };
    return response(config, user);
  }
  if (path === "/customers/customer-types") {
    return response(config, { customerTypes: [{ value: 21, label: "شركة" }, { value: 22, label: "فرد" }] });
  }
  if (path === "/customers" && config.method === "get") {
    const search = query.get("filter[search]") ?? "";
    return response(config, {
      customers: customers.filter((customer) => customer.name.includes(search) || customer.phone.includes(search)),
      pagination: { currentPage: 1, lastPage: 1, perPage: 15, total: customers.length },
    });
  }
  if (path === "/customers" && config.method === "post") {
    const created: Customer = {
      id: 103, name: String(body.name), phone: String(body.phone),
      address: body.address ? String(body.address) : null, customerTypeId: Number(body.customerTypeId),
      customerType: { id: Number(body.customerTypeId), name: "شركة" },
      status: Number(body.status) as 0 | 1, statusLabel: "فعال",
    };
    customers = [...customers, created];
    return response(config, created, 201);
  }
  if (path === "/customers/101" && config.method === "get") return response(config, customers[0]);
  if (path === "/customers/101" && config.method === "patch") {
    if (rejectDuplicate) {
      const failure: AxiosResponse = {
        config, status: 422, statusText: "Unprocessable Entity", headers: {},
        data: { success: false, message: "خطأ في البيانات", errors: { phone: ["رقم هاتف العميل مستخدم بالفعل."] } },
      };
      throw new AxiosError("Validation failed", "ERR_BAD_REQUEST", config, undefined, failure);
    }
    customers = customers.map((c) => c.id === 101 ? {
      ...c, name: String(body.name), phone: String(body.phone), address: body.address === null ? null : String(body.address),
    } : c);
    return response(config, null);
  }
  if (path === "/customers/101" && config.method === "delete") {
    customers = customers.filter((c) => c.id !== 101);
    return response(config, null);
  }
  if (path === "/finance/customers/101/balance") {
    return response(config, { customerId: 101, amount: "150.00", type: 1, typeLabel: "مدين" });
  }
  if (path === "/finance/customers/101/ledger") {
    return response(config, {
      entries: [{ id: 9, type: 1, typeLabel: "رصيد افتتاحي", amount: "150.00",
        signedAmount: "150.00", orderId: null, collectionId: null, refundId: null,
        effectiveDate: "2026-10-23", note: null, createdAt: "2026-10-23T12:00:00+03:00" }],
      balance: { amount: "150.00", type: 1, typeLabel: "مدين" },
      pagination: { currentPage: 1, lastPage: 1, perPage: 15, total: 1 },
    });
  }
  throw Error(`Unexpected request ${config.method} ${path}`);
};

function visit(path: string) {
  window.history.replaceState({}, "", path);
  return render(<App />);
}
beforeEach(() => {
  permissions = [...fullPermissions];
  rejectDuplicate = false;
  requests = [];
  customers = [{ id: 101, name: "أحمد محمد", phone: "01012345678", address: "القاهرة",
    customerTypeId: 21, customerType: { id: 21, name: "شركة" }, status: 1, statusLabel: "فعال" }];
  apiClient.defaults.adapter = api;
});
afterEach(() => { apiClient.defaults.adapter = original; });

describe("Customers Laravel integration", () => {
  it("loads customers and searches by name using the real filter contract", async () => {
    visit("/customers");
    expect(await screen.findByText("أحمد محمد")).toBeTruthy();
    await userEvent.setup().type(screen.getByPlaceholderText("بحث باسم العميل أو رقم الهاتف"), "أحمد");
    await waitFor(() => expect(requests.some((r) => r.path === "/customers" && r.query.get("filter[search]") === "أحمد")).toBe(true));
  });

  it("creates customer using active-type endpoint and camelCase fields", async () => {
    visit("/customers");
    expect(await screen.findByText("أحمد محمد")).toBeTruthy();
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "إضافة عميل" }));
    expect(await within(screen.getByRole("dialog")).findByRole("option", { name: "شركة" })).toBeTruthy();
    await u.type(screen.getByRole("textbox", { name: "اسم العميل" }), "مطبعة الندى");
    await u.type(screen.getByRole("textbox", { name: "رقم الهاتف" }), "01112345678");
    await u.selectOptions(screen.getByRole("combobox", { name: "نوع العميل" }), "21");
    await u.click(screen.getByRole("button", { name: "إضافة العميل" }));
    await waitFor(() => expect(requests.some((r) => r.path === "/customers" && r.method === "post")).toBe(true));
    expect(requests.find((r) => r.path === "/customers" && r.method === "post")?.body).toMatchObject({
      name: "مطبعة الندى", phone: "01112345678", customerTypeId: 21, status: 1, address: null,
    });
    expect(await screen.findByText("مطبعة الندى")).toBeTruthy();
  });

  it("maps backend duplicate phone validation below its field", async () => {
    rejectDuplicate = true;
    visit("/customers");
    expect(await screen.findByText("أحمد محمد")).toBeTruthy();
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "تعديل أحمد محمد" }));
    const phone = screen.getByRole("textbox", { name: "رقم الهاتف" });
    await u.clear(phone);
    await u.type(phone, "01112345678");
    await u.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
    expect(await screen.findByText("رقم هاتف العميل مستخدم بالفعل.")).toBeTruthy();
    expect(phone.getAttribute("aria-invalid")).toBe("true");
    await u.type(phone, "9");
    expect(screen.queryByText("رقم هاتف العميل مستخدم بالفعل.")).toBeNull();
  });

  it("hides write actions when logged in as a read-only customer user", async () => {
    permissions = ["customers.view"];
    visit("/customers");
    expect(await screen.findByText("أحمد محمد")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "إضافة عميل" })).toBeNull();
    expect(screen.queryByRole("button", { name: "تعديل أحمد محمد" })).toBeNull();
    expect(screen.queryByRole("button", { name: "حذف أحمد محمد" })).toBeNull();
  });

  it("shows finance balance and ledger only if finance permissions are granted", async () => {
    visit("/customers/101");
    expect(await screen.findByRole("heading", { name: "أحمد محمد" })).toBeTruthy();
    expect(await screen.findByText("مديونية على العميل")).toBeTruthy();
    expect(await screen.findByText("رصيد افتتاحي")).toBeTruthy();
    expect(requests.some((r) => r.path === "/finance/customers/101/balance")).toBe(true);
    expect(requests.some((r) => r.path === "/finance/customers/101/ledger")).toBe(true);
  });

  it("does not request or display finance when customer user lacks finance rights", async () => {
    permissions = ["customers.view"];
    visit("/customers/101");
    expect(await screen.findByRole("heading", { name: "أحمد محمد" })).toBeTruthy();
    expect(screen.queryByText("رصيد العميل")).toBeNull();
    expect(screen.queryByText("كشف الحساب")).toBeNull();
    expect(requests.filter((r) => r.path.startsWith("/finance/"))).toHaveLength(0);
  });
});
