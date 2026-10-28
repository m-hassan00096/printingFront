export type Pagination = { currentPage: number; lastPage: number; perPage: number; total: number };
export type MoneyBalance = { amount: string; type: 0 | 1 | 2; typeLabel: string };
export type PaymentMethod = 0 | 1 | 2;
export type ReadyItem = {
  id: number; serviceName: string; quantity: number;
  productionStage: number; productionStageLabel: string;
};
export type ReadyOrder = {
  orderId: number; orderNumber: string; customerId: number;
  customerName: string; customerPhone: string; dueDate: string | null;
  orderTotal: string; productionStatus: number; productionStatusLabel: string;
  readyItemsCount: number; totalItemsCount: number;
  isReadyForDelivery: boolean; canDeliver: boolean;
  customerBalance: MoneyBalance | null; items: ReadyItem[];
};
export type ReadyList = { orders: ReadyOrder[]; pagination: Pagination };
export type ReadyPreview = {
  order: Omit<ReadyOrder, "customerBalance" | "canDeliver">;
  customerBalance: MoneyBalance | null; canDeliver: boolean; canCollect: boolean;
};
export type DeliveryCollection = {
  id: number; amount: string; receiptNumber: string | null; source: number;
  status: number; statusLabel: string; paymentMethod: number;
  paymentMethodLabel: string; paymentDestinationId: number | null;
  destinationLabel: string | null;
};
export type DeliveryRecord = {
  id: number; orderId: number; orderNumber: string | null;
  customerId: number | null; customerName: string | null; customerPhone: string | null;
  deliveredById: number; deliveredByName: string; receiverName: string | null;
  receivedAmount: string; effectiveReceivedAmount: string;
  collectionId: number | null; receiptNumber: string | null; collectionStatus: number | null;
  status: 1 | 2; statusLabel: string;
  deliveredAt: string | null; deliveredLocalDate: string | null;
  cancelledAt: string | null; cancelledByName: string | null; cancellationReason: string | null;
  orderTotal?: string | null; collection?: DeliveryCollection | null;
  cancelledById?: number | null; canCancel?: boolean;
};
export type DeliveryHistory = { deliveries: DeliveryRecord[]; pagination: Pagination };
export type DeliveryDetails = { delivery: DeliveryRecord };
export type DeliverPayload = {
  receiverName: string | null; collectedAmount: string;
  paymentMethod?: PaymentMethod; paymentDestinationId?: number;
  confirmCreditBalance?: boolean;
};
export type CancelPayload = { reason: string; fundsReturnConfirmed?: boolean };
export type ReadyFilters = { search: string; customerId: number | null; sort: "dueDate" | "-dueDate" | "id" | "-id" };
export type HistoryFilters = {
  search: string; customerId: number | null; dateFrom: string; dateTo: string; status: "" | "1" | "2";
  sort: "deliveredAt" | "-deliveredAt" | "id" | "-id";
};
