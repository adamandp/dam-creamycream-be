# Production readiness review — learning project

## Implemented
- Durable payment initialization intent, absolute provider expiry, cancellation intent, scheduled reconciliation and atomic stock finalization.
- Per-account pending-order and request limits, transactional checkout and promotion counters.
- Immutable delivery-address snapshot, primary-address database uniqueness and owner-scoped writes.
- Explicit user.read permission on admin assignment routes, with no automatic grant of external account authority.
- Production environment checks, TLS certificate verification, and continuous-runtime requirement.
- Removed the direct user-voucher consumption endpoint; generated OpenAPI and Markdown reference updated to 90 endpoints.

## Deployment gates
1. Set up a new PostgreSQL database with sslmode=verify-full, Redis with rediss://, and correct production CORS origins.
2. Configure the exact production Accounts Service public key; grant STORE_ADMIN user.read via Accounts Service only if voucher/notification assignment is required.
3. Configure sandbox Midtrans credentials with Snap and Core status/cancel permissions and register the HTTPS notification URL.
4. Deploy to a continuously running Node runtime and ensure reconciliation logs are collected.
5. Smoke-test real Accounts Service customer/store-admin tokens, sandbox payment success, pending payment cancellation and abandoned Snap session recovery.
6. Commit/push and verify CI on GitHub. The local tests mock provider HTTP and do not prove the live integration.

## Scope and operational limitations
Public learning/sandbox project only, no real-money checkout, refunds or chargebacks. Ambiguous known-token provider responses fail closed and retain the reservation until confirmed; monitor repeated reconciliation warnings, and verify with the provider before operational remediation. JWTs remain valid until their short expiration unless the identity service is queried. No production database or provider account was mutated by this implementation.
