import type { Pagination } from "./finance.types";

export type AccountSettlementItem = {
  id: number; orderId: number; orderNumber: string; deliveryDate: string;
  description: string; specifications: string | null; quantity: number;
  unitPrice: string; amount: string; pricingMethod: string;
  widthCm: string | null; heightCm: string | null;
};
export type AccountSettlementPreview = {
  customerId: number; customerName: string; customerPhone: string;
  dateTo: string; paymentsThrough: string; scope: "cumulative_delivered_work";
  previewHash: string; openingBalance: string; deliveredTotal: string;
  grossCollections: string; collectionReversals: string; refundsTotal: string;
  netPayments: string; advancesForOtherWork: string; balanceBefore: string;
  dueNow: string; creditInScope: string; accountBalance: string; outsideBalance: string;
  hasWork: boolean; items: AccountSettlementItem[];
  payments: {entryId: number; type: number; typeLabel: string; effectiveDate: string;
    signedAmount: string; collectionId: number | null; receiptNumber: string | null;
    orderId: number | null; outsideWorkScope: boolean}[];
};
export type AccountSettlementStatus = "closed" | "partial" | "credit" | "needs_review";
export type AccountSettlementRecord = {
  id: number; number: string; customerId: number; dateTo: string; settledOn: string;
  status: AccountSettlementStatus; originalStatus: Exclude<AccountSettlementStatus, "needs_review">;
  statusLabel: string; needsReview: boolean; balanceBefore: string; amountCollected: string;
  balanceAfter: string; accountBalanceAfter: string; collectionId: number | null;
  receiptNumber: string | null; createdAt: string; createdBy: number; note: string | null;
  snapshot?: {before: AccountSettlementPreview; after: AccountSettlementPreview; receiptNumber: string | null};
};
export type AccountSettlementInput = {
  dateTo: string; previewHash: string; amount: string;
  paymentMethod?: 0 | 1 | 2; paymentDestinationId?: number; note?: string;
};
export type AccountSettlementHistory = {settlements: AccountSettlementRecord[]; pagination: Pagination};
