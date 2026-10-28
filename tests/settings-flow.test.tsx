import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";

const original = apiClient.defaults.adapter;
const allPermissions = [
  "settings.view_parameter_values", "settings.create_parameter_value",
  "settings.update_parameter_value", "settings.delete_parameter_value",
  "settings.bank_accounts.view", "settings.bank_accounts.create",
  "settings.bank_accounts.update", "settings.bank_accounts.delete",
  "settings.e_wallets.view", "settings.e_wallets.create",
  "settings.e_wallets.update", "settings.e_wallets.delete",
];
let permissions: string[];
let requests: { method: string; path: string; params: URLSearchParams; body: Record<string, unknown> }[];
let bankAccounts: { id: number; bankName: string; accountNumber: string; isDefault: 0 | 1; status: 0 | 1 }[];
const auth = (): AuthUser => ({
  name: "Manager", username: "admin", role: "admin", roleAlias: "مدير النظام",
  status: 1, statusLabel: "نشط", permissions,
});
const envelope = (config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse => ({
  config, data: { success: true, message: "", data }, status, statusText: "OK", headers: {},
});
const adapter: AxiosAdapter = async (config) => {
  const path = config.url ?? "";
  const query = config.params instanceof URLSearchParams
    ? config.params : new URLSearchParams(config.params as Record<string, string>);
  const body: Record<string, unknown> = typeof config.data === "string" ? JSON.parse(config.data) as Record<string, unknown> : {};
  requests.push({ method: config.method ?? "", path, params: query, body });
  if (path === "/auth/me") return envelope(config, auth());
  if (path === "/settings/parameter-groups" && config.method === "get")
    return envelope(config, { groups: [
      { id: 31, name: "customer_types" }, { id: 57, name: "printing_locations" },
    ] });
  if (path === "/settings/parameter-values" && config.method === "get") {
    const printing = query.get("parameterId") === "57";
    return envelope(config, { parameters: printing
      ? [{ id: 5, parameterId: 57, name: "مطبعة رئيسية", description: null, status: 1 }]
      : [{ id: 7, parameterId: 31, name: "عميل جملة", description: null, status: 1 }],
    pagination: { currentPage: 1, lastPage: 1, perPage: 15, total: 1 } });
  }
  if (path === "/settings/parameter-values/7" && config.method === "patch") {
    const validation: AxiosResponse = {
      config,
      status: 422,
      statusText: "Unprocessable Content",
      headers: {},
      data: {
        success: false,
        message: "بيانات الإدخال غير صحيحة.",
        errors: { name: ["قيمة الاسم مستخدمة بالفعل."] },
      },
    };
    throw new AxiosError("Validation failed", "ERR_BAD_REQUEST", config, undefined, validation);
  }
  if (path === "/settings/bank-accounts" && config.method === "get")
    return envelope(config, { bankAccounts, pagination: {
      currentPage: 1, lastPage: 1, perPage: 15, total: bankAccounts.length,
    } });
  if (path === "/settings/e-wallets" && config.method === "get")
    return envelope(config, { eWallets: [{ id: 11, name: "فودافون كاش", phone: "01012345678",
      accountHolder: "أحمد علي", paymentLink: null, status: 1, isDefault: 0 }],
    pagination: { currentPage: 1, lastPage: 1, perPage: 15, total: 1 } });
  if (path === "/settings/bank-accounts" && config.method === "post") {
    bankAccounts = [...bankAccounts, { id: 13, bankName: String(body.bankName), accountNumber: String(body.accountNumber),
      isDefault: Number(body.isDefault) as 0 | 1, status: Number(body.status) as 0 | 1 }];
    return envelope(config, bankAccounts[bankAccounts.length - 1], 201);
  }
  if (path === "/settings/bank-accounts/9" && config.method === "patch") {
    bankAccounts = bankAccounts.map((bank) => bank.id === 9 ? { ...bank, ...body } as typeof bank : bank);
    return envelope(config, bankAccounts[0]);
  }
  if (path === "/settings/bank-accounts/9" && config.method === "delete") {
    bankAccounts = bankAccounts.filter((bank) => bank.id !== 9);
    return envelope(config, null);
  }
  throw Error(`Unexpected API request ${config.method} ${path}`);
};
function visit(path: string) {
  window.history.replaceState({}, "", path);
  return render(<App />);
}
beforeEach(() => {
  permissions = [...allPermissions];
  bankAccounts = [{ id: 9, bankName: "البنك الأهلي", accountNumber: "12345", isDefault: 1, status: 1 }];
  requests = [];
  apiClient.defaults.adapter = adapter;
});
afterEach(() => { apiClient.defaults.adapter = original; });

describe("Settings permissions and backend integration", () => {
  it("renders the المطابع section in the shared tabular layout", async () => {
    visit("/settings");
    expect(await screen.findByText("مطبعة رئيسية")).toBeTruthy();
    expect(screen.getByRole("tab", { name: /المطابع/ })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "اسم المطبعة" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "البيانات" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "الحالة" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "الإجراءات" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "إضافة مطبعة" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "تسجيل خروج" })).toBeTruthy();
  });

  it("discovers real parameter-group IDs and never hardcodes them", async () => {
    visit("/settings");
    expect(await screen.findByText("مطبعة رئيسية")).toBeTruthy();
    expect(requests.some((r) => r.path === "/settings/parameter-groups")).toBe(true);
    expect(requests.some((r) => r.path === "/settings/parameter-values" && r.params.get("parameterId") === "57")).toBe(true);
    await userEvent.setup().click(screen.getByRole("tab", { name: /أنواع العملاء/ }));
    expect(await screen.findByText("عميل جملة")).toBeTruthy();
    expect(requests.some((r) => r.path === "/settings/parameter-values" && r.params.get("parameterId") === "31")).toBe(true);
  });

  it("displays backend bank accounts and saves a newly created account", async () => {
    visit("/settings?tab=bank-accounts");
    expect(await screen.findByText("البنك الأهلي")).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "إضافة حساب بنكي" }));
    await user.type(screen.getByRole("textbox", { name: "اسم البنك *" }), "بنك مصر");
    await user.type(screen.getByRole("textbox", { name: "رقم الحساب *" }), "99999");
    await user.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(requests.some((r) => r.path === "/settings/bank-accounts" && r.method === "post")).toBe(true));
    expect(requests.find((r) => r.path === "/settings/bank-accounts" && r.method === "post")?.body)
      .toMatchObject({ bankName: "بنك مصر", accountNumber: "99999", status: 1, isDefault: 0 });
    expect(await screen.findByText("بنك مصر")).toBeTruthy();
  });

  it("hides unauthorized tabs and write actions while preserving read access", async () => {
    permissions = ["settings.bank_accounts.view"];
    visit("/settings");
    expect(await screen.findByText("البنك الأهلي")).toBeTruthy();
    expect(screen.queryByRole("tab", { name: /المطابع/ })).toBeNull();
    expect(screen.queryByRole("tab", { name: /المحافظ الإلكترونية/ })).toBeNull();
    expect(screen.queryByRole("button", { name: "إضافة حساب بنكي" })).toBeNull();
    expect(screen.queryByRole("button", { name: /تعديل البنك الأهلي/ })).toBeNull();
    expect(requests.some((r) => r.path === "/settings/parameter-groups")).toBe(false);
  });

  it("updates an existing bank account using PATCH without changing its ID", async () => {
    visit("/settings?tab=bank-accounts");
    expect(await screen.findByText("البنك الأهلي")).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "تعديل البنك الأهلي" }));
    const name = screen.getByRole("textbox", { name: "اسم البنك *" });
    await user.clear(name);
    await user.type(name, "بنك جديد");
    await user.click(screen.getByRole("button", { name: "حفظ" }));
    await waitFor(() => expect(requests.some((r) => r.path === "/settings/bank-accounts/9" && r.method === "patch")).toBe(true));
    expect(await screen.findByText("بنك جديد")).toBeTruthy();
  });
  it("shows required-field validation directly below each field", async () => {
    visit("/settings?tab=bank-accounts");
    expect(await screen.findByText("البنك الأهلي")).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "إضافة حساب بنكي" }));
    await user.click(screen.getByRole("button", { name: "حفظ" }));
    const bankField = screen.getByRole("textbox", { name: "اسم البنك *" });
    const accountField = screen.getByRole("textbox", { name: "رقم الحساب *" });
    expect(bankField.getAttribute("aria-invalid")).toBe("true");
    expect(accountField.getAttribute("aria-invalid")).toBe("true");
    expect(await screen.findByText("حقل اسم البنك مطلوب.")).toBeTruthy();
    expect(screen.getByText("حقل رقم الحساب مطلوب.")).toBeTruthy();
    expect(requests.filter((r) => r.path === "/settings/bank-accounts" && r.method === "post")).toHaveLength(0);
    await user.type(bankField, "بنك مصر");
    expect(screen.queryByText("حقل اسم البنك مطلوب.")).toBeNull();
    expect(screen.getByText("حقل رقم الحساب مطلوب.")).toBeTruthy();
  });

  it("maps Laravel 422 name uniqueness error under customer type input", async () => {
    visit("/settings?tab=customer-types");
    expect(await screen.findByText("عميل جملة")).toBeTruthy();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "تعديل عميل جملة" }));
    const name = screen.getByRole("textbox", { name: "الاسم *" });
    await user.clear(name);
    await user.type(name, "شركة");
    await user.click(screen.getByRole("button", { name: "حفظ" }));
    expect(await screen.findByText("قيمة الاسم مستخدمة بالفعل.")).toBeTruthy();
    expect(name.getAttribute("aria-invalid")).toBe("true");
    expect(requests.some((r) => r.path === "/settings/parameter-values/7" && r.method === "patch")).toBe(true);
    await user.type(name, " أخرى");
    expect(screen.queryByText("قيمة الاسم مستخدمة بالفعل.")).toBeNull();
  });

  it("positions notifications based on UI language and updates when it changes", async () => {
    const root = document.documentElement;
    const originalLang = root.lang;
    const originalDir = root.dir;
    try {
      root.lang = "ar";
      root.dir = "rtl";
      visit("/settings?tab=bank-accounts");
      expect(await screen.findByText("البنك الأهلي")).toBeTruthy();
      const currentToaster = () => document.querySelector("[data-sonner-toaster]");
      expect(currentToaster()?.getAttribute("data-y-position")).toBe("bottom");
      expect(currentToaster()?.getAttribute("data-x-position")).toBe("left");
      expect(currentToaster()?.getAttribute("dir")).toBe("rtl");

      root.lang = "en";
      root.dir = "ltr";
      await waitFor(() => {
        expect(currentToaster()?.getAttribute("data-x-position")).toBe("right");
        expect(currentToaster()?.getAttribute("dir")).toBe("ltr");
      });

      root.lang = "ar";
      root.dir = "rtl";
      await waitFor(() => {
        expect(currentToaster()?.getAttribute("data-x-position")).toBe("left");
        expect(currentToaster()?.getAttribute("dir")).toBe("rtl");
      });
    } finally {
      root.lang = originalLang;
      root.dir = originalDir;
    }
  });

});
