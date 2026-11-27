import {
  Body,
  Headers,
  Req,
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Public, Roles } from '../../decorators/access.decorator';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { JwtPayload } from '../../integrations/accounts/accounts.interface';
import { PaginationDto } from '../../common/common.dto';
import { ApiBody, ApiHeader, ApiOperation } from '@nestjs/swagger';
import { createZodDto } from 'nestjs-zod';
import { paymentInputSchema, PaymentsService } from './payments.service';
import { UserRateLimit } from '../../guards/user-rate-limit.guard';
import { Throttle } from '@nestjs/throttler';

import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import {
  QstashService,
  EXPIRE_PATH,
  RECONCILE_PATH,
} from '../../integrations/qstash/qstash.service';
import { z } from 'zod';
class PaymentInputDto extends createZodDto(paymentInputSchema) {}

@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly qstash: QstashService,
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
  @Post('expire-checkout')
  @HttpCode(200)
  @ApiOperation({ summary: 'QStash signed checkout expiration' })
  @ApiHeader({ name: 'Upstash-Signature', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['orderId'],
      properties: { orderId: { type: 'string', format: 'uuid' } },
    },
  })
  async expireCheckout(
    @Req() req: RawBodyRequest<Request>,
    @Headers('upstash-signature') signature: string,
  ) {
    this.qstash.assertSignature(signature, req.rawBody, EXPIRE_PATH);
    const parsed = z.object({ orderId: z.uuid() }).strict().safeParse(req.body);
    if (!parsed.success)
      throw new BadRequestException('Invalid checkout expiration');
    return this.paymentsService.expireCheckout(parsed.data.orderId);
  }
  @Public()
  @Post('reconcile')
  @HttpCode(200)
  @ApiOperation({ summary: 'QStash signed abandoned checkout reconciliation' })
  @ApiHeader({ name: 'Upstash-Signature', required: true })
  reconcile(
    @Req() req: RawBodyRequest<Request>,
    @Headers('upstash-signature') signature: string,
  ) {
    this.qstash.assertSignature(signature, req.rawBody, RECONCILE_PATH);
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
