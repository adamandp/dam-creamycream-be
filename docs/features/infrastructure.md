# Infrastructure and release pipeline

## Runtime
NestJS/Express, Prisma with PostgreSQL, ioredis and Redis, Pino structured logs, Cloudinary image storage, RajaOngkir indicative quotes, centralized Payment Service, external Accounts Service. Production requires HTTPS Accounts Service/frontend origins, PostgreSQL sslmode=verify-full and rediss Redis with certificate verification. Only explicitly trusted reverse proxies may provide client IPs. Swagger is protected by HTTP Basic authentication in production. Health checks PostgreSQL and Redis; detailed DB health is admin protected.

## Environment and fresh database

Use .env.example as the key inventory. Use a NEW dedicated database. Run npm run db:setup to push the Prisma schema and add checks/partial unique indexes; never point this at the old database.

Configure Accounts and Payment Service settings as described in [.env.example](../../.env.example) and [payment integration](../payment-service-integration.md). Never commit secrets.

## CI pipeline

Install lockfile dependencies, generate Prisma client, compile TypeScript, run unit/security suite, start isolated PostgreSQL/Redis, run db:setup, run HTTP end-to-end tests with mocked Payment Service, check generated documentation and audit runtime dependencies. The GitHub Actions workflow validates pushes; Vercel handles deployments separately.

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

Use npm run start:prod after build in a continuously running Node runtime (the command explicitly selects production). Vercel uses api/index.ts. QStash publishes checkout expiration and schedules a signed reconciliation POST every five minutes. Payment Service owns upstream reconciliation. Configure all production environment variables before deployment; the build does not verify runtime credentials. Monitor reconciliation warnings and pending-payment age; investigate provider ambiguity without manually forcing payment status. The compiled entry point is dist/src/main.js. Production service origins are listed in .env.example; configure secrets in the deployment environment. CI does not substitute for a live sandbox payment, webhook registration, Accounts Service integration test, load testing, or refunds.

## QStash deployment
Set QSTASH_URL (regional Upstash endpoint supported), QSTASH_TOKEN, QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY. The callback base defaults to the HTTPS Vercel production project domain (VERCEL_PROJECT_PRODUCTION_URL). To use the public proxy instead, set PUBLIC_BASE_URL=https://dam-creamycream.vercel.app/core-service. The publisher and verifier use the same exact URL; configure the schedule with the same base and keys. From a trusted local terminal with the production settings loaded, run:

\`\`\`sh
node --env-file=.env.prod --import tsx scripts/register-qstash.ts
\`\`\`

If not using PUBLIC_BASE_URL, supply VERCEL_PROJECT_PRODUCTION_URL=dam-creamycream-cs.vercel.app in that command's environment. Registration is explicit and uses a deterministic schedule ID; never register from application startup or preview. Confirm the schedule in Upstash and that Payment Service's own reconciliation schedule is active. Checkout publishes only after DB commit; a failed publish leaves the successful checkout intact and the recurring sweep recovers it. Duplicate and concurrent deliveries are safe under the existing payment row lock. Monitor QStash DLQ and failed reconciliation; initialized or ambiguous payments must stay reserved until verified terminal provider status arrives.
