# Settings — Frontend implementation

**Branch:** `feature/settings` (based on `develop` after Identity PR #2)
**Backend:** `m-hassan00096/printingApi` → `develop` (Settings module and parameter groups PR #12)

## Screens

`/settings` is a real, permission-aware management page with four tabs:

1. أماكن الطباعة — parameter values for `printing_locations`
2. أنواع العملاء — parameter values for `customer_types`
3. الحسابات البنكية — Bank Accounts
4. المحافظ الإلكترونية — E-Wallets

Each tab loads from the backend, supports search/status filters and pagination, and shows create/edit/delete only when the signed-in user has the matching permission. Dialogs validate fields locally and surface backend 422/409 failures. Payment destinations support `isDefault`. Avoid hardcoded IDs, mock production data, or separate frontend permission stores.

## Real backend contract

| Operation | Endpoint | Access |
|---|---|---|
| Group IDs | `GET /api/v1/settings/parameter-groups` | `settings.view_parameter_values` |
| Parameter values | `GET/POST /api/v1/settings/parameter-values` | matching `settings.*_parameter_value*` |
| Parameter value | `PATCH/DELETE /api/v1/settings/parameter-values/{id}` | matching write permission |
| Bank accounts | `GET/POST /api/v1/settings/bank-accounts` | `settings.bank_accounts.view/create` |
| Bank account | `PATCH/DELETE /api/v1/settings/bank-accounts/{id}` | `settings.bank_accounts.update/delete` |
| E-wallets | `GET/POST /api/v1/settings/e-wallets` | `settings.e_wallets.view/create` |
| E-wallet | `PATCH/DELETE /api/v1/settings/e-wallets/{id}` | `settings.e_wallets.update/delete` |

The group response is `data.groups: [{id,name}]`; valid group names are `customer_types` and `printing_locations`. **Group IDs are obtained from the real backend**, never assumed to be 1 or 2. The list of parameter values requires `parameterId` as query parameter and returns `data.parameters`. Other lists return `data.bankAccounts` and `data.eWallets`. Pagination is `data.pagination`. All writes use camelCase JSON.

- Parameter value fields: `name`, optional `description`, `status`, and `parameterId` on create only.
- Bank fields: `bankName`, `accountNumber`, `status`, optional `isDefault`.
- Wallet fields: `name`, `phone` (Egyptian mobile format), `accountHolder`, `paymentLink`, `status`, optional `isDefault`.
- Status/default values are numeric `0 | 1`.
- Data may not be deleted/deactivated if other modules depend on it; backend guards remain authoritative.

## Verification

- GitHub CI for `feature/settings` runs `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build`.
- `tests/settings-flow.test.tsx` verifies group-ID lookups, bank creation and edit payloads, and UI permission restrictions.
- **Still to verify manually:** connect to local Laravel/MySQL and smoke-test all four tabs including delete/conflict, inactive status, defaults, and no-permission accounts. Do not merge Settings to develop until browser smoke tests/review are complete.

## Local setup

```powershell
# printingApi: pull develop with PR #12
git switch develop
git pull --ff-only origin develop
php artisan optimize:clear

# printingFront
git fetch origin
git switch --track origin/feature/settings
npm ci
npm run dev
```

Existing local work must be saved before switching branches. The frontend Settings feature is intended to remain on `feature/settings` until reviewed.
