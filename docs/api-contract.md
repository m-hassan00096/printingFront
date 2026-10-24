# API Contract

Keep this document aligned with the Tabaa Laravel API standards.

## Success envelope

~~~json
{
  "success": true,
  "message": "",
  "data": {}
}
~~~

A GET response may use an empty message. The data shape depends on the endpoint.

## Pagination

~~~json
{
  "success": true,
  "message": "",
  "data": {
    "items": [],
    "pagination": {
      "currentPage": 1,
      "perPage": 20,
      "total": 0,
      "lastPage": 1
    }
  }
}
~~~

Use the actual pagination field names returned by the backend. Do not infer total counts from the current page length.

## Error response

~~~json
{
  "success": false,
  "message": "The submitted data is invalid.",
  "errors": {
    "customerId": ["The customer field is required."]
  }
}
~~~

Use field-level validation messages when present and a concise general message otherwise.

## Authentication and CSRF

- Use session cookies with Laravel Sanctum for the browser SPA.
- Enable credentials on the HTTP client.
- Initialize the CSRF cookie through the backend root path at /sanctum/csrf-cookie before state-changing requests when required.
- Configure backend CORS credentials and Sanctum stateful domains for the actual development and production origins.
- Never persist a session cookie or token in application state.
- Do not use a bearer token as a fallback for the web application.

## Mutations

- Do not automatically retry financial mutations.
- Use Idempotency-Key on order/payment operations that require it in the backend contract.
- Invalidate or update affected TanStack Query caches after successful mutations.
- Treat posted financial movements as immutable; corrections should use the backend's correction flow.
- Backend authorization and business validation remain authoritative.

## Client conventions

- API field names use camelCase.
- Keep money values as decimal strings at the API boundary.
- Do not force unrelated endpoints into an inaccurate generic response shape.
- Keep endpoint functions in the owning feature's api folder.
