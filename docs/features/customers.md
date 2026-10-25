# Customers Frontend — طَبعة

**Branch:** `feature/customers` from frontend `develop` after Settings PR #3.
**Backend:** `printingApi/develop` includes Customers and the shared Settings Selects API. Do not request `/customers/customer-types`.

## Pages

- `/customers` — list customers, search by name/phone, filter status/customer type, supported sort keys, pagination; actions gated by customer permissions.
- `/customers/:id` — customer details, edit modal, permission-gated Finance balance and ledger, future Orders placeholder.
- Add/edit are modals, not routes. Validation errors from Laravel 422 are shown inline and cleared on editing the corresponding field.
- Deletion requires confirmation. Existing Orders/Finance reference guards can reject deletion; report server message instead of bypassing protections.

## Exact APIs

| Method | Path | Response data | Permission |
|---|---|---|---|
| GET | `/api/v1/customers` | `{customers: Customer[], pagination}` | `customers.view` |
| GET | `/api/v1/customers/{id}` | `Customer` | `customers.view` |
| POST | `/api/v1/customers` | `Customer` (201) | `customers.create` |
| PATCH | `/api/v1/customers/{id}` | `null` | `customers.update` |
| DELETE | `/api/v1/customers/{id}` | `null` | `customers.delete` |
| GET | `/api/v1/selects?selects=customerTypes` | `[{label:"customerTypes",options:[{value,label}]}]` | `settings.selects.view` (or customer read/write rights after ACL update) |
| GET | `/api/v1/finance/customers/{id}/balance` | `{customerId,amount,type,typeLabel}` | `finance.balances.view` |
| GET | `/api/v1/finance/customers/{id}/ledger` | `{entries,balance,pagination}` | `finance.ledger.view` |

All amounts are decimal strings, **Finance balance type is integer enum 0=zero,1=debit,2=credit**. Do not derive an account balance from frontend summation. Ledger filters are `filter[dateFrom]`/`filter[dateTo]` and pagination.

Customer type options come from the shared Selects registry and contain only active assignable types. The UI must locate the entry whose `label` is `customerTypes` and use its `options` array, not treat the Selects envelope as a flat list.\n\nThe Customer resource fields are `id,name,phone,address,customerTypeId,customerType:{id,name}|null,status,statusLabel`. Store requires `name,phone,customerTypeId,status`; address optional. Update supports partial PATCH and the UI sends only changed fields. Backend requires an assignable active type if `customerTypeId` changes.

Search/filter keys: `filter[search]`, `filter[status]`, `filter[customerTypeId]`. Allowed sorts include `id`, `-id`, `name`, `-name`, `created_at`. Pagination is `page` and `perPage`.

## Verification

Automated integration tests in `tests/customers-flow.test.tsx` mock only the transport, not API schema; GitHub CI runs tests, TypeScript, ESLint and build. Real local browser tests with Laravel/MySQL and permissions are required before merging `feature/customers` to `develop`.

## Local setup

```powershell
cd C:\xampp\htdocs\printingApi
git switch develop
git pull --ff-only origin develop
php artisan optimize:clear

cd C:\xampp\htdocs\printingFront
git fetch origin
git switch --track origin/feature/customers
npm ci
npm run dev
```

If the frontend branch already exists locally, use `git switch feature/customers` and `git pull --ff-only origin feature/customers` instead. Protect existing local edits before switching branches.
