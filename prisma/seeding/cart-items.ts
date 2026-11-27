import { PrismaClient } from '../../src/generated/prisma/client';

export async function seedCartItems(prisma: PrismaClient) {
  const products = await prisma.product.findMany();
  const carts = await prisma.cart.findMany();

  await prisma.cartItem.createMany({
    data: carts.flatMap((cart, index) =>
      products.slice(0, 6).map((_, i) => ({
        quantity: Math.floor(Math.random() * 10) + 1,
        productId: products[(index + i) % products.length].id,
        cartId: cart.id,
      })),
    ),
  });

  console.log('Seeding cart items done');
}
