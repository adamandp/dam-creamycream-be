import { ConflictException, Injectable } from '@nestjs/common';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { PinoLogger } from 'nestjs-pino';
// import { PrismaService } from 'src/common/prisma.module';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { Messages } from 'src/utils/message.helper';
import { NotFoundException } from 'src/exceptions';
import { PaginationDto } from 'src/common/common.dto';
import { WebResponse } from 'src/common/common.interface';
import {
  findByProductIdInventoryResDto as findByProductId,
  findAllInventoryResDto as findAll,
  findByIdInventoryResDto as findById,
} from './inventory.interface';

@Injectable()
export class InventoryService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
  ) {
    this.logger.setContext(InventoryService.name);
  }

  async findAll({ limit, page }: PaginationDto): Promise<WebResponse<findAll>> {
    this.logger.trace('findAll inventory service method called');
    const skip = Math.max((page - 1) * limit, 0);
    return await Promise.all([
      this.prisma.inventory.findMany({
        skip,
        take: limit,
      }),
      this.prisma.inventory.count(),
    ]).then(([data, total]) => {
      if (total <= 0) throw new NotFoundException('Inventory');
      return {
        message: Messages.get('Inventory'),
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

  async findById(id: string): Promise<WebResponse<findById>> {
    return await this.prisma.inventory
      .findUniqueOrThrow({ where: { id } })
      .then((order) => ({
        message: Messages.get('Inventory'),
        data: order,
      }));
  }

  async findByProductId(id: string): Promise<WebResponse<findByProductId>> {
    return this.prisma.inventory
      .findFirstOrThrow({ where: { productId: id } })
      .then((order) => ({
        message: Messages.get('Inventory'),
        data: order,
      }));
  }

  async update(id: string, body: UpdateInventoryDto): Promise<WebResponse> {
    const result = await this.prisma.inventory.updateMany({
      where: {
        id,
        ...(body.quantity === undefined
          ? {}
          : { reservedQuantity: { lte: body.quantity } }),
      },
      data: { quantity: body.quantity, isActive: body.isActive },
    });
    if (result.count !== 1)
      throw new ConflictException(
        'Inventory not found or quantity below reserved stock',
      );
    return { message: Messages.update('Inventory') };
  }
}
