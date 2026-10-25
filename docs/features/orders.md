# Orders Frontend — طَبعة

## Integration status

- Frontend branch: `feature/orders` from `develop` after Printing Services PR #5.
- Backend source of truth: `printingApi/develop`, `Modules/Orders` plus Finance and Settings Selects.
- Orders select permissions dependency: Backend PR #18 permits order creators to read `activeCustomers` and `printingServices` and order confirmers to read `bankAccounts` and `eWallets` **without unrelated management rights**.
- No migrations or bespoke frontend pricing calculations.

## API contracts

| Verb | Route | data | Permission |
|---|---|---|---|
| GET | `/api/v1/orders` | `{orders,pagination}` | `orders.list` |
| GET | `/api/v1/orders/{id}` | `OrderResource` with `items`, conditionally `files` | `orders.view` |
| POST | `/api/v1/orders` | `null`, HTTP 201 | `orders.create` |
| PATCH | `/api/v1/orders/{id}` | `null` | `orders.update` |
| DELETE | `/api/v1/orders/{id}` | `null` (draft only) | `orders.delete` |
| POST | `/api/v1/orders/{id}/items` | `null` | `orders.items.create` |
| PATCH/DELETE | `/api/v1/orders/{id}/items/{itemId}` | `null` | `orders.items.update` / `orders.items.delete` |
| POST | `/api/v1/orders/{id}/confirm` | `null` | `orders.confirm` |
| POST | `/api/v1/orders/{id}/cancel` | `null` | `orders.cancel` |
| GET | `/api/v1/orders/{id}/activities` | `{activities,pagination}` | `orders.activities.view` |
| GET | `/api/v1/orders/{id}/items/{itemId}/files` | `OrderFile[]` | `orders.files.list` |
| POST | `/api/v1/orders/{id}/items/{itemId}/files` | Uploaded `OrderFile`, 201 | `orders.files.upload` |
| GET | `/api/v1/orders/{id}/items/{itemId}/files/{fileId}` | Binary | `orders.files.view` |
| DELETE | `/api/v1/orders/{id}/items/{itemId}/files/{fileId}` | `null` | `orders.files.delete` |

`POST /orders`, `POST /orders/{id}/confirm`, and `POST /orders/{id}/cancel` require `Idempotency-Key`. Keep one key per user operation and reuse it for retry. Do not invent an order ID from creation: the API returns `data:null`, so navigate to the orders list.

### Status and production enums

- Order status `0` draft, `1` confirmed, `2` cancelled.
- Production status `0` not started, `1` in production, `2` partly ready, `3` ready for delivery, `4` delivered; drafts have `null`.
- Order source `0` branch, `1` online.
- Delay status comes from Laravel's `delayStatusLabel`, not from client date math.
- Order number is **null until confirmed**.

List filters: `filter[search]` (name/phone/number), `filter[status]`, `filter[productionStatus]`, `filter[lateOnly]=1`, `sort` (`id,-id,created_at,-created_at,due_date,-due_date`), `page`, `perPage`.

### Draft creation and items

```json
{
  "customerId": 5,
  "source": 0,
  "dueDate": null,
  "notes": null,
  "status": 0,
  "items": [
    {"serviceId": 11, "quantity": 100, "specifications": "مطفي", "agreedTotal": "350.00"}
  ]
}
```

- A saved draft can have its source, due date, notes and item details changed; only drafts are editable.
- `agreedTotal` is an explicit string decimal set by staff. Suggested prices are available from `POST /printing-services/price-preview`, but are **only applied when the staff clicks “اعتماد السعر”**, never automatically.
- One draft must always have at least one item. Deleting an item archives related files using the backend's private-file archive logic. No frontend filesystem operations.
- Using an unchanged service while editing an item preserves snapshots; the original backend prevents editing confirmed items.
- Customer and printing-service pickers come from `GET /api/v1/selects?selects=activeCustomers,printingServices`. New draft items fetch `printingServices` alone. Readonly customer type is fetched via existing Customers API for optional customer-specific price suggestions when permitted.
- Each uploaded file is sent via `FormData` in `file` field. Backend limit 100 MiB; downloadable through the authenticated file route.

