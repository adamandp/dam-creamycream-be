import {
  Body,
  Headers,
  Req,
  ForbiddenException,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Public, Roles } from 'src/decorators/access.decorator';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import type { JwtPayload } from 'src/integrations/accounts/accounts.interface';
import { PaginationDto } from 'src/common/common.dto';
import { ApiOperation } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { paymentInputSchema, PaymentsService } from './payments.service';
import { UserRateLimit } from 'src/guards/user-rate-limit.guard';
import { Throttle } from '@nestjs/throttler';

import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { ConfigService } from '@nestjs/config';
class PaymentInputDto extends createZodDto(paymentInputSchema) {}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly config: ConfigService,
  ) {}
  @Roles('CUSTOMER', 'STORE_ADMIN')
  @Get()
  list(@CurrentUser() actor: JwtPayload, @Query() pagination: PaginationDto) {
    return this.paymentsService.list(actor, pagination);
  }
  @Public()
  @ApiOperation({
    summary: 'Verify Payment Service callback',
  })
  @Post('webhook')
  @HttpCode(200)
  notification(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-webhook-timestamp') ts: string,
    @Headers('x-webhook-event-id') id: string,
    @Headers('x-webhook-signature') sig: string,
  ) {
    return this.paymentsService.notification(req.rawBody, ts, id, sig);
  }
  @Roles('CUSTOMER')
  @UserRateLimit(10)
  @Post(':orderId/start')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  start(
    @Headers('authorization') authorization: string,
    @Body() body: PaymentInputDto,
    @CurrentUser() actor: JwtPayload,
    @Param('orderId', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.start(actor, id, body, authorization);
  }
  @Roles('CUSTOMER')
  @UserRateLimit(20)
  @Post(':orderId/sync')
  @HttpCode(200)
  sync(
    @Headers('authorization') authorization: string,
    @CurrentUser() actor: JwtPayload,
    @Param('orderId', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.sync(actor, id, authorization);
  }
  @Roles('CUSTOMER')
  @UserRateLimit(10)
  @Post(':orderId/cancel')
  @HttpCode(200)
  cancel(
    @Headers('authorization') authorization: string,
    @CurrentUser() actor: JwtPayload,
    @Param('orderId', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.cancel(actor, id, authorization);
  }
  @Roles('CUSTOMER', 'STORE_ADMIN')
  @Get('methods')
  methods(@Headers('authorization') authorization: string) {
    return this.paymentsService.methods(authorization);
  }
  @Public()
  @Get('reconcile')
  reconcile(@Headers('authorization') authorization: string) {
    const secret = this.config.get<string>('CRON_SECRET');
    if (!secret || authorization !== 'Bearer ' + secret)
      throw new ForbiddenException();
    return this.paymentsService.reconcileDue();
  }
  @Roles('CUSTOMER', 'STORE_ADMIN')
  @Get(':orderId/instructions')
  instructions(
    @CurrentUser() actor: JwtPayload,
    @Param('orderId', ParseUUIDPipe) id: string,
    @Headers('authorization') authorization: string,
  ) {
    return this.paymentsService.instructions(actor, id, authorization);
  }

  @Roles('CUSTOMER', 'STORE_ADMIN')
  @Get(':orderId')
  find(
    @CurrentUser() actor: JwtPayload,
    @Param('orderId', ParseUUIDPipe) id: string,
  ) {
    return this.paymentsService.find(actor, id);
  }
}
