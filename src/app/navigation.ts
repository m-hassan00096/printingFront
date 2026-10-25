import { featureAccessPolicy, identityAccessPolicy } from "@/app/access-policy";
import { hasAnyPermission } from "@/features/auth/lib/auth-helpers";
import {
  ClipboardList, LayoutDashboard, Layers, ReceiptText, Settings, Truck,
  Users, Wallet, ShieldCheck, type LucideIcon,
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
      { to: "/orders", label: "الطلبات", icon: ClipboardList, anyOf: featureAccessPolicy.orders },
      { to: "/production", label: "الإنتاج", icon: Layers, anyOf: featureAccessPolicy.production },
      { to: "/deliveries", label: "التسليمات", icon: Truck, anyOf: featureAccessPolicy.deliveries },
    ],
  },
  {
    label: "العملاء والمالية",
    items: [
      { to: "/customers", label: "العملاء", icon: Users, anyOf: featureAccessPolicy.customers },
      { to: "/collections", label: "التحصيلات", icon: ReceiptText, anyOf: featureAccessPolicy.collections },
      { to: "/finance", label: "الحسابات", icon: Wallet, anyOf: featureAccessPolicy.finance },
    ],
  },
  {
    label: "المستخدمون والصلاحيات",
    items: [
      { to: "/users", label: "المستخدمون", icon: Users, anyOf: identityAccessPolicy.users },
      { to: "/roles", label: "الأدوار والصلاحيات", icon: ShieldCheck, anyOf: identityAccessPolicy.roles },
    ],
  },
  {
    label: "النظام",
    items: [
      {
        to: "/settings", label: "الإعدادات", icon: Settings,
        anyOf: featureAccessPolicy.settings
      },
    ],
  },
];

export function canAccessNavigation(item: NavigationItem, permissions: readonly string[]): boolean {
  return !item.anyOf || hasAnyPermission(permissions, item.anyOf);
}

export function getPageTitle(pathname: string): string {
  for (const group of navigationGroups) {
    const item = group.items.find((nav) => nav.to === pathname);
    if (item) return item.label;
  }
  if (pathname.startsWith("/users/")) return pathname.endsWith("/edit") ? "تعديل مستخدم" : pathname === "/users/new" ? "إضافة مستخدم" : "تفاصيل المستخدم";
  if (pathname.startsWith("/roles/")) return pathname === "/roles/new" ? "إضافة دور" : "تعديل الدور";
  return pathname === "/" ? "نظرة عامة" : "طَبعة";
}
