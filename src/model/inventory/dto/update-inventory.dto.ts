import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
export class UpdateInventoryDto extends createZodDto(
  z
    .object({
      quantity: z.number().int().min(0).max(1000000).optional(),
      isActive: z.boolean().optional(),
    })
    .strict()
    .refine((v) => Object.keys(v).length > 0, 'At least one field required'),
) {}
