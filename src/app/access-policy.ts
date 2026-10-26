import type { FeatureKey } from "@/app/pages/feature-placeholder-page";

/** Single client-side UX policy; backend permissions remain authoritative. */
export const featureAccessPolicy: Record<FeatureKey, readonly string[]> = {
  orders: ["orders.list"],
  production: ["production.items.list"],
  deliveries: ["deliveries.ready.view", "deliveries.list"],
  customers: ["customers.view"],
  collections: ["finance.collections.view", "finance.collections.create"],
  finance: ["finance.balances.view", "finance.ledger.view"],
  settings: [
    "settings.view_parameter_values",
    "settings.bank_accounts.view",
    "settings.e_wallets.view",
    "settings.selects.view",
  ],
};

/** Identity access is explicitly mapped to its backend permissions. */
export const identityAccessPolicy = {
  users: ["identity.users.view"],
  createUser: ["identity.users.create"],
  editUser: ["identity.users.update"],
  roles: ["identity.roles.view"],
  createRole: ["identity.roles.create"],
  editRole: ["identity.roles.update"],
} as const;

/** Printing Services UI uses the exact backend Spatie permission keys. */
export const printingServiceAccessPolicy = {
  view: ["printing_services.view"],
  create: ["printing_services.create"],
  update: ["printing_services.update"],
  delete: ["printing_services.delete"],
  preview: ["printing_services.price_preview.view"],
} as const;
