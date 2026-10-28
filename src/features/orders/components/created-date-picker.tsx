import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { formatCollectionDate } from "@/features/collections/components/collection-date-field";

const weekdays = ["السبت", "الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const iso = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

function dateParts(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]) - 1, day = Number(match[3]);
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

/** A theme-matched Gregorian calendar; never launches the browser-native date picker. */
export function CreatedDatePicker({ label, value, onChange, min, max, disabled = false }: {
  label: string; value: string; onChange: (next: string) => void; min?: string; max?: string; disabled?: boolean;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => {
    const parts = dateParts(value);
    const now = new Date();
    const cairo = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo", year: "numeric", month: "2-digit" }).formatToParts(now);
    return { year: parts?.year ?? Number(cairo.find(x => x.type === "year")?.value ?? now.getUTCFullYear()),
      month: parts?.month ?? Number(cairo.find(x => x.type === "month")?.value ?? now.getUTCMonth() + 1) - 1 };
  });
  const [position, setPosition] = useState({ left: 0, top: 0, width: 292 });
  const selected = dateParts(value);
  const monthTitle = new Intl.DateTimeFormat("ar-EG", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(view.year, view.month, 15)));
  const daysInMonth = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate();
  const firstWeekday = (new Date(Date.UTC(view.year, view.month, 1)).getUTCDay() + 1) % 7;
  const tiles = Array.from({ length: firstWeekday + daysInMonth }, (_, i) => i - firstWeekday + 1);
  const canChoose = (day: number) => {
    const date = iso(view.year, view.month, day);
    return (!min || date >= min) && (!max || date <= max);
  };
  function toggle() {
    if (disabled) return;
    if (open) { setOpen(false); return; }
    const rect = trigger.current?.getBoundingClientRect();
    if (rect) {
      const width = Math.min(292, window.innerWidth - 16);
      const left = Math.min(Math.max(8, rect.right - width), window.innerWidth - width - 8);
      const height = 354;
      const top = rect.bottom + height > window.innerHeight - 8
        ? Math.max(8, rect.top - height - 6) : rect.bottom + 6;
      setPosition({ left, top, width });
    }
    const current = dateParts(value);
    if (current) setView({ year: current.year, month: current.month });
    setOpen(true);
  }
  useEffect(() => {
    if (!open) return;
    function pointer(event: PointerEvent) {
      const node = event.target as Node;
      if (!panel.current?.contains(node) && !trigger.current?.contains(node)) setOpen(false);
    }
    function key(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); trigger.current?.focus(); }
    }
    function close() { setOpen(false); }
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", key);
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", key);
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
    };
  }, [open]);
  function moveMonth(offset: number) {
    setView(current => {
      const date = new Date(Date.UTC(current.year, current.month + offset, 1));
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
    });
  }

  return <div className="min-w-0">
    <span className="mb-1 block text-xs font-semibold">{label}</span>
    <button type="button" ref={trigger} onClick={toggle} disabled={disabled}
      aria-label={label} aria-haspopup="dialog" aria-expanded={open}
      className="flex h-9 w-full items-center justify-between gap-2 rounded-lg border border-input bg-card px-3 text-xs font-medium transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-50">
      <span dir="ltr" className={value ? "tabular-nums text-foreground" : "text-muted-foreground"}>
        {value ? formatCollectionDate(value) : "يوم/شهر/سنة"}
      </span>
      <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
    </button>
    {open && createPortal(<div ref={panel} role="dialog" aria-label={`اختيار ${label}`}
      className="fixed z-[80] rounded-xl border border-[#e4e8f4] bg-white p-3 text-foreground shadow-[0_16px_45px_#192b5050]"
      style={{ left: position.left, top: position.top, width: position.width }} dir="rtl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <button type="button" aria-label="الشهر السابق" onClick={() => moveMonth(-1)}
          className="flex size-8 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary">
          <ChevronRight className="size-4" />
        </button>
        <span className="text-sm font-bold">{monthTitle}</span>
        <button type="button" aria-label="الشهر التالي" onClick={() => moveMonth(1)}
          className="flex size-8 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary">
          <ChevronLeft className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1" role="grid" aria-label={monthTitle}>
        {weekdays.map(day => <span key={day} role="columnheader" className="py-1 text-center text-[10px] font-semibold text-muted-foreground">{day.slice(0, 2)}</span>)}
        {tiles.map((day, index) => day < 1 ? <span key={`empty-${index}`} /> :
          <button type="button" key={day} role="gridcell" disabled={!canChoose(day)}
            aria-label={iso(view.year, view.month, day)} aria-selected={!!selected && selected.day === day && selected.month === view.month && selected.year === view.year}
            onClick={() => { onChange(iso(view.year, view.month, day)); setOpen(false); trigger.current?.focus(); }}
            className={`flex h-8 items-center justify-center rounded-lg text-xs transition-colors disabled:opacity-25 disabled:cursor-not-allowed ${selected && selected.day === day && selected.month === view.month && selected.year === view.year
              ? "bg-primary font-bold text-primary-foreground" : "hover:bg-primary/10"}`}>
            {day}
          </button>)}
      </div>
      <div className="mt-3 flex justify-between border-t pt-2">
        <button type="button" onClick={() => { onChange(""); setOpen(false); }}
          className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-destructive">
          <X className="size-3.5" /> مسح التاريخ
        </button>
        <button type="button" onClick={() => setOpen(false)}
          className="text-xs font-semibold text-primary">إغلاق</button>
      </div>
    </div>, document.body)}
  </div>;
}
