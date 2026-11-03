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


## Accounts / global refunds navigation tabs (2026-10-29)

- Replace the page-header toggle button with two RTL, accessible tabs: **حسابات العملاء** and **سجل الردود العام**.
- `/finance` shows the account overview (or selected customer statement using `customerId`). `/finance?tab=refunds` opens the general refund register. If `customerId` is already present, switching tabs preserves it; switching back returns to the same customer's account and filters.
- The refund register is global only in its own tab. The per-customer refund history remains an explicit action inside that customer's account, filtered by `filter[customerId]` and must not be confused with global records.
- Tabs are permission-aware: account access requires account/ledger/opening permissions, general refund register requires `finance.refunds.view`. Users with only refund permissions cannot access account data; users without refund-read permission cannot see the global refunds tab. Refund-create-only user flow remains unchanged.
- Tab controls use proper `tablist`, `tab`, `tabpanel`, `aria-selected` and directionally correct Arabic labels from translation files. The inactive panel does not fetch its protected records.
- Tests cover selecting tabs, URL state and deep links, preserving selected customer, and refund-only access.

## Delivered-work tab: operational report, not a financial statement (2026-11-02)

- The historical **الشغل المستلّم** operational report has a standalone implementation retained in code, but its account tab and extra action are hidden in the current two-tab finance UI. The customer-facing **تقرير التصفية Excel** replaces its role for customer communications.
- It reuses the existing read-only `GET /finance/customers/{id}/settlement` response, but displays/prints/exports **only** `delivered_item` and `delivery_cancellation` rows. Opening balances, receipts, refunds, historical running balances, and undelivered Finance debts are **not** part of this delivered-work report. No new debt or payment is posted by opening it.
- Summary: unique orders with delivered items in the selected period; gross delivered-work value; delivery cancellations; and authoritative backend `deliveredTotal` as the **net** (a work value, not a receivable). The total can be affected by cancellation of a delivery made before the selected period. Empty results are based on delivery rows, not on cash movements.
- The table and output formats show delivery date, order reference (a link only with `orders.view`), item description including dimensions when recorded, quantity, agreed per-piece price, signed value, and negative cancellation rows. Area-unit rates must **not** be presented as the per-piece price.
- The **Print / PDF** and **Excel** outputs use the exact same filtered delivery rows and amounts as the UI, with no client debt or payment columns. Escaping is preserved for untrusted customer/item names and Excel values remain numeric, without spreadsheet formulas.
- Historical finance ledgers, deposits, collection on order/delivery, refunds, accounting settlement confirmation and print evidence remain unchanged. Their independent regressions must continue passing.


## Integrated customer-account settlement and fixed discount (2026-11-02)

