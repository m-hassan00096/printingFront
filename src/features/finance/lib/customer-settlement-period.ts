import { centsToMoney, parseCents } from "@/features/deliveries/lib/delivery-money";
import type { AccountSettlementPreview, AccountSettlementRecord } from "../types/account-settlement.types";

export function nextSettlementDay(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) throw Error("Invalid previous settlement cutoff");
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (date.toISOString().slice(0, 10) !== value) throw Error("Invalid previous settlement cutoff");
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** A reporting preference, not a change to the backend's cumulative settlement scope. */
export function suggestedStatementFrom(cutoff: string, previous: AccountSettlementRecord | null): string {
  const start = previous ? nextSettlementDay(previous.dateTo) : cutoff.slice(0, 8) + "01";
  return start > cutoff ? cutoff : start;
}

function signedCents(amount: string): number {
  const negative = amount.startsWith("-");
  const cents = parseCents(negative ? amount.slice(1) : amount);
  if (cents === null) throw Error("Invalid settlement financial amount");
  return negative ? -cents : cents;
}

export type ClientPeriodBreakdown = {
  items: AccountSettlementPreview["items"];
  payments: AccountSettlementPreview["payments"];
  deliveredPeriod: string;
  newWork: string;
  workAdjustments: string;
  netPaymentsSince: string;
  newDiscounts: string;
  startingBalance: string;
  otherAdjustments: string;
  previousNumber: string | null;
};

/**
 * Financial values are always reconciled to the authoritative backend preview.
 * The prior settlement's *after* snapshot, not its date alone, separates
 * same-day receipts and prevents counting its receipt twice.
 */
export function clientPeriodBreakdown(
  preview: AccountSettlementPreview,
  from: string,
  previous: AccountSettlementRecord | null,
): ClientPeriodBreakdown {
  if (from > preview.dateTo || !/^\d{4}-\d{2}-\d{2}$/.test(from))
    throw Error("Invalid client statement reporting period");
  if (previous && (previous.customerId !== preview.customerId || previous.dateTo > preview.dateTo))
    throw Error("Previous settlement is outside this account statement");
  if (previous && from < suggestedStatementFrom(preview.dateTo, previous))
    throw Error("Client report begins before the last settlement");

  const before = previous?.snapshot?.after;
  if (previous && !before) throw Error("Previous settlement is missing its saved account snapshot");
  const lastLedgerId = before?.sourceManifest?.ledgerMaxId;
  if (previous && (lastLedgerId === undefined || !Number.isSafeInteger(lastLedgerId)))
    throw Error("Previous settlement has no reliable receipt cutoff");

  const oldIds = new Set(before?.items.map(item => item.id) ?? []);
  const newlyDelivered = preview.items.filter(item => !oldIds.has(item.id));
  const items = newlyDelivered
    .filter(item => item.deliveryDate >= from && item.deliveryDate <= preview.dateTo)
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate) ||
      a.orderNumber.localeCompare(b.orderNumber) || a.id - b.id);
  const workPeriodCents = items.reduce((sum, item) => sum + signedCents(item.amount), 0);
  const payments = preview.payments
    .filter(item => previous ? item.entryId > lastLedgerId! : item.effectiveDate >= from)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.entryId - b.entryId);
  const paymentCents = payments.reduce((sum, item) => sum - signedCents(item.signedAmount), 0);

  const due = signedCents(preview.balanceBefore);
  const workDelta = before ? signedCents(preview.deliveredTotal) - signedCents(before.deliveredTotal) : workPeriodCents;
  const netPayments = before ? signedCents(preview.netPayments) - signedCents(before.netPayments) : paymentCents;
  if (netPayments !== paymentCents)
    throw Error("Customer payments changed outside the saved statement watermark");
  const discounts = before
    ? signedCents(preview.discountsTotal ?? "0.00") - signedCents(before.discountsTotal ?? "0.00")
    : 0;
  const base = before ? signedCents(previous!.balanceAfter) : due - workDelta + netPayments;
  const workAdjustments = before ? workDelta - workPeriodCents : 0;
  const other = due - (base + workDelta - netPayments - discounts);

  return {
    items,
    payments,
    deliveredPeriod: centsToMoney(workPeriodCents),
    newWork: centsToMoney(workDelta),
    workAdjustments: centsToMoney(workAdjustments),
    netPaymentsSince: centsToMoney(netPayments),
    newDiscounts: centsToMoney(discounts),
    startingBalance: centsToMoney(base),
    otherAdjustments: centsToMoney(other),
    previousNumber: previous?.number ?? null,
  };
}
