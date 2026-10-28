export type OrderStatus = 0 | 1 | 2;
export type ProductionStatus = 0 | 1 | 2 | 3 | 4 | null;
export type Pagination = { currentPage: number; lastPage: number; perPage: number; total: number };
export type OrderFile = {
  id: number; name: string; extension: string; mimeType: string; sizeBytes: number;
  url: string | null; createdAt: string | null;
};
export type OrderItem = {
  id: number; serviceId: number; serviceName: string;
  customerTypeId: number | null; customerTypeName: string | null;
  quantity: number; specifications: string | null; agreedTotal: string;
  unitPrice: string; productionStage: number;
  designerId: number | null; printingLocationId: number | null; files?: OrderFile[];
};
export type Order = {
  id: number; orderNumber: string | null; customerId: number;
  customerName: string; customerPhone: string;
  customerTypeId: number | null; customerTypeName: string | null;
  source: 0 | 1; sourceLabel: string; status: OrderStatus; statusLabel: string;
  productionStatus: ProductionStatus; productionStatusLabel: string | null;
  delayStatus: number | null; delayStatusLabel: string | null;
  dueDate: string | null; notes: string | null;
  plannedDepositAmount?: string | null;
  plannedPaymentMethod?: 0 | 1 | 2 | null;
  plannedPaymentDestinationId?: number | null;
  itemsCount: number | null; totalAmount: string;
  createdAt: string | null; updatedAt: string | null; confirmedAt: string | null;
  deliveredAt: string | null; cancelledAt: string | null;
  items?: OrderItem[];
};
export type OrderFilters = { search: string; status: string; productionStatus: string; lateOnly: boolean; readyDueToday: boolean; createdFrom: string; createdTo: string; sort: string; page: number };
export type OrderItemPayload = { serviceId: number; quantity: number; specifications: string | null; agreedTotal: string };
export type CreateOrderPayload = {
  customerId: number; source: 0 | 1; dueDate: string | null;
  notes: string | null; items: OrderItemPayload[]; status: 0 | 1;
  depositAmount?: string; paymentMethod?: 0 | 1 | 2; paymentDestinationId?: number;
  plannedDepositAmount?: string | null;
  plannedPaymentMethod?: 0 | 1 | 2 | null;
  plannedPaymentDestinationId?: number | null;
};
export type UpdateOrderPayload = Partial<Pick<CreateOrderPayload, "customerId" | "source" | "dueDate" | "notes" | "plannedDepositAmount" | "plannedPaymentMethod" | "plannedPaymentDestinationId">>;
export type ConfirmOrderPayload = {
  depositAmount?: string; paymentMethod?: 0 | 1 | 2; paymentDestinationId?: number;
};
export type OrderActivity = {
  id: number; eventType: string; actorId: number | null;
  createdAt: string | null; context: Record<string, unknown> | null;
};
