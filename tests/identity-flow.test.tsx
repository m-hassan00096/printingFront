import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosAdapter, AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";

const originalAdapter = apiClient.defaults.adapter;
const fullPermissions = [
  "identity.users.view", "identity.users.create", "identity.users.update", "identity.users.delete",
  "identity.roles.view", "identity.roles.create", "identity.roles.update", "identity.roles.delete",
];
const admin: AuthUser = {
  name: "Manager", username: "admin", status: 1, statusLabel: "نشط",
  role: "admin", roleAlias: "مدير النظام", permissions: fullPermissions,
};
const userRecord = {
  id: 42, name: "أحمد علي", username: "ahmed", phone: "01000000000",
  address: "الجيزة", avatar: null, status: 1, statusLabel: "نشط",
  role: { id: 2, name: "operator", alias: "موظف" },
};
const inactiveRecord = { ...userRecord, id: 43, name: "محمد سعيد", username: "mohamed", status: 0, statusLabel: "غير نشط" };
const role = { id: 2, name: "موظف", nameAr: "موظف", key: "operator",
  status: 1, statusLabel: "نشط", usersCount: 2, permissionIds: [1, 5] };
let current: AuthUser;
let requests: { method?: string; path?: string; data: unknown; search: string }[];
function envelope(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { data: { success: true, message: "", data }, status, statusText: "OK", headers: {}, config };
}
const backend: AxiosAdapter = async (config) => {
  const url = config.url;
  const filters = config.params instanceof URLSearchParams ? config.params : new URLSearchParams(config.params as Record<string, string>);
  const body = config.data instanceof FormData ? Object.fromEntries(config.data.entries()) :
    typeof config.data === "string" ? JSON.parse(config.data) as unknown : config.data;
  requests.push({ method: config.method, path: url, data: body, search: filters.toString() });
  if (url === "/auth/me") return envelope(config, current);
  if (url === "/users" && config.method === "get") {
    const status = filters.get("filter[status]");
    const search = filters.get("filter[search]")?.toLowerCase() ?? "";
    const selected = [userRecord, inactiveRecord]
      .filter((u) => status === null || String(u.status) === status)
      .filter((u) => !search || [u.name, u.username, u.phone].some((x) => x.toLowerCase().includes(search)));
    return envelope(config, { users: selected, pagination: {
      currentPage: Number(filters.get("page") || 1), lastPage: 1, perPage: 15, total: selected.length,
    } });
  }
  if (url === "/selects" && config.method === "get") {
    return envelope(config, [{ label: "permissions", options: [
      { value: 1, label: "عرض المستخدمين" },
      { value: 5, label: "عرض الأدوار" },
      { value: 9, label: "إنشاء طلب" },
    ] }]);
  }
  if (url === "/roles" && config.method === "get") return envelope(config, {
    roles: [role], pagination: { currentPage: 1, lastPage: 1, perPage: 15, total: 1 },
  });
  if (url === "/users/42" && config.method === "get") return envelope(config, userRecord);
  if (url === "/roles/2" && config.method === "get") return envelope(config, role);
  if (url === "/users" && config.method === "post") return envelope(config, { ...userRecord, id: 44 }, 201);
  if (url === "/roles" && config.method === "post") return envelope(config, { ...role, id: 4, key: "role_new" }, 201);
  if (url === "/roles/2" && config.method === "patch") return envelope(config, { ...role, ...(body as object) });
  if (url === "/users/42" && config.method === "patch") return envelope(config, { ...userRecord, ...(body as object) });
  if (url === "/users/42" && config.method === "delete") return envelope(config, null);
  throw new Error(`Unexpected endpoint ${config.method} ${url}`);
};
function open(path: string) {
  window.history.replaceState({}, "", path);
  return render(<App />);
}
beforeEach(() => {
  requests = [];
  current = { ...admin, permissions: [...fullPermissions] };
  apiClient.defaults.adapter = backend;
});
afterEach(() => { apiClient.defaults.adapter = originalAdapter; });

