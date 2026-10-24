# طَبعة | Tabaa Frontend

واجهة نظام إدارة طلبات الطباعة والإنتاج والتحصيلات، مبنية باستخدام React وTypeScript، ومهيأة للعمل مع Laravel API عبر Sanctum SPA authentication.

## Product principles

- Arabic-first interface with RTL layout.
- Clear visual hierarchy and low cognitive load.
- Consistent actions, forms, tables, empty states, loading states, and error feedback.
- Feature-based architecture that can grow without turning into a monolith.
- Server state belongs to TanStack Query; Zustand is reserved for shared client/UI state.
- No bearer tokens in browser storage. Authentication uses Sanctum session cookies and CSRF protection.

## Planned stack

- React + TypeScript + Vite
- Tailwind CSS + shadcn/ui
- TanStack Query
- Zustand
- React Router
- Axios
- React Hook Form + Zod

## Local development

```bash
npm install
npm run dev
```

## Project status

The initial foundation and UI/UX standards are being established before implementing business features. See `docs/frontend-architecture.md` and `docs/ui-ux-guidelines.md`.
