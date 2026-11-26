# Identity and security

## Accounts Service

The browser authenticates with Accounts Service directly. Registration, login, OAuth, logout, refresh, profile changes and session management are not proxied through the commerce backend. Accounts Service is the identity authority and signs access tokens using RSA private keys. Commerce stores only the corresponding public key and verifies JWT claims locally. No commerce-side password or refresh token is needed.

## Role and permission pipeline

CUSTOMER is the shopper role; STORE_ADMIN is the store-management role. ACCOUNT_ADMIN belongs to the identity service and is explicitly excluded from commerce role mapping. Incoming requests pass through shared Redis rate limiting, JWT validation, role guard, permission guard (only where explicitly required), Zod validation, resource ownership and business logic. Public endpoints are explicitly decorated; unclassified protected routes fail closed. The verified sub is the resource owner, never an untrusted userId.

AccountsClient still fetches the current profile for review snapshots and validates targeted user IDs for admin voucher/notification assignment. The latter uses the caller's bearer token and requires the Accounts Service user.read permission; grant it intentionally to STORE_ADMIN through Accounts Service RBAC if those features are required. The commerce endpoint guard checks this permission before forwarding; the Accounts Service default seed and production roles have not been changed. The backend does not bypass Accounts Service permissions.

Browser security: explicit CORS origins, Authorization header, no credentialed CORS, Helmet, no cache on authenticated responses, no x-powered-by, limited JSON bodies. There are no cookie-authenticated commerce mutations; CSRF protection for Accounts Service remains in that service. JWT logout/revocation may take effect at commerce only when the current access token expires (at most 15 minutes); no introspection or JWKS rotation is introduced.

## Rate limiting and logs

Redis shares a fixed-window counter and block period across instances (atomic Lua). The global default is 120 requests/minute per route/IP; checkout and Snap initiation have tighter IP limits. Additionally, authenticated checkout, Snap and cancel are limited to 10 requests per account per minute; sync to 20. Forwarded IPs are trusted only from explicitly configured ingress IPs. Rate limiting fails closed when Redis is unavailable. Production logging uses structured stdout with redacted sensitive HTTP headers. Provider server keys are server-only.
