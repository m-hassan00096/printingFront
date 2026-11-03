# Tabaa Design System — Balanced Modern
Version: **1.0** · Status: **Approved visual direction** · Date: **2026-11-03**

> **Source of truth for the whole Tabaa frontend.** The approved Create Order mockup and implementation establish the visual baseline. This document replaces older dark-mode and violet-heavy design proposals for new work. It does **not** change business rules.

## 1. Design principles

1. **Clarity before decoration:** readable Arabic first, one obvious primary action per view, restrained purple accent. Avoid ornamental hero cards and redundant descriptions.
2. **Operational speed:** high-information screens keep usable tables, short labels, searchable selectors, action affordances and fast keyboard/focus behavior. No extra steps for common operations.
3. **Progressive disclosure:** secondary notes, specifications, filters, previews and destructive actions reveal details only when requested. Never hide legally/financially important information.
4. **Visual hierarchy:** title → section → form/table → detail → helper copy. Display critical totals once near the action where they are needed.
5. **Semantic color:** purple means focus/active/primary action; green means success/completion; amber means warning; red means danger/debt or errors **with a text label**. No per-module rainbow colors.
6. **RTL-native:** right-to-left flow; monetary figures, receipt IDs, phone and technical values retain stable left-to-right spans as needed; icon order follows meaning. No color-only status.
7. **No behavior regression:** no changes to APIs, pricing, permissions, form validation, audit or settlement rules in visual PRs.

## 2. Canonical tokens

| Token | Value | Usage |
| --- | --- | --- |
| Brand / primary | `#6250C9` | Primary CTA, active navigation and focus |
| Brand hover | `#5140AD` | Primary hover |
| Brand subtle | `#F0EDFC` | Selected nav, small accents, subtle totals |
| Page background | `#F7F8FC` | App canvas |
| Surface | `#FFFFFF` | Cards, toolbars, sheets and modals |
| Text / ink | `#252A40` | Titles, amount, form input text |
| Muted text | `#6A7388` | Metadata and helper content |
| Border | `#E5E8F1` | Surface separators |
| Input border | `#D9DEEB` | Inputs/selects |
| Success | `#15845F` | Positive/completed state |
| Warning | `#A66A19` | Warnings/pending |
| Danger | `#C74256` | Errors/debt/destructive |
| Table hover | `#F9F8FF` | Hover only, not permanent zebra striping |

Tokens are defined in `src/index.css` and must be used by `bg-primary`, `bg-card`, `text-muted-foreground`, `border-border`, etc. Prefer semantic tokens to new inline hex colors. New exact colors need contrast testing.

## 3. Typography

- **Primary:** **IBM Plex Sans Arabic** (400/500/600/700) for the entire authenticated application; Cairo and system UI as fallbacks.
- English text/IDs: Inter or system sans only where useful; numeric quantities use `tabular-nums` to keep table columns aligned.
- Default readable body: **14px / 1.65**; tables and form inputs **13–14px**; microcopy should generally be **12px minimum** (exceptions: very short supporting metadata).
- Page title: **24px / 700**; section heading **16–18px / 700**; field label **13px / 600**; value **14–16px**; critical financial totals **20–24px**.
- Do not use excessive boldness throughout a card; limit to primary heading or primary number.

## 4. Geometry and rhythm

- 4px spacing base, common gaps 8/12/16/20/24px. Separate related fields with 12–16px, major sections with 16–24px.
- Surfaces: **12–16px radius**, subtle 1px border and understated shadow `0 3px 14px rgba(37,51,87,.035)`.
- Controls: minimum **40px** comfortable height for main inputs/buttons; compact 32–36px only for secondary table/filter controls. Target touch areas `44px` where practicable.
- Desktop max content width `1660px` with responsive side padding. No fixed width that clips tables, finance statements or order quantities.
- Sidebar: **238px** expanded, **66px** collapsed; remains permission-aware and mobile-collapsible.
- Responsive breakpoint guidance: phone <640px stack, tablet 640–1199px flexible one column, wide desktop ≥1200px allow side summary where it improves comprehension.

