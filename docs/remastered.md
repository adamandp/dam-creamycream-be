# Remastered

Current implementation documentation has moved to [API documentation](api-documentation/README.md) and [features and pipelines](features/README.md).

Identity and sessions are owned by Accounts Service. This service accepts a bearer JWT only; no authentication proxy. It implements a sandbox commerce pipeline with a new database, not a migration of old user data.
