# Collections — Frontend Phase 1

Backend contract verified from printingApi `develop`: `GET /finance/collections`, `GET /finance/collections/summary`, `GET /finance/collections/{id}`, `POST /finance/collections`, `POST /finance/collections/{id}/reverse`.

## UI
- `/collections` is an RTL receipt register with search, inclusive date filters, method/source/status filters, sort and pagination.
- Summary uses the same filters *except status*, as required by the backend: totals include only POSTED collections.
- Receipt details show immutable identity, source, original amount, status and reversal reason.
- New GENERAL customer collection supports active or inactive customers (customer `selects=customers`) and cash/bank/wallet method; bank or wallet requires one active destination. No client-side deposit allocation.
- User-selected `collectedOn` is optional and cannot be future-dated; backend defaults to current Africa/Cairo date.
- The POST is idempotent, and new receipt response is `201` with `data: {id,receiptNumber}`, not `data:null`. The frontend uses that exact response.
- No direct editing/deletion of financial documents. A reversed record remains visible in history.
- Any **POSTED** receipt (general, order deposit or delivery source) can be corrected via **عكس التحصيل** with `finance.collections.reverse`, a mandatory reason and a second acknowledgment. It creates an opposite ledger entry and records audit details while preserving the original collection, order and delivery. The backend has always allowed this correction; the previous UI restriction to general receipts has been removed.
- If the delivery is later cancelled after its collection was already reversed independently, its finance adapter recognizes the reversed state and does not post a second reversal. Cancellation and reimbursement are distinct operations.
- If money was actually received and must be returned, use the separate **رد رصيد** workflow in `/finance?customerId=...`, subject to available refundable credit and `finance.refunds.create`; reversal does **not** transfer money back to a customer.
- The existing two-column receipt details layout remains unchanged. Reversed receipts display reason and reversal timestamp; view-only users cannot reverse.
- Mutations invalidate Collections, Finance, Customers, Orders and Deliveries caches. Authorization is enforced server-side. Buttons also hide when permissions are unavailable.
- Account selectors reuse the existing `getOrderPaymentOptions`, no duplicate service API.

## QA
`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

Manual before merge: real MySQL/Sanctum API + Cairo dates, positive amounts/valid destinations, inactive-customer selection permission, duplicate submit and retry, unrelated collections vs delivery reversal, locked customer credit/debt, role visibility, mobile RTL and empty states.

Deferred: source-specific order-linked general collection picker; employee name in the list (API currently exposes `createdBy` ID only); the standalone Finance customer ledger module.

## UI refinement (October 26, 2026)
- Filters use a compact single-row layout on wide screens. Search, period and payment method are immediately visible; source, status and sort live under an expandable "فلاتر إضافية" group. Active advanced criteria remain indicated by a count after collapsing, and "مسح الفلاتر" resets both groups.
- Summary cards are explicitly labeled "ملخص التحصيلات المعتمدة فقط", clarifying that they exclude reversed transactions. They respect all supported filters except status, per Laravel's summary endpoint contract.
- The receipt register shows the result count **above** the rows, retains readable details controls, aligns numeric values, and dims—but never hides, zeroes or strikes—the original amount of a reversed receipt.
- Cairo UI dates are displayed in `DD/MM/YYYY` with a native date picker. API request/response values remain `YYYY-MM-DD`. Format changes are presentation-only, including the create form and receipt details.
- Secondary text contrast and compact form heights have been tuned; no new backend endpoints are needed.
- Tests cover advanced filters, summary-status independence, ISO-backed localized dates, result count, permissions and existing finance flows.


## Atomic amount correction UI (October 29, 2026)

- Adds **رقم الأوردر** immediately after the source column for deposit and delivery receipts, showing the true order number; only users with `orders.view` get a clickable link. General collections show a dash.
- Details preserve the established two-column layout and show order number when the receipt has a linked deposit/delivery source.
- Authorized users with `finance.collections.correct` see **تصحيح المبلغ** on posted receipts. Input is the corrected absolute amount and mandatory reason. Same-amount replacements are blocked; `0.00` reverses without replacement.
- Correction submits one idempotent `POST /finance/collections/{id}/correct` with `amount`, `reason`, and optional delivery-credit acknowledgment. The backend preserves source/method/order/delivery, creates the audit chain, and validates conflict/credit cases.
- Existing independent **عكس التحصيل** and refund flows are unchanged. Correction does not transfer funds; a separate refund is required if money was actually returned.
- Required backend: printingApi PR #30, migration and finance permission seeder. Do not deploy frontend alone. Run frontend CI and manual real-API regression before merging.
