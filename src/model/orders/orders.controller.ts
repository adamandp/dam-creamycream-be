import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from 'src/decorators/access.decorator';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import type { JwtPayload } from 'src/integrations/accounts/accounts.interface';
import { PaginationDto } from 'src/common/common.dto';
import { CheckOutDto } from './dto/checkout.dto';
import { OrdersService } from './orders.service';
import { z } from 'zod';
import { ApiHeader, ApiOperation } from '@nestjs/swagger';
import { UserRateLimit } from 'src/guards/user-rate-limit.guard';
import { Throttle } from '@nestjs/throttler';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}
  @Roles('CUSTOMER')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: 'Create a server-priced, idempotent checkout' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: true,
    description:
      'Client-generated UUID; reuse only for retries of the same checkout',
    schema: { type: 'string', format: 'uuid' },
  })
  @UserRateLimit(10)
  @Post('checkout')
  checkout(
    @Body() body: CheckOutDto,
    @CurrentUser() actor: JwtPayload,
    @Headers('idempotency-key') key: string,
  ) {
    if (!z.uuid().safeParse(key).success)
      throw new BadRequestException('Idempotency-Key must be a UUID');
    return this.ordersService.checkout(body, actor, key);
  }
  @Roles('CUSTOMER')
  @Get('me')
  mine(@CurrentUser() actor: JwtPayload, @Query() pagination: PaginationDto) {
    return this.ordersService.mine(actor, pagination);
  }
  @Roles('STORE_ADMIN')
  @Get()
  findAll(@Query() pagination: PaginationDto) {
    return this.ordersService.findAll(pagination);
  }
  @Roles('CUSTOMER', 'STORE_ADMIN')
  @Get(':id')
  findOne(
    @CurrentUser() actor: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.ordersService.findOne(actor, id);
  }
}
