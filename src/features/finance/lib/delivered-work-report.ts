import type { CustomerSettlement, SettlementLine } from "../types/settlement.types";
import { centsToMoney, parseCents } from "@/features/deliveries/lib/delivery-money";

/**
 * Presentation-only view of the authoritative delivered-work statement.
 * The source API also contains cash, opening balance and ledger rows needed
 * by the financial settlement workflow. None belong in this delivery report.
 *
 * In particular, delivery cancellations must remain visible and reduce the
 * delivered net amount; never present the gross as an outstanding debt.
 */
export type DeliveredWorkLine = SettlementLine & { kind: "delivered_item" | "delivery_cancellation" };

export type DeliveredWorkReport = {
  lines: DeliveredWorkLine[];
  deliveredOrderCount: number;
  deliveredItemCount: number;
  grossDelivered: string;
  cancelledDelivered: string;
  netDelivered: string;
};

function positiveCents(value: string): number {
  const unsigned = value.startsWith("-") ? value.slice(1) : value;
  const cents = parseCents(unsigned);
  if (cents === null) throw Error("Invalid delivered-work amount");
  return cents;
}

export function deliveredWorkReport(statement: CustomerSettlement): DeliveredWorkReport {
  const lines = statement.lines.filter(
    (line): line is DeliveredWorkLine => line.kind === "delivered_item" || line.kind === "delivery_cancellation",
  );

  const deliveredItems = lines.filter(line => line.kind === "delivered_item");
  const deliveredOrderCount = new Set(
    deliveredItems.map(line => line.orderId).filter((id): id is number => id !== null),
  ).size;
  const grossCents = deliveredItems.reduce((sum, line) => sum + positiveCents(line.signedAmount), 0);
  const cancelledCents = lines.filter(line => line.kind === "delivery_cancellation")
    .reduce((sum, line) => sum + positiveCents(line.signedAmount), 0);

  return {
    lines,
    deliveredOrderCount,
    deliveredItemCount: deliveredItems.length,
    grossDelivered: centsToMoney(grossCents),
    cancelledDelivered: centsToMoney(cancelledCents),
    // The server's deliveredTotal already accounts for cancellations in the selected period.
    netDelivered: statement.deliveredTotal,
  };
}
