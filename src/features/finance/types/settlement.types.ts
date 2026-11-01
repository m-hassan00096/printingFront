export type SettlementLineKind =
  | "delivered_item" | "delivery_cancellation"
  | "collection" | "collection_reversal" | "refund" | "opening_balance";

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
  adjustmentsTotal: string;
  closingBalance: string;
  financeBalanceAsOf: string;
  undeliveredDifference: string;
  lines: SettlementLine[];
};

export type SettlementPeriod = { from: string; to: string };
