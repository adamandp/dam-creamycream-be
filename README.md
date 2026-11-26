# Creamy Cream — Commerce Backend

NestJS business API for the Creamy Cream learning project. Authentication is provided by Accounts Service; payments use the centralized Payment Service.

## Documentation

- [API documentation](docs/api-documentation/README.md)
- [All endpoints](docs/api-documentation/endpoints.md)
- [Features and pipelines](docs/features/README.md)
- [Environment and release workflow](docs/features/infrastructure.md)

## Local setup

```sh
npm ci
cp .env.example .env
# Fill in environment values for a NEW database and configured services.
npm run db:setup
npm run build
npm run start:dev
```

Development Swagger: /docs. Production Swagger uses HTTP Basic authentication. Vercel/serverless uses the payment service callback and the scheduled checkout cleanup route. Do not run db:setup against the legacy database.

## Validation

```sh
npm test -- --runInBand
npm run docs:generate
npm audit --omit=dev
```

The HTTP E2E suite needs disposable loopback PostgreSQL/Redis with a database name ending in _test; run db:setup and run npm run test:e2e. CI provisions these automatically. Never run the fixture tests on a real database. Payment Service calls are mocked; configure its callback URL for an actual end-to-end payment. See [integration](docs/payment-service-integration.md).
