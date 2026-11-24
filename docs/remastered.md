# Remastered: Accounts Service integration

## Contract and security boundary

- Accounts Service is the identity authority; Creamy Cream does not sign tokens, store refresh tokens, maintain roles, or manage revocation.
- Current Accounts Service access-token contract: RS256, `sub`, `sid`, `iss`, `aud`, `iat`, `exp`, `jti`, `token_use=access`, a **single** string `role`, `permissions[]`, and `must_change_password`. Access lifetime: at most 900 seconds. The refresh token is HS256 and never accepted by the core JWT guard.
- Configure the public key, exact issuer and audience, and role codes from Accounts Service. Current system role codes are ADMIN and USER; SUPER_ADMIN is only recognized if deliberately configured and assigned by Accounts Service.
- The Accounts Service currently uses one configured audience. App-specific audiences must be implemented by Accounts Service if tokens must be isolated between applications. No immediate access-token revocation: previously issued access tokens may remain usable until expiry.
- JWT, role and permission guards are global. Business controllers use explicit public and role policies; unclassified routes fail closed. The permission guard is available, but no new permission catalogue or endpoint-to-permission mapping was invented.
- Public business routes: health liveness, catalogue, product detail/information, recommendations, categories, and product reviews. Customer actions are scoped to authenticated identity; admin lists and management routes require configured admin roles. Customer voucher issuance is not enabled by default.
- The explicit Accounts gateway routes forward to the trusted upstream authority, which authenticates session/profile operations (including forced password changes). Login/register, logout/logout-all, refresh, profile read/update/password, and session list/revoke are supported. Legacy dummy login is removed. OAuth and additional admin Accounts routes are not proxied in this change.
- Only the refresh cookie is forwarded; credential and session mutations use trusted-origin checks and JSON validation where applicable. Upstream cookie flags are checked. Set identical trusted frontend origins at both services.
- Helmet, origin whitelist, per-instance throttling, request validation, image signature/size checks, sensitive header/error redaction, and disabled production Swagger are implemented. In multi-replica deployments configure shared/edge rate limiting; configure ingress proxy trust explicitly before using client IPs behind a proxy.

## Environment

Start with .env.example; fill placeholders using environment/secret manager, not git. Never copy the Accounts private RSA key or refresh secret. Use HTTPS for the upstream and frontend in production and TLS for DB/Redis connections. Configure a least-privileged DB runtime user, separate migration credentials, backups and a dedicated test database. Review old logs for tokens and rotate affected credentials if exposure is found.

## Data migration (NOT executed)

1. Backup and verify restoration in a separate environment.
2. Export an approved mapping of old user UUIDs to Accounts Service UUIDs. Prefer preserving UUIDs. Verify all seven business tables; do not match unrelated users by username alone.
3. Stop legacy writers or schedule a controlled cutover. Test the migration on a sanitized database copy.
4. Apply the prepared migration only after the mapping is approved. It removes seven legacy user foreign keys, adds owner indexes and backfills review snapshots. If IDs differ, update business UUIDs with the approved mapping in a controlled transaction (resolve cart uniqueness collisions first).
5. Legacy identity tables remain physically present, marked ignored in Prisma, so no legacy identity data is destroyed. Drop them only in a separate reviewed migration after reconciliation, backup and rollback-window approval. Do not run schema push/reset against production.
6. Deploy after end-to-end authentication, ownership and frontend checks. Do not expose the old master alongside remastered writers during cutover.
7. New reviews snapshot the display name; new image URLs are null because Accounts Service profile images are private, expiring presigned URLs. Existing review snapshots preserve prior display data. A public-profile contract is needed for durable current avatars.

## Local testing

Use a separate database and Redis, never production credentials. Unit/security tests can run without either service:
```sh
npm ci
npx prisma generate
npm run build
npm test -- --runInBand --runTestsByPath src/guards/security.spec.ts src/guards/ownership.spec.ts
```
The fixture seeder accepts only explicit local empty _dev/_test databases, supplied fixture Accounts UUIDs, and SEED_CONFIRM=LOCAL_EMPTY_DB. It never resets or deletes existing records.

## Frontend compatibility

The old dummy-customer-login call must be replaced with login/register/refresh and Bearer access-token handling. Account profile DTOs now follow Accounts Service. This branch does not modify the frontend or Accounts Service. Business routes are preserved except deliberate security restrictions, and self-service ownership comes from the verified token rather than a client-supplied userId.
