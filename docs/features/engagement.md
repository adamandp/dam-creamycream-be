# Engagement features

## Reviews
Public product reviews are retrieved by product. Authenticated actors create reviews using their own verified identity; the backend fetches the active Accounts Service profile for a display-name snapshot. Updates and deletes are owner-scoped. Store admins can list all reviews and read individual records. Private expiring account avatars are not persisted as durable public review image URLs.

## Product analytics
Authenticated users record product interactions using the verified sub. Customer queries are restricted to their own activity; administrative queries expose aggregate or product-level records as implemented by the controller. Analytics data is separate from identity credentials.

## Recommendations
Public recommendation endpoints retrieve products and categories based on the existing catalog, discount, review and order-item data. The service maps these into recommendation cards and sorts/ranks selected items by review and sales signals. They are deterministic database queries rather than AI-personalized recommendations. Recommendation display prices are indicative; checkout recalculates them.

## Notifications and user notifications
STORE_ADMIN creates and manages notification templates. A user-notification assignment links an existing notification to a verified Accounts Service account; target validation needs the caller's user.read permission. Customers fetch their own notifications and counts, and mark their own records read. Store admin has list and notification-level queries. No cross-user mutation from a customer token.
