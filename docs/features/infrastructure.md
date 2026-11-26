# Infrastructure and release pipeline

## Runtime
NestJS/Express, Prisma with PostgreSQL, ioredis and Redis, Pino structured logs, Cloudinary image storage, RajaOngkir indicative quotes, centralized Payment Service, external Accounts Service. Production requires HTTPS Accounts Service/frontend origins, PostgreSQL sslmode=verify-full and rediss Redis with certificate verification. Only explicitly trusted reverse proxies may provide client IPs. Swagger is protected by HTTP Basic authentication in production. Health checks PostgreSQL and Redis; detailed DB health is admin protected.

## Environment and fresh database

Use .env.example as the key inventory. Use a NEW dedicated database. Run npm run db:setup to push the Prisma schema and add checks/partial unique indexes; never point this at the old database.

Configure Accounts and Payment Service settings as described in [.env.example](../../.env.example) and [payment integration](../payment-service-integration.md). Never commit secrets.

## CI pipeline

Install lockfile dependencies, generate Prisma client, compile TypeScript, run unit/security suite, start isolated PostgreSQL/Redis, run db:setup, run HTTP end-to-end tests with mocked Payment Service, check generated documentation and audit runtime dependencies. The GitHub Actions workflow is local until committed/pushed; it does not deploy automatically.

Run locally:
```sh
npm ci
npm run build
npm test -- --runInBand
npm run docs:generate
npm audit --omit=dev
# Point DATABASE_URL/REDIS_URL at disposable loopback services, DB name ends in _test:
npm run db:setup
npm run test:e2e
```

Use npm run start:prod after build in a continuously running Node runtime (the command explicitly selects production). The reconciliation worker must stay alive; Vercel/Lambda runtimes are rejected unless a separate scheduler architecture is implemented. Monitor reconciliation warnings and pending-payment age; investigate provider ambiguity without manually forcing payment status. The compiled entry point is dist/src/main.js. Deployment target and secrets are not configured here. CI does not substitute for a live sandbox payment, webhook registration, Accounts Service integration test, load testing, or refunds.
