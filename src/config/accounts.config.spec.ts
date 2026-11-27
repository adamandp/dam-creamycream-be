import { ConfigService } from '@nestjs/config';
import { generateKeyPairSync } from 'node:crypto';
import { AccountsConfig } from './accounts.config';

describe('Accounts public key configuration', () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const der = publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  const config = (key: string) =>
    new ConfigService({
      ACCESS_TOKEN_PUBLIC_KEY: key,
      ACCOUNTS_SERVICE_URL: 'https://accounts.example.com',
      ROLE_STORE_ADMIN: 'STORE_ADMIN',
      ROLE_CUSTOMER: 'CUSTOMER',
      FRONTEND_ORIGINS: 'https://store.example.com',
    });
  it.each([pem, pem.replace(/\n/g, '\\n'), der])(
    'normalizes supported public key formats',
    (key) => expect(new AccountsConfig(config(key)).publicKey).toBe(pem),
  );
  it.each([
    'invalid',
    privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(),
  ])('rejects invalid or private keys', (key) =>
    expect(() => new AccountsConfig(config(key))).toThrow(
      'Expected a public RSA key',
    ),
  );
});
