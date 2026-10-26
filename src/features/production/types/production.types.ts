export type ProductionColumnId = 0 | 1 | 2 | 3;
export type ProductionStage = 0 | 1 | 2 | 3 | 4;
export type ProductionAction =
  | "start-design" | "complete-design" | "complete-and-send-to-printing"
  | "send-to-printing" | "mark-ready" | "undo" | "change-location";
export type Pagination = {
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
};
export type ProductionItem = {
  id: number;
  orderId: number;
  orderNumber: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  serviceId: number;
  serviceName: string;
  quantity: number;
  dueDate: string | null;
  isLate: boolean;
  productionStage: ProductionStage;
  productionStageLabel: string;
  designerId: number | null;
  designerName: string | null;
  designCompletedById: number | null;
  designCompletedByName: string | null;
  printingLocationId: number | null;
  printingLocationName: string | null;
};
export type ProductionSummary = {
  notStartedCount: number;
  designInProgressCount: number;
  designCompletedCount: number;
  printingCount: number;
  readyCount: number;
  lateOrdersCount: number;
};
export type ProductionEvent = {
  id: number;
  orderItemId: number;
  eventType: number;
  eventTypeLabel: string;
  actorId: number;
  actorName: string | null;
  fromStage: number | null;
  toStage: number | null;
  oldPrintingLocationId: number | null;
  newPrintingLocationId: number | null;
  oldPrintingLocationName: string | null;
  newPrintingLocationName: string | null;
  createdAt: string;
};
export type ProductionFilters = {
  search: string;
  customerId: number | null;
  serviceId: number | null;
  myDesignWork: "" | "1" | "2";
  lateOnly: boolean;
  sort: "dueDate" | "-dueDate" | "id" | "-id";
};
export type ProductionList = { items: ProductionItem[]; pagination: Pagination };
export type ProductionHistory = { events: ProductionEvent[]; pagination: Pagination };
export type SelectOption = { value: number; label: string };
export const PRODUCTION_COLUMNS = [
  { id: 0, label: "لم يبدأ" },
  { id: 1, label: "التصميم" },
  { id: 2, label: "الطباعة" },
  { id: 3, label: "جاهز للتسليم" },
] as const;
