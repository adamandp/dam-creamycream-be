# Endpoint reference

Generated from current controller source. Do not edit manually. Run `npm run docs:generate`.

All URLs are relative to the commerce API base URL. Public routes do not require a Bearer token; the Payment Service webhook and QStash expiration/reconciliation routes require valid signatures. Protected routes require a valid Accounts Service access JWT. DTO names link to the contract in Swagger and source. A customer route is scoped to the current actor where applicable.

**96 endpoints.**


## addresses

Source: [`src/model/addresses/addresses.controller.ts`](../../src/model/addresses/addresses.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| POST | `/addresses` | STORE_ADMIN, CUSTOMER | Body: CreateAddressDto | `create` |
| GET | `/addresses` | STORE_ADMIN | Query: PaginationDto | `findAll` |
| GET | `/addresses/user` | STORE_ADMIN, CUSTOMER | — | `findByUserId` |
| GET | `/addresses/:id` | STORE_ADMIN, CUSTOMER | Param id, ParseUUIDPipe: string | `findById` |
| PATCH | `/addresses/:id` | STORE_ADMIN, CUSTOMER | Param id, ParseUUIDPipe: string; Body: UpdateAddressDto | `update` |
| DELETE | `/addresses/:id` | STORE_ADMIN, CUSTOMER | Param id, ParseUUIDPipe: string | `remove` |

## carts

Source: [`src/model/carts/carts.controller.ts`](../../src/model/carts/carts.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| POST | `/carts/user/add` | STORE_ADMIN, CUSTOMER | Body: AddToCartDto | `addToCart` |
| POST | `/carts/user/remove` | STORE_ADMIN, CUSTOMER | Body: AddToCartDto | `removeFromCart` |
| GET | `/carts/user` | STORE_ADMIN, CUSTOMER | Query: PaginationDto | `findByUser` |

## categories

Source: [`src/model/categories/categories.controller.ts`](../../src/model/categories/categories.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| POST | `/categories` | STORE_ADMIN | Body: CreateCategoryDto | `create` |
| GET | `/categories` | Public | Query: PaginationDto | `findAll` |
| GET | `/categories/:id` | Public | Param id, ParseUUIDPipe: string | `findById` |
| PATCH | `/categories/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string; Body: UpdateCategoryDto | `update` |
| DELETE | `/categories/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `remove` |

## discounts

Source: [`src/model/discounts/discounts.controller.ts`](../../src/model/discounts/discounts.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| POST | `/discounts` | STORE_ADMIN | Body: CreateDiscountDto | `create` |
| GET | `/discounts` | STORE_ADMIN | Query: PaginationDto | `findAll` |
| GET | `/discounts/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `findById` |
| PATCH | `/discounts/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string; Body: UpdateDiscountDto | `update` |
| DELETE | `/discounts/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `remove` |

## health

Source: [`src/model/health/health.controller.ts`](../../src/model/health/health.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| GET | `/health` | Public | — | `check` |
| GET | `/health/db` | STORE_ADMIN | — | `dbCheck` |

## inventory

Source: [`src/model/inventory/inventory.controller.ts`](../../src/model/inventory/inventory.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| GET | `/inventory` | STORE_ADMIN | Query: PaginationDto | `findAll` |
| GET | `/inventory/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `findById` |
| GET | `/inventory/product/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `findByProductId` |
| PATCH | `/inventory/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string; Body: UpdateInventoryDto | `update` |

## notifications

Source: [`src/model/notifications/notifications.controller.ts`](../../src/model/notifications/notifications.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| POST | `/notifications` | STORE_ADMIN | Body: CreateNotificationDto | `create` |
| GET | `/notifications` | STORE_ADMIN | Query: PaginationDto | `findAll` |
| GET | `/notifications/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `findById` |
| PATCH | `/notifications/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string; Body: UpdateNotificationDto | `update` |
| DELETE | `/notifications/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `remove` |

## orders

Source: [`src/model/orders/orders.controller.ts`](../../src/model/orders/orders.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| POST | `/orders/checkout` | CUSTOMER | Body: CheckOutDto; Headers idempotency-key: string | `checkout` |
| GET | `/orders/me` | CUSTOMER | Query: PaginationDto | `mine` |
| GET | `/orders` | STORE_ADMIN | Query: PaginationDto | `findAll` |
| GET | `/orders/:id` | CUSTOMER, STORE_ADMIN | Param id, ParseUUIDPipe: string | `findOne` |

## payments

Source: [`src/model/payments/payments.controller.ts`](../../src/model/payments/payments.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| GET | `/payments` | CUSTOMER, STORE_ADMIN | Query: PaginationDto | `list` |
| POST | `/payments/webhook` | Public | Headers x-webhook-timestamp: string; Headers x-webhook-event-id: string; Headers x-webhook-signature: string | `notification` |
| POST | `/payments/:orderId/start` | CUSTOMER | Headers authorization: string; Body: PaymentInputDto; Param orderId, ParseUUIDPipe: string | `start` |
| POST | `/payments/:orderId/sync` | CUSTOMER | Headers authorization: string; Param orderId, ParseUUIDPipe: string | `sync` |
| POST | `/payments/:orderId/cancel` | CUSTOMER | Headers authorization: string; Param orderId, ParseUUIDPipe: string | `cancel` |
| GET | `/payments/methods` | CUSTOMER, STORE_ADMIN | Headers authorization: string | `methods` |
| POST | `/payments/expire-checkout` | Public | Headers upstash-signature: string | `expireCheckout` |
| POST | `/payments/reconcile` | Public | Headers upstash-signature: string | `reconcile` |
| GET | `/payments/:orderId/instructions` | CUSTOMER, STORE_ADMIN | Param orderId, ParseUUIDPipe: string; Headers authorization: string | `instructions` |
| GET | `/payments/:orderId` | CUSTOMER, STORE_ADMIN | Param orderId, ParseUUIDPipe: string | `find` |

## product-analytics

Source: [`src/model/product-analytics/product-analytics.controller.ts`](../../src/model/product-analytics/product-analytics.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| POST | `/product-analytics` | STORE_ADMIN, CUSTOMER | Body: CreateProductAnalyticDto | `create` |
| GET | `/product-analytics/product/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string; Query: PaginationDto | `findByProduct` |
| GET | `/product-analytics/user` | STORE_ADMIN, CUSTOMER | Query: PaginationDto | `findByUser` |
| GET | `/product-analytics/product/:id/count` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `findByProductCount` |

## product-discounts

Source: [`src/model/product-discounts/product-discounts.controller.ts`](../../src/model/product-discounts/product-discounts.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| POST | `/product-discounts` | STORE_ADMIN | Body: CreateProductDiscountDto | `create` |
| GET | `/product-discounts` | STORE_ADMIN | Query: PaginationDto | `findAll` |
| GET | `/product-discounts/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `findById` |
| GET | `/product-discounts/product/:productId` | STORE_ADMIN | Param productId: string | `findByProductId` |
| DELETE | `/product-discounts/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `remove` |

## product

Source: [`src/model/product/product.controller.ts`](../../src/model/product/product.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| GET | `/product/information/:id` | Public | Param id, ParseUUIDPipe: string | `findInformation` |
| GET | `/product/:id` | Public | Param id, ParseUUIDPipe: string | `findOne` |

## products

Source: [`src/model/products/products.controller.ts`](../../src/model/products/products.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| POST | `/products` | STORE_ADMIN | Body: CreateProductDto | `create` |
| GET | `/products` | STORE_ADMIN | Query: PaginationDto | `findAll` |
| GET | `/products/catalog` | Public | Query: ProductQueryDto | `findCatalog` |
| PATCH | `/products/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string; Body: UpdateProductDto | `update` |
| PATCH | `/products/:id/image` | STORE_ADMIN | Param id, ParseUUIDPipe: string; UploadedFile: Express.Multer.File | `updateImage` |
| DELETE | `/products/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `remove` |

## recommendations

Source: [`src/model/recommendations/recommendations.controller.ts`](../../src/model/recommendations/recommendations.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| GET | `/recommendations/classic` | Public | — | `getClassic` |
| GET | `/recommendations/categories` | Public | — | `getCategories` |
| GET | `/recommendations/offers` | Public | — | `getOffers` |
| GET | `/recommendations/related/:id` | Public | Param id, ParseUUIDPipe: string | `getRelated` |

## reviews

Source: [`src/model/reviews/reviews.controller.ts`](../../src/model/reviews/reviews.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| POST | `/reviews` | STORE_ADMIN, CUSTOMER | Body: CreateReviewDto | `create` |
| GET | `/reviews` | STORE_ADMIN | Query: PaginationDto | `findAll` |
| GET | `/reviews/product/:id` | Public | Param id, ParseUUIDPipe: string; Query: PaginationDto | `findByProduct` |
| GET | `/reviews/me` | STORE_ADMIN, CUSTOMER | Query: PaginationDto | `findByUser` |
| GET | `/reviews/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `findById` |
| PATCH | `/reviews/:id` | STORE_ADMIN, CUSTOMER | Param id, ParseUUIDPipe: string; Body: UpdateReviewDto | `update` |
| DELETE | `/reviews/:id` | STORE_ADMIN, CUSTOMER | Param id, ParseUUIDPipe: string | `remove` |

## shipments

Source: [`src/model/shipments/shipments.controller.ts`](../../src/model/shipments/shipments.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| GET | `/shipments` | STORE_ADMIN | Query: PaginationDto | `findAll` |
| GET | `/shipments/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `findById` |
| PATCH | `/shipments/:id/status` | STORE_ADMIN | Param id, ParseUUIDPipe: string; Body: UpdateStatusShipmentDto | `updateStatus` |
| GET | `/shipments/destinations/search` | CUSTOMER, STORE_ADMIN | Query q: string | `destinations` |
| POST | `/shipments/quote` | CUSTOMER | Body: QuoteDto | `quote` |
| POST | `/shipments/cost` | STORE_ADMIN, CUSTOMER | Body: CostDto | `cost` |

## user-notifications

Source: [`src/model/user-notifications/user-notifications.controller.ts`](../../src/model/user-notifications/user-notifications.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| POST | `/user-notifications` | STORE_ADMIN + user.read | Body: CreateUserNotificationDto | `create` |
| GET | `/user-notifications` | STORE_ADMIN | Query: PaginationDto | `findAll` |
| GET | `/user-notifications/me` | STORE_ADMIN, CUSTOMER | Query: PaginationDto | `findByUser` |
| GET | `/user-notifications/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `findById` |
| GET | `/user-notifications/count/me` | STORE_ADMIN, CUSTOMER | — | `findByUserCount` |
| GET | `/user-notifications/notification/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string; Query: PaginationDto | `findByNotification` |
| GET | `/user-notifications/notification/:id/count` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `findByNotificationCount` |
| PATCH | `/user-notifications/:id` | STORE_ADMIN, CUSTOMER | Param id, ParseUUIDPipe: string | `updateRead` |

## user-vouchers

Source: [`src/model/user-vouchers/user-vouchers.controller.ts`](../../src/model/user-vouchers/user-vouchers.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| POST | `/user-vouchers` | STORE_ADMIN + user.read | Body: CreateUserVoucherDto | `create` |
| GET | `/user-vouchers` | STORE_ADMIN | Query: PaginationDto | `findAll` |
| GET | `/user-vouchers/user` | STORE_ADMIN, CUSTOMER | — | `findByUser` |
| GET | `/user-vouchers/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `findById` |
| GET | `/user-vouchers/voucher/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `findByVoucher` |

## vouchers

Source: [`src/model/vouchers/vouchers.controller.ts`](../../src/model/vouchers/vouchers.controller.ts)

| Method | Path | Access | Input | Handler |
|---|---|---|---|---|
| POST | `/vouchers` | STORE_ADMIN | Body: CreateVoucherDto | `create` |
| GET | `/vouchers` | STORE_ADMIN | Query: PaginationDto | `findAll` |
| GET | `/vouchers/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `findById` |
| PATCH | `/vouchers/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string; Body: UpdateVoucherDto | `update` |
| DELETE | `/vouchers/:id` | STORE_ADMIN | Param id, ParseUUIDPipe: string | `remove` |
