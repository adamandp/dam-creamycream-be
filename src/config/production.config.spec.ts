import {
  startupFailureReason,
  validateProductionEnvironment,
} from './production.config';
describe('Production configuration', () => {
  const env = {
    NODE_ENV: 'production',
    DATABASE_URL:
      'postgresql://fixture:fixture@db.example.com/store?sslmode=verify-full',
    REDIS_URL: 'rediss://redis.example.com',
    ACCOUNTS_SERVICE_URL: 'https://accounts.example.com',
    ACCOUNTS_JWT_PUBLIC_KEY: 'fixture',
    ACCOUNTS_JWT_ISSUER: 'fixture',
    ACCOUNTS_JWT_AUDIENCE: 'fixture',
    ROLE_STORE_ADMIN: 'STORE_ADMIN',
    ROLE_CUSTOMER: 'CUSTOMER',
    FRONTEND_ORIGINS: 'https://store.example.com',
    PAYMENT_SERVICE_URL: 'https://pay.example.com',
    PAYMENT_INTERNAL_HMAC_SECRET: 'fixture',
    WEBHOOK_CALLBACK_SECRET: 'fixture',
    QSTASH_URL: 'https://qstash.upstash.io',
    QSTASH_TOKEN: 'fixture',
    QSTASH_CURRENT_SIGNING_KEY: 'fixture-current',
    QSTASH_NEXT_SIGNING_KEY: 'fixture-next',
    PUBLIC_BASE_URL: 'https://store.example.com/core-service',
    DOCS_USERNAME: 'fixture',
    DOCS_PASSWORD: 'fixture',
    SHIPPING_ORIGIN_ID: '100',
    CLOUDINARY_CLOUD_NAME: 'fixture',
    CLOUDINARY_API_KEY: 'fixture',
    CLOUDINARY_API_SECRET: 'fixture',
    RAJAONGKIR_BASE_URL: 'https://shipping.example.com',
    RAJAONGKIR_API_KEY: 'fixture',
  };
  it('supports serverless with complete settings', () =>
    expect(() =>
      validateProductionEnvironment({ ...env, VERCEL: '1' }),
    ).not.toThrow());
  it('rejects invalid configuration', () => {
    for (const extra of [
      { PAYMENT_SERVICE_URL: 'http://pay.example.com' },
      { ACCOUNTS_SERVICE_URL: 'not-a-url' },
      { DATABASE_URL: '' },
      { REDIS_URL: '' },
      { ACCOUNTS_JWT_PUBLIC_KEY: '' },
      { WEBHOOK_CALLBACK_SECRET: '' },
      { QSTASH_URL: 'https://untrusted.example.com' },
      { QSTASH_TOKEN: '' },
      { QSTASH_CURRENT_SIGNING_KEY: '' },
      { PUBLIC_BASE_URL: 'http://store.example.com' },
      { SHIPPING_ORIGIN_ID: '-1' },
      { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    ])
      expect(() =>
        validateProductionEnvironment({ ...env, ...extra }),
      ).toThrow();
  });
  it('reports only safe configuration diagnostics', () => {
    expect(
      startupFailureReason(
        new Error('Missing production configuration: DATABASE_URL'),
      ),
    ).toBe('Missing production configuration: DATABASE_URL');
    expect(
      startupFailureReason(new Error('postgresql://user:secret@db')),
    ).not.toContain('secret');
  });
});
