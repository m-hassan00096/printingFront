/** Arabic-only UI copy. Future locales can provide the same keys without changing components. */
export const uiMessages = {

  roles: {
    selectedOnly: "المحددة فقط",
    showAll: "كل الصلاحيات",
    expandAll: "فتح الكل",
    collapseAll: "طي الكل",
    selectedCount: "محددة",
    groupSelect: "تحديد مجموعة",
    groupClear: "إلغاء تحديد مجموعة",
    selectVisibleInGroup: "تحديد المعروض في",
    clearVisibleInGroup: "إلغاء المعروض في",
    noResults: "لا توجد صلاحيات تطابق البحث.",
    unsaved: "عندك تعديلات غير محفوظة. هل تريد مغادرة الصفحة؟",
    usersCount: "المستخدمون المرتبطون",
    groupLabels: {
      orders: "الأوردرات",
      production: "الإنتاج",
      deliveries: "التسليمات",
      customers: "العملاء",
      finance: "الحسابات والتحصيلات",
      services: "الخدمات والإعدادات",
      identity: "المستخدمون والأدوار",
      other: "صلاحيات أخرى",
    },
  },
  sidebar: {
    logout: "تسجيل خروج",
    logoutError: "تعذّر تسجيل الخروج. حاول مرة أخرى.",
  },
  orders: {
    filtersLabel: "فلاتر الأوردرات",
    dueDateColumn: "موعد التسليم",
    noDueDate: "بدون موعد",
  },
} as const;
