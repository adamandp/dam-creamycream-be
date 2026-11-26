# Catalog, promotions and inventory

## Categories
STORE_ADMIN creates, lists, updates and removes category records. Public category queries expose catalog navigation. A category is validated before a product is created.

## Products and product information
STORE_ADMIN manages products and uploads images via the validated multipart endpoint to Cloudinary. Product creation also creates a zero-stock inventory row. Public catalog supports query/filter/pagination and detail endpoints join product, discount, inventory and reviews. Product information is stored in ProductInformation (highlights, serving suggestions, product details and whyChoose) and exposed on the public information endpoint. It is not an independent editable HTTP resource.

## Inventory
STORE_ADMIN lists inventory by ID or product, updates physical stock and activation. Reserved quantity is not writable through the admin DTO. Physical stock cannot fall below reserved stock. Checkout atomically reserves stock for purchased and free items. Payment settlement decreases physical stock and reservation, cancellation releases reservation only. PostgreSQL constraints reject negative or inconsistent inventory.

## Discounts and product discounts
STORE_ADMIN creates discount definitions and links them to products using the ProductDiscount relation. The checkout verifies the exact active link, dates, per-purchase cap and remaining redemption capacity. Fixed, percentage, special price and free-item discounts are supported; money is rounded in integer IDR and cannot become negative. Checkout increments redemption counters inside the serializable transaction. A cancelled order reverses its redemption counters.

## Vouchers and user vouchers
STORE_ADMIN creates vouchers and assigns them to specific Accounts Service users after validating target identity (requires user.read). Customers list their own assigned vouchers. Checkout checks activation, start/end dates, ownership, claimed state, expiry, minimum purchase, redemption caps and group uniqueness. Only one voucher per CHECKOUT/SHIPPING group. Voucher use, redemption and order linkage are atomic; cancellation releases usage. Voucher redemption occurs only through checkout; the standalone self-use endpoint has been removed. Redemption counters are server-managed and database constraints keep them between zero and the configured maximum. A database uniqueness constraint prevents duplicate assignments.
