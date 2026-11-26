export function validateProductionEnvironment(
  env: NodeJS.ProcessEnv = process.env,
) {
  if (env.NODE_ENV !== 'production') return;
  for (const key of [
    'PAYMENT_SERVICE_URL',
    'PAYMENT_INTERNAL_HMAC_SECRET',
    'WEBHOOK_CALLBACK_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'RAJAONGKIR_BASE_URL',
    'RAJAONGKIR_API_KEY',
    'SHIPPING_ORIGIN_ID',
    'CRON_SECRET',
    'DOCS_USERNAME',
    'DOCS_PASSWORD',
  ]) {
    if (!env[key]?.trim())
      throw new Error('Missing production configuration: ' + key);
  }
  for (const key of ['PAYMENT_SERVICE_URL', 'RAJAONGKIR_BASE_URL']) {
    const url = new URL(env[key]!);
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
  if (env.NODE_TLS_REJECT_UNAUTHORIZED === '0')
    throw new Error('TLS certificate verification must be enabled');
}
