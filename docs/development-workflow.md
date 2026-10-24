# Development Workflow

## Branches

Use short-lived branches for changes and keep main in a releasable state.

Examples:
- feature/orders-list
- feature/customers-profile
- fix/collection-validation
- chore/update-dependencies

## Commit messages

Use a conventional, descriptive format:

~~~text
feat(orders): add order list filters
fix(auth): initialize csrf before login
refactor(customers): extract balance summary
chore(frontend): configure lint and formatting
docs(architecture): clarify feature boundaries
~~~

Keep each commit focused on one logical change.

## Before opening a pull request

~~~bash
npm run lint
npm run typecheck
npm run build
~~~

## Review checklist

- Does the change follow feature boundaries?
- Is server state managed by TanStack Query?
- Are errors and empty/loading states handled?
- Are labels, focus states, and RTL behavior correct?
- Are sensitive actions and financial mutations safe?
- Were environment files and secrets kept out of Git?
