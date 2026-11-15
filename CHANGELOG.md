# Changelog

## 1.0.0
- Initial Smart Restaurant customer menu and ordering interface.
- SQLite-backed menu and order persistence.
- Session-based administrator authentication.
- Admin dashboard for menu and order management.
- Read-only demo admin role and demo login endpoint.
- Docker and VPS deployment documentation.


## 1.0.1 - Security and maintainability update

- Split startup, Express configuration, SQLite setup, session storage, shared security
  helpers, and public/admin API routes into separate modules.
- Enforced full-admin role checks on all admin write endpoints (retained and covered
  by HTTP integration tests).
- Replaced per-cart-item menu lookups with one parameterized query during order creation.
- Replaced per-order item queries with a batched query for admin order listings.
- Added HTTP integration tests for guest checkout, admin login, demo read-only access,
  and admin menu/order mutations.
- Corrected static asset path after the application module move.
