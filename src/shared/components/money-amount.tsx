import { formatEgp } from "@/shared/lib/format-egp";

export function MoneyAmount({ amount, maximumFractionDigits = 2, className = "" }: {
  amount: number | string;
  maximumFractionDigits?: number;
  className?: string;
}) {
  return <span dir="ltr" className={`inline-block whitespace-nowrap tabular-nums ${className}`}>
    {formatEgp(amount, maximumFractionDigits)}
  </span>;
}
