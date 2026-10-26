import { useRef } from "react";
import { CalendarDays } from "lucide-react";

/** The API keeps ISO YYYY-MM-DD; the visible field always uses Egyptian day/month/year. */
export function formatCollectionDate(value: string | null | undefined): string {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function CollectionDateField({ label, value, onChange, min, max, disabled = false }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  return <label className="block min-w-0 space-y-1 text-xs font-semibold">
    <span className="text-foreground/80">{label}</span>
    <span className="relative flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-sm font-medium transition-colors focus-within:border-primary focus-within:ring-2 focus-within:ring-ring/20">
      <span dir="ltr" className={`tabular-nums ${value ? "text-foreground" : "text-muted-foreground"}`}>
        {value ? formatCollectionDate(value) : "يوم/شهر/سنة"}
      </span>
      <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden="true"/>
      <input ref={input} type="date" lang="en-GB" aria-label={label}
        value={value} min={min} max={max} disabled={disabled}
        onChange={event => onChange(event.currentTarget.value)}
        onClick={() => {
          // Chromium desktop opens the native picker even when its input text is visually hidden.
          try { input.current?.showPicker?.(); } catch { /* Keep native date input as fallback. */ }
        }}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
      />
    </span>
  </label>;
}
