# Production Frontend — Phase 1

Source: `printingApi` `develop` Production static workflow (verified 2026-10-26).
Status: feature branch; not merged into `develop`.

## Board and navigation
- `/production` replaces the placeholder under the existing `production.items.list` route policy and sidebar item.
- Four columns, each with independent paginated `GET /production/items?filter[column]=0|1|2|3` calls. Column 1 contains stages 1 and 2; column 3 is ready-for-delivery stage 4.
- `GET /production/summary` is shown only with `production.summary.view`; counts refer to all matching items, not the current page. A board column groups the *currently loaded page* by order; one order can span multiple columns/pages.
- Search by order/customer/phone/service, searchable customer (`activeCustomers`) and printing service (`printingServices`) selectors, personal design-work filter (started/completed), lateness, sort. Selecting a service sends `filter[serviceId]` to board and summary; the backend uses `order_items.printing_service_id` before pagination to keep counts accurate. On mobile, choose one visible stage while other stage data remains cached.
- Detail modal shows item metadata, history (`production.history.view`) and existing order attachments when Orders read/file permissions allow it. File actions are view-only here; uploads remain in Orders.

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
