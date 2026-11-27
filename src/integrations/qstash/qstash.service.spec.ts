import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import axios from 'axios';
import {
  EXPIRE_PATH,
  RECONCILE_PATH,
  QstashService,
  verifyQstash,
} from './qstash.service';
import { qstashConfig } from '../../config/qstash.config';

describe('QStash checkout delivery', () => {
  const jwt = new JwtService();
  const current = 'test-current-signing-key';
  const next = 'test-next-signing-key';
  const base = 'https://store.example.com/core-service';
  const raw = Buffer.from(JSON.stringify({ orderId: randomUUID() }));
  const destination = base + EXPIRE_PATH;
  const sign = (key: string, claims: Record<string, unknown> = {}) => {
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      {
        iss: 'Upstash',
        sub: destination,
        iat: now,
        exp: now + 60,
        nbf: now - 1,
        jti: randomUUID(),
        body: createHash('sha256').update(raw).digest('base64url'),
        ...claims,
      },
      { secret: key, algorithm: 'HS256' },
    );
  };
  it('accepts both signing keys and binds raw body and exact endpoint', () => {
    for (const key of [current, next]) {
      const token = sign(key);
      expect(verifyQstash(token, raw, destination, [current, next])).toBe(true);
      expect(
        verifyQstash(token, raw, base + RECONCILE_PATH, [current, next]),
      ).toBe(false);
      expect(
        verifyQstash(token, Buffer.from('{}'), destination, [current, next]),
      ).toBe(false);
    }
    expect(verifyQstash(sign('wrong'), raw, destination, [current, next])).toBe(
      false,
    );
    expect(
      verifyQstash(sign(current, { iss: 'other' }), raw, destination, [
        current,
        next,
      ]),
    ).toBe(false);
    expect(
      verifyQstash(sign(current, { exp: 1 }), raw, destination, [
        current,
        next,
      ]),
    ).toBe(false);
    expect(
      verifyQstash(
        sign(current, { nbf: Math.floor(Date.now() / 1000) + 60 }),
        raw,
        destination,
        [current, next],
      ),
    ).toBe(false);
    expect(verifyQstash('', raw, destination, [current, next])).toBe(false);
  });

  const settings = {
    QSTASH_URL: 'https://qstash-eu-central-1.upstash.io',
    QSTASH_TOKEN: 'fixture',
    QSTASH_CURRENT_SIGNING_KEY: current,
    QSTASH_NEXT_SIGNING_KEY: next,
  };
  it('supports regional URL and the Vercel production hostname', () => {
    expect(
      qstashConfig({
        ...settings,
        VERCEL_PROJECT_PRODUCTION_URL: 'api.example.com',
      }).base,
    ).toBe('https://api.example.com');
    expect(() =>
      qstashConfig({
        ...settings,
        QSTASH_URL: 'https://other.example.com',
        PUBLIC_BASE_URL: base,
      }),
    ).toThrow();
  });
  it('publishes at the exact deadline and registers a deterministic schedule', async () => {
    const original = process.env;
    process.env = { ...original, ...settings, PUBLIC_BASE_URL: base };
    const post = jest
      .spyOn(axios, 'post')
      .mockResolvedValue({ data: { scheduleId: 'fixture' } });
    try {
      const service = new QstashService();
      const orderId = randomUUID();
      const deadline = new Date(Date.now() + 30 * 60 * 1000);
      await service.publishExpiration(orderId, deadline);
      expect(post).toHaveBeenCalledWith(
        settings.QSTASH_URL + '/v2/publish/' + destination,
        { orderId },
        expect.objectContaining({
          headers: expect.objectContaining({
            'Upstash-Not-Before': String(Math.ceil(deadline.getTime() / 1000)),
            'Upstash-Deduplication-Id': 'checkout-expire-' + orderId,
          }) as unknown,
        }),
      );
      expect(await service.registerSchedule()).toBe('fixture');
      expect(post).toHaveBeenLastCalledWith(
        settings.QSTASH_URL + '/v2/schedules/' + base + RECONCILE_PATH,
        {},
        expect.objectContaining({
          headers: expect.objectContaining({
            'Upstash-Cron': '*/5 * * * *',
          }) as unknown,
        }),
      );
      post.mockRejectedValueOnce(new Error('network failed'));
      await expect(
        service.publishExpiration(orderId, deadline),
      ).resolves.toBeUndefined();
    } finally {
      post.mockRestore();
      process.env = original;
    }
  });
});
