# CLAUDE.md

## Project overview
Smart Restaurant is a Node.js and Express restaurant ordering and administration application. It serves a browser UI from `public/` and persists menu, order and session data in SQLite.

## Architecture
- `server.js`: Express bootstrap, environment validation, SQLite initialization, session store, authentication middleware and API route handlers.
- `public/index.html`: customer interface, cart/checkout views, admin login and dashboard UI.
- `database/schema.sql`: reproducible SQLite schema.
- `database/seed.sql`: initial menu records.
- `HowToSetup.md`: local, VPS and Docker setup.

## Routes and business logic
See `docs/API-ARCHITECTURE.md` for the route inventory. Order totals are recalculated on the server using current menu prices. Admin write routes require full-admin authorization; the demo role is read-only.

## Naming and coding conventions
- Use camelCase for JavaScript variables and functions.
- Use descriptive SQL table and index names in snake_case.
- Use parameterized SQL for all user-controlled values.
- Validate and bound all incoming strings, IDs, prices and quantities.
- Never commit `.env`, real credentials, SQLite database files or customer data.
- Keep the real admin and demo admin accounts separate.

## Development commands
- `npm ci` — install locked dependencies.
- `npm run dev` — start Node watch mode.
- `npm start` — start production server.
- `npm audit` — inspect dependency advisories.
- `node --test` — run tests (add tests as features are changed).
