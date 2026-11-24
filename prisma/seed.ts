import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import { z } from 'zod';
import {
  seedAddresses,
  seedProducts,
  seedCategories,
  seedCartItems,
  seedVouchers,
  seedDiscounts,
  seedProductDiscount,
  seedOrders,
  seedUserVouchers,
  seedOrderItems,
  seedShipments,
  seedPayments,
  seedReviews,
} from './seeding';
import { seedProductInformations } from './seeding/product-informations';

async function main() {
  if (
    !['development', 'test'].includes(process.env.NODE_ENV ?? '') ||
    process.env.SEED_CONFIRM !== 'LOCAL_EMPTY_DB'
  )
    throw new Error('Fixture seed requires explicit local-only configuration');
  const url = new URL(process.env.SEED_DATABASE_URL ?? '');
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) ||
    !/(?:_test|_dev)$/.test(url.pathname)
  )
    throw new Error('Seed requires a local _test or _dev database');
  const userIds = z
    .array(z.uuid())
    .min(1)
    .parse(
      (process.env.SEED_USER_IDS ?? '')
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    );
  if (new Set(userIds).size !== userIds.length)
    throw new Error('Duplicate fixture UUIDs');
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url.href }),
  });
  try {
    const counts = await Promise.all([
      prisma.category.count(),
      prisma.product.count(),
      prisma.cart.count(),
      prisma.address.count(),
      prisma.order.count(),
      prisma.voucher.count(),
      prisma.discount.count(),
      prisma.review.count(),
      prisma.notification.count(),
    ]);
    if (counts.some((count) => count !== 0))
      throw new Error('Fixture seeding refuses a nonempty database');
    await prisma.cart.createMany({
      data: userIds.map((userId) => ({ userId })),
    });
    await seedAddresses(prisma, userIds);
    await seedCategories(prisma);
    await seedProducts(prisma);
    await seedProductInformations(prisma);
    await seedCartItems(prisma);
    await seedVouchers(prisma);
    await seedDiscounts(prisma);
    await seedProductDiscount(prisma);
    await seedUserVouchers(prisma, userIds);
    const orders = await seedOrders(prisma, userIds);
    await seedOrderItems(prisma, orders);
    await seedShipments(prisma, orders);
    await seedPayments(prisma, orders);
    await seedReviews(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
main().catch(() => {
  console.error('Fixture seed failed; verify isolated database configuration.');
  process.exitCode = 1;
});
