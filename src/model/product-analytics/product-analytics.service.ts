import { Injectable } from '@nestjs/common';
import { CreateProductAnalyticDto } from './dto/create-product-analytic.dto';
import {
  FindByProductProductAnalyticsDto as FindByProductDto,
  FindByUserProductAnalyticsDto as FindByUserDto,
  FindByProductCountProductAnalyticsDto as FindByProductCountDto,
} from './product-analytics.interface';
import { PinoLogger } from 'nestjs-pino';
// import { PrismaService } from 'src/common/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WebResponse } from '../../common/common.interface';
import { Messages } from '../../utils/message.helper';
import { PaginationDto } from '../../common/common.dto';
import { NotFoundException } from '../../exceptions';
import { JwtPayload } from '../../integrations/accounts/accounts.interface';

@Injectable()
export class ProductAnalyticsService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
  ) {
    this.logger.setContext(ProductAnalyticsService.name);
  }

  private name = 'Product Analytic';

  async create(
    { productId }: CreateProductAnalyticDto,
    actor: JwtPayload,
  ): Promise<WebResponse> {
    return await this.prisma.productAnalytics
      .create({
        data: { productId, userId: actor.sub },
      })
      .then(() => ({ message: Messages.create(this.name) }));
  }

  async findByProduct(
    id: string,
    { limit, page }: PaginationDto,
  ): Promise<WebResponse<FindByProductDto>> {
    const skip = Math.max((page - 1) * limit, 0);
    return await Promise.all([
      this.prisma.productAnalytics.findMany({
        where: { productId: id },
        skip,
        take: limit,
      }),
      this.prisma.productAnalytics.count({ where: { productId: id } }),
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

  async findByUser(
    request: JwtPayload,
    { limit, page }: PaginationDto,
  ): Promise<WebResponse<FindByUserDto>> {
    const { sub } = request;
    const skip = Math.max((page - 1) * limit, 0);
    return await Promise.all([
      this.prisma.productAnalytics.findMany({
        where: { userId: sub },
        skip,
        take: limit,
      }),
      this.prisma.productAnalytics.count({ where: { userId: sub } }),
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

  async findByProductCount(
    id: string,
  ): Promise<WebResponse<FindByProductCountDto>> {
    return await this.prisma.productAnalytics
      .count({ where: { productId: id } })
      .then((data) => ({
        message: Messages.get(this.name),
        data: { count: data },
      }));
  }
}
