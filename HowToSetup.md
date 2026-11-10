# Smart Restaurant — Setup and Deployment

## Requirements
- Node.js 22.x and npm
- Git (for source deployment)
- A writable persistent directory for the SQLite database

## Local setup (Windows, macOS or Linux)
1. Extract the project ZIP and open a terminal in the project root (the folder containing `package.json`).
2. Copy `.env.example` to `.env`.
3. Edit `.env` and replace every placeholder. Use a unique `SESSION_SECRET` with at least 32 characters and a unique `ADMIN_PASSWORD` with at least 12 characters.
4. Install the exact locked dependencies: `npm ci`.
5. Start the app: `npm start`.
6. Open `http://localhost:3000`.
7. Sign in using the real admin username and password configured in `.env`.

Generate a session secret with:
```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## VPS deployment (Node.js)
1. Install Node.js 22.x and npm on the VPS.
2. Upload or clone the project into a dedicated application directory.
3. Create a private `.env` file from `.env.example`; do not commit or upload `.env`.
4. Set `NODE_ENV=production`, `PORT`, `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD` and optional demo credentials.
5. Set `DATABASE_FILE` to a persistent writable path, for example `/var/lib/smart-restaurant/restaurant.sqlite`; create the directory and grant it to the app user.
6. Run `npm ci`.
7. Start with a process manager such as systemd or PM2. Configure automatic restart and log rotation.
8. Put the app behind a reverse proxy with HTTPS. Ensure the proxy forwards the original host and protocol.
9. Verify `/api/health`, customer ordering, admin login and database persistence after a restart.
10. Back up the SQLite database and test restore procedures.

## Docker deployment
1. Install Docker Engine and the Docker Compose plugin.
2. Copy `.env.example` to `.env` and replace every placeholder with private values.
3. Ensure `SESSION_SECRET`, `ADMIN_USERNAME` and `ADMIN_PASSWORD` are set.
4. Start the service with `docker compose up -d --build`.
5. View logs with `docker compose logs -f smart-restaurant`.
6. Verify `http://YOUR_SERVER:3000/api/health`.
7. The named `restaurant_data` volume persists the SQLite database at `/app/data/restaurant.sqlite`.
8. Back up the Docker volume regularly.

## Database
- The application creates its tables on startup.
- `database/schema.sql` can create the schema in a new SQLite database.
- `database/seed.sql` inserts initial menu items when the menu is empty.
- Never ship a live SQLite database or customer order data in a public archive.
- For production, verify that the host provides persistent disk storage. If it does not, use a managed database rather than ephemeral SQLite storage.

## First admin and demo login
- The first real admin is created from `ADMIN_USERNAME` and `ADMIN_PASSWORD` only when the database has no real admin.
- Changing `ADMIN_PASSWORD` after an admin already exists does not automatically change the stored password hash.
- Configure `DEMO_ADMIN_USERNAME` and `DEMO_ADMIN_PASSWORD` to create a separate read-only demo account. The Admin Demo Login button uses that account.
- Never use the real administrator account as the demo account.
- The optional `ADMIN_RESET_TOKEN` endpoint is sensitive; set a long random token only when needed, use it once, then remove it from the environment.

## Branding
Edit the public interface in `public/index.html`. Review the app title, restaurant name, menu items, currency formatting, contact details and licensed images before resale or deployment.

## Troubleshooting
- `SESSION_SECRET must be at least 32 characters`: configure a longer random secret.
- SQLite permission errors: ensure the app user can write to the directory containing `DATABASE_FILE`.
- Missing demo account: configure both demo environment variables and restart the app.
- Orders disappear after redeploy: the database path is on ephemeral storage; configure a persistent disk or managed database.
