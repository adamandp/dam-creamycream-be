import { generateKeyPairSync } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../app.module';
import { PrismaService } from '../common/prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import { buildOpenApiDocument } from './openapi.config';
import contracts from './openapi.contracts.json';

describe('Commerce OpenAPI contract (offline)', () => {
  let app: INestApplication;
  let document: ReturnType<typeof buildOpenApiDocument>;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    const { publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    Object.assign(process.env, {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://fixture:fixture@127.0.0.1:1/fixture_test',
      REDIS_URL: 'redis://127.0.0.1:1',
      ACCOUNTS_JWT_PUBLIC_KEY: publicKey
        .export({ type: 'spki', format: 'pem' })
        .toString(),
      ACCOUNTS_SERVICE_URL: 'http://127.0.0.1:1',
      ROLE_STORE_ADMIN: 'STORE_ADMIN',
      ROLE_CUSTOMER: 'CUSTOMER',
      FRONTEND_ORIGINS: 'http://localhost:3001',
      SHIPPING_ORIGIN_ID: '123',
      RAJAONGKIR_BASE_URL: 'http://127.0.0.1:1',
      RAJAONGKIR_API_KEY: 'fixture',
      PAYMENT_SERVICE_URL: 'http://127.0.0.1:1',
      PAYMENT_INTERNAL_HMAC_SECRET: 'fixture-internal-secret',
      WEBHOOK_CALLBACK_SECRET: 'fixture-callback-secret',
      QSTASH_URL: 'https://qstash.upstash.io',
      QSTASH_TOKEN: 'fixture',
      QSTASH_CURRENT_SIGNING_KEY: 'fixture',
      QSTASH_NEXT_SIGNING_KEY: 'fixture',
      PUBLIC_BASE_URL: 'https://example.invalid/core-service',
      CLOUDINARY_CLOUD_NAME: 'fixture',
      CLOUDINARY_API_KEY: 'fixture',
      CLOUDINARY_API_SECRET: 'fixture',
      LOG_LEVEL: 'silent',
    });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideProvider(RedisService)
      .useValue({})
      .compile();
    app = module.createNestApplication({ logger: false });
    document = buildOpenApiDocument(app);
  });

  afterAll(async () => {
    await app?.close();
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    Object.assign(process.env, originalEnv);
  });

  it('covers all registered operations and all documented response bodies', () => {
    const ids: string[] = [];
    for (const item of Object.values(document.paths)) {
      for (const method of ['get', 'post', 'patch', 'delete', 'put'] as const) {
        const operation = item[method];
        if (!operation) continue;
        expect(operation.operationId).toBeDefined();
        ids.push(operation.operationId!);
        for (const [status, response] of Object.entries(operation.responses)) {
          if (status === '204') continue;
          expect(response).toBeDefined();
          if (!response || '$ref' in response)
            throw new Error('Expected inline response');
          expect(response.description).not.toBe('');
          expect(response.content?.['application/json']?.schema).toBeDefined();
        }
      }
    }
    expect(ids).toHaveLength(96);
    expect(ids.sort()).toEqual(Object.keys(contracts).sort());
  });

  it('preserves public reads, protected mutations and signed callbacks', () => {
    expect(document.paths['/categories'].get?.security).toEqual([]);
    expect(document.paths['/categories'].post?.security).toEqual([
      { accessToken: [] },
    ]);
    expect(document.paths['/payments/webhook'].post?.security).toEqual([
      { paymentWebhookSignature: [] },
    ]);
    expect(document.paths['/payments/webhook'].post?.requestBody).toBeDefined();
    for (const path of ['/payments/expire-checkout', '/payments/reconcile']) {
      expect(document.paths[path].post?.security).toEqual([
        { qstashSignature: [] },
      ]);
      expect(document.paths[path].post?.requestBody).toBeDefined();
    }
  });

  it('documents actual category response, multipart image upload and checkout header', () => {
    const response = document.paths['/categories'].get?.responses['200'];
    if (!response || '$ref' in response)
      throw new Error('Missing category response');
    expect(response.content?.['application/json']?.schema).toMatchObject({
      required: ['message', 'data', 'paging'],
      properties: { data: { type: 'array' } },
    });
    expect(
      document.paths['/products/{id}/image'].patch?.requestBody,
    ).toMatchObject({
      required: true,
      content: {
        'multipart/form-data': {
          schema: {
            required: ['file'],
            properties: { file: { type: 'string', format: 'binary' } },
          },
        },
      },
    });
    expect(document.paths['/orders/checkout'].post?.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Idempotency-Key', required: true }),
      ]),
    );
  });

  it('uses OpenAPI 3.0-compatible schema keywords and resolves all local schema refs', () => {
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      const value = node as Record<string, unknown>;
      expect(value.type).not.toBe('null');
      expect(value).not.toHaveProperty('const');
      if ('exclusiveMinimum' in value)
        expect(typeof value.exclusiveMinimum).toBe('boolean');
      if ('exclusiveMaximum' in value)
        expect(typeof value.exclusiveMaximum).toBe('boolean');
      if (
        typeof value.$ref === 'string' &&
        value.$ref.startsWith('#/components/schemas/')
      ) {
        expect(
          document.components?.schemas?.[value.$ref.split('/').pop()!],
        ).toBeDefined();
      }
      Object.values(value).forEach(walk);
    };
    walk(document);
  });
});
