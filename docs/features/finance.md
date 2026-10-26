# Customer Finance — phase 1

## Purpose
Standalone `/finance` account workspace for financial staff, complementary to the existing Customer details / Ledger tab. The landing page is the **paginated customer balances register** for finance.balances.view holders; selecting one account opens its ledger. Ledger-only/opening-only users retain a customer selector instead of seeing unauthorized balances.

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

## Phase 2 — accounts overview + running history
- `GET /finance/customer-balances?page=1&perPage=20&sort=-id&filter[search]=&filter[type]=`: paginated `accounts` with name, phone, openingBalanceExists and amount/type. Optional account filters: search by name or phone, type = 0 zero / 1 debit / 2 credit, sort = id/name/balance variants. Backend uses one SQL aggregate over all customer ledger rows, **not per-customer N+1 API calls**. Access requires `finance.balances.view`.
- `GET /finance/customers/{id}/opening-balance-status`: returns `openingBalanceExists`, authorized with `finance.opening_balances.create` even when employee cannot read balances/ledger. The form is hidden when already registered; the existing transactional server 409 guard still prevents races.
- Balance and ledger endpoints also expose `openingBalanceExists`.
- Ledger entries now expose `runningBalance:{amount,type,typeLabel}` computed by MySQL/SQLite window functions over **all** entries by `effective_date ASC, id ASC` before filters and pagination. UI displays this immutable historical running balance for each row, even when ledger is filtered to only collections.
- Account registry includes inactive registered customers with existing balances, zero-balance clients, and sorting/filtering/pagination. No grand total is inferred from visible rows.
- Show primary card label as 'رصيد مدين' / 'رصيد دائن' / 'الرصيد متوازن'. Original absolute amounts and reversal movements are kept unchanged.
- Integration tests in Backend PR #24 and Frontend PR #10 include aggregate filters, stable running balances, and opening status permissions. CI must pass before browser review.

## Phase 3 — Refunds inside customer accounts
- Finance `/finance` contains two permission-aware tabs: Customer Accounts and Refunds. Standalone Refunds route/module **not** created. Dashboard remains deferred.
- `finance.refunds.view` lists immutable refunds with search (refund number/customer/phone), date, payment method, details and pagination. A view-only user does not read account balances/customer selects.
- `finance.refunds.create` opens a mandatory-confirmation form, permitted even without balance/ledger/list permissions. Customer select is authorized separately (backend PR #25).
- `GET /finance/customers/{id}/refundable-credit` is restricted to refund creators; returns `availableCredit` and `canRefund`. It is advisory only; the POST re-checks against latest customer ledger credit **under row lock**.
- Refund POST `/finance/refunds` accepts customerId, decimal-string amount, paymentMethod 0/1/2, optional paymentDestinationId for bank/wallet and a required 3–3000 character reason. It requires a request-stable `Idempotency-Key`.
- Refund date/number/author come from the server. The client cannot choose or backdate the refund effective date.
- The UI requires explicit confirmation that the **physical money return has been completed**; posting a refund records a ledger entry but does not execute cash movement or bank transfer.
- Positive amount cannot exceed displayed customer credit; a concurrent change returns HTTP 409 and no refund ledger entry is posted. No deletion/reversal of posted refund from the UI.
- Creating a refund invalidates finance balances, accounts overview, ledger, refund list and existing Customer detail caches.
- Credit accounts show a direct 'رد الرصيد' shortcut preselecting the customer.
- Bank/wallet dropdowns use Settings-owned `/selects?selects=bankAccounts,eWallets`, authorized for finance.refunds.create without management access.
- Backend PR #25 provides least-privilege credit preview and dropdowns; Frontend PR #11 provides UI and integration tests. Keep both draft until CI and local browser QA.
