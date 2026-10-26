import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosAdapter, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { App } from "@/App";
import { apiClient } from "@/shared/api/http";
import type { AuthUser } from "@/features/auth/types/auth.types";

vi.mock("@/shared/api/http", async (loadActual) => {
  const original = await loadActual<typeof import("../src/shared/api/http")>();
  return { ...original, initializeCsrf: vi.fn(async () => undefined) };
});

const ORIGINAL_ADAPTER = apiClient.defaults.adapter;

const initialUser: AuthUser = {
  name: "System Administrator",
  username: "admin",
  status: 1,
  statusLabel: "نشط",
  role: "admin",
  roleAlias: "مدير النظام",
  permissions: ["orders.list", "production.items.list", "deliveries.list"],
};

let serverUser: AuthUser | null;
let timesMeCalled: number;
let loginCalls: number;
let logoutCalls: number;
let businessResponse: 200 | 401 | 403;
let networkFailure: boolean;

function apiResponse(config: InternalAxiosRequestConfig, status: number, data: unknown): AxiosResponse {
  return { data, status, statusText: String(status), headers: {}, config };
}

const simulatedBackend: AxiosAdapter = async (config) => {
  const url = config.url;
  if (networkFailure && url === "/auth/me") {
    throw new AxiosError("Network Error", "ERR_NETWORK", config);
  }

  if (url === "/auth/me" && config.method === "get") {
    timesMeCalled += 1;
    if (serverUser) {
      return apiResponse(config, 200, { success: true, message: "", data: serverUser });
    }
    throw new AxiosError("Unauthorized", "ERR_BAD_RESPONSE", config, undefined,
      apiResponse(config, 401, { success: false, message: "Unauthenticated.", errors: {} }));
  }

  if (url === "/auth/login" && config.method === "post") {
    loginCalls += 1;
    const body = JSON.parse(config.data as string) as { username: string; password: string };
    if (body.username !== "admin" || body.password !== "password") {
      throw new AxiosError("Invalid credentials", "ERR_BAD_RESPONSE", config, undefined,
        apiResponse(config, 422, {
          success: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة.", errors: {},
        }));
    }
    serverUser = { ...initialUser, permissions: [...initialUser.permissions] };
    return apiResponse(config, 200, { success: true, message: "", data: serverUser });
  }

  if (url === "/auth/logout" && config.method === "post") {
    logoutCalls += 1;
    serverUser = null;
    return apiResponse(config, 200, { success: true, message: "", data: null });
  }

  if (url === "/dashboard" && config.method === "get") {
    return apiResponse(config, 200, {success:true,message:"",data:{
      asOfDate:"2026-10-26",metrics:{activeOrders:0,overdueOrders:0,readyForDelivery:0,dueToday:0},
      productionPressure:{notStarted:0,design:0,printing:0,ready:0},
      attentionOrders:[],latestOrders:[],
    }});
  }

  if (url === "/orders" && config.method === "get") {
    return apiResponse(config, 200, {
      success: true, message: "", data: {
        orders: [], pagination: { currentPage: 1, lastPage: 1, perPage: 15, total: 0 },
      },
    });
  }

  if (url === "/business/check") {
    if (businessResponse !== 200) {
      throw new AxiosError("Rejected", "ERR_BAD_RESPONSE", config, undefined,
        apiResponse(config, businessResponse, { success: false, message: "غير مصرح.", errors: {} }));
    }
    return apiResponse(config, 200, { success: true, message: "", data: { ok: true } });
  }

  throw new Error(`Unexpected request: ${config.method} ${url}`);
};

function openPage(path = "/") {
  window.history.replaceState({}, "", path);
  return render(<App />);
}

beforeEach(() => {
  serverUser = null;
  loginCalls = 0;
  logoutCalls = 0;
  timesMeCalled = 0;
  networkFailure = false;
  businessResponse = 200;
  apiClient.defaults.adapter = simulatedBackend;
});

afterEach(() => {
  apiClient.defaults.adapter = ORIGINAL_ADAPTER;
  vi.restoreAllMocks();
});

async function signIn() {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("اسم المستخدم"), "admin");
  await user.type(screen.getByLabelText("كلمة المرور"), "password");
  await user.click(screen.getByRole("button", { name: /تسجيل الدخول/ }));
  return user;
}

