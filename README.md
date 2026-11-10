# Smart Restaurant

Smart Restaurant is a responsive restaurant ordering and management web application for restaurant owners, staff and diners.

## Main features
- Public restaurant menu with category browsing
- Shopping cart and separate checkout view
- Customer order placement with server-side price validation
- Admin sign-in and one-click read-only demo admin login
- Admin menu creation, editing and deletion
- Order management and status updates
- Sales and order overview dashboard
- SQLite persistence with parameterized SQL queries
- Responsive browser-based interface

## Technology
- Node.js 22, Express 4
- HTML, CSS and vanilla JavaScript
- SQLite with better-sqlite3
- express-session and bcryptjs
- Helmet and express-rate-limit

## Intended users
Restaurant owners and staff who manage menus and orders, and diners who browse a menu and place orders.

## Live demo
https://smart-restaurant-secure.onrender.com/

## Source code
https://github.com/lotifmb48-afk/smart-restaurant-secure

## Local installation
See [HowToSetup.md](HowToSetup.md) for local, VPS and Docker deployment instructions.

Create a private `.env` file from `.env.example`. Never put real credentials in README files, source control, screenshots or public archives. Generate a unique session secret and use a strong, unique administrator password.

## Demo access
The login page provides a **Admin Demo Login** button. It works only when the seller configures `DEMO_ADMIN_USERNAME` and `DEMO_ADMIN_PASSWORD` in the deployment environment. The demo role is read-only; do not publish the real administrator credentials. Customer browsing and ordering require no customer account.

## Screenshots
Add current screenshots before marketplace submission:
- `docs/screenshots/customer-menu.png`
- `docs/screenshots/cart-checkout.png`
- `docs/screenshots/admin-dashboard.png`
- `docs/screenshots/admin-orders.png`
- `docs/screenshots/admin-menu.png`

Screenshots should show the actual running application and must not expose passwords, session cookies, customer phone numbers or private order details.

## Database and persistence
The application creates its SQLite tables on startup. `database/schema.sql` is also provided for manual schema setup. Configure `DATABASE_FILE` to a persistent writable path in production and back up that file regularly. Do not deploy a sample or live database file.

## Security notes
- All real credentials belong in environment variables, not in this repository.
- Use HTTPS in production.
- Use a unique `SESSION_SECRET` of at least 32 characters.
- Set a strong `ADMIN_PASSWORD` of at least 12 characters.
- Configure demo credentials separately from the real admin account.
- Review hosting persistence and backup settings before production use.

## Licence
See [LICENSE-NOTE.md](LICENSE-NOTE.md) for the buyer-facing licence note.
