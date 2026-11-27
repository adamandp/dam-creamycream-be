import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { createHash, timingSafeEqual } from 'node:crypto';
import { qstashConfig } from '../../config/qstash.config';

export const EXPIRE_PATH = '/payments/expire-checkout';
export const RECONCILE_PATH = '/payments/reconcile';

export function verifyQstash(
  signature: string,
  raw: Buffer,
  destination: string,
  keys: string[],
) {
  if (!signature || signature.length > 8192) return false;
  const jwt = new JwtService();
  const now = Math.floor(Date.now() / 1000);
  const expected = createHash('sha256').update(raw).digest();
  return keys.filter(Boolean).some((secret) => {
    try {
      const claims = jwt.verify<Record<string, unknown>>(signature, {
        secret,
        algorithms: ['HS256'],
        issuer: 'Upstash',
        subject: destination,
        clockTolerance: 0,
      });
      if (
        typeof claims.iat !== 'number' ||
        !Number.isInteger(claims.iat) ||
        typeof claims.exp !== 'number' ||
        !Number.isInteger(claims.exp) ||
        typeof claims.nbf !== 'number' ||
        !Number.isInteger(claims.nbf) ||
        claims.iat > now ||
        claims.exp <= now ||
        claims.exp <= claims.iat ||
        claims.nbf > now ||
        typeof claims.jti !== 'string' ||
        !claims.jti ||
        typeof claims.body !== 'string' ||
        !/^[A-Za-z0-9_-]{43}=?$/.test(claims.body)
      )
        return false;
      const actual = Buffer.from(claims.body, 'base64url');
      return (
        actual.length === expected.length && timingSafeEqual(actual, expected)
      );
    } catch {
      return false;
    }
  });
}

@Injectable()
export class QstashService {
  private readonly logger = new Logger(QstashService.name);

  // Database commit is authoritative; the periodic sweep recovers lost publishes.
  async publishExpiration(orderId: string, deadline: Date) {
    try {
      const config = qstashConfig();
      const destination = config.base + EXPIRE_PATH;
      await axios.post(
        config.url + '/v2/publish/' + destination,
        { orderId },
        {
          headers: {
            Authorization: 'Bearer ' + config.token,
            'Content-Type': 'application/json',
            'Upstash-Not-Before': String(Math.ceil(deadline.getTime() / 1000)),
            'Upstash-Deduplication-Id': 'checkout-expire-' + orderId,
            'Upstash-Retries': '3',
          },
          timeout: 5000,
          maxRedirects: 0,
        },
      );
    } catch {
      this.logger.warn(
        'Checkout expiration publish not acknowledged; scheduled reconciliation will recover',
      );
    }
  }

  assertSignature(signature: string, raw: Buffer | undefined, path: string) {
    if (!raw) throw new ForbiddenException('Invalid QStash signature');
    const config = qstashConfig();
    if (
      !verifyQstash(signature, raw, config.base + path, [
        config.current,
        config.next,
      ])
    )
      throw new ForbiddenException('Invalid QStash signature');
  }

  async registerSchedule() {
    const config = qstashConfig();
    const destination = config.base + RECONCILE_PATH;
    const id =
      'core-reconcile-' +
      createHash('sha256').update(destination).digest('hex').slice(0, 32);
    const response = await axios.post<{ scheduleId?: unknown }>(
      config.url + '/v2/schedules/' + destination,
      {},
      {
        headers: {
          Authorization: 'Bearer ' + config.token,
          'Content-Type': 'application/json',
          'Upstash-Cron': '*/5 * * * *',
          'Upstash-Schedule-Id': id,
          'Upstash-Retries': '3',
        },
        timeout: 10000,
        maxRedirects: 0,
      },
    );
    if (typeof response.data?.scheduleId !== 'string')
      throw new Error('Invalid schedule response');
    return response.data.scheduleId;
  }
}
