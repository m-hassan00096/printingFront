import {
  ClipboardList, LayoutDashboard, Layers, ReceiptText, Settings, Truck,
  Users, Wallet, type LucideIcon,
} from "lucide-react";

export type NavigationItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  anyOf?: readonly string[];
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

/** Real permission names from printingApi Identity/Orders/Production/Finance seeders. */
export const navigationGroups: NavigationGroup[] = [
  { label: "الرئيسية", items: [{ to: "/", label: "نظرة عامة", icon: LayoutDashboard }] },
  {
    label: "إدارة العمل",
    items: [
      { to: "/orders", label: "الطلبات", icon: ClipboardList, anyOf: ["orders.list"] },
      { to: "/production", label: "الإنتاج", icon: Layers, anyOf: ["production.items.list"] },
      { to: "/deliveries", label: "التسليمات", icon: Truck, anyOf: ["deliveries.ready.view", "deliveries.list"] },
    ],
  },
  {
    label: "العملاء والمالية",
    items: [
      { to: "/customers", label: "العملاء", icon: Users, anyOf: ["customers.view"] },
      { to: "/collections", label: "التحصيلات", icon: ReceiptText, anyOf: ["finance.collections.view"] },
      { to: "/finance", label: "الحسابات", icon: Wallet, anyOf: ["finance.balances.view", "finance.ledger.view"] },
    ],
  },
  {
    label: "النظام",
    items: [
      {
        to: "/settings", label: "الإعدادات", icon: Settings,
        anyOf: [
          "settings.view_parameter_values", "settings.bank_accounts.view",
          "settings.e_wallets.view", "settings.selects.view",
        ],
      },
    ],
  },
];

export function canAccessNavigation(item: NavigationItem, permissions: readonly string[]): boolean {
  return !item.anyOf || item.anyOf.some((permission) => permissions.includes(permission));
}

export function getPageTitle(pathname: string): string {
  for (const group of navigationGroups) {
    const item = group.items.find((nav) => nav.to === pathname);
    if (item) return item.label;
  }
  return pathname === "/" ? "نظرة عامة" : "طَبعة";
}
