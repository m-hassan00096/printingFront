export type SettlementLineKind =
  | "delivered_item" | "delivery_cancellation"
  | "collection" | "collection_reversal" | "refund" | "opening_balance"
  | "settlement_discount";

export type SettlementLine = {
  key: string;
  kind: SettlementLineKind;
  date: string;
  description: string;
  orderId: number | null;
  orderNumber: string | null;
  receiptNumber: string | null;
  actualReceiptNumber?: string | null;
  quantity: number | null;
  unitPrice: string | null;
  signedAmount: string;
  runningBalance: string;
};

export type CustomerSettlement = {
  customerId: number;
  customerName: string;
  customerPhone: string;
  dateFrom: string;
  dateTo: string;
  openingBalance: string;
  deliveredTotal: string;
  paymentsTotal: string;
  discountsTotal?: string;
  adjustmentsTotal: string;
  closingBalance: string;
  financeBalanceAsOf: string;
  undeliveredDifference: string;
  lines: SettlementLine[];
};

export type SettlementPeriod = { from: string; to: string };

export type SettlementRecordSummary = {
  id: number;
  number: string;
  dateFrom: string;
  dateTo: string;
  createdAt: string;
  balanceBefore: string;
  balanceAfter: string;
  discountAmount: string;
  collectedAmount: string;
  status: "settled" | "partial" | "unpaid";
};

export type SettlementRecord = SettlementRecordSummary & {
  note: string | null;
  discountReason: string | null;
  collectionId: number | null;
  statement: CustomerSettlement;
};

export type SettlementRecordsPage = {
  settlements: SettlementRecordSummary[];
  nextDateFrom: string | null;
  pagination: { currentPage: number; lastPage: number; perPage: number; total: number };
};

export type CreateSettlementRecordPayload = {
  dateFrom: string;
  dateTo: string;
  discountAmount: string;
  discountReason?: string;
  collectedAmount: string;
  paymentMethod?: 0 | 1 | 2;
  paymentDestinationId?: number;
  note?: string;
};
