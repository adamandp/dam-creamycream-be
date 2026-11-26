import { randomUUID } from 'node:crypto';
import { NotFoundException } from '@nestjs/common';
import { AddressesService } from '../model/addresses/addresses.service';
import { CartsService } from '../model/carts/carts.service';
import { ReviewsService } from '../model/reviews/reviews.service';
import { UserVouchersService } from '../model/user-vouchers/user-vouchers.service';
import { UserNotificationsService } from '../model/user-notifications/user-notifications.service';
import { ProductAnalyticsService } from '../model/product-analytics/product-analytics.service';
import type { JwtPayload } from '../integrations/accounts/accounts.interface';

const actor = { sub: randomUUID() } as JwtPayload;
const otherUser = randomUUID();
const id = randomUUID();
const logger = { setContext: jest.fn(), trace: jest.fn() } as any;

describe('Business resource ownership (mock database)', () => {
  it('creates address for the verified sub, not a forged request userId', async () => {
    const address = {
      count: jest.fn().mockResolvedValue(0),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockResolvedValue({}),
    };
    const prisma = {
      $transaction: jest.fn((fn) => fn({ address, $queryRaw: jest.fn() })),
    } as any;
    const service = new AddressesService(prisma, logger);
    await service.create({ userId: otherUser, isPrimary: false } as any, actor);
    expect(address.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: actor.sub, isPrimary: true }),
    });
  });
  it('scopes address read to owner and refuses another owner', async () => {
    const findUniqueOrThrow = jest
      .fn()
      .mockRejectedValue(new NotFoundException());
    const service = new AddressesService(
      { address: { findUniqueOrThrow } } as any,
      logger,
    );
    await expect(service.findById(id, actor)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id, userId: actor.sub },
    });
  });
  it('scopes address update and does not allow owner reassignment through DTO', async () => {
    const address = {
      findUniqueOrThrow: jest
        .fn()
        .mockResolvedValue({ id, userId: actor.sub, recipientName: 'Old' }),
      update: jest.fn().mockResolvedValue({}),
    };
    const service = new AddressesService(
      {
        $transaction: (fn: any) => fn({ address, $queryRaw: jest.fn() }),
      } as any,
      logger,
    );
    await service.update(
      id,
      { recipientName: 'New', userId: otherUser } as any,
      actor,
    );
    expect(address.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id, userId: actor.sub } }),
    );
    expect(address.update.mock.calls[0][0].data).not.toHaveProperty('userId');
  });
  it('creates carts lazily using verified user id', async () => {
    const cart = { upsert: jest.fn().mockResolvedValue({ id }) };
    const cartItem = { upsert: jest.fn().mockResolvedValue({}) };
    const service = new CartsService(
      logger,
      { $transaction: (fn: any) => fn({ cart, cartItem }) } as any,
      { validateProduct: jest.fn().mockResolvedValue({}) } as any,
    );
    await service.addToCart(actor.sub, { productId: id, quantity: 1 });
    expect(cart.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: actor.sub },
        create: { userId: actor.sub },
      }),
    );
  });
  it('scopes review delete to owner', async () => {
    const remove = jest.fn().mockResolvedValue({});
    const service = new ReviewsService(
      { review: { delete: remove } } as any,
      logger,
      {} as any,
    );
    await service.remove(id, actor);
    expect(remove).toHaveBeenCalledWith({ where: { id, userId: actor.sub } });
  });
  it('scopes voucher list to owner and exposes no direct use mutation', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const service = new UserVouchersService(
      { userVoucher: { findMany } } as any,
      logger,
      {} as any,
    );
    await service.findByUser(actor);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: actor.sub } }),
    );
    expect('use' in service).toBe(false);
  });
  it('scopes notification read mutation to owner', async () => {
    const update = jest.fn().mockResolvedValue({});
    const service = new UserNotificationsService(
      logger,
      {} as any,
      { userNotification: { update } } as any,
    );
    await service.updateRead(id, actor);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id, userId: actor.sub } }),
    );
  });
  it('creates product analytics using verified current user', async () => {
    const create = jest.fn().mockResolvedValue({});
    const service = new ProductAnalyticsService(logger, {
      productAnalytics: { create },
    } as any);
    await service.create({ productId: id, userId: otherUser } as any, actor);
    expect(create).toHaveBeenCalledWith({
      data: { productId: id, userId: actor.sub },
    });
  });
});
