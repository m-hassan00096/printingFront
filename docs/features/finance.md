# Customer Finance — phase 1

## Purpose
Standalone `/finance` account workspace for financial staff, complementary to the existing Customer details / Ledger tab.

### Backend contracts
Uses existing Laravel Finance APIs:
- `GET /selects?selects=customers` (including inactive customers: payments and historical balances remain valid)
- `GET /finance/customers/{id}/balance` — `{customerId,amount,type,typeLabel}`, where 0=zero, 1=debit and 2=credit.
- `GET /finance/customers/{id}/ledger?page=&perPage=&filter[dateFrom]=&filter[dateTo]=&filter[type]=` — `entries,balance,pagination`. Enum types 1 order debt, 2 collection, 3 order cancellation, 4 collection reversal, 5 refund, 6 opening balance.
- `POST /finance/customers/{id}/opening-balance` with `{amount:decimal string,type:1|2,note?}`, returns `data:null` (201).

### Permissions
- finance.balances.view: balance cards.
- finance.ledger.view: movement register and ledger balance.
- finance.opening_balances.create: one-time opening balance form. Users with create-only access can open the workspace without reading historical balances.
- customers.view and orders.view are *optional*: profile/order links are hidden without permission.
- Backend PR #23 expands only customer dropdown authorization for Finance workers; it does **not** grant Customers CRUD.

### Financial invariants
- Finance writes/reads are always server-authoritative and immutable. No client-side balance adjustments or per-order payment allocation.
- Opening balance is unique per customer; server rejects a duplicate with 409. Form requires positive decimal amount, debit/credit type and explicit one-time confirmation.
- Ledger `signedAmount` controls debit vs credit direction. Original absolute amount is kept for display; no history is deleted.
- Date picker displays DD/MM/YYYY but the API uses YYYY-MM-DD, as in Collections.
- Ledger read filters support date range and type only; no unsupported sort or status filters are sent.
- Invalidate both Finance and existing Customer balance/ledger query keys after opening balance creation.

### Scope deferred
- Full customer financial overview with a *server-side paginated aggregate balances endpoint*, instead of making one API request per customer. The existing API exposes balances for one customer at a time.
- Customer name and phone search are provided through selects; client does not invent customer financial totals.
- Actual browser/role testing with connected local backend and MySQL is still required before merging frontend PR #10.

## QA
`npm test`; `npm run typecheck`; `npm run lint`; `npm run build`.
Backend PR #23 exercises customer-select permission boundaries, including inactive customers and rejecting Customers CRUD for Finance-only roles.