### Confirmations

- Confirm modal submits zero/no deposit or an optional cash/bank/wallet deposit.
- `depositAmount` string decimal; positive amount requires `paymentMethod`: 0 cash, 1 bank, 2 e-wallet.
- Bank and wallet deposit require an active `paymentDestinationId` obtained from `GET /api/v1/selects?selects=bankAccounts,eWallets`; options only fetched for noncash positive deposits.
- Cancel requires reason 3–3000 chars and uses its own idempotency key.
- Finance posts actual customer debt and any deposit in the backend transaction. Client never computes customer accounting liability.

## Scope intentionally deferred

- Payment with existing customer credit is governed by Finance APIs; do not invent an unsupported order credit offset request.
- Order production stage advancement belongs to the Production module, not to the Orders create form.
- Detailed balance, collections and refunds belong to Finance/Collections UI.
- More advanced PDF/media file previews and customer search autocomplete may follow live testing.

## Order creation UX (current)

- Customer and service selection use **single searchable comboboxes**, not a separate search input plus native select. Customer search matches the text/phone label of the existing `activeCustomers` Selects API; service search is per order line.
- Users with `customers.create` can open the shared Customer modal directly from the combobox. `POST /customers` returns the new resource, which is selected immediately; the Orders Selects cache is invalidated and refreshed.
- The new form keeps individual order lines compact: service, quantity and agreed total on one row; optional specifications expand on demand.
- Each line can request a price preview from the backend. Its suggested price **never replaces** `agreedTotal` until the user clicks “استخدام السعر”.
- Local summary uses integer cents for *display only*: item count, order amount, paid-now amount and remainder. The backend still validates/posts all finance values.
- Two explicit submit choices use the **same** `POST /api/v1/orders` route: “حفظ مسودة” = `status:0`; “تأكيد الأوردر” = `status:1` and requires `orders.confirm`. Payment data is included only in the confirmed operation with positive deposit.
- Bank and wallet choices come from the existing Selects response. `isDefault:1` selects the default *automatically*, independently for each payment method. Staff can still change the choice. If there is no configured default, the first active destination is selected; with none available, confirmation is blocked with validation.
- Existing draft confirmation also automatically chooses the default bank or wallet.
- Larger-than-total deposits require a deliberate checkbox acknowledgement that the excess becomes customer credit, subject to authoritative backend accounting.
- Customer's previous net ledger balance appears only with `finance.balances.view`, clearly separated from the amount outstanding on the *new* order.
- Uploading files is still performed against a saved draft and is not part of immediate create-and-confirm; the UI explicitly tells staff to use the draft path when design files are required.
- Order creation responses are `data:null`; redirect to list on success, never infer an ID. Retries reuse the same idempotency key for an unchanged request payload, and rotate it if the payload changes.
- Arabic labels, per-field errors and sticky bottom action buttons are used throughout.

## QA before merging

1. Create multiple items using searchable comboboxes; create a customer inline and verify it is selected, validate 422 errors and agreed totals.
2. Save draft, verify it appears without a number; modify header, edit/add/remove items, upload/download/archive files.
3. Confirm **directly from creation** with no deposit, cash deposit, bank and wallet (preselected defaults), and also confirm saved drafts; verify order number generated and Finance ledger updated.
4. Try 409 actions: delete confirmed order, cancel already-delivered order, remove last item, reused idempotency key.
5. Permission-check list/view/create/update/confirm/cancel and individual file actions; ensure no other Settings selects are exposed.
6. Check date, pagination, lateOnly and production status filters.

CI runs unit/integration mock-transport tests, typecheck, ESLint and production build. A local live Laravel/MySQL smoke test remains mandatory before merging the frontend Draft PR.
