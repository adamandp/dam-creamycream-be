import { qstashConfig } from './qstash.config';

export function validateProductionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
) {
  if (env.NODE_ENV !== 'production') return;
  for (const key of [
    'DATABASE_URL',
    'REDIS_URL',
    'ACCOUNTS_SERVICE_URL',
    'ROLE_STORE_ADMIN',
    'ROLE_CUSTOMER',
    'FRONTEND_ORIGINS',
    'PAYMENT_SERVICE_URL',
    'PAYMENT_INTERNAL_HMAC_SECRET',
    'WEBHOOK_CALLBACK_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'RAJAONGKIR_BASE_URL',
    'RAJAONGKIR_API_KEY',
    'SHIPPING_ORIGIN_ID',
    'QSTASH_URL',
    'QSTASH_TOKEN',
    'QSTASH_CURRENT_SIGNING_KEY',
    'QSTASH_NEXT_SIGNING_KEY',
    'DOCS_USERNAME',
    'DOCS_PASSWORD',
  ]) {
    if (!env[key]?.trim())
      throw new Error('Missing production configuration: ' + key);
  }
  if (!(env.ACCOUNTS_JWT_PUBLIC_KEY ?? env.ACCESS_TOKEN_PUBLIC_KEY)?.trim())
    throw new Error(
      'Missing production configuration: ACCOUNTS_JWT_PUBLIC_KEY',
    );
  for (const key of [
    'ACCOUNTS_SERVICE_URL',
    'PAYMENT_SERVICE_URL',
    'RAJAONGKIR_BASE_URL',
  ]) {
    let url: URL;
    try {
      url = new URL(env[key]!);
    } catch {
      throw new Error('Invalid URL: ' + key);
    }
    if (
      url.protocol !== 'https:' ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.hostname.endsWith('.invalid')
    )
      throw new Error('Invalid URL: ' + key);
  }
  if (
    !Number.isSafeInteger(Number(env.SHIPPING_ORIGIN_ID)) ||
    Number(env.SHIPPING_ORIGIN_ID) < 1
  )
    throw new Error('Invalid shipping origin');
  qstashConfig(env);
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0')
    throw new Error('TLS certificate verification must be enabled');
}

/** Only report known safe configuration errors; never log arbitrary URLs or credentials. */
export function startupFailureReason(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  return /^(Missing production configuration|Invalid URL): [A-Z_]+$/.test(
    message,
  )
    ? message
    : 'Check configuration and service connectivity.';
}
