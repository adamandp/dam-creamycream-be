import { Injectable } from '@nestjs/common';
import { CreateUserNotificationDto } from './dto/create-user-notification.dto';
import { PinoLogger } from 'nestjs-pino';
import { NotificationsService } from '../notifications/notifications.service';
import { WebResponse } from '../../common/common.interface';
// import { PrismaService } from 'src/common/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Messages } from '../../utils/message.helper';
import { PaginationDto } from '../../common/common.dto';
import { NotFoundException } from '../../exceptions';
import {
  ValidateUserNotificationDto as ValidateDto,
  FindAllUserNotificationDto as FindAllDto,
  FindByIdUserNotificationDto as FindByIdDto,
  FindByUserUserNotificationDto as FindByUserDto,
  FindByUserCountUserNotificationDto as FindByUserCountDto,
  FindByNotifiactionUserNotificationDto as FindByNotifiactionDto,
  FindByNotifiactionCountUserNotificationDto as FindByNotificationCount,
} from './user-notifications.interface';
import { JwtPayload } from '../../integrations/accounts/accounts.interface';

@Injectable()
export class UserNotificationsService {
  constructor(
    private readonly logger: PinoLogger,

    private readonly notification: NotificationsService,
    private readonly prisma: PrismaService,
  ) {
    this.logger.setContext(UserNotificationsService.name);
  }

  private name = 'User Notification';

  async create(body: CreateUserNotificationDto): Promise<WebResponse> {
    await this.notification.validateNotification(body.notificationId);
    return this.prisma.userNotification
      .create({ data: body })
      .then(() => ({ message: Messages.create(this.name) }));
  }

  async findAll({
    limit,
    page,
  }: PaginationDto): Promise<WebResponse<FindAllDto>> {
    const skip = Math.max((page - 1) * limit, 0);
    return await Promise.all([
      this.prisma.userNotification.findMany({
        skip,
        take: limit,
        include: { notifications: true },
      }),
      this.prisma.userNotification.count(),
    ]).then(([data, total]) => {
      if (total <= 0) throw new NotFoundException(this.name);
      return {
        message: Messages.get(this.name),
        data,
        paging: {
          currentPage: page,
          pageSize: limit,
          totalItems: total,
          totalPages: Math.ceil(total / (limit || 1)),
        },
      };
    });
  }

  async validateUserNotification(
    id: string,
  ): Promise<WebResponse<ValidateDto>> {
    return await this.prisma.userNotification
      .findUniqueOrThrow({ where: { id } })
      .then((data) => ({ message: Messages.get(this.name), data }));
  }

  async findById(id: string): Promise<WebResponse<FindByIdDto>> {
    return await this.prisma.userNotification
      .findUniqueOrThrow({ where: { id }, include: { notifications: true } })
      .then((data) => ({ message: Messages.get(this.name), data }));
  }

  async updateRead(id: string, actor: JwtPayload): Promise<WebResponse> {
    return await this.prisma.userNotification
      .update({
        where: { id, userId: actor.sub },
        data: { isRead: true },
      })
      .then(() => ({ message: Messages.update(this.name) }));
  }

  async findByUser(
    request: JwtPayload,
    { limit, page }: PaginationDto,
  ): Promise<WebResponse<FindByUserDto>> {
    const { sub } = request;
    const skip = Math.max((page - 1) * limit, 0);
    return await Promise.all([
      this.prisma.userNotification.findMany({
        where: { userId: sub },
        skip,
        take: limit,
        include: { notifications: true },
      }),
      this.prisma.userNotification.count({ where: { userId: sub } }),
    ]).then(([data, total]) => {
      if (total <= 0) throw new NotFoundException(this.name);
      return {
        message: Messages.get(this.name),
        data,
        paging: {
          currentPage: page,
          pageSize: limit,
          totalItems: total,
          totalPages: Math.ceil(total / (limit || 1)),
        },
      };
    });
  }

  async findByNotification(
    id: string,
    { limit, page }: PaginationDto,
  ): Promise<WebResponse<FindByNotifiactionDto>> {
    await this.notification.validateNotification(id);
    const skip = Math.max((page - 1) * limit, 0);
    return await Promise.all([
      this.prisma.userNotification.findMany({
        where: { notificationId: id },
        skip,
        take: limit,
        include: { notifications: true },
      }),
      this.prisma.userNotification.count({ where: { notificationId: id } }),
    ]).then(([data, total]) => {
      if (total <= 0) throw new NotFoundException(this.name);
      return {
        message: Messages.get(this.name),
        data,
        paging: {
          currentPage: page,
          pageSize: limit,
          totalItems: total,
          totalPages: Math.ceil(total / (limit || 1)),
        },
      };
    });
  }

  async findByNotificationCount(
    id: string,
  ): Promise<WebResponse<FindByNotificationCount>> {
    await this.notification.validateNotification(id);
    return await this.prisma.userNotification
      .count({ where: { notificationId: id } })
      .then((data) => ({
        message: Messages.get(this.name),
        data: { count: data },
      }));
  }

  async findByUserCount(
    request: JwtPayload,
  ): Promise<WebResponse<FindByUserCountDto>> {
    const { sub } = request;
    return await this.prisma.userNotification
      .count({ where: { userId: sub } })
      .then((data) => ({
        message: Messages.get(this.name),
        data: { count: data },
      }));
  }
}
