import z from 'zod';
import { BaseOrderItemSchema, BaseOrderSchema } from '../orders.validation';
import { createZodDto } from 'nestjs-zod';
import { BaseShipmentSchema } from 'src/model/shipments/shipments.validation';
import { BasePaymentSchema } from 'src/model/payments/payments.validation';
import { baseUUID } from 'src/utils/zod.helper';

const OrderInputSchema = BaseOrderSchema.pick({
  userId: true,
  addressId: true,
}).extend({
  voucherIds: z
    .array(baseUUID('Voucher ID'))
    .max(2, { message: 'Voucher ID max 2' })
    .refine((ids) => new Set(ids).size === ids.length, 'Duplicate vouchers')
    .nullish(),
});

const OrderItemInputSchema = BaseOrderItemSchema.pick({
  productId: true,
  discountId: true,
  quantity: true,
})
  .extend({ quantity: z.number().int().min(1).max(100) })
  .array()
  .min(1)
  .max(100)
  .refine(
    (items) => new Set(items.map((i) => i.productId)).size === items.length,
    'Duplicate product IDs',
  );

const ShipmentInputSchema = BaseShipmentSchema.pick({
  courier: true,
  service: true,
  cost: true,
  estimated: true,
  description: true,
});

const PaymentInputSchema = BasePaymentSchema.pick({
  method: true,
});

const CreateOrderSchema = z.object({
  order: OrderInputSchema.omit({ userId: true }),
  orderItems: OrderItemInputSchema,
  shipment: ShipmentInputSchema.partial({
    cost: true,
    estimated: true,
    description: true,
  }),
  payment: PaymentInputSchema.optional(),
});

class CheckOutDto
  extends createZodDto(CreateOrderSchema)
  implements z.infer<typeof CreateOrderSchema> {}

class OrderInputDto
  extends createZodDto(OrderInputSchema)
  implements z.infer<typeof OrderInputSchema> {}

class OrderItemInputDto
  extends createZodDto(OrderItemInputSchema)
  implements z.infer<typeof OrderItemInputSchema> {}

class ShipmentInputDto
  extends createZodDto(ShipmentInputSchema)
  implements z.infer<typeof ShipmentInputSchema> {}

class PaymentInputDto
  extends createZodDto(PaymentInputSchema)
  implements z.infer<typeof PaymentInputSchema> {}

export {
  CheckOutDto,
  OrderInputDto,
  OrderItemInputDto,
  ShipmentInputDto,
  PaymentInputDto,
};