- **Basis:** the original V2 finance workspace (#25); the current account UI intentionally has two tabs, ledger and settlement.
- Opening **تصفية الحساب** first displays the saved immutable settlement history. **تصفية جديدة** opens one compact modal containing the cumulative delivered-work cutoff, real current customer funds, fixed discount, optional cash collection and an optional explanatory breakdown.
- Previous **discountsTotal** is shown separately from **netPayments**; neither the UI nor print evidence should treat a fixed discount as money received.
- The fixed-discount field is visible only with \`finance.settlements.discount\`. A nonzero discount needs a reason, cannot exceed the delivered-work balance or real account debit, and cannot create customer credit.
- The actual received amount always starts blank when the balance is positive. **بدون تحصيل الآن** explicitly records a zero-cash settlement: the remaining debt stays outstanding. **دفع كامل المتبقي بعد الخصم** only fills the amount; it never posts on its own.
- Saving the settlement calls the **existing** POST \`/finance/customers/:customer/settlements\`, using the current \`previewHash\` and stable \`Idempotency-Key\`. The server atomically applies discount and optional real receipt dated today. Never call any separate discount or second settlement API.
- Historical evidence keeps the discount, its reason, real cash, receipt, original balance and remaining balance separately; reversal/cancellation warnings from the original backend V2 are preserved. The ledger filter adds the discount movement type.
- Requires backend integrated PR #42 (migration and permission seeders) deployed before the frontend PR #27. Old V2 PRs #25/#40 and the parallel drafts #26/#41 must **not** be merged independently.
- Verify actual currency arithmetic, staff roles, cash receipts, historical snapshots, mobile RTL and printed evidence in staging before deployment.

## Customer-facing settlement account statement Excel (2026-11-02)

- Dedicated Arabic RTL **one-sheet client-facing XLSX** available in new settlement preview, saved settlement result, and each saved history row (one-click).
- The customer-facing settlement report is separate from internal immutable evidence, which remains in the code but is no longer offered as a second on-screen action.
- The client sees **only** customer identity, the selected order reporting period, prominent due/remaining balance, a short summary (opening balance, prior delivered work, delivered work in period, net previous payments, applicable discounts and settled payment), and **only orders delivered during the chosen From/To period**, each with delivery date, order number, item, dimensions, quantity, unit price and total. A detailed per-transaction reversal/refund/payment ledger is intentionally omitted: the internal evidence and Finance ledger remain available for audit.
- The modal now has **بداية فترة التصفية** (`dateFrom`) and **الشغل المستلّم حتى** (`dateTo`). Both dates are persisted by the backend on confirmation, with automatic defaults after the previous saved settlement, or the first of the month when none exists. This is the saved reporting period, not a filter on the cumulative financial due. The client report shows verified cash posted since the prior settlement.
- **Draft:** re-read the latest backend preview before exporting; always label as NOT posted. Valid entered discount and cash can appear only as proposals, with projected balance explicitly hypothetical, not a receipt. Stale preview rejects proposed figures until user refreshes.
- **Saved:** re-fetch individual saved snapshot and review flag; actual collected cash and actual discount are separate, remaining balance historical, and a later reversal/refund triggers a clear warning.
- Numerics/dates use Excel value types; customer strings are escaped inline text, preventing formula injection. The existing settlement POST now carries `dateFrom`; an additive migration adds nullable `scope_from`, while `scope_to` already stores the end. Never leak idempotency keys, internal identifiers or internal operator notes.
- Verify `npm test`, `npm run typecheck`, `npm run lint` and `npm run build` before merge; check customer-facing statements against actual receipts in staging.


### Statement since the last settlement (2026-11-03)

- The client statement defaults **بداية فترة التصفية** to the day after the **last saved settlement's delivery cutoff** (`dateTo`), or to the beginning of the selected month if none exists. The saved **إلى** date remains the official delivered-work cutoff. Changing the start does not alter the backend cumulative account balance, but it is now saved as immutable period metadata upon confirmation.
- Before posting a new settlement, the customer Excel says **تصفية جديدة — لم تُسجّل بعد** and shows no invented current settlement number. It shows the most recent actual settlement number, saved date, delivery cutoff and remaining amount from that immutable record.
- The account bridge between that previous recorded settlement and the live preview reconciles: previous recorded remainder + newly delivered work + any delivered-work adjustments − **net actual customer payments** − saved non-cash discounts + other movements = the server-authoritative amount now due. It never treats a draft collection as paid cash.
- Payments are selected by `sourceManifest.ledgerMaxId` from the prior saved **after** snapshot, **not simply effectiveDate**: receipts and reversals on the same calendar day are distinguished correctly. Client Excel lists receipt/date, collection/reversal/refund and signed money amount, alongside the subtotal. If no prior settlement exists, display movements from the chosen date onward and carry other account activity into the opening summary.
- A previously saved settlement export uses its immutable `snapshot.before` and the *preceding* saved settlement, never the newest current balance or the settlement itself as its own previous settlement. The settlement being exported may display its recorded number and real collected amount; post-settlement transactions are never fabricated.
- Previous saved statements are discovered through the existing paginated history and individual show GET endpoints; no new route or extra POST. Saved settlements now expose `dateFrom` from their immutable date column, if available. If a historical snapshot lacks the required ledger high-water mark, the report rejects rather than guessing which same-day payments happened after the prior settlement. Historical reversal/review warnings remain intact.
- Before confirmation, the operator can change the proposed start date (never before the prior settlement cutoff). After confirmation, `dateFrom` and `dateTo` are read-only and shown from the stored record; old rows with NULL `dateFrom` explicitly show an unknown start and permit only a legacy report-time override.

### Persistent settlement period and simplified action UI (2026-11-03)

- Finance accounts retain two tabs: **كشف الحساب** and **تصفية الحساب**. No visible **تقرير الشغل فقط** button or separate work report in either the history or saved result. The retired work-report component and its independent export code remain available internally for future needs.
- **بداية فترة التصفية** and **الشغل المستلّم حتى** are submitted together as `dateFrom` and `dateTo` on confirmation. Backend PR #43 adds `scope_from` (nullable to preserve historical unknown starts), writes both atomically with the settlement receipt/discount and returns them via `dateFrom` and `dateTo` in history, saved detail and store.
- The start auto-defaults to the day after the previous settlement cutoff, or the first day of the month for the first settlement, and can be edited within the permitted range. Legacy clients omitting `dateFrom` receive a server-computed stored start. The cumulative accounting algorithm remains unchanged.
- New saved settlement records display **فترة التصفية** using the two dates actually stored. Old records with `scope_from = NULL` display **غير مسجّل**; no historical backfill or fabricated period. Legacy record reports can use a clearly marked report-only date picker.
- In the saved result the only customer-facing Excel action is **تقرير التصفية Excel**. The extra **مستندات وإثباتات** menu and visible work-only report button are removed. Internal evidence print/export generators remain in the repo (not exposed in this screen). A posted collection receipt link remains when permitted.
- The client Excel uses stored `dateFrom` first when present, making the report period align with the immutable settlement. Old NULL-start records display an explicit legacy-period caveat.
- Backend must be deployed **before** frontend and migrated (`php artisan migrate --force`). Frontend PR #28 and backend PR #43 are kept Draft until CI/manual QA; no production migrations or deployment from this change.

### Refund history consolidated into the customer accounts UI (2026-11-03)

- **Presentation-only change.** Remove the top-level **سجل الردود العام** tab beside **حسابات العملاء**. The refunds register is still accessible via a quiet **سجل ردود الأموال** action in the page header for authorized users, with **العودة لحسابات العملاء** navigation. The legacy `?tab=refunds` deep link continues to open the global refunds register directly, without loading private customer balances.
- For a selected customer, **كشف الحساب** already contains refund movement type `5` and access to the linked immutable refund document (only when staff has `finance.refunds.view`). Add a quick **ردود الأموال فقط** toggle next to the existing date and full movement-type filters. It uses exactly the same server ledger `filter[type]=5`; no duplicate financial computation or frontend filtering of a paginated list.
- Keep customer-scoped refund history (`?view=refunds`) reachable from **إجراءات أخرى** for staff with `finance.refunds.view`, with its original search/date/payment method filters and its original `RefundDetailsDialog`. Keep global refunds history accessible even if a role has only `finance.refunds.view` and not `finance.ledger.view` or `finance.balances.view`.
- **Create Refund remains fully functional**: the selected-customer action **رد رصيد للعميل** and a single **رد رصيد دائن** create action within the global refunds history for `finance.refunds.create`. The existing `CreateRefundDialog`, `POST /finance/refunds`, idempotency key, available-credit guard, payment method/destination, reason, physical payout acknowledgment, query invalidation, and ledger balance updates are untouched.
- This change does not add/change any backend API, controller, DB table, migration or authorization. Separate refund money from order returns and from canceled collections; the account ledger still shows these as different movement types.
- UI tests cover permissions, legacy links, global and customer scope separation, refund-only viewers, posted refund visibility in ledger, one-click server filter, refund detail lookup, and a single POST for creation.