## 5. Component recipes

| Component | Standard |
| --- | --- |
| Sidebar | White/slightly tinted, selected row subtle purple + purple icon/text, other rows neutral; grouped navigation permissions unchanged |
| Topbar | White, thin border, clear current section context, only functional controls; avoid duplicate page H1 |
| Primary button | Solid purple + white, readable label, visible focus ring, disabled state. One primary CTA per action area |
| Secondary button | White with neutral border and darker readable text |
| Form field | Label above, min 40px input, visible required marker and inline validation, no placeholder-only labels |
| Card | White `rounded-xl`/`rounded-2xl`, border, tiny shadow, 16–20px padding |
| Table | Readable 12px headers + 13–14px body, sticky headers when useful, minimum row height suitable for actions, horizontally scrollable on mobile |
| Filter bar | Clearly grouped fields, search first; optional filters can be collapsed; never remove active filters silently |
| Modal | 16px spacing, max-width matched to task, clear title/action, scroll-safe, keyboard/escape/focus trapping unchanged |
| Financial summary | Totals from existing calculation only; no invented discount; positive and negative values show text labels as well as semantic colors |
| Kanban card | Same white surface/border/focus system; workflow stage names and status remain visible. Stage colors have semantic meaning only |
| Empty/loading/error | Short plain-Arabic message and specific recovery action; accessible roles remain intact |

### Example Tailwind surface

```tsx
<section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
  <h2 className="text-base font-bold">بيانات الأوردر</h2>
  {/* Existing form controls, permission checks, logic, and events remain unchanged */}
</section>
```

## 6. Screen-level application

- **Create Order**: approved two-column composition on wide screens, order and item fields in main column, persistent existing amount/deposit summary in side column, Save Draft and Confirm controls below. All service methods, dimensions, pricing previews and payment warnings preserved.
- **Dashboard**: concise KPIs, tasks requiring attention, latest orders and production pressure; subdued background with a single accent, not full-surface rainbow cards.
- **Orders & customers & services**: list-first with compact, readable filter toolbars; row actions and direct links unchanged.
- **Production**: clean Kanban swimlanes; statuses distinguished by text and subtle semantic accents. Retain all permissions/drag-or-status actions.
- **Deliveries & collections**: high clarity of dates and amounts, distinct destructive actions; receipt, payment and delivery logic untouched.
- **Finance**: readable dense ledger and settlements, separate financial semantics for due/credit/refunds, preserve CSV/XLSX/report functionality.
  - In a selected customer account, **تسجيل تحصيل** (primary) and **رد رصيد للعميل** (secondary) sit side by side. Refund creation stays visibly **disabled** (with an accessible inline reason) until the existing backend `/finance/customers/:id/refundable-credit` preview confirms a positive refundable amount; **hide** the action entirely for roles lacking `finance.refunds.create`.
  - Show refund movements through the existing **نوع الحركة** dropdown (`رد مبلغ للعميل`, type `5`) and keep individual clickable refund receipts. Do **not** add a second `ردود الأموال فقط` shortcut button or explanatory paragraph above the filters; these duplicate existing controls.
  - No separate refund-history navigation item: customer refunds are read via the **كشف الحساب** ledger (select `رد مبلغ للعميل` from **نوع الحركة**, then open the refund receipt). For backwards compatibility and authorized audit use, the all-customers report remains accessible through its **existing direct URL** `/finance/refunds` (permission `finance.refunds.view`), plus legacy `?tab=refunds` and `?view=refunds` bookmarks; none adds another sidebar entry. The one-time **رصيد افتتاحي** action is under **المزيد** only if available.
- **Identity & settings**: clear section headings, forms with accessible labels, consistent modal surfaces.

## 6A. Modal size policy (mandatory)

