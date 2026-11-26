import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { UpdateStatusShipmentDto } from './dto/update-shipment.dto';
import { PinoLogger } from 'nestjs-pino';
// import { PrismaService } from 'src/common/prisma.module';
import { PrismaService } from 'src/common/prisma/prisma.service';
import {
  FindAllShipmentDto as FindAllDto,
  FindByIdShipmentDto as FindByIdDto,
  FindManyIdShipmentDto as FindManyDto,
  ShippingData,
  ShippingResponse,
} from './shipments.interface';
import { WebResponse } from 'src/common/common.interface';
import { PaginationDto } from 'src/common/common.dto';
import { NotFoundException } from 'src/exceptions';
import { ErrorMessage, Messages } from 'src/utils/message.helper';
import { CostDto, QuoteDto } from './dto/cost-shipment.dto';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.logger.setContext(ShipmentsService.name);
  }

  private name = 'Shipment';

  async destinations(q: string) {
    try {
      const base = this.configService
        .getOrThrow<string>('RAJAONGKIR_BASE_URL')
        .replace(/\/$/, '');
      const { data } = await firstValueFrom(
        this.httpService.get(base + '/destination/domestic-destination', {
          params: { search: q, limit: 20, offset: 0 },
          headers: {
            key: this.configService.getOrThrow<string>('RAJAONGKIR_API_KEY'),
          },
          timeout: 5000,
          maxRedirects: 0,
        }),
      );
      if (data?.meta?.code !== 200 || !Array.isArray(data?.data))
        throw new Error('Invalid provider response');
      return { data: data.data };
    } catch {
      throw new InternalServerErrorException(
        'Shipping destination search unavailable',
      );
    }
  }

  async quote(request: QuoteDto, userId: string) {
    const address = await this.prisma.address.findFirst({
      where: { id: request.addressId, userId },
    });
    if (!address?.destinationId)
      throw new ConflictException('Shipping destination missing');
    const items = await this.prisma.cartItem.findMany({
      where: {
        carts: { userId },
        productId: { in: request.items.map((i) => i.productId) },
      },
      include: {
        products: {
          include: { productDiscounts: { include: { discounts: true } } },
        },
      },
    });
    let weight = 0;
    const bonus = new Map<string, number>();
    const now = new Date();
    for (const input of request.items) {
      const item = items.find((i) => i.productId === input.productId);
      if (
        !item ||
        item.quantity < input.quantity ||
        !item.products.isActive ||
        !item.products.weightGrams ||
        item.products.weightGrams < 1
      )
        throw new ConflictException('Product or shipping weight unavailable');
      weight += item.products.weightGrams * input.quantity;
      if (input.discountId) {
        const link = item.products.productDiscounts,
          d = link?.discounts;
        if (
          !link?.isActive ||
          !d ||
          d.id !== input.discountId ||
          d.startDate > now ||
          d.endDate < now ||
          input.quantity > d.maxApplied ||
          d.redeemedCount + input.quantity > d.maxRedeemed
        )
          throw new ConflictException('Discount unavailable');
        if (d.discountType === 'FREE_ITEM' && d.productId && d.quantity)
          bonus.set(d.productId, (bonus.get(d.productId) ?? 0) + d.quantity);
      }
    }
    if (request.voucherIds?.length) {
      const vouchers = await this.prisma.userVoucher.findMany({
        where: {
          userId,
          voucherId: { in: request.voucherIds },
          status: 'CLAIMED',
          expiredAt: { gt: now },
        },
        include: { vouchers: true },
      });
      if (vouchers.length !== request.voucherIds.length)
        throw new ConflictException('Voucher unavailable');
      for (const { vouchers: v } of vouchers) {
        if (
          !v.isActive ||
          v.startDate > now ||
          v.endDate < now ||
          v.redeemedCount >= v.maxRedeemed
        )
          throw new ConflictException('Voucher unavailable');
        if (v.type === 'FREE_ITEM' && v.productId && v.quantity)
          bonus.set(v.productId, (bonus.get(v.productId) ?? 0) + v.quantity);
      }
    }
    if (bonus.size) {
      const products = await this.prisma.product.findMany({
        where: { id: { in: [...bonus.keys()] }, isActive: true },
      });
      for (const [id, qty] of bonus) {
        const grams = products.find((p) => p.id === id)?.weightGrams;
        if (!grams || grams < 1)
          throw new ConflictException('Bonus shipping weight unavailable');
        weight += grams * qty;
      }
    }
    if (!Number.isSafeInteger(weight) || weight < 1 || weight > 1000000)
      throw new ConflictException('Invalid shipment weight');
    return this.cost({
      origin: Number(this.configService.getOrThrow('SHIPPING_ORIGIN_ID')),
      destination: address.destinationId,
      weight,
    });
  }

  async findAll({
    limit,
    page,
  }: PaginationDto): Promise<WebResponse<FindAllDto>> {
    const skip = Math.max((page - 1) * limit, 0);
    return await Promise.all([
      this.prisma.shipment.findMany({
        skip,
        take: limit,
      }),
      this.prisma.shipment.count(),
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

  async findById(id: string): Promise<WebResponse<FindByIdDto>> {
    return await this.prisma.shipment
      .findUniqueOrThrow({ where: { id } })
      .then((data) => ({ message: Messages.get(this.name), data }));
  }

  async findMany(ids: string[]): Promise<WebResponse<FindManyDto>> {
    return await this.prisma.shipment
      .findMany({ where: { id: { in: ids } } })
      .then((data) => ({ message: Messages.get(this.name), data }));
  }

  async updateStatus(id: string, body: UpdateStatusShipmentDto) {
    return this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUniqueOrThrow({
        where: { id },
        include: { orders: true },
      });
      if (
        body.status === 'SHIPPED' &&
        shipment.status === 'PENDING' &&
        shipment.orders.status === 'PAID'
      ) {
        const changed = await tx.order.updateMany({
          where: { id: shipment.orderId, status: 'PAID' },
          data: { status: 'SHIPPED' },
        });
        if (changed.count !== 1)
          throw new ConflictException('Order state changed');
      } else if (
        body.status === 'DELIVERED' &&
        shipment.status === 'SHIPPED' &&
        shipment.orders.status === 'SHIPPED'
      ) {
        const changed = await tx.order.updateMany({
          where: { id: shipment.orderId, status: 'SHIPPED' },
          data: { status: 'DELIVERED' },
        });
        if (changed.count !== 1)
          throw new ConflictException('Order state changed');
      } else throw new ConflictException('Invalid shipment transition');
      await tx.shipment.update({
        where: { id },
        data: {
          status: body.status,
          deliveredAt: body.status === 'DELIVERED' ? new Date() : undefined,
        },
      });
      return { message: Messages.update(this.name) };
    });
  }

  async cost(request: CostDto): Promise<WebResponse<ShippingData[]>> {
    const data = {
      ...request,
      courier:
        'jne:sicepat:ide:sap:jnt:ninja:tiki:lion:anteraja:pos:ncs:rex:rpx:sentral:star:wahana:dse',
    };
    return await firstValueFrom(
      this.httpService.post<ShippingResponse>(
        `${this.configService.get<string>('RAJAONGKIR_BASE_URL')}/calculate/domestic-cost`,
        data,
        {
          timeout: 5000,
          maxRedirects: 0,
          headers: {
            key: this.configService.get<string>('RAJAONGKIR_API_KEY'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        },
      ),
    )
      .catch(() => {
        this.logger.error('Shipping provider request failed');
        throw new InternalServerErrorException(
          ErrorMessage.create('Shipping cost'),
        );
      })
      .then((response) => {
        return {
          message: response.data.meta.message,
          status: response.data.meta.code,
          data: response.data.data,
        };
      });
  }
}
