import {
  Injectable,
  BadGatewayException,
  HttpException,
  ForbiddenException,
} from '@nestjs/common';
import axios from 'axios';
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
}
