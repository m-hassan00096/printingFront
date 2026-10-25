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

## QA before merging

1. Create multiple items, search/select an existing customer and active services, validate 422 errors and agreed totals.
2. Save draft, verify it appears without a number; modify header, edit/add/remove items, upload/download/archive files.
3. Confirm with no deposit, cash deposit, bank and wallet destination; verify order number generated and Finance ledger updated.
4. Try 409 actions: delete confirmed order, cancel already-delivered order, remove last item, reused idempotency key.
5. Permission-check list/view/create/update/confirm/cancel and individual file actions; ensure no other Settings selects are exposed.
6. Check date, pagination, lateOnly and production status filters.

CI runs unit/integration mock-transport tests, typecheck, ESLint and production build. A local live Laravel/MySQL smoke test remains mandatory before merging the frontend Draft PR.
