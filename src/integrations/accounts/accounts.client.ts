import {
  Injectable,
  BadGatewayException,
  HttpException,
  ForbiddenException,
} from '@nestjs/common';
import axios from 'axios';
import { Request, Response } from 'express';
import { AccountsConfig } from '../../config/accounts.config';
import { z } from 'zod';

const profileSchema = z.object({
  id: z.uuid(),
  username: z.string().nullable(),
  name: z.string().nullable(),
  imageUrl: z.string().nullable(),
  isActive: z.boolean(),
});
@Injectable()
export class AccountsClient {
  constructor(private readonly config: AccountsConfig) {}
  private async call(
    method: string,
    path: string,
    headers: Record<string, string> = {},
    data?: unknown,
  ) {
    try {
      return await axios.request({
        method,
        url: this.config.baseUrl + path,
        headers,
        data,
        timeout: 5000,
        maxRedirects: 0,
        maxContentLength: 4 * 1024 * 1024,
        maxBodyLength: 2 * 1024 * 1024,
        validateStatus: () => true,
      });
    } catch {
      throw new BadGatewayException('Accounts Service unavailable');
    }
  }
  async profile(authorization: string, expectedId: string) {
    const res = await this.call('GET', '/users/me', { authorization });
    if (res.status !== 200)
      throw new HttpException(
        'Unable to retrieve account profile',
        [401, 403, 404].includes(res.status) ? res.status : 502,
      );
    const parsed = profileSchema.safeParse(res.data?.data);
    if (
      !parsed.success ||
      parsed.data.id !== expectedId ||
      !parsed.data.isActive
    )
      throw new BadGatewayException('Invalid account profile');
    return parsed.data;
  }
  async validateTarget(id: string, authorization: string) {
    if (!z.uuid().safeParse(id).success) throw new ForbiddenException();
    const res = await this.call('GET', '/users/' + id, { authorization });
    if (res.status !== 200)
      throw new HttpException(
        'Unable to validate target account',
        [401, 403, 404].includes(res.status) ? res.status : 502,
      );
    const result = profileSchema.safeParse(res.data?.data);
    if (!result.success || result.data.id !== id || !result.data.isActive)
      throw new ForbiddenException('Invalid target account');
  }
  async forward(
    method: string,
    path: string,
    req: Request,
    res: Response,
    data?: unknown,
  ) {
    const origin = req.headers.origin;
    if (data !== undefined && !req.is('application/json'))
      throw new HttpException('JSON content required', 415);
    if (origin && !this.config.origins.includes(origin))
      throw new ForbiddenException('Untrusted origin');
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    if (req.headers.authorization)
      headers.authorization = req.headers.authorization;
    if (origin) headers.origin = origin;
    const cookie = req.headers.cookie
      ?.split(';')
      .map((v) => v.trim())
      .find((v) => v.startsWith('refreshToken='));
    if (cookie && method !== 'GET') {
      if (!origin || !this.config.origins.includes(origin))
        throw new ForbiddenException('Trusted origin required');
      headers.cookie = cookie;
    }
    const upstream = await this.call(method, path, headers, data);
    if (
      upstream.status >= 500 ||
      upstream.status < 200 ||
      (upstream.status >= 300 && upstream.status < 400)
    )
      throw new BadGatewayException('Accounts Service unavailable');
    res.setHeader('Cache-Control', 'no-store');
    // Forward only the refresh cookie, never arbitrary upstream response headers.
    const cookies = upstream.headers['set-cookie']?.filter((v) =>
      /^refreshToken=/.test(v),
    );
    if (cookies?.length) {
      if (
        cookies.some(
          (cookie) =>
            !/;\s*HttpOnly(?:;|$)/i.test(cookie) ||
            /;\s*Domain=/i.test(cookie) ||
            (process.env.NODE_ENV === 'production' &&
              !/;\s*Secure(?:;|$)/i.test(cookie)) ||
            !/;\s*SameSite=(?:Lax|Strict|None)(?:;|$)/i.test(cookie),
        )
      )
        throw new BadGatewayException('Invalid upstream session cookie');
      res.setHeader('Set-Cookie', cookies);
    }
    if (upstream.headers['retry-after'])
      res.setHeader('Retry-After', String(upstream.headers['retry-after']));
    return res.status(upstream.status).json(upstream.data);
  }
}
