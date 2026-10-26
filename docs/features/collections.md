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
- The frontend permits general receipt reversal (source=0) only. Linked deposits and delivery receipts require handling from the originating workflow; in particular never call Finance reversal on a delivery receipt separately from delivery cancellation.
- Mutations invalidate Collections, Finance, Customers, Orders and Deliveries caches. Authorization is enforced server-side. Buttons also hide when permissions are unavailable.
- Account selectors reuse the existing `getOrderPaymentOptions`, no duplicate service API.

## QA
`npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.

Manual before merge: real MySQL/Sanctum API + Cairo dates, positive amounts/valid destinations, inactive-customer selection permission, duplicate submit and retry, unrelated collections vs delivery reversal, locked customer credit/debt, role visibility, mobile RTL and empty states.

Deferred: source-specific order-linked general collection picker; employee name in the list (API currently exposes `createdBy` ID only); the standalone Finance customer ledger module.