describe("Identity feature browser workflows", () => {
  it("shows users and applies status=0 without dropping the filter", async () => {
    open("/users");
    expect(await screen.findByRole("link", { name: "أحمد علي" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "محمد سعيد" })).toBeTruthy();
    await userEvent.setup().selectOptions(screen.getByLabelText("فلتر الحالة"), "0");
    await waitFor(() => expect(screen.queryByRole("link", { name: "أحمد علي" })).toBeNull());
    expect(screen.getByRole("link", { name: "محمد سعيد" })).toBeTruthy();
    expect(requests.some((r) => r.path === "/users" && new URLSearchParams(r.search).get("filter[status]") === "0")).toBe(true);
  });

  it("denies direct access to users and hides navigation without view permission", async () => {
    current = { ...admin, permissions: [] };
    open("/users");
    expect(await screen.findByRole("heading", { name: "ليس لديك صلاحية الوصول" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "المستخدمون" })).toBeNull();
    expect(requests.filter((r) => r.path === "/users")).toHaveLength(0);
  });

  it("opens user detail with role, current status and account data", async () => {
    open("/users/42");
    expect(await screen.findByText("أحمد علي")).toBeTruthy();
    expect(screen.getByText("01000000000")).toBeTruthy();
    expect(screen.getByText("موظف")).toBeTruthy();
  });

  it("requires password confirmation and valid role before creating user", async () => {
    open("/users/new");
    expect(await screen.findByLabelText(/الاسم الكامل/)).toBeTruthy();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/الاسم الكامل/), "New Worker");
    await user.type(screen.getByLabelText(/اسم الدخول/), "newworker");
    await user.selectOptions(screen.getByLabelText(/الدور الوظيفي/), "2");
    await user.type(screen.getByLabelText(/^كلمة المرور/), "password123");
    await user.type(screen.getByLabelText(/^تأكيد كلمة المرور/), "different");
    await user.click(screen.getByRole("button", { name: "إنشاء المستخدم" }));
    expect(await screen.findByText("تأكيد كلمة المرور غير مطابق")).toBeTruthy();
    expect(requests.filter((r) => r.path === "/users" && r.method === "post")).toHaveLength(0);
    await user.clear(screen.getByLabelText(/^تأكيد كلمة المرور/));
    await user.type(screen.getByLabelText(/^تأكيد كلمة المرور/), "password123");
    await user.click(screen.getByRole("button", { name: "إنشاء المستخدم" }));
    await waitFor(() => expect(requests.filter((r) => r.path === "/users" && r.method === "post")).toHaveLength(1));
    const posted = requests.find((r) => r.path === "/users" && r.method === "post")!.data as Record<string, FormDataEntryValue>;
    expect(posted.roleId).toBe("2");
    expect(posted.password).toBe("password123");
    expect(window.location.pathname).toBe("/users/44");
  });

  it("updates status only after the user confirms the change", async () => {
    open("/users");
    expect(await screen.findByRole("link", { name: "أحمد علي" })).toBeTruthy();
    const u = userEvent.setup();
    await u.click(screen.getByRole("button", { name: "تعطيل أحمد علي" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(requests.filter((r) => r.path === "/users/42" && r.method === "patch")).toHaveLength(0);
    await u.click(screen.getByRole("button", { name: "تعطيل الحساب" }));
    await waitFor(() => expect(requests.filter((r) => r.path === "/users/42" && r.method === "patch")).toHaveLength(1));
    expect(requests.find((r) => r.path === "/users/42" && r.method === "patch")?.data).toMatchObject({ status: 0 });
  });


  it("shows role names without exposing technical keys in the roles list", async () => {
    open("/roles");
    expect(await screen.findByText("موظف")).toBeTruthy();
    expect(screen.queryByText("operator")).toBeNull();
  });

  it("hides the role technical key from the editor but keeps linked users visible", async () => {
    open("/roles/2/edit");
    expect(await screen.findByText("المستخدمون المرتبطون")).toBeTruthy();
    expect(screen.queryByText("المعرّف التقني")).toBeNull();
    expect(screen.queryByText("operator")).toBeNull();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("loads existing role permissionIds and updates only selected permissions", async () => {
    open("/roles/2/edit");
    expect(await screen.findByText("عرض المستخدمين")).toBeTruthy();
    expect(screen.getByText("عرض الأدوار")).toBeTruthy();
    const user = userEvent.setup();
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "عرض المستخدمين" })).toHaveProperty("checked", true);
      expect(screen.getByRole("checkbox", { name: "عرض الأدوار" })).toHaveProperty("checked", true);
    });
    expect(screen.getByRole("checkbox", { name: "إنشاء طلب" })).toHaveProperty("checked", false);
    await user.click(screen.getByRole("checkbox", { name: "عرض الأدوار" }));
    await user.click(screen.getByRole("checkbox", { name: "إنشاء طلب" }));
    await user.click(screen.getByRole("button", { name: "حفظ الدور" }));
    await waitFor(() => expect(requests.some((r) => r.path === "/roles/2" && r.method === "patch")).toBe(true));
    expect(requests.find((r) => r.path === "/roles/2" && r.method === "patch")!.data)
      .toMatchObject({ nameAr: "موظف", status: 1, permissionIds: [1, 9] });
  });

  it("creates role with exactly the selected real permission IDs", async () => {
    open("/roles/new");
    expect(await screen.findByLabelText(/اسم الدور بالعربي/)).toBeTruthy();
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/اسم الدور بالعربي/), "عامل إنتاج");
    expect(await screen.findByText("عرض المستخدمين")).toBeTruthy();
    await user.click(screen.getByRole("checkbox", { name: "عرض المستخدمين" }));
    await user.click(screen.getByRole("checkbox", { name: "إنشاء طلب" }));
    await user.click(screen.getByRole("button", { name: "حفظ الدور" }));
    await waitFor(() => expect(requests.some((r) => r.path === "/roles" && r.method === "post")).toBe(true));
    expect(requests.find((r) => r.path === "/roles" && r.method === "post")!.data)
      .toMatchObject({ nameAr: "عامل إنتاج", status: 1, permissionIds: [1, 9] });
  });

  it("keeps hidden checked permissions when selecting or clearing filtered visible options", async () => {
    open("/roles/2/edit");
    expect(await screen.findByText("عرض المستخدمين")).toBeTruthy();
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText("ابحث عن صلاحية..."), "إنشاء");
    await user.click(screen.getByRole("button", { name: "تحديد مجموعة الأوردرات" }));
    await user.click(screen.getByRole("button", { name: "حفظ الدور" }));
    await waitFor(() => expect(requests.some((r) => r.path === "/roles/2" && r.method === "patch")).toBe(true));
    expect(requests.find((r) => r.path === "/roles/2" && r.method === "patch")!.data)
      .toMatchObject({ permissionIds: [1, 5, 9] });
  });
});
