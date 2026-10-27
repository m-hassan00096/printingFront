import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Plus, Search } from "lucide-react";

export type SearchOption = { value: number; label: string };

export function SearchableSelect({
  options, value, onChange, placeholder, label, disabled = false,
  loading = false, onCreate, createLabel = "إضافة جديد",
}: {
  options: SearchOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  disabled?: boolean;
  loading?: boolean;
  onCreate?: () => void;
  createLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const wrapper = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((item) => String(item.value) === value);
  const visible = options.filter((item) => item.label.toLocaleLowerCase("ar").includes(query.trim().toLocaleLowerCase("ar"))).slice(0, 30);

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", closeOutside);
    return () => document.removeEventListener("mousedown", closeOutside);
  }, [open]);

  function choose(id: number) {
    onChange(String(id));
    setQuery("");
    setOpen(false);
  }
  function keyboard(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((current) => Math.min(current + 1, Math.max(visible.length - 1, 0)));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((current) => Math.max(current - 1, 0));
    } else if (event.key === "Enter" && open) {
      event.preventDefault();
      if (visible[highlight]) choose(visible[highlight].value);
    }
  }

  return <div ref={wrapper} className="relative">
    <div className="relative">
      <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <input role="combobox" aria-label={label} aria-autocomplete="list" aria-expanded={open}
        aria-controls={listId} aria-activedescendant={open && visible[highlight] ? `${listId}-${visible[highlight].value}` : undefined}
        autoComplete="off" disabled={disabled} value={open ? query : (selected?.label ?? "")}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border bg-background pr-10 pl-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
        onFocus={() => {setOpen(true);setHighlight(0);setQuery("");}}
        onClick={() => {setOpen(true);setHighlight(0);}}
        onChange={(event) => {setQuery(event.target.value);setHighlight(0);setOpen(true);}}
        onKeyDown={keyboard} />
      <ChevronDown className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
    {open && !disabled && <div className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border bg-popover shadow-xl">
      <div role="listbox" id={listId} aria-label={label} className="max-h-56 overflow-y-auto p-1">
        {visible.map((item, index) => <button key={item.value} type="button" role="option"
          id={`${listId}-${item.value}`} aria-selected={value === String(item.value)}
          className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-right text-sm hover:bg-muted ${index === highlight ? "bg-muted" : ""}`}
          onMouseEnter={() => setHighlight(index)} onClick={() => choose(item.value)}>
          <span>{item.label}</span>
          {value === String(item.value) && <Check className="size-4 shrink-0 text-primary" />}
        </button>)}
        {loading && <p role="status" className="p-3 text-xs text-muted-foreground">جاري التحميل...</p>}
        {!loading && !visible.length && <p className="p-3 text-xs text-muted-foreground">لا توجد نتائج مطابقة.</p>}
        {options.length > 30 && !query && <p className="px-3 py-2 text-xs text-muted-foreground">اكتب للبحث في باقي الخيارات.</p>}
      </div>
      {onCreate && <button type="button" onClick={() => {setOpen(false);setQuery("");onCreate();}}
        className="flex w-full items-center justify-center gap-2 border-t px-3 py-3 text-sm font-bold text-primary hover:bg-muted">
        <Plus className="size-4" /> {createLabel}
      </button>}
    </div>}
  </div>;
}
