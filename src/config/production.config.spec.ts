import { validateProductionEnvironment } from './production.config';
describe('Production configuration', () => {
  const env = {
    NODE_ENV: 'production',
    PAYMENT_SERVICE_URL: 'https://pay.example.com',
    PAYMENT_INTERNAL_HMAC_SECRET: 'fixture',
    WEBHOOK_CALLBACK_SECRET: 'fixture',
    CRON_SECRET: 'fixture',
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
      { WEBHOOK_CALLBACK_SECRET: '' },
      { SHIPPING_ORIGIN_ID: '-1' },
      { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    ])
      expect(() =>
        validateProductionEnvironment({ ...env, ...extra }),
      ).toThrow();
  });
});
