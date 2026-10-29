/** Display-only EGP formatting. Amounts stay as backend decimal strings in API payloads. */
export function formatEgp(amount: number | string, maximumFractionDigits = 2): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return "—";
  return `${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits,
  })} ج.م`;
}

