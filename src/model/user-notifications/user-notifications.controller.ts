import { Roles } from 'src/decorators/access.decorator';
import { AccountsClient } from 'src/integrations/accounts/accounts.client';
import { Req } from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { CurrentUser } from 'src/decorators/current-user.decorator';
import type { JwtPayload } from 'src/integrations/accounts/accounts.interface';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { UserNotificationsService } from './user-notifications.service';
import { CreateUserNotificationDto } from './dto/create-user-notification.dto';
import { PinoLogger } from 'nestjs-pino';
import type { WebResponse } from 'src/common/common.interface';
import { PaginationDto } from 'src/common/common.dto';
import {
  FindAllUserNotificationDto as FindAllDto,
  FindByIdUserNotificationDto as FindByIdDto,
  FindByUserUserNotificationDto as FindByUserDto,
  FindByUserCountUserNotificationDto as FindByUserCountDto,
  FindByNotifiactionUserNotificationDto as FindByNotifiactionDto,
  FindByNotifiactionCountUserNotificationDto as FindByNotificationCount,
} from './user-notifications.interface';

@Roles('ADMIN', 'SUPER_ADMIN')
@Controller('user-notifications')
export class UserNotificationsController {
  constructor(
    private readonly service: UserNotificationsService,
    private readonly logger: PinoLogger,
    private readonly accounts: AccountsClient,
  ) {
    this.logger.setContext(UserNotificationsController.name);
  }

  @Post()
  async create(
    @Req() req: ExpressRequest,
    @Body() body: CreateUserNotificationDto,
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

  @Roles('ADMIN', 'SUPER_ADMIN', 'CUSTOMER')
  @Get('me')
  findByUser(
    @CurrentUser() request: JwtPayload,
    @Query() pagination: PaginationDto,
  ): Promise<WebResponse<FindByUserDto>> {
    return this.service.findByUser(request, pagination);
  }

  @Get(':id')
  findById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebResponse<FindByIdDto>> {
    return this.service.findById(id);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'CUSTOMER')
  @Get('count/me')
  findByUserCount(
    @CurrentUser() request: JwtPayload,
  ): Promise<WebResponse<FindByUserCountDto>> {
    return this.service.findByUserCount(request);
  }

  @Get('notification/:id')
  findByNotification(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() pagination: PaginationDto,
  ): Promise<WebResponse<FindByNotifiactionDto>> {
    return this.service.findByNotification(id, pagination);
  }

  @Get('notification/:id/count')
  findByNotificationCount(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<WebResponse<FindByNotificationCount>> {
    return this.service.findByNotificationCount(id);
  }

  @Roles('ADMIN', 'SUPER_ADMIN', 'CUSTOMER')
  @Patch(':id')
  updateRead(
    @CurrentUser() actor: JwtPayload,
    @Param('id') id: string,
  ): Promise<WebResponse> {
    return this.service.updateRead(id, actor);
  }
}
