import {
  CanActivate,
  ExecutionContext,
  HttpException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RedisService } from 'src/common/redis/redis.service';
import { RedisThrottlerStorage } from 'src/common/redis/redis-throttler.storage';
import { AuthenticatedRequest } from './jwt.guard';
const KEY = 'user-rate-limit';
export const UserRateLimit = (limit: number) => SetMetadata(KEY, limit);
@Injectable()
export class UserRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const limit = this.reflector.get<number>(KEY, ctx.getHandler());
    if (!limit) return true;
    const req = ctx.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.user) return false;
    const key =
      'user:' +
      req.user.sub +
      ':' +
      ctx.getClass().name +
      ':' +
      ctx.getHandler().name;
    const result = await new RedisThrottlerStorage(this.redis).increment(
      key,
      60000,
      limit,
      60000,
      'account',
    );
    if (result.isBlocked) {
      ctx
        .switchToHttp()
        .getResponse()
        .setHeader('Retry-After', String(result.timeToBlockExpire));
      throw new HttpException('Too many requests', 429);
    }
    return true;
  }
}
