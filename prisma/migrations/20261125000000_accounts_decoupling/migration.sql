-- Apply only after identity UUID mapping and backup have been verified.
BEGIN;
ALTER TABLE "reviews" ADD COLUMN "reviewer_name" VARCHAR(255), ADD COLUMN "reviewer_image_url" TEXT;
UPDATE "reviews" r SET "reviewer_name" = u."username", "reviewer_image_url" = u."image_url" FROM "users" u WHERE r."user_id" = u."id";
ALTER TABLE "addresses" DROP CONSTRAINT "addresses_user_id_fkey";
CREATE INDEX "addresses_user_id_idx" ON "addresses"("user_id");
ALTER TABLE "carts" DROP CONSTRAINT "carts_user_id_fkey";
ALTER TABLE "orders" DROP CONSTRAINT "orders_user_id_fkey";
CREATE INDEX "orders_user_id_idx" ON "orders"("user_id");
ALTER TABLE "reviews" DROP CONSTRAINT "reviews_user_id_fkey";
CREATE INDEX "reviews_user_id_idx" ON "reviews"("user_id");
ALTER TABLE "user_vouchers" DROP CONSTRAINT "user_vouchers_user_id_fkey";
CREATE INDEX "user_vouchers_user_id_idx" ON "user_vouchers"("user_id");
ALTER TABLE "product_analytics" DROP CONSTRAINT "product_analytics_user_id_fkey";
CREATE INDEX "product_analytics_user_id_idx" ON "product_analytics"("user_id");
ALTER TABLE "user_notifications" DROP CONSTRAINT "user_notifications_user_id_fkey";
CREATE INDEX "user_notifications_user_id_idx" ON "user_notifications"("user_id");
-- Legacy users/roles/user_tokens deliberately retained until UUID migration is approved.
COMMIT;
