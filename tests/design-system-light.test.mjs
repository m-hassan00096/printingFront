import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const get = path => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const css = get("src/index.css");
const docs = get("DESIGN_SYSTEM_BALANCED_MODERN.md");

test("Tabaa uses the approved Balanced Modern light tokens", () => {
  assert.match(css, /color-scheme:\s*light/);
  for (const [token, hex] of Object.entries({
    background: "#f7f8fc",
    card: "#ffffff",
    sidebar: "#ffffff",
    foreground: "#252a40",
    primary: "#6250c9",
    secondary: "#f0edfc",
    border: "#e5e8f1",
    input: "#d9deeb",
    success: "#15845f",
  })) {
    assert.match(css, new RegExp("--" + token + ":\\s*" + hex, "i"));
    assert.ok(docs.toLowerCase().includes(hex), token + " is documented");
  }
  assert.doesNotMatch(css, /color-scheme:\s*dark/);
});

test("IBM Plex Sans Arabic is global, not a single-screen-only font", () => {
  assert.match(css, /--font-sans: "IBM Plex Sans Arabic"/);
  assert.match(css, /font: 400 14px\/1\.65 "IBM Plex Sans Arabic"/);
  assert.match(docs, /IBM Plex Sans Arabic/);
  const orderCss = get("src/features/orders/pages/order-create-page.css");
  assert.doesNotMatch(orderCss, /@import url/);
});

test("All operational pages opt in to the shared page styling", () => {
  const pages = [
    "dashboard/pages/dashboard-page.tsx",
    "orders/pages/orders-page.tsx",
    "orders/pages/order-create-page.tsx",
    "orders/pages/order-detail-page.tsx",
    "production/pages/production-page.tsx",
    "deliveries/pages/deliveries-page.tsx",
    "customers/pages/customers-page.tsx",
    "customers/pages/customer-detail-page.tsx",
    "collections/pages/collections-page.tsx",
    "finance/pages/finance-page.tsx",
    "printing-services/pages/printing-services-page.tsx",
    "printing-services/pages/printing-service-detail-page.tsx",
    "printing-services/pages/printing-service-form-page.tsx",
    "settings/pages/settings-page.tsx",
    "identity/pages/users-page.tsx",
    "identity/pages/user-detail-page.tsx",
    "identity/pages/user-form-page.tsx",
    "identity/pages/roles-page.tsx",
    "identity/pages/role-form-page.tsx",
  ];
  for (const path of pages) {
    assert.match(get("src/features/" + path), /return <div className="tabaa-page\b/, path);
  }
  assert.match(get("src/app/layouts/app-shell.tsx"), /className="tabaa-app /);
  assert.match(get("src/app/layouts/sidebar.tsx"), /bg-sidebar-accent/);
  assert.match(get("src/shared/components/ui/button.tsx"), /bg-primary text-primary-foreground/);
});
