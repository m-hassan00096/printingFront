import { apiClient } from "@/shared/api/http";
import type { ApiResponse } from "@/shared/api/api-types";

export type SelectOption = { value: number; label: string; isDefault?: number };
type SelectGroup = { label: string; options: SelectOption[] };
async function getGroups(keys: string[]): Promise<SelectGroup[]> {
  const { data } = await apiClient.get<ApiResponse<SelectGroup[]>>("/selects", {
    params: { selects: keys.join(",") },
  });
  if (!Array.isArray(data.data)) throw new Error("تعذّر تحميل قوائم الاختيار.");
  return data.data;
}
function options(groups: SelectGroup[], name: string): SelectOption[] {
  const match = groups.find((group) => group.label === name);
  if (!match || !Array.isArray(match.options)) throw new Error(`قائمة ${name} غير متاحة.`);
  return match.options;
}
export async function getOrderCreateOptions(): Promise<{ customers: SelectOption[]; services: SelectOption[] }> {
  const groups = await getGroups(["activeCustomers", "printingServices"]);
  return { customers: options(groups, "activeCustomers"), services: options(groups, "printingServices") };
}
export async function getOrderServiceOptions(): Promise<SelectOption[]> {
  return options(await getGroups(["printingServices"]), "printingServices");
}
export async function getOrderPaymentOptions(): Promise<{ banks: SelectOption[]; wallets: SelectOption[] }> {
  const groups = await getGroups(["bankAccounts", "eWallets"]);
  return { banks: options(groups, "bankAccounts"), wallets: options(groups, "eWallets") };
}
