import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import axios from 'axios';
import { z } from 'zod';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { AccountsConfig } from 'src/config/accounts.config';
import type { JwtPayload } from 'src/integrations/accounts/accounts.interface';
import { PaginationDto } from 'src/common/common.dto';
import { Prisma } from 'src/generated/prisma/client';

export const paymentInputSchema = z
  .object({
    paymentMethod: z.enum([
      'QRIS',
      'GOPAY',
      'SHOPEEPAY',
      'OVO',
      'BCA_VA',
      'BNI_VA',
      'BRI_VA',
      'PERMATA_VA',
      'CIMB_VA',
      'MANDIRI_BILL',
      'INDOMARET',
      'ALFAMART',
      'CREDIT_CARD',
      'AKULAKU',
      'KREDIVO',
    ]),
    customer: z
      .object({
        name: z.string().trim().min(1).max(100),
        email: z.email().max(254),
        phone: z.string().trim().min(1).max(32),
        lastName: z.string().max(100).optional(),
      })
      .strict(),
    cardToken: z.string().min(1).max(4096).optional(),
  })
  .strict();
export const remotePaymentSchema = z.object({
  id: z.uuid(),
  referenceId: z.uuid(),
  amount: z.number().int().positive(),
  currency: z.literal('IDR'),
  paymentMethod: z.string(),
  status: z.string(),
  transactionId: z.string().nullish(),
  providerPaymentType: z.string().nullish(),
  paymentInstructions: z.unknown().optional(),
  expiresAt: z.iso.datetime({ offset: true }).nullish(),
  updatedAt: z.iso.datetime({ offset: true }),
});
export const notificationSchema = z.object({
  eventId: z.uuid(),
  eventType: z.string(),
  data: z.unknown(),
});
export function classifyStatus(status: string) {
  if (status === 'PAID') return 'PAID';
  if (['FAILED', 'CANCELLED', 'EXPIRED'].includes(status)) return 'CANCELLED';
  return 'PENDING';
}
export function verifiedSignature(
  body: Buffer,
  timestamp: string,
  eventId: string,
  signature: string,
  secret: string,
) {
  if (
    !/^\d+$/.test(timestamp) ||
    Math.abs(Date.now() / 1000 - Number(timestamp)) > 300 ||
    !z.uuid().safeParse(eventId).success ||
    !/^[a-fA-F0-9]{64}$/.test(signature)
  )
    return false;
  const expected = createHmac('sha256', secret)
    .update(timestamp + '.' + eventId + '.')
    .update(body)
    .digest();
  return timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
const sha = (value: string) => createHash('sha256').update(value).digest('hex');
export function internalSignature(
  secret: string,
  timestamp: string,
  path: string,
  token: string,
  key: string,
  body: string,
) {
  return createHmac('sha256', secret)
    .update(
      ['v1', timestamp, 'POST', path, sha(token), key, sha(body)].join('\n'),
    )
    .digest('hex');
}
type RemotePayment = z.infer<typeof remotePaymentSchema>;
type PaymentInput = z.infer<typeof paymentInputSchema>;
@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly accounts: AccountsConfig,
  ) {}
  private async request(
    method: 'GET' | 'POST',
    path: string,
    authorization: string,
    body?: unknown,
    key = '',
  ) {
    const base = this.config
      .getOrThrow<string>('PAYMENT_SERVICE_URL')
      .replace(/\/$/, '');
    const token = /^Bearer ([^\s]+)$/i.exec(authorization)?.[1];
    if (!token) throw new ForbiddenException();
    const raw = body === undefined ? '' : JSON.stringify(body);
    const headers: Record<string, string> = {
      Authorization: 'Bearer ' + token,
      Accept: 'application/json',
    };
    if (method === 'POST') {
      const ts = Math.floor(Date.now() / 1000).toString();
      const secret = this.config.getOrThrow<string>(
        'PAYMENT_INTERNAL_HMAC_SECRET',
      );
      headers['X-Internal-Timestamp'] = ts;
      headers['X-Internal-Signature'] = internalSignature(
        secret,
        ts,
        path,
        token,
        key,
        raw,
      );
      if (key) headers['Idempotency-Key'] = key;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
    }
    try {
      const response = await axios.request({
        method,
        url: base + path,
        headers,
        data: method === 'POST' ? raw : undefined,
        timeout: 12000,
        maxRedirects: 0,
        maxContentLength: 1024 * 1024,
        validateStatus: () => true,
      });
      if (response.status < 200 || response.status >= 300) {
        if ([400, 401, 403, 404, 409, 422, 429, 503].includes(response.status))
          throw new ServiceUnavailableException(
            'Payment Service rejected request (' + response.status + ')',
          );
        throw new BadGatewayException('Payment Service unavailable');
      }
      return response.data?.data;
    } catch (e) {
      if (
        e instanceof ServiceUnavailableException ||
        e instanceof BadGatewayException
      )
        throw e;
      throw new BadGatewayException('Payment Service unavailable');
    }
  }
  private scope(actor: JwtPayload) {
    return actor.role === this.accounts.roles.CUSTOMER
      ? { orders: { userId: actor.sub } }
      : {};
  }
  private async lock(tx: Prisma.TransactionClient, orderId: string) {
    await tx.$queryRaw`SELECT "id" FROM "payments" WHERE "order_id"=${orderId}::uuid FOR UPDATE`;
  }
  private parse(raw: unknown) {
    const parsed = remotePaymentSchema.safeParse(raw);
    if (!parsed.success)
      throw new BadGatewayException('Invalid Payment Service response');
    return parsed.data;
  }
  async methods(authorization: string) {
    return {
      data: await this.request('GET', '/payment-methods', authorization),
    };
  }
  async start(
    actor: JwtPayload,
    orderId: string,
    input: PaymentInput,
    authorization: string,
  ) {
    const claim = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, orderId);
      const p = await tx.payment.findFirst({
        where: { orderId, orders: { userId: actor.sub } },
        include: { orders: true },
      });
      if (!p) throw new NotFoundException('Payment not found');
      if (
        p.status !== 'PENDING' ||
        p.orders.status !== 'PENDING' ||
        p.cancelRequestedAt
      )
        throw new ConflictException('Payment is not active');
      if (
        !p.initializationStartedAt &&
        (!p.expiryDate || p.expiryDate <= new Date())
      )
        throw new ConflictException('Checkout expired');
      if (
        !Number.isSafeInteger(p.amount) ||
        p.amount < 1 ||
        p.amount !== p.orders.finalPrice
      )
        throw new ConflictException('Invalid payment amount');
      const body = {
        referenceId: orderId,
        amount: p.amount,
        paymentMethod: input.paymentMethod,
        customer: input.customer,
        ...(input.cardToken ? { cardToken: input.cardToken } : {}),
      };
      const hash = sha(JSON.stringify(body));
      if (
        p.initializationStartedAt &&
        Date.now() - p.initializationStartedAt.getTime() > 23 * 3600000
      )
        throw new ConflictException(
          'Payment retry window elapsed; synchronize instead',
        );
      if (p.paymentRequestHash && p.paymentRequestHash !== hash)
        throw new ConflictException('Retry the original payment request');
      if (!p.initializationStartedAt)
        await tx.payment.update({
          where: { id: p.id },
          data: {
            initializationStartedAt: new Date(),
            paymentRequestHash: hash,
            method: 'PAYMENT_SERVICE',
            methodType: input.paymentMethod,
          },
        });
      return { p, body };
    });
    const remote = this.parse(
      await this.request(
        'POST',
        '/payments',
        authorization,
        claim.body,
        claim.p.id,
      ),
    );
    await this.apply(remote);
    return { data: { ...remote, orderId, paymentId: claim.p.id } };
  }
  async list(actor: JwtPayload, { page, limit }: PaginationDto) {
    const where = this.scope(actor);
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        omit: {
          paymentRequestHash: true,
        },
      }),
      this.prisma.payment.count({ where }),
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
  async find(actor: JwtPayload, orderId: string) {
    return {
      data: await this.prisma.payment.findFirstOrThrow({
        where: { orderId, ...this.scope(actor) },
        omit: {
          paymentRequestHash: true,
        },
      }),
    };
  }
  async instructions(
    actor: JwtPayload,
    orderId: string,
    authorization: string,
  ) {
    const p = (await this.find(actor, orderId)).data;
    if (!p.externalPaymentId || p.status !== 'PENDING') return { data: null };
    const remote = this.parse(
      await this.request(
        'GET',
        '/payments/' + p.externalPaymentId,
        authorization,
      ),
    );
    if (
      remote.id !== p.externalPaymentId ||
      remote.referenceId !== orderId ||
      remote.amount !== p.amount ||
      remote.paymentMethod !== p.methodType
    )
      throw new BadGatewayException('Invalid payment identity');
    return { data: remote };
  }

  private async apply(remote: RemotePayment) {
    return this.prisma.$transaction(async (tx) => {
      await this.lock(tx, remote.referenceId);
      const p = await tx.payment.findUnique({
        where: { orderId: remote.referenceId },
        include: { orders: true },
      });
      if (!p || !p.initializationStartedAt)
        throw new NotFoundException('Payment not found');
      if (
        p.amount !== remote.amount ||
        p.orders.finalPrice !== remote.amount ||
        p.methodType !== remote.paymentMethod ||
        (p.externalPaymentId && p.externalPaymentId !== remote.id)
      )
        throw new ConflictException('Payment identity or amount mismatch');
      const updated = new Date(remote.updatedAt);
      if (p.providerUpdatedAt && p.providerUpdatedAt > updated)
        return { data: { status: p.status } };
      await tx.payment.update({
        where: { id: p.id },
        data: {
          externalPaymentId: remote.id,
          providerStatus: remote.status,
          providerUpdatedAt: updated,
          expiryDate: remote.expiresAt ? new Date(remote.expiresAt) : undefined,
          transactionId: remote.transactionId ?? undefined,
        },
      });
      const next = classifyStatus(remote.status);
      if (
        p.status === 'PENDING' &&
        p.orders.status === 'PENDING' &&
        next !== 'PENDING'
      )
        await this.finalize(
          tx,
          p.orderId,
          next,
          remote.transactionId ?? undefined,
        );
      return { data: { status: p.status === 'PENDING' ? next : p.status } };
    });
  }
  async notification(
    raw: Buffer | undefined,
    timestamp: string,
    eventId: string,
    signature: string,
  ) {
    if (
      !raw ||
      !verifiedSignature(
        raw,
        timestamp,
        eventId,
        signature,
        this.config.getOrThrow<string>('WEBHOOK_CALLBACK_SECRET'),
      )
    )
      throw new ForbiddenException('Invalid callback signature');
    let payload: unknown;
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch {
      throw new BadRequestException('Invalid callback');
    }
    const parsed = notificationSchema.safeParse(payload);
    if (!parsed.success || parsed.data.eventId !== eventId)
      throw new BadRequestException('Invalid callback event');
    if (parsed.data.eventType === 'refund.status_changed')
      return { message: 'Refund event acknowledged' };
    if (parsed.data.eventType !== 'payment.status_changed')
      throw new BadRequestException('Unsupported callback');
    return this.apply(this.parse(parsed.data.data));
  }
  private async resolveRemote(
    p: { externalPaymentId: string | null; orderId: string },
    authorization: string,
  ) {
    if (p.externalPaymentId) return p.externalPaymentId;
    const rows = z
      .array(remotePaymentSchema)
      .safeParse(
        await this.request(
          'GET',
          '/payments?referenceId=' +
            encodeURIComponent(p.orderId) +
            '&pageSize=10',
          authorization,
        ),
      );
    if (!rows.success || rows.data.length > 1)
      throw new BadGatewayException('Uncertain payment identity');
    if (!rows.data.length) return null;
    await this.apply(rows.data[0]);
    return rows.data[0].id;
  }
  async sync(actor: JwtPayload, orderId: string, authorization: string) {
    const p = (await this.find(actor, orderId)).data;
    if (!p.initializationStartedAt) return { data: { status: p.status } };
    const id = await this.resolveRemote(p, authorization);
    if (!id) return { data: { status: p.status } };
    const remote = this.parse(
      await this.request('POST', '/payments/' + id + '/sync', authorization),
    );
    await this.apply(remote);
    return { data: remote };
  }
  async cancel(actor: JwtPayload, orderId: string, authorization: string) {
    const p = await this.prisma.$transaction(async (tx) => {
      await this.lock(tx, orderId);
      const row = await tx.payment.findFirst({
        where: { orderId, orders: { userId: actor.sub } },
        include: { orders: true },
      });
      if (!row) throw new NotFoundException('Payment not found');
      if (row.status !== 'PENDING') return row;
      if (!row.initializationStartedAt) {
        await this.finalize(tx, orderId, 'CANCELLED');
        return { ...row, status: 'CANCELLED' };
      }
      await tx.payment.update({
        where: { id: row.id },
        data: { cancelRequestedAt: new Date() },
      });
      return row;
    });
    if (p.status !== 'PENDING') return { data: { status: p.status } };
    const id = await this.resolveRemote(p, authorization);
    if (!id) return { data: { status: 'PENDING' } };
    return this.apply(
      this.parse(
        await this.request(
          'POST',
          '/payments/' + id + '/cancel',
          authorization,
        ),
      ),
    );
  }
  async reconcileDue(limit = 50) {
    const due = await this.prisma.payment.findMany({
      where: {
        status: 'PENDING',
        initializationStartedAt: null,
        expiryDate: { lte: new Date() },
      },
      take: limit,
    });
    for (const p of due)
      await this.prisma.$transaction(async (tx) => {
        await this.lock(tx, p.orderId);
        const current = await tx.payment.findUnique({ where: { id: p.id } });
        if (
          current?.status === 'PENDING' &&
          !current.initializationStartedAt &&
          current.expiryDate &&
          current.expiryDate <= new Date()
        )
          await this.finalize(tx, p.orderId, 'CANCELLED');
      });
    return { message: 'Abandoned checkouts reconciled' };
  }
  private async finalize(
    tx: Prisma.TransactionClient,
    orderId: string,
    next: 'PAID' | 'CANCELLED',
    transactionId?: string,
    method?: string,
  ) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { orderItems: true, vouchers: true },
    });
    const stock = new Map<string, number>();
    for (const item of order.orderItems)
      stock.set(
        item.productId,
        (stock.get(item.productId) ?? 0) + item.quantity,
      );
    for (const [id, quantity] of [...stock].sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const count =
        await tx.$executeRaw`UPDATE "inventory" SET "reserved_quantity"="reserved_quantity"-${quantity},"quantity"="quantity"-${next === 'PAID' ? quantity : 0},"updated_at"=NOW() WHERE "product_id"=${id}::uuid AND "reserved_quantity">=${quantity} AND "quantity">=${quantity}`;
      if (count !== 1)
        throw new ConflictException('Inventory reconciliation required');
    }
    if (next === 'CANCELLED') {
      for (const item of order.orderItems)
        if (item.discountId)
          await tx.discount.update({
            where: { id: item.discountId },
            data: { redeemedCount: { decrement: item.quantity } },
          });
      for (const v of order.vouchers) {
        await tx.voucher.update({
          where: { id: v.voucherId },
          data: { redeemedCount: { decrement: 1 } },
        });
        await tx.userVoucher.updateMany({
          where: {
            userId: order.userId,
            voucherId: v.voucherId,
            status: 'USED',
          },
          data: { status: 'CLAIMED' },
        });
      }
      await tx.shipment.updateMany({
        where: { orderId },
        data: { status: 'CANCELLED' },
      });
    }
    await tx.payment.update({
      where: { orderId },
      data: {
        status: next,
        transactionId,
        methodType: method,
        nextCheckAt: null,
        paidAt: next === 'PAID' ? new Date() : undefined,
      },
    });
    await tx.order.update({ where: { id: orderId }, data: { status: next } });
  }
}
