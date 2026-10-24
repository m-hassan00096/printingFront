# Frontend Architecture

## Goal

Keep the frontend easy to understand as the printing workflow grows. Organize code by business feature, not by file type alone.

## Source boundaries

~~~text
src/
├── app/
│   ├── layouts/
│   ├── pages/
│   ├── providers/
│   ├── navigation.ts
│   └── router.tsx
├── features/
│   ├── auth/
│   ├── customers/
│   ├── orders/
│   ├── production/
│   ├── deliveries/
│   ├── collections/
│   ├── finance/
│   ├── identity/
│   └── settings/
├── shared/
│   ├── api/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── stores/
└── main.tsx
~~~

## Feature structure

Add folders only when they are needed.

~~~text
features/orders/
├── api/
├── components/
├── hooks/
├── pages/
├── schemas/
├── types/
└── index.ts
~~~

- api: feature-specific HTTP functions.
- hooks: TanStack Query hooks and mutations.
- components: components used only by this feature.
- pages: route-level screens for the feature.
- schemas: Zod schemas for form input and validation.
- types: feature-specific domain types.
- index.ts: optional public exports only; do not create barrel files mechanically.

## Dependency rules

1. app can compose features and shared components.
2. A feature may import from shared.
3. A feature should not reach into another feature's internal folders.
4. shared must not import from features.
5. Avoid speculative abstractions. Extract shared code only after a genuine reuse pattern appears.

## State ownership

- Server state: TanStack Query for API data, caching, loading, errors, mutations, and invalidation.
- Client/UI state: Zustand for shared UI state such as sidebar state or temporary cross-page selections.
- Form state: React Hook Form + Zod, kept local to the form.

Do not mirror customers, orders, permissions, or API responses into Zustand.

## API access

- Use the shared Axios client for requests.
- Feature API modules own feature endpoints.
- Query hooks call feature API functions; components should not call Axios directly.
- Keep API DTO types separate from view-only types when their shape differs.
- Use camelCase and keep money values as decimal strings at the API boundary.
- Keep pagination inside the response data object as defined by the backend contract.

## Authentication

The browser app uses Laravel Sanctum stateful sessions and CSRF cookies. Do not store access tokens in localStorage or sessionStorage. Session validity is determined by the backend, not by a client-side role flag.

## Error handling and quality

Design loading, empty, error, validation, success, and disabled states. Do not automatically retry non-idempotent mutations. Backend authorization remains authoritative; hiding a frontend action is not a security boundary.

Before a change is ready, run lint, typecheck, and production build. Add focused tests for non-trivial business rules and interaction-heavy components as features are implemented.