describe("Auth browser workflows", () => {
  it("redirects unauthenticated protected URL to login, then returns to that URL", async () => {
    openPage("/orders?page=2");
    expect(await screen.findByRole("heading", { name: "مرحبًا بعودتك" })).toBeTruthy();
    expect(window.location.pathname).toBe("/login");
    await signIn();
    expect(await screen.findByRole("heading", { name: "الأوردرات", level: 2 })).toBeTruthy();
    expect(window.location.pathname).toBe("/orders");
    expect(window.location.search).toBe("?page=2");
    expect(loginCalls).toBe(1);
  });

  it("shows a backend validation error for incorrect credentials without navigating", async () => {
    openPage("/login");
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("اسم المستخدم"), "admin");
    await user.type(screen.getByLabelText("كلمة المرور"), "incorrect");
    await user.click(screen.getByRole("button", { name: /تسجيل الدخول/ }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent",
      "اسم المستخدم أو كلمة المرور غير صحيحة.");
    expect(window.location.pathname).toBe("/login");
    expect(loginCalls).toBe(1);
  });

  it("recovers a valid cookie-backed session on reload without another login", async () => {
    serverUser = { ...initialUser };
    const view = openPage("/");
    expect(await screen.findByText("ملخص العمل اليومي، الأوردرات التي تحتاج متابعة، وحالة الإنتاج.")).toBeTruthy();
    view.unmount();

    // A new React Query cache represents reloading the entire application.
    openPage("/");
    expect(await screen.findByText("ملخص العمل اليومي، الأوردرات التي تحتاج متابعة، وحالة الإنتاج.")).toBeTruthy();
    expect(window.location.pathname).toBe("/");
    expect(timesMeCalled).toBeGreaterThanOrEqual(2);
    expect(loginCalls).toBe(0);
  });

  it("does not show protected content for a logged-in account lacking permissions", async () => {
    serverUser = { ...initialUser, permissions: [] };
    openPage("/orders");
    expect(await screen.findByRole("heading", { name: "ليس لديك صلاحية الوصول" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "الأوردرات", level: 2 })).toBeNull();
    expect(screen.queryByRole("link", { name: "الطلبات" })).toBeNull();
    expect(window.location.pathname).toBe("/orders");
  });

  it("immediately updates the sidebar and route guard after a revoked permission and backend 403", async () => {
    serverUser = { ...initialUser };
    openPage("/orders");
    expect(await screen.findByRole("heading", { name: "الأوردرات", level: 2 })).toBeTruthy();
    serverUser = { ...initialUser, permissions: ["production.items.list", "deliveries.list"] };
    businessResponse = 403;
    await act(async () => {
      await expect(apiClient.get("/business/check")).rejects.toMatchObject({
        response: { status: 403 },
      });
    });
    expect(await screen.findByRole("heading", { name: "ليس لديك صلاحية الوصول" })).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("link", { name: "الطلبات" })).toBeNull());
  });

  it("ends expired sessions immediately and no longer exposes protected cached content", async () => {
    serverUser = { ...initialUser };
    openPage("/orders");
    expect(await screen.findByRole("heading", { name: "الأوردرات", level: 2 })).toBeTruthy();
    serverUser = null;
    businessResponse = 401;
    await act(async () => {
      await expect(apiClient.get("/business/check")).rejects.toMatchObject({
        response: { status: 401 },
      });
    });
    expect(await screen.findByRole("heading", { name: "مرحبًا بعودتك" })).toBeTruthy();
    expect(window.location.pathname).toBe("/login");
    expect(screen.queryByRole("heading", { name: "الأوردرات", level: 2 })).toBeNull();
  });

  it("logs out, clears protected UI, and blocks a Back-style navigation into private routes", async () => {
    serverUser = { ...initialUser };
    openPage("/orders");
    expect(await screen.findByRole("heading", { name: "الأوردرات", level: 2 })).toBeTruthy();
    await userEvent.setup().click(screen.getByRole("button", { name: "تسجيل الخروج" }));
    expect(await screen.findByRole("heading", { name: "مرحبًا بعودتك" })).toBeTruthy();
    expect(logoutCalls).toBe(1);
    await act(async () => {
      window.history.pushState({}, "", "/orders");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await waitFor(() => expect(window.location.pathname).toBe("/login"));
    expect(screen.queryByRole("heading", { name: "الأوردرات", level: 2 })).toBeNull();
  });

  it("keeps server outages separate from a guest and offers retry", async () => {
    networkFailure = true;
    openPage("/orders");
    expect(await screen.findByRole("heading", { name: "تعذّر الاتصال بالخادم" })).toBeTruthy();
    expect(window.location.pathname).toBe("/orders");
    networkFailure = false;
    await userEvent.setup().click(screen.getByRole("button", { name: "إعادة المحاولة" }));
    expect(await screen.findByRole("heading", { name: "مرحبًا بعودتك" })).toBeTruthy();
  });
});
