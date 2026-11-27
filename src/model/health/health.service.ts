import { Injectable } from '@nestjs/common';
import {
  HealthCheckResult,
  HealthCheckService,
  HttpHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { RedisService } from '../../common/redis/redis.service';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private prismaHealth: PrismaHealthIndicator,
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  healthCheck(): Promise<HealthCheckResult> {
    return this.health.check([
      async () => ({ application: { status: 'up' } }),
      () => this.prismaHealth.pingCheck('db', this.prisma),
      async () => ({
        redis: { status: (await this.redis.ping()) === 'PONG' ? 'up' : 'down' },
      }),
    ]);
  }

  dbCheck() {
    return this.prismaHealth.pingCheck('db', this.prisma);
  }
}
