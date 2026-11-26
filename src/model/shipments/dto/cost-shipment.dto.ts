import { createZodDto } from 'nestjs-zod';
import { coerceNumber } from 'src/utils/zod.helper';
import { z } from 'zod';

const CostSchema = z
  .object({
    origin: coerceNumber('origin').int().positive(),
    destination: coerceNumber('destination').int().positive(),
    weight: coerceNumber('weight').int().positive(),
  })
  .strict();

export class CostDto
  extends createZodDto(CostSchema)
  implements z.infer<typeof CostSchema> {}

export { CostSchema };

export const QuoteSchema = z
  .object({
    addressId: z.uuid(),
    items: z
      .array(
        z.object({
          productId: z.uuid(),
          quantity: z.number().int().min(1).max(100),
          discountId: z.uuid().nullish(),
        }),
      )
      .min(1)
      .max(100)
      .refine(
        (items) => new Set(items.map((i) => i.productId)).size === items.length,
      ),
    voucherIds: z.array(z.uuid()).max(2).optional(),
  })
  .strict();
export class QuoteDto extends createZodDto(QuoteSchema) {}
