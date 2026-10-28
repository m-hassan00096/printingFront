# UI/UX Guidelines

## Product direction

Tabaa is a daily operations tool. Optimize for quick recognition, low error rates, and repeated use—not decorative dashboards.

## Visual identity

- Arabic-first, right-to-left layout from the document root.
- Cairo remains the primary Arabic typeface, with Inter for Latin text and JetBrains Mono for order identifiers and shortcut hints.
- **Approved direction: Light analytics dashboard**, matching the user-provided Lucid Analytics screenshots on October 27, 2026. #F7F8FC canvas, #FFFFFF white panels, #F6F8FC sidebar, #535FD1 violet accent and dark #222633 text.
- Reserve violet for focus, selection and primary actions; accessible dark-green (#14815B), amber (#A46B0B) and coral (#C73A4C) status text on pale colored chips.
- Prefer white cards, understated soft shadows, thin dividers, clear grouping and generous whitespace rather than dark panels.
- Use 4/8px spacing increments, rounded 10–14px cards, and 7–10px buttons/inputs.
- Use Lucide icons consistently. Icon-only controls need an accessible label.

## Information hierarchy

1. Page title and purpose.
2. The primary action for that screen.
3. The information required to make the next decision.
4. Secondary filters and supporting details.
5. Destructive or rare actions inside a contextual menu.

Avoid several primary buttons with equal visual weight. Keep summary metrics only when they help the user decide what to do next.

## Navigation

- Keep top-level navigation stable and limited to the main work areas.
- Use clear Arabic labels rather than internal technical terminology.
- Preserve a visible active state in the sidebar.
- Support a 238px RTL sidebar collapsing to 66px on desktop, and a dismissible mobile drawer.
- Add Ctrl/Cmd+K command navigation and keyboard-operable controls; show only destinations allowed by the current user's permissions.
- Do not use dead links or controls that look functional but do nothing.

## Tables and lists

- Put search and the most-used filters near the table they affect.
- Keep row actions consistent across lists.
- Provide loading, empty, error recovery, and pagination states where appropriate.
- Keep long identifiers readable and avoid excessive columns.
- On small screens, prioritize key fields and move secondary details into a detail view rather than shrinking the whole table.

## Statuses and color

- Always pair status color with a readable label or icon.
- Use color consistently for the same meaning throughout the product.
- Show late, blocked, partially ready, and completed states without relying on color alone.
- Confirm irreversible or financially sensitive actions with the relevant amount and context.

## Forms and dialogs

- Use a dedicated page for complex workflows such as creating or editing a full print order.
- Use a dialog for short, focused tasks that can be completed without losing context.
- Group fields by user intent, not by database table.
- Mark required fields clearly and explain validation errors beside the field.
- Preserve entered values after recoverable errors.
- Do not ask for information that can be derived safely or is not needed.
- Label destructive actions by what they will do.

## Printing workflow considerations

- Show the order number, customer, due date, and current status consistently where useful.
- Organize production items under their order so users understand which items belong together.
- Make the next available production action obvious.
- Distinguish ready-to-deliver items from the final delivery operation.
- Before a delivery or collection is confirmed, show the amount involved and remaining balance.
- Keep financial corrections auditable; posted financial movements should not look like ordinary editable records.

## Financial clarity

- Visually distinguish amount due, amount paid, and customer credit.
- Format money consistently in EGP and avoid ambiguous labels.
- Never use color alone to indicate payment status.
- Confirm overpayments explicitly and show the resulting credit before saving.
- Protect users from duplicate submissions on financial actions.

## Accessibility and responsive behavior

- Maintain visible keyboard focus and logical tab order.
- Use semantic headings, buttons, labels, and landmarks.
- Provide accessible names for icon buttons.
- Keep text contrast readable and avoid tiny metadata for important information.
- Ensure touch targets are comfortable on mobile.
- Test long Arabic labels, large numbers, long order numbers, and mixed Arabic/Latin text.
- Prefer logical start/end spacing for RTL layouts.

## UX review checklist

1. Can the user identify the screen's purpose immediately?
2. Is the next action obvious without competing buttons?
3. Can the user find and compare records quickly?
4. Are errors and irreversible actions handled safely?
5. Are loading, empty, and failure states designed?
6. Does the layout remain clear with realistic data and long Arabic text?

## Reference hierarchy and implementation (October 2026)

- **Primary visual source:** the three light Lucid Analytics screenshots provided by the user on October 27, 2026. These **override the dark mode aesthetic** of the upstream `DESIGN.md` specification.
- `DESIGN.md` remains a copy of https://designmd.ai/chef/violet-issue for design-system provenance, UI component discipline, and visual accent identity; do not interpret its dark-background instruction as the approved Tabaa theme.
- Use a **light theme only**, until another theme is explicitly requested.
- Match the references with white app header and content cards, off-white page, pale gray RTL sidebar, gentle indigo/violet accent, soft elevation, polished table rows, and clear spaced sections.
- Keep Arabic RTL and Cairo; mirror the English screenshot's left navigation to the right.
- Keep the real four production stages and real metrics; do not invent revenue trends or demo charts when data isn't available from the existing API.
- Preserve Laravel API contracts, session authentication, permissions and all order/production/finance flows. Styling work should not change business rules.
- Verify desktop/mobile with realistic Arabic labels, long order identifiers, menu overlays and clear keyboard/touch focus.

## Printing services: UI/UX and tier-priority explanation (October 27, 2026)

- **Do not alter backend pricing precedence.** The backend `/printing-services/price-preview` result is authoritative. Frontend does not calculate prices or choose a tier.
- For tier rows where both quantity bounds are empty, the UI labels that tier `السعر الافتراضي` (default/catch-all for that customer type), not “all quantities”. Quantity-specific tier rows have visual priority guidance; the source returned by the API is displayed in the preview.
- A light advisory warns about overlapping *quantity-bounded* rows of the same customer type. It is informational only (not new validation), excludes a catch-all tier, and does not change the API payload.
- Distinguish blank `basePrice` (manual pricing fallback) from explicit numeric `0` (free fallback), without changing `null` or `0` values being saved.
- Show a compact service-level base-price and tier-count summary, visually emphasize the previewed grand total, and keep legacy permissions/gates unchanged.
- Quantity input labels and backend schema names (`minQuantity`, `maxQuantity`, `price`) remain unchanged.

## Optional customer type / base-price fallback (2026-10-27)
- Customer type selection is optional; save `customerTypeId: null` for unclassified customers (and permit clearing a type on update).
- Backend pricing preview with `customerTypeId: null` **uses the service base price**, bypassing generic quantity tiers. Classified clients retain current specific/generic tier priority.
- A service with `basePrice: null` suggests **0.00 EGP** when no tier applies; don't display a manual-pricing message or imply that a separate price entry is mandatory.
- Hide the summary cards for base price and number of tiers; display the base price once in the pricing-table footer. Remove repeated pricing hints and source badges in the preview while keeping the highlighted total.
- Requires corresponding backend PR in `printingApi` and migrations for nullable customer/order snapshots. Deploy backend before frontend.

## Pricing tier layout refinement (October 27, 2026)
- Keep the existing native `select` components and their shared field styling unchanged; the user specifically approved them.
- Align tier title, quantity-range chip and compact delete icon on one line. Avoid repeating the same range label above input fields.
- Tier card padding and vertical gaps are reduced; customer type, quantity range and unit price align horizontally on desktop and reflow on smaller screens.
- Confirm removal of **persisted tiers** inline before adding the delete command to the update payload. Unsaved tiers can be removed immediately. No backend changes.
- In service details, explain the base-price fallback in the pricing table footer (also applicable to customers without a type) instead of repeating pricing-priority prose.
- Display preview's source once and a compact formula `quantity × unit price` under the prominent suggested total, without making the preview compute pricing client-side.
- Keep a visible sticky form action bar with save on the right in RTL and cancel beside it.
