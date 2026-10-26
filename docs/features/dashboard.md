# لوحة التحكم — طَبعة

## Purpose
Dashboard replaces the old static Foundation page at `/` with a useful **read-only, live** operational overview. The layout takes high-level inspiration from a supplied screenshot but follows Tabaa's Arabic RTL palette, existing rounded cards and typography.

## API and authorization
- `GET /api/v1/dashboard` (printingApi PR #26, merged to `develop`), authenticated with Sanctum and restricted to `orders.list`.
- The frontend does not fetch that endpoint when the user lacks `orders.list`; instead it displays available permission-based quick links, with no private order metrics.
- The response has:
  - `asOfDate` in **Africa/Cairo**.
  - `metrics.activeOrders`: confirmed but not delivered (includes orders without a due date).
  - `metrics.overdueOrders`: confirmed, not delivered, due date before Cairo today.
  - `metrics.readyForDelivery`: confirmed, not delivered, production status READY_FOR_DELIVERY.
  - `metrics.dueToday`: confirmed, not delivered, due date equal to Cairo today.
  - `productionPressure`: item counts grouped by stages (not started, design working/finished, printing, ready), **NOT summed printing quantities**.
  - `attentionOrders`: max 6 confirmed undelivered orders with a due date, earliest due date first (overdue first), each with isOverdue.
  - `latestOrders`: max 5 newest confirmed orders, including already delivered orders.
- Draft, cancelled, soft-deleted orders and soft-deleted items do not contribute to active/stage metrics. The backend provides summaries, not frontend-derived counts. No fake data.
- Link to an order detail requires `orders.view`, not merely `orders.list`. Quick actions honor individual permissions (orders.create, production.items.list, deliveries.list / deliveries.ready.view, finance.collections.view / finance.collections.create).

## Layout
1. Title, optional new-order action, manual refresh.
2. Four operational KPI cards.
3. Main two-column content: urgent/near-due orders and latest confirmed orders; pressure bars and quick links on the opposite side.
4. On smaller viewports, cards and columns stack naturally. Progress meters remain keyboard/screen-reader readable with explicit stage labels/counts.
5. Empty, loading, failure and no-permission states show meaningful text; failed requests can be retried.
6. Backend is query-based with bounded lists rather than fetching and filtering all orders on the client.

## Test coverage
- Backend Orders Feature tests validate open/late/ready/dueToday counts, exclusion of drafts/delivered items, stage pressure and nearest due ordering, no-access 401/403.
- Frontend tests validate the live API rendering, empty results, permission isolation (no data request without orders.list), conditional actions and refresh.
- Required CI: PHPUnit/Laravel Orders and other module suites; Vitest, TypeScript, ESLint, Vite build.

## Next
Review the Dashboard visually with actual local Laravel + MySQL data prior to merging frontend PR #12. This Dashboard is the final planned business module for the first operational scope.
