import { Injectable } from '@nestjs/common';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { PinoLogger } from 'nestjs-pino';
// import { PrismaService } from 'src/common/prisma.module';
import { PrismaService } from 'src/common/prisma/prisma.service';
import { ProductsService } from '../products/products.service';
import { RemoveFromCartDto } from './dto/remove-from-cart';
import { WebResponse } from 'src/common/common.interface';
import { Messages } from 'src/utils/message.helper';
import { PaginationDto } from 'src/common/common.dto';
import { FindByUserCartDto as FindByUserDto } from './carts.interface';
import { JwtPayload } from 'src/integrations/accounts/accounts.interface';

@Injectable()
export class CartsService {
  constructor(
    private readonly logger: PinoLogger,
    private readonly prisma: PrismaService,

    private readonly product: ProductsService,
  ) {
    this.logger.setContext(CartsService.name);
  }

  private readonly name = 'Cart';

  private logCartAction(
    action: 'add' | 'remove',
    userId: string,
    productId: string,
    quantity: number,
  ) {
    const actionText = action === 'add' ? 'Added' : 'Removed';
    this.logger.trace(
      `${actionText} ${quantity} of product ${productId} ${action === 'add' ? 'to' : 'from'} cart for user ${userId}`,
    );
  }

  async addToCart(userId: string, body: AddToCartDto): Promise<WebResponse> {
    await this.product.validateProduct(body.productId);
    return await this.prisma
      .$transaction(async (tx) => {
        const { id: cartId } = await tx.cart.upsert({
          where: { userId },
          update: {},
          create: { userId },
          select: { id: true },
        });
        await tx.cartItem.upsert({
          where: {
            cartId_productId: {
              cartId,
              productId: body.productId,
            },
          },
          update: {
            quantity: {
              increment: body.quantity,
            },
          },
          create: {
            cartId,
            productId: body.productId,
            quantity: body.quantity,
          },
        });
      })
      .then((data) => {
        this.logCartAction('add', userId, body.productId, body.quantity);
        return { message: Messages.create(this.name), data: data };
      });
  }

  async removeFromCart(
    userId: string,
    body: RemoveFromCartDto,
  ): Promise<WebResponse> {
    await this.product.validateProduct(body.productId);
    return await this.prisma
      .$transaction(async (tx) => {
        const { id: cartId } = await tx.cart.findUniqueOrThrow({
          where: { userId },
          select: { id: true },
        });
        const { id: cartItemId, quantity: exsitingQuantity } =
          await tx.cartItem.findUniqueOrThrow({
            where: {
              cartId_productId: {
                cartId,
                productId: body.productId,
              },
            },
            select: { id: true, quantity: true },
          });
        if (exsitingQuantity <= body.quantity) {
          await tx.cartItem.delete({ where: { id: cartItemId } });
        } else {
          await tx.cartItem.update({
            where: { id: cartItemId },
            data: { quantity: { decrement: body.quantity } },
          });
        }
      })
      .then((data) => {
        this.logCartAction('remove', userId, body.productId, body.quantity);
        return { message: Messages.delete(this.name), data };
      });
  }

  async findByUser(
    payload: JwtPayload,
    { limit, page }: PaginationDto,
  ): Promise<WebResponse<FindByUserDto[]>> {
    const skip = Math.max((page - 1) * limit, 0);

    const [cart, total] = await Promise.all([
      this.prisma.cart.findFirst({
        where: {
          userId: payload.sub,
        },
        select: {
          cartItems: {
            skip,
            take: limit,
            select: {
              quantity: true,
              products: {
                select: {
                  id: true,
                  name: true,
                  imageUrl: true,
                  price: true,
                  categories: {
                    select: {
                      name: true,
                    },
                  },
                  productDiscounts: {
                    select: {
                      isActive: true,
                      discounts: {
                        select: {
                          id: true,
                          maxApplied: true,
                          maxRedeemed: true,
                          redeemedCount: true,
                          discountType: true,
                          value: true,
                          startDate: true,
                          endDate: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.cartItem.count({
        where: {
          carts: {
            userId: payload.sub,
          },
        },
      }),
    ]);

    if (!cart || total === 0) {
      return {
        message: Messages.get(this.name),
        data: [],
        paging: {
          currentPage: page,
          pageSize: limit,
          totalItems: 0,
          totalPages: 0,
        },
      };
    }

    const now = new Date();

    const items: FindByUserDto[] = cart.cartItems.map((item) => {
      const product = item.products;
      const discount = product.productDiscounts?.discounts;

      let discountPrice: number | null = null;
      let discountId: string | null = null;

      if (
        discount &&
        product.productDiscounts?.isActive &&
        item.quantity <= discount.maxApplied &&
        discount.redeemedCount + item.quantity <= discount.maxRedeemed &&
        (discount.value !== null || discount.discountType === 'FREE_ITEM') &&
        discount.startDate <= now &&
        discount.endDate >= now
      ) {
        discountId = discount.id;
        switch (discount.discountType) {
          case 'PERCENTAGE':
            discountPrice = Math.max(
              0,
              Math.round(
                product.price - (product.price * (discount.value ?? 0)) / 100,
              ),
            );
            break;

          case 'PRICE':
            discountPrice = Math.max(
              0,
              Math.round(
                Math.min(product.price, discount.value ?? product.price),
              ),
            );
            break;
          case 'FREE_ITEM':
            discountPrice = null;
            break;
          default:
            discountPrice = Math.max(
              0,
              Math.round(product.price - (discount.value ?? 0)),
            );
        }
      }

      return {
        id: product.id,
        name: product.name,
        imageUrl: product.imageUrl,
        category: product.categories.name,
        price: product.price,
        discountPrice,
        discountId,
        qty: item.quantity,
      };
    });

    return {
      message: Messages.get('User Cart'),
      data: items,
      paging: {
        currentPage: page,
        pageSize: limit,
        totalItems: total,
        totalPages: Math.ceil(total / (limit || 1)),
      },
    };
  }
}
