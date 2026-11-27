import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey } from 'node:crypto';

@Injectable()
export class AccountsConfig {
  readonly publicKey: string;
  readonly baseUrl: string;
  readonly roles: Record<'STORE_ADMIN' | 'CUSTOMER', string>;
  readonly origins: string[];

  constructor(config: ConfigService) {
    const rawKey = config
      .get<string>(
        'ACCOUNTS_JWT_PUBLIC_KEY',
        config.get<string>('ACCESS_TOKEN_PUBLIC_KEY', ''),
      )
      .replace(/\\n/g, '\n')
      .trim();
    let key;
    try {
      if (/^-----BEGIN (RSA )?PUBLIC KEY-----/.test(rawKey)) {
        key = createPublicKey(rawKey);
      } else if (/^[A-Za-z0-9+/]+={0,2}$/.test(rawKey)) {
        key = createPublicKey({
          key: Buffer.from(rawKey, 'base64'),
          format: 'der',
          type: 'spki',
        });
      } else {
        throw new Error('Invalid public key format');
      }
    } catch {
      throw new Error('Expected a public RSA key');
    }
    if (
      key.asymmetricKeyType !== 'rsa' ||
      (key.asymmetricKeyDetails?.modulusLength ?? 0) < 2048
    )
      throw new Error('Expected an RSA public key of at least 2048 bits');
    this.publicKey = key.export({ type: 'spki', format: 'pem' }).toString();
    const url = new URL(config.getOrThrow<string>('ACCOUNTS_SERVICE_URL'));
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !['http:', 'https:'].includes(url.protocol) ||
      (process.env.NODE_ENV === 'production' && url.protocol !== 'https:')
    )
      throw new Error('Invalid Accounts Service URL');
    this.baseUrl = url.href.replace(/\/$/, '');
    this.roles = {
      STORE_ADMIN: config.getOrThrow<string>('ROLE_STORE_ADMIN').trim(),
      CUSTOMER: config.getOrThrow<string>('ROLE_CUSTOMER').trim(),
    };
    this.origins = config
      .getOrThrow<string>('FRONTEND_ORIGINS')
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
    if (
      Object.values(this.roles).some((v) => !v) ||
      new Set(Object.values(this.roles)).size !== 2 ||
      Object.values(this.roles).includes('ACCOUNT_ADMIN') ||
      !this.origins.length
    )
      throw new Error('Invalid accounts security configuration');
    for (const origin of this.origins) {
      const u = new URL(origin);
      if (
        u.origin !== origin ||
        !['http:', 'https:'].includes(u.protocol) ||
        (process.env.NODE_ENV === 'production' && u.protocol !== 'https:')
      )
        throw new Error('Invalid frontend origin');
    }
  }
}
