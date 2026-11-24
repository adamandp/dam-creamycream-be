import { Public, Roles } from 'src/decorators/access.decorator';
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { HealthCheck } from '@nestjs/terminus';

@Roles('ADMIN', 'SUPER_ADMIN')
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
