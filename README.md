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
The login page provides a **One-click Admin Demo Login** button. The server automatically creates a dedicated read-only demo account on first database initialization; no demo username or password needs to be published or configured. Demo sessions can inspect dashboard data and print receipts, but server-side authorization blocks menu and order mutations. Keep the real `ADMIN_USERNAME` and `ADMIN_PASSWORD` private. Customer browsing and ordering require no customer account.

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
- The read-only buyer demo account is provisioned automatically; do not share or publish demo credentials.
- Review hosting persistence and backup settings before production use.

## Licence
See [LICENSE-NOTE.md](LICENSE-NOTE.md) for the buyer-facing licence note.


## Feature-to-file map

| Feature | Location |
|---|---|
| Public menu | `public/index.html`, `GET /api/menu` in `server.js` |
| Cart and checkout | `public/index.html` |
| Guest order submission and server-side price validation | `POST /api/orders` in `server.js` |
| Admin sign-in and demo sign-in | Admin login routes in `server.js` |
| Admin order management | Admin order routes in `server.js` |
| Sales dashboard | Admin dashboard in `public/index.html` |
| Persistent SQLite data and sessions | `server.js`, `database/schema.sql` |

Guest checkout is intentional: customers can submit orders without creating an account. Order listing and administration are restricted to authenticated admin sessions. The public API does not provide customer order-history or order-edit endpoints.


## Project structure and tests

The Express setup, SQLite database/session store, security helpers, public routes,
and administrator routes are separated under `src/`. Run `npm test` for schema
and HTTP integration tests. Run `npm audit` before release to review dependency
advisories.
