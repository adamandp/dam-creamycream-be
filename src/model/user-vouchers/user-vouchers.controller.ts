import { Permissions, Roles } from '../../decorators/access.decorator';
import { AccountsClient } from '../../integrations/accounts/accounts.client';
import { Req } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { CurrentUser } from '../../decorators/current-user.decorator';
import type { JwtPayload } from '../../integrations/accounts/accounts.interface';
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserVouchersService } from './user-vouchers.service';
import { CreateUserVoucherDto } from './dto/create-user-voucher.dto';
import { PaginationDto } from '../../common/common.dto';
import type { WebResponse } from '../../common/common.interface';
import { PinoLogger } from 'nestjs-pino';
import {
  FindByUserUserVoucherDto as FindByUserDto,
  FindByIdUserVoucherDto as FindByIdDto,
  FindAllUserVoucherDto as FindAllDto,
  FindByVoucherUserVoucherDto as FindByVoucherDto,
} from './user-vouchers.interface';

@Roles('STORE_ADMIN')
@Controller('user-vouchers')
export class UserVouchersController {
  constructor(
    private readonly service: UserVouchersService,
    private readonly logger: PinoLogger,
    private readonly accounts: AccountsClient,
  ) {
    this.logger.setContext(UserVouchersController.name);
  }

  @Permissions('user.read')
  @Post()
  async create(
    @Req() req: ExpressRequest,
    @Body() body: CreateUserVoucherDto,
  ): Promise<WebResponse> {
    await this.accounts.validateTarget(body.userId, req.headers.authorization!);
    return this.service.create(body);
  }

  @Get()
  findAll(
    @Query() pagination: PaginationDto,
  ): Promise<WebResponse<FindAllDto>> {
    return this.service.findAll(pagination);
  }

  @Roles('STORE_ADMIN', 'CUSTOMER')
  @Get('/user')
  findByUser(
    @CurrentUser() request: JwtPayload,
  ): Promise<WebResponse<FindByUserDto>> {
    return this.service.findByUser(request);
  }

  @Get(':id')
  findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebResponse<FindByIdDto>> {
    return this.service.findById(id);
  }

  @Get('/voucher/:id')
  findByVoucher(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebResponse<FindByVoucherDto>> {
    return this.service.findByVoucher(id);
  }
}
