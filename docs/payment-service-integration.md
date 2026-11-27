# Payment Service integration

1. POST /orders/checkout with a client UUID Idempotency-Key. Server checks cart, discounts, stock, address and provider shipping price. It reserves stock and creates an unpaid order.
2. GET /payments/methods with Accounts access JWT.
3. POST /payments/{orderId}/start with paymentMethod, customer {name,email,phone}, optional cardToken. Payment amount is read from the order; the commerce payment UUID is the stable upstream idempotency key. Retry identical request after timeout, never generate a second payment.
4. Payment Service sends signed callbacks to POST /payments/webhook. Configure its WEBHOOK_CALLBACK_URL to https://creamycream-cs.vercel.app/payments/webhook and share WEBHOOK_CALLBACK_SECRET. Map PAYMENT_INTERNAL_HMAC_SECRET to the Payment Service INTERNAL_HMAC_SECRET. Status and amount are checked under database lock; stock finalizes only once.
5. POST /payments/{orderId}/sync or /cancel with access JWT; uncertain creation retains stock until provider confirmation. Refund callbacks are acknowledged; refund/chargeback fulfillment handling remains a separate business decision.
6. After checkout commits, QStash publishes a delayed POST /payments/expire-checkout for the stored checkout deadline. A signed POST /payments/reconcile runs every five minutes as a fallback. Both use a payment row lock and only expire never-started PENDING orders. Payment Service owns upstream reconciliation; signed terminal callbacks release or finalize stock for initialized payments. Never release ambiguous payments merely because a deadline passed.
7. Set SHIPPING_ORIGIN_ID to the merchant RajaOngkir destination ID. Address destinationId and product weightGrams must be populated for production checkout.
8. For an empty DB run npm run db:setup (Prisma db push plus database-only checks/partial unique index). No reset or destructive flags. Configure database environment before execution.
