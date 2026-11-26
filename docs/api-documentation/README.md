# API documentation

This is the business API for Creamy Cream, not an identity provider. All paths are relative to the deployed commerce API base URL. The frontend signs in directly at Accounts Service (currently https://as-creamy-cream.vercel.app/api).

- [Complete endpoint reference](endpoints.md) — generated from every controller, including role requirements and DTO names.
- [Checkout and Midtrans contract](checkout-payments.md) — request/response examples and status transitions.
- Interactive OpenAPI: /docs (development/test only).
- Machine-readable OpenAPI: /swagger/json (development/test only). Schemas are generated from Zod DTOs; security and required permissions are derived from actual controller guard metadata. Voucher/notification assignment requires STORE_ADMIN and user.read. The standalone voucher-use endpoint was removed.

## Authentication

Customer: POST /auth/login/customer on Accounts Service. Store admin: POST /auth/login/store-admin on Accounts Service. Accounts Service also owns registration, refresh, logout, profile, password, sessions and OAuth.

Call commerce API with Authorization: Bearer <access token>. Do not send refresh cookies, passwords, private keys or role overrides to commerce. Its guards verify signature (RS256), issuer, audience, expiry, issued-at, token type, UUID claims, forced-password-change flag and exact role codes. ACCOUNT_ADMIN does not have store access.

Protected route success uses a JSON object with data and/or message. List endpoints may include paging (currentPage, pageSize, totalItems, totalPages). Default page=1, limit=10; integer values 1–100. Some legacy list endpoints return 404 on empty data. Consult endpoint-specific DTOs for filters.

## Errors

| Status | Meaning |
|---|---|
| 400 | Request validation failed (including missing/invalid checkout idempotency key). |
| 401 | Missing or invalid/expired JWT. |
| 403 | Role or permission denied; invalid webhook signature. |
| 404 | Resource not found or not owned by actor. |
| 409 | Conflict, exhausted inventory, invalid transition or idempotency mismatch. |
| 429 | Rate limit exceeded. |
| 502 | External service returned invalid or unavailable response. |
| 503 | Dependency or required feature configuration unavailable. |

Do not retry a 400 or 403 without correction. Retry checkout conflicts due to concurrency with the same idempotency key, not a new key. Never treat a browser callback as proof of successful payment.

## Maintenance

Run npm run docs:generate after modifying a controller. API examples are illustrative, not live credentials or real transaction IDs. Runtime OpenAPI is the authoritative request-schema reference.
