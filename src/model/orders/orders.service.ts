import type { JwtPayload } from 'src/integrations/accounts/accounts.interface';
import { Injectable } from '@nestjs/common';
import { PinoLogger } from 'nestjs-pino';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AccountsConfig } from 'src/config/accounts.config';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CheckOutCommand } from './cqrs/commands/checkout/checkout.command';
import { WebResponse } from 'src/common/common.interface';
import { CheckOutDto } from './dto/checkout.dto';
import { PaginationDto } from 'src/common/common.dto';
import { FindAllOrderResDto as FindAllDto } from './orders.interface';
import { FindAllOrderCommand } from './cqrs/queries/find-all/find-all.query';

@Injectable()
export class OrdersService {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly config: AccountsConfig,
  ) {
    this.logger.setContext(OrdersService.name);
  }

  async checkout(
    body: CheckOutDto,
    actor: JwtPayload,
    key: string,
  ): Promise<WebResponse> {
    return this.commandBus.execute(new CheckOutCommand(body, actor, key));
  }

  async findAll(pagination: PaginationDto): Promise<WebResponse<FindAllDto>> {
    return this.queryBus.execute(new FindAllOrderCommand(pagination));
  }
  async mine(actor: JwtPayload, { page, limit }: PaginationDto) {
    const where = { userId: actor.sub };
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);
    return {
      data,
      paging: {
        currentPage: page,
        pageSize: limit,
        totalItems: total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  async findOne(actor: JwtPayload, id: string) {
    return {
      data: await this.prisma.order.findFirstOrThrow({
        where: {
          id,
          ...(actor.role === this.config.roles.CUSTOMER
            ? { userId: actor.sub }
            : {}),
        },
        include: { orderItems: true, shipments: true },
      }),
    };
  }
}
