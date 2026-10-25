export type ServiceStatus = 0 | 1;
export type ServiceTier = {
  priceTierId: number;
  customerTypeId: number | null;
  minQuantity: number | null;
  maxQuantity: number | null;
  price: string;
};
export type PrintingService = {
  id: number;
  name: string;
  basePrice: string | null;
  status: ServiceStatus;
  priceTiers?: ServiceTier[];
};
export type ServicePagination = {
  currentPage: number; lastPage: number; perPage: number; total: number;
};
export type ServiceFilters = {
  search: string;
  status: string;
  sort: string;
  page: number;
};
export type TierValues = {
  customerTypeId: number | null;
  minQuantity: number | null;
  maxQuantity: number | null;
  price: string;
};
export type TierCommand =
  | ({ actionStatus: 1 } & TierValues)
  | ({ actionStatus: 2; priceTierId: number } & TierValues)
  | { actionStatus: 3; priceTierId: number };
export type CreateServicePayload = {
  name: string; status: ServiceStatus; basePrice: string | null;
  priceTiers: TierValues[];
};
export type UpdateServicePayload = {
  name?: string; status?: ServiceStatus; basePrice?: string | null;
  priceTiers?: TierCommand[];
};
export type PricePreviewPayload = {
  serviceId: number; customerTypeId: number | null; quantity: number;
};
export type PricePreview = {
  serviceId: number;
  quantity: number;
  source: "customerTypeQuantityTier" | "customerTypeCatchAll" | "genericQuantityTier" | "genericCatchAll" | "basePrice" | null;
  suggestedUnitPrice: string | null;
  suggestedTotal: string | null;
  requiresManualTotal: boolean;
};
