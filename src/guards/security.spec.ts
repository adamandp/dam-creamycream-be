import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import request from 'supertest';
import { AccountsConfig } from '../config/accounts.config';
import { Roles, Public, Permissions } from '../decorators/access.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { JwtPayload } from '../integrations/accounts/accounts.interface';
import { JwtGuard } from './jwt.guard';
import { RolesGuard } from './roles.guard';
import { PermissionsGuard } from './permissions.guard';

const keys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const wrongKeys = generateKeyPairSync('rsa', { modulusLength: 2048 });
const privateKey = keys.privateKey
  .export({ type: 'pkcs8', format: 'pem' })
  .toString();
const publicKey = keys.publicKey
  .export({ type: 'spki', format: 'pem' })
  .toString();
const config = {
  publicKey,
  issuer: 'https://issuer.example.test',
  audience: 'accounts-test',
  roles: {
    STORE_ADMIN: 'ADMIN_CODE',
    CUSTOMER: 'USER_CODE',
  },
};
const userId = randomUUID();

@Controller('security-test')
class SecurityController {
  @Public() @Get('public') open() {
    return { public: true };
  }
  @Roles('STORE_ADMIN') @Get('admin') admin() {
    return { admin: true };
  }
  @Roles('STORE_ADMIN', 'CUSTOMER') @Get('me') me(
    @CurrentUser() actor: JwtPayload,
  ) {
    return { id: actor.sub };
  }
  @Permissions('product.write', 'product.read')
  @Get('permission')
  permission() {
    return { allowed: true };
  }
  @Get('unclassified') unclassified() {
    return { unsafe: true };
  }
}
@Module({
  imports: [JwtModule.register({})],
  controllers: [SecurityController],
  providers: [
    { provide: AccountsConfig, useValue: config },
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
class SecurityTestModule {}

describe('Accounts JWT and authorization (isolated HTTP)', () => {
  let app: INestApplication;
  const jwt = new JwtService();
  const claims = (overrides: Record<string, unknown> = {}) => {
    const now = Math.floor(Date.now() / 1000);
    return {
      sub: userId,
      sid: randomUUID(),
      jti: randomUUID(),
      iss: config.issuer,
      aud: config.audience,
      iat: now,
      exp: now + 900,
      token_use: 'access',
      role: 'USER_CODE',
      permissions: [],
      must_change_password: false,
      ...overrides,
    };
  };
  const token = (overrides: Record<string, unknown> = {}, key = privateKey) =>
    jwt.sign(claims(overrides), { privateKey: key, algorithm: 'RS256' });
  const get = (path: string, bearer?: string) => {
    const req = request(app.getHttpServer()).get('/security-test/' + path);
    return bearer ? req.set('Authorization', 'Bearer ' + bearer) : req;
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [SecurityTestModule],
    }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });
  afterAll(async () => {
    await app?.close();
  });
  it('allows explicitly public endpoint without a token', async () => {
    await get('public').expect(200);
  });
  it('rejects missing bearer and refresh cookie alone', async () => {
    await get('me').set('Cookie', 'refreshToken=anything').expect(401);
  });
  it('uses verified sub with no refresh cookie', async () => {
    const response = await get('me', token()).expect(200);
    expect(response.body.id).toBe(userId);
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('rejects malformed JWT', async () => {
    await get('me', 'invalid').expect(401);
  });
  it('rejects a different signing key', async () => {
    await get(
      'me',
      token(
        {},
        wrongKeys.privateKey
          .export({ type: 'pkcs8', format: 'pem' })
          .toString(),
      ),
    ).expect(401);
  });
  it('rejects a tampered payload', async () => {
    const parts = token().split('.');
    parts[1] = Buffer.from(
      JSON.stringify(claims({ role: 'ADMIN_CODE' })),
    ).toString('base64url');
    await get('admin', parts.join('.')).expect(401);
  });
  it('rejects a refresh JWT even if signed by the trusted RSA key', async () => {
    await get('me', token({ token_use: 'refresh' })).expect(401);
  });
  it('rejects HS256', async () => {
    await get(
      'me',
      jwt.sign(claims(), { secret: publicKey, algorithm: 'HS256' }),
    ).expect(401);
  });
  it('rejects expired JWT', async () => {
    const now = Math.floor(Date.now() / 1000);
    await get('me', token({ iat: now - 900, exp: now - 1 })).expect(401);
  });
  it('rejects a different issuer', async () => {
    await get('me', token({ iss: 'https://wrong.example.test' })).expect(401);
  });
  it('rejects a different audience', async () => {
    await get('me', token({ aud: 'other-service' })).expect(401);
  });
  it('rejects missing expiry', async () => {
    const payload = claims();
    delete (payload as Partial<typeof payload>).exp;
    await get(
      'me',
      jwt.sign(payload, { privateKey, algorithm: 'RS256' }),
    ).expect(401);
  });
  it('rejects future-issued JWT', async () => {
    const now = Math.floor(Date.now() / 1000);
    await get('me', token({ iat: now + 10, exp: now + 900 })).expect(401);
  });
  it('rejects forced-password-change account for business routes', async () => {
    await get('me', token({ must_change_password: true })).expect(403);
  });
  it('rejects unknown role code', async () => {
    await get('me', token({ role: 'ADMIN' })).expect(403);
  });
  it('rejects user on admin route', async () => {
    await get('admin', token()).expect(403);
  });
  it('accepts configured exact admin role code', async () => {
    await get('admin', token({ role: 'ADMIN_CODE' })).expect(200);
  });
  it('does not give account admin implicit bypass', async () => {
    await get('admin', token({ role: 'ACCOUNT_ADMIN' })).expect(403);
  });
  it('requires all explicitly declared permissions, even for admins', async () => {
    await get(
      'permission',
      token({ role: 'ADMIN_CODE', permissions: ['product.write'] }),
    ).expect(403);
  });
  it('accepts matching permission keys', async () => {
    await get(
      'permission',
      token({ permissions: ['product.read', 'product.write'] }),
    ).expect(200);
  });
  it('denies authenticated requests to unclassified routes', async () => {
    await get('unclassified', token({ role: 'ADMIN_CODE' })).expect(403);
  });
});
