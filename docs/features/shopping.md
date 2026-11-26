# Customer shopping

## Addresses
Authenticated actors create and read their own delivery addresses, update or remove their own records, and select a primary address. Store admins can list all records. The backend takes userId from the verified JWT, including when clients send a forged value. Checkout checks address ownership before reservation and records the immutable delivery address snapshot. Primary selection is serialized per account and enforced by a partial unique index; deleting a primary address promotes another one when allowed by order references.

## Cart
The customer's cart is created lazily on first add. Adding/removing a product updates the unique cart/product row; integer item quantities must be positive. A customer lists only their own cart with catalog and price information. Cart display estimates are not authoritative checkout totals. Checkout revalidates current product availability, cart quantity, promotion eligibility and stock; fully purchased cart entries are deleted and partial entries decremented.

## Shipping selection
Checkout computes shipping through RajaOngkir using the configured merchant origin, owned address destination ID, product weights and chosen service. Client-supplied shipping cost is ignored.

## Frontend integration sequence

1. Authenticate at Accounts Service; retain access token in memory.
2. Load public catalog. Add products to authenticated cart and create/select address.
3. Display eligible vouchers and available shipment options.
4. Generate UUID idempotency key, submit checkout and keep that key for retries.
5. Start payment by order ID and open Snap.
6. Poll order/payment status or call sync after browser callback. Only provider-confirmed status can mark an order paid.
