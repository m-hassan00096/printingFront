import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { navigationGroups, canAccessNavigation } from "@/app/navigation";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";

type Props = { open: boolean; onClose: () => void };

/** Permission-aware, RTL keyboard navigation. It does not query or expose private records. */
export function CommandPalette({ open, onClose }: Props) {
  const { data: user } = useCurrentUser();
  const navigate = useNavigate();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const items = useMemo(() => navigationGroups.flatMap(group =>
    group.items.filter(item => canAccessNavigation(item, user?.permissions ?? []))
      .map(item => ({ ...item, group: group.label }))
  ), [user?.permissions]);
  const filtered = useMemo(() => items.filter(item =>
    (item.label + " " + item.group).toLocaleLowerCase("ar").includes(query.trim().toLocaleLowerCase("ar"))
  ), [items, query]);

  useEffect(() => {
    function onShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) onClose(); else document.dispatchEvent(new Event("tabaa:open-command"));
      }
    }
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open) return null;
  function go(to: string) { navigate(to); onClose(); }
  const current = Math.min(active, filtered.length - 1);
  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center bg-black/70 px-3 pt-[12vh] backdrop-blur-[4px]"
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="بحث وتنقل سريع"
        className="w-full max-w-[560px] overflow-hidden rounded-xl border border-border bg-popover shadow-[0_24px_48px_#0008]"
        onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); onClose(); }
          if (event.key === "ArrowDown") { event.preventDefault(); setActive(i => Math.min(i + 1, filtered.length - 1)); }
          if (event.key === "ArrowUp") { event.preventDefault(); setActive(i => Math.max(i - 1, 0)); }
          if (event.key === "Enter" && filtered[current]) { event.preventDefault(); go(filtered[current].to); }
        }}>
        <div className="flex h-12 items-center gap-3 border-b border-border px-4">
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input ref={input} role="combobox" aria-label="ابحث في أقسام النظام" aria-expanded="true"
            aria-controls="tabaa-command-results" aria-activedescendant={filtered[current] ? "tabaa-command-" + current : undefined}
            className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none focus-visible:shadow-none"
            placeholder="اكتب اسم القسم للانتقال..." value={query}
            onChange={event => { setQuery(event.target.value); setActive(0); }}/>
          <button type="button" onClick={onClose} aria-label="إغلاق البحث"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="size-4"/></button>
        </div>
        <div id="tabaa-command-results" role="listbox" aria-label="نتائج التنقل" className="max-h-[min(55vh,430px)] overflow-auto p-2">
          {!filtered.length && <p className="px-3 py-8 text-center text-xs text-muted-foreground">لا توجد أقسام مطابقة.</p>}
          {filtered.map((item, index) => {
            const Icon = item.icon;
            return <button key={item.to} type="button" id={"tabaa-command-" + index} role="option" aria-selected={current === index}
              className={"flex h-9 w-full items-center gap-3 rounded-md px-3 text-start text-[13px] transition-colors " +
                (current === index ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground")}
              onMouseEnter={() => setActive(index)} onClick={() => go(item.to)}>
              <Icon className="size-4 shrink-0"/><span className="flex-1">{item.label}</span><span className="text-[11px] text-muted-foreground">{item.group}</span>
            </button>;
          })}
        </div>
        <div className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-2 text-[11px] text-muted-foreground">
          <span>↑ ↓ للتنقل</span><span>Enter للفتح</span><span>Esc للإغلاق</span>
        </div>
      </section>
    </div>
  );
}
