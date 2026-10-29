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
- Finance `/finance` is **one screen**: customer balances list (when permitted), inline customer account detail, two financial actions (opening balance and credit refund), and an optional expandable refunds-history section. **No tabs, secondary refund route or Dashboard changes.**
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

## Unified one-screen UX refinements
- Selecting an account reveals its details **on the same Finance route**. The accounts register collapses to reduce scrolling; “تغيير العميل” expands it again without resetting the customer's ledger context.
- Account header consolidates opening-balance eligibility and refund action. Opening action is replaced with “الرصيد الافتتاحي مسجل” if server has an opening. Refund action is available only with `finance.refunds.create` and when the known balance is credit-positive; refund-only users choose the customer in the existing modal.
- Single balance card replaces repeated net/debit/credit cards. Label indicates debit, credit or balanced with color; the actual amount still comes from Laravel.
- “سجل رد الأرصدة” is a permission-gated expandable **global refund history** below account details (not a separate tab), loaded only after expansion. View-only refund employees see it directly, without unauthorized account requests. User actions live at account level, avoiding duplicate create buttons.
- The previous `?tab=refunds` navigation is retired; `?customerId=` deep-links continue to work.
- Ledger-only and opening-only roles can switch customers from the inline selector. Both the form and backend still enforce the one-time opening and transactional refund constraints.

## Final compact customer selection UX
- Removed customer-balances register/table, balance-type filters, sort, and customer-list pagination from the **frontend**. The backend aggregated balance endpoint remains available but is not requested by this screen.
- One authorized searchable customer select (`GET /selects?selects=customers`) is always visible for balance, ledger, or opening-balance staff; selection updates the existing `?customerId=` deep link and loads only that customer's Finance balance and ledger.
- A compact account summary displays selected customer's name, phone, current actual balance with type (debit/credit/zero) and whether an opening balance exists. Name and phone are parsed from the existing select label; backend balance remains authoritative and is never client-calculated.
- The financial actions remain in the same summary header: opening balance only when not recorded; refund only for eligible credit or refund-only staff (server still guards all writes).
- Existing ledger with date/type filters, historical running balances and pagination remains unchanged below the selected customer summary.
- Refunds global history remains an optional expandable section, not a tab.
- Roles without Finance balance permission must not request arbitrary account balances or the removed overview endpoint.
- Backend contracts, transaction locks and the one-time opening restriction have not changed.


## Accounts UX revision (2026-10-29)

- First visit to /finance with `finance.balances.view` shows a paginated table of **all customer balances** from the existing `GET /finance/customer-balances` endpoint. Filters: debounced name/phone search, debit/credit/zero status, sorting by highest debt, largest credit, latest or name. The overview is read-only.
- Selecting an account updates `?customerId=` and opens the existing protected individual ledger. The selected-customer header is compact and shows debit/credit balance plus the actual opening balance amount/type when `finance.balances.view` is granted. Back to overview clears the customer.
- The account statement shows backend-provided human-readable `orderNumber`, `receiptNumber` and `refundNumber` instead of raw IDs when present. Each reference links to its specific authorized order or collection receipt details, or opens a refund details dialog. Related order appears as a secondary link for order-related receipt entries.
- Notes are expanded in a dialog, not clipped to an unusable single-line tooltip. Running balances remain computed server-side over the whole ledger history **before** date/type filters; do not treat filtered displayed entries as a recomputed account balance.
- The **customer-specific refund history** is accessible beside the customer balance header, *not* after scrolling through the ledger. It uses `filter[customerId]` on `GET /finance/refunds` so refunds from other customers cannot appear in this view.
- The **global refund history** is a separate screen state `/finance?tab=refunds`, controlled by an explicit top-level action. Refund-only permissions continue to get the global register and can create authorized refunds without seeing protected account data.
- All account and refund date filters use the themed `CreatedDatePicker` calendar, identical to the collections and orders interface, retaining `DD/MM/YYYY` display and `YYYY-MM-DD` API values. No browser-native picker.
- Critical permissions stay separate: balances overview requires `finance.balances.view`; ledger needs `finance.ledger.view`; refund documents require `finance.refunds.view`; collection/related order links only appear for users with respective view permissions.
- Stacked changes depend on backend finance-accounts PR (opening breakdown, ledger refs, customer-specific refunds) and frontend PR #20. Do not merge before QA.


## Account header / refund action discoverability refinement (2026-10-29)
- On an individual customer account, the customer switcher, identity/phone, balance, opening balance and financial actions are consolidated into one compact card. The separate full-width customer selector card is no longer displayed for a selected account.
- For users with `finance.refunds.create`, **رد رصيد للعميل** is always discoverable on a selected account. When current ledger/balance access confirms a debit or zero balance it is disabled, with an explicit contextual explanation shown beside the action. When credit is available, the amount is displayed beside the enabled action.
- Refund action is never rendered for users without refund-create permission. Users authorized for refunds but without account balance/ledger permissions retain their separate refund-only workflow; the backend still validates the available refundable credit at submission.
- **عرض ردود رصيد العميل** stays next to the refund action. The opening balance action appears in the same action row only when eligible.
- Statement rows use denser vertical padding and a more compact primary receipt / secondary order-reference treatment, without hiding audit references or full movement notes.
- Added frontend regression tests for a debtor's disabled refund action, available-credit action, permission hiding and compact account layout.