Each modal must use its **own task-driven width utility**. Do not set `max-width` for all `[role="dialog"]` elements in global/unlayered CSS: it overrides Tailwind's utility layer even when the component has a `max-w-*` class, and stretches every dialog to the viewport width.

| Mode | Target desktop width | Examples |
| --- | --- | --- |
| **Small** | 400–440px | Delete confirmations, short prompts, irreversible action confirmation |
| **Medium** | 480–560px | Customer type, printing location, bank/wallet settings, customer edits, collections and refunds |
| **Large** | 640–760px | Production details and complex multi-section dialogs |
| **Extra-large** | 800–960px, only when needed | Customer account settlement with complex financial tables and summaries |

- Use `w-full` **with** explicit `max-w-[...px]` in the dialog container. Viewport overlay padding (12px mobile, 16px desktop) keeps the surface away from edges; don't assume an arbitrary global max-width will constrain the content.
- Keep dialogs centered and **content-height by default**, not full-screen. On small screens cap at `max-h-[calc(100dvh-24px)]` and scroll the dialog/body rather than crop action buttons.
- Use 16–20px internal padding, 12–16px form gaps, a clear title and close control, and an action footer near the final field; avoid oversized textareas or full-width blocks of helper text.
- Preserve existing keyboard focus, Escape behavior, role/aria labels, access controls, confirmation steps, validation, loading and save flows.
- **Full-screen dialogs** are exceptional and need a justified long workflow; a normal CRUD form must never inherit full width.

## 6B. Customer ledger pagination

- Customer-ledger movements are **server-paginated** via the existing `GET /finance/customers/:id/ledger?page=&perPage=` endpoint. Default to **20 movements**, with **50** as an optional page size for long account histories. Only render the footer controls when more than 20 movements match.
- Display the actual range (for example, `1–20 من 83 حركة`) and previous/next arrows in **the same card footer** beneath the table. Keep the page indicator visible when the footer is shown.
- Changing the page size, date range, movement type, or customer resets to **page 1** to avoid blank/misleading views. Date/movement filters are applied **on the server**, not after slicing visible rows.
- The running balance for each row is returned by the backend over the customer's **complete ledger**, including movements outside the current filter or page. Never derive it by summing the current page or alter the financial totals.
- For 20 or fewer movements, no pagination footer appears; the header still shows the total. Leave enough horizontal scroll room on mobile for the ledger columns.

## 7. Accessibility & QA checklist

- [ ] Every control continues to have an accessible name, keyboard navigation, focus-visible and clear disabled state.
- [ ] RTL tested at **320px / 768px / 1280px / 1600px**; tables scroll horizontally rather than crop; fixed summary collapses below main form.
- [ ] Visual contrast targets **WCAG AA 4.5:1** normal text and **3:1** large text and UI indicators, wherever applicable.
- [ ] No additional inaccessible action controls, no fake clickable elements.
- [ ] Prefers-reduced-motion honored.
- [ ] Long Arabic names, large money figures, PDF/file names and order identifiers remain legible.
- [ ] Save/confirm/undo, validation focus, permissions, idempotency, financial balances and all existing tests continue to pass.
- [ ] No fake discount/order number/payment fields from illustrative mockup.

## 8. Technical enforcement

- Global tokens/typography: `src/index.css`
- Application shell: `src/app/layouts/{app-shell,sidebar,topbar}.tsx`
- Shared components: `src/shared/components/ui/{button,badge,card}.tsx`
- Form recipe: `src/features/identity/components/identity-ui.tsx`
- Order-specific responsive visual composition: `src/features/orders/pages/{order-create-page.tsx,order-create-page.css}`
- Business hooks, services, API payloads, permission guards, validation schemas and database are **out of scope** for visual-only changes.
- Use the PR screenshot-approved **Balanced Modern** direction; update this file when UI principles or tokens change.

## 9. Release policy

Implement in a **separate frontend feature branch**, leave PR **Draft** until visual inspection and CI pass. Do not merge `develop` or deploy without explicit approval. Use manual QA after automated tests, especially for complex operational modals.
