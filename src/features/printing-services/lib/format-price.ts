/**
 * Show catalog prices with at least two decimals, without discarding
 * significant extra digits used by square-centimeter and square-meter rates.
 * Display only: persisted/API prices retain their original precision.
 */
export function formatPriceForDisplay(amount: string): string {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(amount);
  if (!match) return amount;

  const [, whole, fraction = ""] = match;
  const meaningfulFraction = fraction.replace(/0+$/, "");
  return whole + "." + meaningfulFraction.padEnd(2, "0");
}
