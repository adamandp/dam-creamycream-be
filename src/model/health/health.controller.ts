import { Public, Roles } from '../../decorators/access.decorator';
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthCheck } from '@nestjs/terminus';

@Roles('STORE_ADMIN')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @HealthCheck()
  check() {
    return this.healthService.healthCheck();
  }

  @Get('/db')
  @HealthCheck()
  dbCheck() {
    return this.healthService.dbCheck();
  }
}
