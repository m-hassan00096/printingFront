# Deliveries Frontend — Phase 1

Backend source: `printingApi` `develop` (Deliveries + Orders/Finance adapters).

## Screen
- `/deliveries` replaces the placeholder; permission-aware tabs for `deliveries.ready.view` and `deliveries.list`.
- **Ready tab:** paginated eligible confirmed, undelivered orders with at least one ready item. Partially ready orders are shown but never display a handover action; backend `canDeliver` and final POST eligibility are authoritative.
- **History tab:** paginated deliveries, immutable handover timestamp in Africa/Cairo, status/date/search filters, original `receivedAmount` and current `effectiveReceivedAmount` separated.
- Detail modal and cancel controls are restricted by `deliveries.view` / `deliveries.cancel`. Order link appears only with `orders.view`.

## Handover
- Fresh `GET /deliveries/ready/{order}` preview is loaded before posting.
- Defaults to `collectedAmount:"0.00"`, no payment method or collection is sent for a free handover.
- If positive, `finance.collections.create` permission is required by backend. Cash=0, bank=1, wallet=2; destination ID required for bank/wallet.
- Optional receiver is only a display name; authenticated user and delivery timestamp come from Laravel.
- Balance estimate uses integer cents. When payment would make the overall balance credit-positive, explicit `confirmCreditBalance` is required; server rechecks under lock.
- Payment account choices reuse existing `getOrderPaymentOptions` and `GET /selects?selects=bankAccounts,eWallets`.
- On 403/409/422 the operation does not navigate away; Laravel's error message is shown.

## Cancellation
- Required reason (3–3000 chars), and when the linked delivery collection remains active, a physical-funds-settlement acknowledgement is required.
- A single `POST /deliveries/{id}/cancel` restores the order's ready state and reverses exactly that collection atomically; never call `/finance/collections/{id}/reverse` separately.
- Both writes require an `Idempotency-Key`. The key is reused when the exact same payload is retried after an uncertain failure, and removed only after success.
- Successful writes invalidate Deliveries, Orders, Production, Finance and Customer caches.

## QA
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- Manual Laravel/MySQL browser tests still necessary before merge: physical handover vs ready state, bank/e-wallet categories, permission variants, 409 on concurrent delivery, cancellation after a reversed collection, balance confirmation race, and empty states/mobile RTL.

## Delivery handover UX polish (2026-10-28)

- Ready-order cards show customer/order details once; use a semantic readiness badge, overdue/today due-date chips, DD/MM/YYYY delivery date, and a compact item list. Full-ready items omit repeating individual ready badges. No partial handover action is exposed.
- Ready filters use one desktop row: search, sort, and a disabled-when-empty reset button. History filters use the same theme-matched Gregorian date picker as Orders, preserving `YYYY-MM-DD` API parameters.
- Delivery preview explicitly distinguishes **order total** from **customer's overall account balance**, including all prior orders. An old balance does **not** block handing over the current ready order.
- Collection is optional and defaults to **0.00**. Buttons preset **بدون تحصيل** or **قيمة الأوردر** without posting anything. Positive amounts reveal cash/bank/e-wallet and destination selection; permission rules, credit consent, precise integer-cent balance math and idempotent single-operation handover remain unchanged.
- The estimate panel exposes starting account balance, amount collected now, and expected after-collection balance (which the backend recalculates under lock).
- Inline field validation from Laravel `422` errors focuses and scrolls to the affected control, while general workflow errors remain visible. Successful handover toast includes the order number.
- All backend request/response contracts and finance settlement workflows remain unchanged. Browser QA should verify real payment destinations, permission configurations and small-screen dialog scrolling.
