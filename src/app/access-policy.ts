import type { FeatureKey } from "@/app/pages/feature-placeholder-page";

/** Single client-side UX policy; backend permissions remain authoritative. */
export const featureAccessPolicy: Record<FeatureKey, readonly string[]> = {
  orders: ["orders.list"],
  production: ["production.items.list"],
  deliveries: ["deliveries.ready.view", "deliveries.list"],
  customers: ["customers.view"],
  collections: ["finance.collections.view"],
  finance: ["finance.balances.view", "finance.ledger.view"],
  settings: [
    "settings.view_parameter_values",
    "settings.bank_accounts.view",
    "settings.e_wallets.view",
    "settings.selects.view",
  ],
};
