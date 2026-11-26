import { ServiceUnavailableException } from '@nestjs/common';
import type { ThrottlerStorage } from '@nestjs/throttler';
import { RedisService } from './redis.service';

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: RedisService) {}
  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    name: string,
  ) {
    // Atomic fixed window shared across replicas; related keys share a Redis hash slot.
    const prefix = 'creamy:throttle:{' + key + '}:' + name;
    try {
      const r = (await this.redis.eval(
        `
        local blocked=redis.call('PTTL',KEYS[2])
        if blocked>0 then return {tonumber(redis.call('GET',KEYS[1]) or '0'),redis.call('PTTL',KEYS[1]),1,blocked} end
        local count=redis.call('INCR',KEYS[1])
        if count==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end
        local remaining=redis.call('PTTL',KEYS[1])
        if count>tonumber(ARGV[2]) then
          local block=math.max(remaining,tonumber(ARGV[3]))
          redis.call('SET',KEYS[2],'1','PX',block)
          return {count,remaining,1,block}
        end
        return {count,remaining,0,0}
      `,
        2,
        prefix,
        prefix + ':blocked',
        ttl,
        limit,
        blockDuration,
      )) as number[];
      return {
        totalHits: r[0],
        timeToExpire: Math.ceil(Math.max(0, r[1]) / 1000),
        isBlocked: r[2] === 1,
        timeToBlockExpire: Math.ceil(r[3] / 1000),
      };
    } catch {
      throw new ServiceUnavailableException('Rate limiter unavailable');
    }
  }
}
