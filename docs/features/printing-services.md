# Printing Services — Frontend implementation

**Backend source:** `printingApi/develop` — `Modules/PrintingServices`.
**Frontend branch:** `feature/printing-services` (created from `develop` after Customers PR #4).
**Backend dependency:** PR #17 merged; the existing `customerTypes` Select now permits Printing Services staff.

## Screens and permissions

- `/printing-services` — searchable, sortable, filterable and paginated services table (permission: `printing_services.view`).
- `/printing-services/new` — create service and initial price tiers (`printing_services.create`).
- `/printing-services/:id` — service information, tier table and live price preview (`printing_services.view`; preview additionally requires `printing_services.price_preview.view`).
- `/printing-services/:id/edit` — edit base fields and individual tiers (`printing_services.update`).
- Delete with confirmation is available only with `printing_services.delete`. A backend 409 remains authoritative when orders reference a service.
- Customer type Selects: `GET /api/v1/selects?selects=customerTypes` -> `data: [{label:"customerTypes",options:[{value,label}]}]`. It is reused from Customers, not a new list/lookup API. Only active customer types are supplied; existing inactive type IDs remain visible in saved tiers and are not silently replaced.

## Verified backend contracts

| Method | Endpoint | data |
|---|---|---|
| GET | `/api/v1/printing-services` | `{printingServices, pagination}` |
| GET | `/api/v1/printing-services/{id}` | `{id,name,basePrice,status,priceTiers}` |
| POST | `/api/v1/printing-services` | created service resource (HTTP 201) |
| PATCH | `/api/v1/printing-services/{id}` | updated service resource |
| DELETE | `/api/v1/printing-services/{id}` | `null` |
| POST | `/api/v1/printing-services/price-preview` | `{serviceId,quantity,source,suggestedUnitPrice,suggestedTotal,requiresManualTotal}` |

List queries support `filter[search]`, `filter[status]`, `sort` (`id,-id,name,-name`), `page` and `perPage`. List resource does **not guarantee** `priceTiers`; use the Show endpoint for tiers.

### Create body
```json
{
  "name":"كروت شخصية",
  "basePrice":"10.00",
  "status":1,
  "priceTiers":[
    {"customerTypeId":null,"minQuantity":100,"maxQuantity":500,"price":"5.50"}
  ]
}
```

- `basePrice` is a string decimal or `null`; `"0.00"` means free base pricing, `null` can require manual total on preview.
- Tier prices must be **positive**, and quantity bounds can be null for catch-all/open-ended.
- Tier ranges cannot overlap for the same customer type; server handles transactional validation and returns indexed `422 errors.priceTiers.0.price` etc.

### Update body uses tier commands (not array replacement)

- Create: `{actionStatus:1,customerTypeId,minQuantity,maxQuantity,price}`
- Update: `{actionStatus:2,priceTierId,customerTypeId,minQuantity,maxQuantity,price}` (**full tier values required**)
- Delete: `{actionStatus:3,priceTierId}`
- Unchanged tiers can be omitted (server retains them).
- Updating `name/basePrice/status` does not require sending the full tier list; only actual edits are posted.
- The form maps Laravel field errors by *command array index* back to the correct UI row.

### Preview
`POST /api/v1/printing-services/price-preview` with `{serviceId,customerTypeId:null|number,quantity:number}`. The backend determines the pricing precedence: customer-type quantity tier, customer-type catch-all, generic quantity tier, generic catch-all, then base price. The frontend **must not derive its own price**. `requiresManualTotal:true` is displayed explicitly without fabricating a number. Previews on inactive services are blocked.

## Verification and follow-up

- CI: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
- `tests/printing-services-flow.test.tsx` checks list queries, create payloads, tier change commands, backend previews, and permission-limited pages.
- Local browser smoke test still needed against MySQL/Laravel: conflicting tier boundaries, duplicate names, 422 translation, full create/update/delete workflow, inactive services, manual pricing and 409 usage guards.
- Keep frontend PR in Draft until user reviews UI and real data integration.

## Pull locally

```powershell
cd C:\xampp\htdocs\printingApi
git switch develop
git pull --ff-only origin develop
php artisan optimize:clear

cd C:\xampp\htdocs\printingFront
git fetch origin
git switch --track origin/feature/printing-services
npm ci
npm run dev
```

If `feature/printing-services` already exists locally, switch to it then use `git pull --ff-only origin feature/printing-services`. Preserve local edits before branch switching.
