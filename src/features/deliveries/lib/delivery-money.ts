import type { MoneyBalance } from "../types/deliveries.types";

const moneyPattern = /^(?:0|[1-9][0-9]{0,9})(?:\.[0-9]{1,2})?$/;

/** All arithmetic uses integer cents, never floating point currency calculations. */
export function parseCents(value: string): number | null {
  if (!moneyPattern.test(value)) return null;
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number((fraction + "00").slice(0, 2));
}
export function centsToMoney(cents: number): string {
  const whole = Math.floor(Math.abs(cents) / 100);
  const fraction = Math.abs(cents) % 100;
  return (cents < 0 ? "-" : "") + whole + "." + String(fraction).padStart(2, "0");
}
export function signedBalanceCents(balance: MoneyBalance | null): number | null {
  if (!balance) return null;
  const amount = parseCents(balance.amount);
  if (amount === null) return null;
  return balance.type === 2 ? -amount : balance.type === 1 ? amount : 0;
}
export function estimatedBalance(balance: MoneyBalance | null, collectedAmount: string): number | null {
  const start = signedBalanceCents(balance);
  const payment = parseCents(collectedAmount);
  return start === null || payment === null ? null : start - payment;
}
