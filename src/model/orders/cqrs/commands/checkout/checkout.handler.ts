import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { createHash } from 'node:crypto';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { Prisma } from 'src/generated/prisma/client';
import { CheckOutCommand } from './checkout.command';
import { QstashService } from 'src/integrations/qstash/qstash.service';

@CommandHandler(CheckOutCommand)
@Injectable()
export class CheckoutOrderHandler implements ICommandHandler<CheckOutCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly qstash: QstashService,
  ) {}

  async execute({ payload, actor, key }: CheckOutCommand) {
    const { order, orderItems, shipment } = payload;
    const userId = actor.sub;
    const hash = createHash('sha256')
      .update(
        JSON.stringify({
          addressId: order.addressId,
          vouchers: [...(order.voucherIds ?? [])].sort(),
          items: [...orderItems].sort((a, b) =>
            a.productId.localeCompare(b.productId),
          ),
          courier: shipment.courier,
          service: shipment.service,
        }),
      )
      .digest('hex');
    const existing = async () => {
      const row = await this.prisma.order.findUnique({
        where: { userId_checkoutKey: { userId, checkoutKey: key } },
        include: { payments: true },
      });
      if (row && row.checkoutHash !== hash)
        throw new ConflictException(
          'Idempotency key already used for another checkout',
        );
      return (
        row && {
          message: 'Order already created',
          data: {
            orderId: row.id,
            paymentId: row.payments[0]?.id,
            finalPrice: row.finalPrice,
            status: row.status,
          },
        }
      );
    };
    const old = await existing();
    if (old) return old;
    const addressForQuote = await this.prisma.address.findFirst({
      where: { id: order.addressId, userId },
    });
    if (!addressForQuote) throw new NotFoundException('Address not found');
    // Include free items in the shipping quote as well as the paid cart items.
    const quotedItems = orderItems.map((i) => ({
      productId: i.productId,
      quantity: i.quantity,
    }));
    const discounts = await this.prisma.discount.findMany({
      where: {
        id: {
          in: orderItems.flatMap((i) => (i.discountId ? [i.discountId] : [])),
        },
        discountType: 'FREE_ITEM',
      },
    });
    const vouchers = await this.prisma.voucher.findMany({
      where: { id: { in: order.voucherIds ?? [] }, type: 'FREE_ITEM' },
    });
    for (const promo of [...discounts, ...vouchers]) {
      if (promo.productId && promo.quantity && promo.quantity > 0)
        quotedItems.push({
          productId: promo.productId,
          quantity: promo.quantity,
        });
    }
    const quotedProducts = await this.prisma.product.findMany({
      where: {
        id: { in: quotedItems.map((i) => i.productId) },
        isActive: true,
      },
      select: { id: true, weightGrams: true },
    });
    const weights = new Map(quotedProducts.map((p) => [p.id, p.weightGrams]));
    const shipping = await this.shippingQuote(
      addressForQuote.destinationId,
      quotedItems,
      shipment,
      weights,
    );
    const quotedStock = new Map<string, number>();
    for (const i of quotedItems)
      quotedStock.set(
        i.productId,
        (quotedStock.get(i.productId) ?? 0) + i.quantity,
      );

    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          // Serialize checkout creation for an account across processes.
          await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'checkout:' + userId},0))::text`;
          const pending = await tx.order.count({
            where: { userId, status: 'PENDING' },
          });
          if (pending >= 3)
            throw new ConflictException(
              'Maximum three pending orders; complete or cancel an existing order',
            );
          if (orderItems.reduce((n, i) => n + i.quantity, 0) > 100)
            throw new BadRequestException('Maximum 100 items per checkout');
          const address = await tx.address.findFirst({
            where: { id: order.addressId, userId },
          });
          if (!address) throw new NotFoundException('Address not found');
          if (address.destinationId !== addressForQuote.destinationId)
            throw new ConflictException(
              'Shipping address changed; retry checkout',
            );
          const cart = await tx.cart.findUnique({ where: { userId } });
          if (!cart) throw new NotFoundException('Cart not found');
          const now = new Date();
          const items: Prisma.OrderItemCreateManyOrdersInput[] = [];
          const stock = new Map<string, number>();
          const reserve = (id: string, qty: number) =>
            stock.set(id, (stock.get(id) ?? 0) + qty);
          let subtotal = 0,
            discounted = 0;
          for (const input of [...orderItems].sort((a, b) =>
            a.productId.localeCompare(b.productId),
          )) {
            const product = await tx.product.findFirst({
              where: { id: input.productId, isActive: true },
              include: { productDiscounts: { include: { discounts: true } } },
            });
            if (
              !product ||
              !Number.isSafeInteger(product.price) ||
              product.price < 0
            )
              throw new ConflictException(
                'Product unavailable or invalid price',
              );
            if (product.weightGrams !== weights.get(product.id))
              throw new ConflictException(
                'Product shipping weight changed; retry checkout',
              );
            const cartItem = await tx.cartItem.findUnique({
              where: {
                cartId_productId: { cartId: cart.id, productId: product.id },
              },
            });
            if (!cartItem || cartItem.quantity < input.quantity)
              throw new ConflictException('Insufficient cart quantity');
            let final = product.price,
              discountId: string | null = null;
            if (input.discountId) {
              const link = product.productDiscounts,
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
              discountId = d.id;
              if (d.discountType === 'FREE_ITEM') {
                if (!d.productId || !d.quantity || d.quantity < 1)
                  throw new ConflictException('Invalid free item discount');
                const qty = d.quantity;
                reserve(d.productId, qty);
                items.push({
                  productId: d.productId,
                  quantity: qty,
                  price: 0,
                  finalPrice: 0,
                  discountAmount: 0,
                });
              } else {
                if (
                  d.value === null ||
                  !Number.isFinite(d.value) ||
                  d.value < 0 ||
                  (d.discountType === 'PERCENTAGE' && d.value > 100)
                )
                  throw new ConflictException('Invalid discount');
                final = Math.max(
                  0,
                  Math.round(
                    d.discountType === 'PRICE'
                      ? Math.min(product.price, d.value)
                      : product.price -
                          (d.discountType === 'FIXED'
                            ? d.value
                            : (product.price * d.value) / 100),
                  ),
                );
              }
              await tx.discount.update({
                where: { id: d.id },
                data: { redeemedCount: { increment: input.quantity } },
              });
            }
            subtotal += product.price * input.quantity;
            discounted += final * input.quantity;
            reserve(product.id, input.quantity);
            items.push({
              productId: product.id,
              quantity: input.quantity,
              price: product.price,
              finalPrice: final,
              discountAmount: product.price - final,
              discountId,
            });
            if (cartItem.quantity === input.quantity)
              await tx.cartItem.delete({ where: { id: cartItem.id } });
            else
              await tx.cartItem.update({
                where: { id: cartItem.id },
                data: { quantity: { decrement: input.quantity } },
              });
          }
          let net = discounted,
            freight = shipping;
          const groups = new Set<string>();
          for (const id of [...(order.voucherIds ?? [])].sort()) {
            const v = await tx.voucher.findUnique({ where: { id } });
            if (
              !v ||
              !v.isActive ||
              v.startDate > now ||
              v.endDate < now ||
              v.redeemedCount >= v.maxRedeemed ||
              discounted < v.minimumPurchase ||
              groups.has(v.group)
            )
              throw new ConflictException('Voucher unavailable');
            groups.add(v.group);
            const used = await tx.userVoucher.updateMany({
              where: {
                userId,
                voucherId: id,
                status: 'CLAIMED',
                expiredAt: { gt: now },
              },
              data: { status: 'USED' },
            });
            if (used.count !== 1)
              throw new ConflictException(
                'Voucher not available to this account',
              );
            await tx.voucher.update({
              where: { id },
              data: { redeemedCount: { increment: 1 } },
            });
            if (v.type === 'FREE_ITEM') {
              if (!v.productId || !v.quantity || v.quantity < 1)
                throw new ConflictException('Invalid free item voucher');
              reserve(v.productId, v.quantity);
              items.push({
                productId: v.productId,
                quantity: v.quantity,
                price: 0,
                finalPrice: 0,
                discountAmount: 0,
              });
            } else {
              if (
                v.value === null ||
                !Number.isFinite(v.value) ||
                v.value < 0 ||
                (v.type === 'PERCENTAGE' && v.value > 100)
              )
                throw new ConflictException('Invalid voucher');
              const base = v.group === 'SHIPPING' ? freight : net;
              const value = Math.max(
                0,
                Math.round(
                  base -
                    (v.type === 'FIXED' ? v.value : (base * v.value) / 100),
                ),
              );
              if (v.group === 'SHIPPING') freight = value;
              else net = value;
            }
          }
          if (
            stock.size !== quotedStock.size ||
            [...stock].some(([id, qty]) => quotedStock.get(id) !== qty)
          )
            throw new ConflictException(
              'Shipment items changed; retry checkout',
            );
          const actualProducts = await tx.product.findMany({
            where: { id: { in: [...stock.keys()] }, isActive: true },
            select: { id: true, weightGrams: true },
          });
          if (
            actualProducts.length !== stock.size ||
            actualProducts.some((p) => p.weightGrams !== weights.get(p.id))
          )
            throw new ConflictException(
              'Shipment weights changed; retry checkout',
            );
          for (const [id, qty] of [...stock].sort(([a], [b]) =>
            a.localeCompare(b),
          )) {
            const count =
              await tx.$executeRaw`UPDATE "inventory" SET "reserved_quantity"="reserved_quantity"+${qty}, "updated_at"=NOW() WHERE "product_id"=${id}::uuid AND "is_active" AND "quantity"-"reserved_quantity">=${qty} AND EXISTS (SELECT 1 FROM "products" WHERE "id"=${id}::uuid AND "is_active")`;
            if (count !== 1)
              throw new ConflictException('Insufficient available stock');
          }
          const finalPrice = net + freight;
          if (
            !Number.isSafeInteger(finalPrice) ||
            finalPrice < 1 ||
            finalPrice > 1000000000
          )
            throw new BadRequestException('Invalid payable amount');
          const created = await tx.order.create({
            data: {
              userId,
              addressId: address.id,
              addressSnapshot: {
                destinationId: address.destinationId,
                recipientName: address.recipientName,
                recipientPhoneNumber: address.recipientPhoneNumber,
                province: address.province,
                city: address.city,
                subdistrict: address.subdistrict,
                village: address.village,
                postalCode: address.postalCode,
                address: address.address,
              },
              checkoutKey: key,
              checkoutHash: hash,
              totalPrice: subtotal,
              discountAmount: subtotal - discounted,
              voucherAmount: discounted - net + shipping - freight,
              finalPrice,
              orderItems: { createMany: { data: items } },
              vouchers: {
                createMany: {
                  data: (order.voucherIds ?? []).map((voucherId) => ({
                    voucherId,
                  })),
                },
              },
              shipments: {
                create: {
                  courier: shipment.courier,
                  service: shipment.service,
                  cost: freight,
                  estimated: new Date(now.getTime() + 3 * 86400000),
                  description: 'Server-verified shipping quote',
                },
              },
              payments: {
                create: {
                  method: 'PAYMENT_SERVICE',
                  methodType: 'UNSELECTED',
                  amount: finalPrice,
                  expiryDate: new Date(now.getTime() + 30 * 60000),
                  nextCheckAt: new Date(now.getTime() + 30 * 60000),
                },
              },
            },
            include: { payments: true },
          });
          return {
            deadline: created.payments[0].expiryDate,
            response: {
              message: 'Order created',
              data: {
                orderId: created.id,
                paymentId: created.payments[0].id,
                finalPrice,
                status: created.status,
              },
            },
          };
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          timeout: 10000,
        },
      );
      if (result.deadline)
        await this.qstash.publishExpiration(
          result.response.data.orderId,
          result.deadline,
        );
      return result.response;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2034', 'P2002'].includes(e.code)
      ) {
        const replay = await existing();
        if (replay) return replay;
        throw new ConflictException(
          'Concurrent checkout; retry with the same idempotency key',
        );
      }
      throw e;
    }
  }
  private async shippingQuote(
    destination: number | null,
    items: { productId: string; quantity: number }[],
    shipment: { courier: string; service: string },
    weights: Map<string, number | null>,
  ) {
    const origin = Number(this.config.getOrThrow('SHIPPING_ORIGIN_ID'));
    if (!destination || !Number.isSafeInteger(origin) || origin < 1)
      throw new BadRequestException(
        'Shipping destination or origin is missing',
      );
    let weight = 0;
    for (const i of items) {
      const grams = weights.get(i.productId);
      if (!grams || grams < 1)
        throw new ConflictException('Product shipping weight is missing');
      weight += grams * i.quantity;
    }
    if (!Number.isSafeInteger(weight) || weight > 1000000)
      throw new BadRequestException('Invalid shipment weight');
    try {
      const res = await axios.post(
        this.config
          .getOrThrow<string>('RAJAONGKIR_BASE_URL')
          .replace(/\/$/, '') + '/calculate/domestic-cost',
        new URLSearchParams({
          origin: String(origin),
          destination: String(destination),
          weight: String(weight),
          courier: shipment.courier.toLowerCase(),
        }).toString(),
        {
          headers: {
            key: this.config.getOrThrow<string>('RAJAONGKIR_API_KEY'),
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 5000,
          maxRedirects: 0,
        },
      );
      const rows = res.data?.data;
      if (!Array.isArray(rows)) throw new Error('Invalid shipping quote');
      const row = rows.find(
        (r) =>
          String(r.code).toLowerCase() === shipment.courier.toLowerCase() &&
          String(r.service).toLowerCase() === shipment.service.toLowerCase(),
      );
      if (!row || !Number.isSafeInteger(row.cost) || row.cost < 0)
        throw new BadRequestException('Shipping service unavailable');
      return row.cost as number;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new ServiceUnavailableException('Shipping quote unavailable');
    }
  }
}
