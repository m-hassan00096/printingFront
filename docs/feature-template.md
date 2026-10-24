# Feature Implementation Template

Use this template when a business feature is ready to implement. Add only the folders it needs.

~~~text
src/features/example/
├── api/
├── components/
├── hooks/
├── pages/
├── schemas/
├── types/
└── index.ts
~~~

## Implementation checklist

- [ ] Confirm the user workflow and permissions before designing the screen.
- [ ] Define request and response types from the backend contract.
- [ ] Add endpoint functions in the feature API module.
- [ ] Define stable TanStack Query keys and hooks.
- [ ] Keep server data out of Zustand.
- [ ] Add Zod schemas and React Hook Form for user input.
- [ ] Design loading, empty, error, validation, success, and disabled states.
- [ ] Use shared UI components instead of duplicating visual patterns.
- [ ] Verify keyboard access, RTL, long Arabic labels, and responsive layout.
- [ ] Run lint, typecheck, and production build.
- [ ] Add focused tests for non-trivial rules and interactions.
