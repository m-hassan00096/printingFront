import {
  ClipboardList,
  LayoutDashboard,
  Layers,
  ReceiptText,
  Settings,
  Truck,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavigationItem = {
  to: string;
  label: string;
  icon: LucideIcon;
};

export type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

export const navigationGroups: NavigationGroup[] = [
  {
    label: "الرئيسية",
    items: [{ to: "/", label: "نظرة عامة", icon: LayoutDashboard }],
  },
  {
    label: "إدارة العمل",
    items: [
      { to: "/orders", label: "الطلبات", icon: ClipboardList },
      { to: "/production", label: "الإنتاج", icon: Layers },
      { to: "/deliveries", label: "التسليمات", icon: Truck },
    ],
  },
  {
    label: "العملاء والمالية",
    items: [
      { to: "/customers", label: "العملاء", icon: Users },
      { to: "/collections", label: "التحصيلات", icon: ReceiptText },
      { to: "/finance", label: "الحسابات", icon: Wallet },
    ],
  },
  {
    label: "النظام",
    items: [{ to: "/settings", label: "الإعدادات", icon: Settings }],
  },
];

export function getPageTitle(pathname: string): string {
  for (const group of navigationGroups) {
    const item = group.items.find((navigationItem) => navigationItem.to === pathname);
    if (item) return item.label;
  }

  return pathname === "/" ? "نظرة عامة" : "طَبعة";
}
