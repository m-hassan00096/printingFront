/** Arabic-only UI copy. Future locales can provide the same keys without changing components. */
export const uiMessages = {
  sidebar: {
    logout: "تسجيل خروج",
    logoutError: "تعذّر تسجيل الخروج. حاول مرة أخرى.",
  },
  orders: {
    filtersLabel: "فلاتر الأوردرات",
    dueDateColumn: "موعد التسليم",
    noDueDate: "بدون موعد",
  },
  command: {
    trigger: "بحث سريع أو انتقال",
    triggerPlaceholder: "بحث أو انتقال...",
    dialogTitle: "بحث وتنقل سريع",
    inputLabel: "ابحث في أقسام النظام",
    inputPlaceholder: "اكتب اسم القسم للانتقال...",
    close: "إغلاق البحث",
    results: "نتائج التنقل",
    empty: "لا توجد أقسام مطابقة.",
    moveHint: "↑ ↓ للتنقل",
    enterHint: "Enter للفتح",
    escapeHint: "Esc للإغلاق",
  },
} as const;
