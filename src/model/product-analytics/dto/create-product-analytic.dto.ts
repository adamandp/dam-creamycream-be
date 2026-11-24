import { createZodDto } from 'nestjs-zod';
import { BaseProductAnalyticsSchema } from '../product-analytics.validation';
import z from 'zod';

const CreateProductAnalyticsSchema = BaseProductAnalyticsSchema.omit({
  id: true,
  userId: true,
  productId: true,
  createdAt: true,
}).extend({ productId: z.uuid() });

export class CreateProductAnalyticDto
  extends createZodDto(CreateProductAnalyticsSchema)
  implements z.infer<typeof CreateProductAnalyticsSchema> {}
