import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { RedisModule } from 'src/common/redis/redis.module';
import { RedisService } from 'src/common/redis/redis.service';
import { RedisThrottlerStorage } from 'src/common/redis/redis-throttler.storage';
import { AccountsConfig } from '../../config/accounts.config';
import { JwtGuard } from '../../guards/jwt.guard';
import { RolesGuard } from '../../guards/roles.guard';
import { PermissionsGuard } from '../../guards/permissions.guard';
import { UserRateLimitGuard } from '../../guards/user-rate-limit.guard';
import { AccountsClient } from './accounts.client';
@Global()
@Module({
  imports: [
    RedisModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redis: RedisService) => ({
        throttlers: [{ ttl: 60000, limit: 120 }],
        storage: new RedisThrottlerStorage(redis),
      }),
    }),
  ],
  providers: [
    AccountsConfig,
    AccountsClient,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: UserRateLimitGuard },
  ],
  exports: [AccountsConfig, AccountsClient],
})
export class AccountsModule {}
