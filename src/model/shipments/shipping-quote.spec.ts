import { ShipmentsService } from './shipments.service';

describe('Customer shipping quote', () => {
  const addressId = 'd9c23722-ac46-4f52-a0e3-312a65d9fd9d';
  const userId = 'f3b1c411-b33a-4af2-9db4-63ef8f8d5b91';
  const productId = 'c7cf57f6-6c99-4d46-bd29-0a7c9c411a12';
  const item = { productId, quantity: 2 };
  function make() {
    const prisma = {
      address: {
        findFirst: jest.fn().mockResolvedValue({ destinationId: 123 }),
      },
      cartItem: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            {
              productId,
              quantity: 2,
              products: { isActive: true, weightGrams: 250 },
            },
          ]),
      },
      product: { findMany: jest.fn().mockResolvedValue([]) },
      userVoucher: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const service = new ShipmentsService(
      { setContext: jest.fn() } as never,
      prisma as never,
      {} as never,
      { getOrThrow: () => '456' } as never,
    );
    const cost = jest.spyOn(service, 'cost').mockResolvedValue({ data: [] });
    return { prisma, service, cost };
  }
  it('uses configured merchant origin, owned address and server cart weight', async () => {
    const { prisma, service, cost } = make();
    await service.quote({ addressId, items: [item] }, userId);
    expect(prisma.address.findFirst).toHaveBeenCalledWith({
      where: { id: addressId, userId },
    });
    expect(cost).toHaveBeenCalledWith({
      origin: 456,
      destination: 123,
      weight: 500,
    });
  });
  it('rejects missing or foreign destinations', async () => {
    const { prisma, service, cost } = make();
    prisma.address.findFirst.mockResolvedValue(null);
    await expect(
      service.quote({ addressId, items: [item] }, userId),
    ).rejects.toThrow('Shipping destination missing');
    expect(cost).not.toHaveBeenCalled();
  });
  it('rejects more items than are owned in the cart', async () => {
    const { service, cost } = make();
    await expect(
      service.quote({ addressId, items: [{ ...item, quantity: 3 }] }, userId),
    ).rejects.toThrow('Product or shipping weight unavailable');
    expect(cost).not.toHaveBeenCalled();
  });
});
