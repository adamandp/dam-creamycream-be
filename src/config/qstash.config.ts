export function qstashConfig(env: NodeJS.ProcessEnv = process.env) {
  const url = new URL(env.QSTASH_URL ?? '');
  if (
    url.protocol !== 'https:' ||
    !/^qstash(?:-[a-z0-9-]+)?\.upstash\.io$/.test(url.hostname) ||
    url.port ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  )
    throw new Error('Invalid URL: QSTASH_URL');
  const raw =
    env.PUBLIC_BASE_URL ||
    (env.VERCEL_PROJECT_PRODUCTION_URL
      ? 'https://' + env.VERCEL_PROJECT_PRODUCTION_URL
      : '');
  const base = new URL(raw);
  if (
    base.protocol !== 'https:' ||
    base.username ||
    base.password ||
    base.search ||
    base.hash
  )
    throw new Error('Invalid URL: PUBLIC_BASE_URL');
  for (const key of [
    'QSTASH_TOKEN',
    'QSTASH_CURRENT_SIGNING_KEY',
    'QSTASH_NEXT_SIGNING_KEY',
  ]) {
    if (!env[key]?.trim())
      throw new Error('Missing production configuration: ' + key);
  }
  return {
    url: url.origin,
    base: base.href.replace(/\/$/, ''),
    token: env.QSTASH_TOKEN!,
    current: env.QSTASH_CURRENT_SIGNING_KEY!,
    next: env.QSTASH_NEXT_SIGNING_KEY!,
  };
}
