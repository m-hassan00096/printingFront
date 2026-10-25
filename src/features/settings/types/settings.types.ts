export type SettingsStatus = 0 | 1;
export type SettingsKind = "printing-locations" | "customer-types" | "bank-accounts" | "e-wallets";
export type SettingsPagination = { currentPage: number; lastPage: number; perPage: number; total: number };
export type ParameterGroup = { id: number; name: "printing_locations" | "customer_types" };
export type ParameterValue = { id: number; parameterId: number; name: string; description: string | null; status: SettingsStatus };
export type BankAccount = { id: number; bankName: string; accountNumber: string; isDefault: SettingsStatus; status: SettingsStatus };
export type EWallet = { id: number; name: string; phone: string; accountHolder: string; paymentLink: string | null; isDefault: SettingsStatus; status: SettingsStatus };
export type SettingsRecord = ParameterValue | BankAccount | EWallet;
export type SettingsFilters = { search: string; status: string; page: number };
export type SettingsPageResult = { items: SettingsRecord[]; pagination: SettingsPagination };
export type SettingsPayload = {
  status: SettingsStatus;
  name?: string;
  description?: string | null;
  bankName?: string;
  accountNumber?: string;
  phone?: string;
  accountHolder?: string;
  paymentLink?: string | null;
  isDefault?: SettingsStatus;
};
export const settingsSections: {
  key: SettingsKind;
  label: string;
  view: string;
  create: string;
  update: string;
  delete: string;
}[] = [
  { key: "printing-locations", label: "أماكن الطباعة", view: "settings.view_parameter_values", create: "settings.create_parameter_value", update: "settings.update_parameter_value", delete: "settings.delete_parameter_value" },
  { key: "customer-types", label: "أنواع العملاء", view: "settings.view_parameter_values", create: "settings.create_parameter_value", update: "settings.update_parameter_value", delete: "settings.delete_parameter_value" },
  { key: "bank-accounts", label: "الحسابات البنكية", view: "settings.bank_accounts.view", create: "settings.bank_accounts.create", update: "settings.bank_accounts.update", delete: "settings.bank_accounts.delete" },
  { key: "e-wallets", label: "المحافظ الإلكترونية", view: "settings.e_wallets.view", create: "settings.e_wallets.create", update: "settings.e_wallets.update", delete: "settings.e_wallets.delete" },
];
export const isParameterKind = (kind: SettingsKind) =>
  kind === "printing-locations" || kind === "customer-types";
export const parameterGroupName = (kind: SettingsKind) =>
  kind === "printing-locations" ? "printing_locations" : "customer_types";
