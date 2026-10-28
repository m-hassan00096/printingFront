# Production Frontend — Phase 1

Source: `printingApi` `develop` Production static workflow (verified 2026-10-26).
Status: feature branch; not merged into `develop`.

## Board and navigation
- `/production` replaces the placeholder under the existing `production.items.list` route policy and sidebar item.
- Four columns, each with independent paginated `GET /production/items?filter[column]=0|1|2|3` calls. Column 1 contains stages 1 and 2; column 3 is ready-for-delivery stage 4.
- `GET /production/summary` is shown only with `production.summary.view`; counts refer to all matching items, not the current page. A board column groups the *currently loaded page* by order; one order can span multiple columns/pages.
- Search by order/customer/phone/service, searchable customer (`activeCustomers`) and printing service (`printingServices`) selectors, personal design-work filter (started/completed), lateness, sort. Selecting a service sends `filter[serviceId]` to board and summary; the backend uses `order_items.printing_service_id` before pagination to keep counts accurate. On mobile, choose one visible stage while other stage data remains cached.
- In design (stage 1), each compact item card shows the **responsible designer** from the backend `designerName`, assigned at start-design. Finished design (stage 2) retains the responsible designer, and shows `designCompletedByName` separately only when a different employee finished; a missing completer is never inferred. Once sent to printing, the printer location is emphasized instead. No new backend fields or ownership enforcement is introduced.
- Detail modal shows item metadata, history (`production.history.view`) and existing order attachments when Orders read/file permissions allow it. File actions are view-only here; uploads remain in Orders.
- Audit history renders human-readable Arabic stage transitions (not raw integer stage values) and shows printer changes only when locations differ.
- Columns omit unusable paging controls on zero/one-page datasets, clamp stale page numbers after transitions, and retain an unobtrusive total count on nonempty single pages. Filter controls have tighter spacing; switching filters never displays stale cards while a new request loads.
- The card and detail dialog both read the same `ProductionItem.quantity` returned by the Production board API; regression tests verify the value is consistent. If a zero quantity is observed in live data, inspect the server response and persisted `order_items.quantity` before masking the discrepancy in UI.

## Backend action contracts
- `POST /production/items/{id}/start-design` — stage 0→1; designer comes from session.
- `POST /production/items/{id}/complete-design` — stage 1→2.
- `POST /production/items/{id}/complete-and-send-to-printing` — stage 1→3, `{printingLocationId}`.
- `POST /production/items/{id}/send-to-printing` — stage 2→3, `{printingLocationId}`.
- `POST /production/items/send-to-printing` — 1..100 unique stage-2 item IDs across orders and one active `printingLocationId`; atomic backend operation.
- `PATCH /production/items/{id}/printing-location` — printing stage only, new active location.
- `POST /production/items/{id}/mark-ready` — stage 3→4; **not** physical customer delivery.
- `POST /production/items/{id}/undo` — 4→3, 3→1, 2→1, 1→0; existing immutable audit preserved.
- All write requests send a random `Idempotency-Key`. Retrying the same *failed/ambiguous* payload reuses its key until success. React Query invalidates board/summary/history and Orders caches after successful operations.
- Writes always send exactly the backend request shape, and errors from Laravel stay visible. Authorization is enforced by Laravel middleware even when controls are hidden on client.
- `GET /selects?selects=activeCustomers,printingServices,printingLocations` supplies customer/service filters and assignable printing locations. Backend Production PR #20 is required for `serviceId` filtering.
- A confirmed, undelivered order is required for any transition. Wrong stages/delivered/cancelled are 409; invalid IDs/bodies are 422. UI neither implements parallel state machines nor supports stage-skipping/drag-drop.

## QA
`npm run test:integration`, `npm run typecheck`, `npm run lint`, `npm run build`. UI tests use mocked axios adapter for Laravel contracts.

Manual scenarios needed before merge:
1. Confirm an order with multiple items, verify their cards on the board.
2. Start/complete design as one user; complete as another authorized user, audit both actors.
3. Complete-and-send and standalone send with a selected active printer.
4. Select completed items from multiple orders, send in one batch, confirm rollback if one becomes ineligible.
5. Change the assigned printer, mark ready, undo a ready item and verify rollup in Orders.
6. Verify archived design attachments and authorized previews, responsive RTL, validation/409/403 messages, no duplicate writes on retries.
7. Confirm final physical delivery happens only in Deliveries (never on the board).

Deferred: drag-and-drop, dynamic stage configuration, production-quantity splits and task comments.

## Daily production UX — priority and visible urgency (2026-10-28)

- **Priority is the default** list sort (`sort=priority`): confirmed, undelivered order items are sorted overdue first, then due today, upcoming dates in ascending date order, and finally items without any deadline. For matching dates in the design column, in-progress design comes before completed design; ties use the order item ID for stable paging. Implemented **server-side before pagination**, independently per Kanban column. Existing `dueDate`, `-dueDate`, `-id`, `id` remain available.
- Changed chronological sort labels to explicitly say **موعد التسليم: الأقدم أولًا / الأبعد أولًا** and **العناصر الأحدث / الأقدم**. The latter refer to item IDs, not necessarily the order's creation date.
- Each order group highlights **متأخر** or **تسليم اليوم** (mutually exclusive); both use Cairo-local date, and the due date is displayed DD / MM / YYYY. Missing deadlines get no urgency marker.
- Main KPI cards now match the four board columns. The design card shows its combined count and compact in-progress/completed breakdown. A fifth, separate overdue-order count is a button that toggles the lateness filter; it respects all other active filters. Summary respects permissions and keeps counting all matching items, not only the currently loaded page.
- Compact design responsibility and item action controls reduce card height without losing actual designer identity, last completer, quantity, file actions, workflow permissions or history.
- Renamed the personal-work filter display to **عملي في التصميم**. It still selects items started or completed by the current user, **even after** the item advances to printing.
- Requires backend Production priority sort support on `feature/optional-customer-type-pricing`. No DB migration, status transition, or permission changes.

## Grouped order header with independent item cards (2026-10-28)

- Keep grouping **per order within each currently loaded production column page**. The order summary (order number, customer, phone, due date/urgency) appears once as a visually distinct light-violet header. For groups with multiple items on that column page, the header shows their **visible** count.
- Render **each item as its own bordered white sub-card** below the shared order header. Every sub-card owns its service name, quantity, stage badge, responsible designer (and different design completer where known), optional printing location, details button, and all permission-gated actions.
- In active design, show two clearly separate actions: primary **إنهاء وإرسال** (existing action `complete-and-send-to-printing`, still requires printing-location confirmation) and secondary **إنهاء فقط** (existing `complete-design`, stays in design column). Accessible button labels preserve the full action names.
- Keep item details available as an eye icon with a clear accessible label and tooltip; keep the portal-based overflow menu and stage undo/location operations unchanged. Compact layout reduces multi-row button clutter without merging item operations.
- **No order-wide production action is introduced**. One item can progress to printing/ready independently while another item from the same order stays in design. If different items are in different columns, each column displays its own order header. The batch-send checkbox still selects individual item IDs.
- The backend/API, permissions, file policy, idempotency, stage transitions and grouped-by-page pagination remain unchanged.
