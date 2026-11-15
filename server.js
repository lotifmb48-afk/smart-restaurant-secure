require('dotenv').config();
const isProduction = process.env.NODE_ENV === 'production';
const sessionSecret = process.env.SESSION_SECRET || '';
if (sessionSecret.length < 32) {
  console.error('ERROR: SESSION_SECRET must be at least 32 characters.');
  process.exit(1);
}
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
  console.error('ERROR: Set ADMIN_USERNAME and ADMIN_PASSWORD. Password must be at least 12 characters.');
  process.exit(1);
}
const { db } = require('./src/database');
const createApp = require('./src/app');
const app = createApp({ db, isProduction, sessionSecret });
const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => console.log(`Smart Restaurant running on port ${port}`));
