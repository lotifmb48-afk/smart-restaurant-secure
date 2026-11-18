const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');

const dbFile = path.resolve(
  process.env.DATABASE_FILE || './data/restaurant.sqlite'
);

fs.mkdirSync(path.dirname(dbFile), { recursive: true });

const db = new Database(dbFile);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS admins (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT NOT NULL UNIQUE,
 password_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS categories (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menu_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 price INTEGER NOT NULL CHECK(price > 0),
 emoji TEXT NOT NULL DEFAULT '🍽️',
 category TEXT NOT NULL DEFAULT 'Popular',
 description TEXT NOT NULL DEFAULT 'Freshly prepared favourite.',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 customer TEXT NOT NULL,
 phone TEXT NOT NULL,
 address TEXT NOT NULL DEFAULT '',
 notes TEXT NOT NULL DEFAULT '',
 total INTEGER NOT NULL CHECK(total >= 0),
 status TEXT NOT NULL DEFAULT 'Pending',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_items (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 menu_item_id INTEGER,
 name TEXT NOT NULL,
 price INTEGER NOT NULL,
 quantity INTEGER NOT NULL CHECK(quantity > 0)
);

CREATE TABLE IF NOT EXISTS sessions (
 sid TEXT PRIMARY KEY,
 sess TEXT NOT NULL,
 expired_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_menu_item_id ON order_items(menu_item_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expired_at ON sessions(expired_at);
`);

// Add role support without changing existing admin accounts.
const adminColumns = db.pragma('table_info(admins)');

if (!adminColumns.some(column => column.name === 'role')) {
  db.exec(`
    ALTER TABLE admins
    ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'
    CHECK(role IN ('admin', 'demo'))
  `);
}

const dummyPasswordHash = bcrypt.hashSync(
  'dummy-password-for-timing-only',
  12
);

// Create or update the separate demo account safely.
const demoUsername = process.env.DEMO_ADMIN_USERNAME;
const demoPassword = process.env.DEMO_ADMIN_PASSWORD;

if (
  demoUsername &&
  demoPassword &&
  demoPassword.length >= 12 &&
  demoUsername !== process.env.ADMIN_USERNAME
) {
  const existingDemo = db.prepare(
    'SELECT id, role FROM admins WHERE username = ?'
  ).get(demoUsername);

  const demoHash = bcrypt.hashSync(demoPassword, 12);

  if (!existingDemo) {
    db.prepare(`
      INSERT INTO admins (username, password_hash, role)
      VALUES (?, ?, 'demo')
    `).run(demoUsername, demoHash);

    console.log('Demo admin account created.');
  } else if (existingDemo.role === 'demo') {
    db.prepare(`
      UPDATE admins
      SET password_hash = ?
      WHERE id = ? AND role = 'demo'
    `).run(demoHash, existingDemo.id);

    console.log('Demo admin account updated.');
  } else {
    console.warn('Demo username already belongs to a full admin. Demo account skipped.');
  }
} else if (demoUsername || demoPassword) {
  console.warn('Demo account skipped. Check its username and password configuration.');
}

// Create initial real admin only if no admin exists.
const adminCount = db.prepare(
  "SELECT COUNT(*) AS n FROM admins WHERE role = 'admin'"
).get().n;

if (adminCount === 0) {
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);

  db.prepare(`
    INSERT INTO admins (username, password_hash, role)
    VALUES (?, ?, 'admin')
  `).run(process.env.ADMIN_USERNAME, hash);

  console.log('Initial admin account created from environment variables.');
} else {
  console.warn('Admin already exists. Existing credentials are preserved.');
}


// Seed the menu only when the database is empty.
if (db.prepare('SELECT COUNT(*) AS n FROM menu_items').get().n === 0) {
  const seed = db.prepare(`
    INSERT INTO menu_items (name, price, emoji, category, description)
    VALUES (?, ?, ?, ?, ?)
  `);

  const initial = [
    ['Classic Burger', 250, '🍔', 'Popular', 'A delicious classic, freshly prepared.'],
    ['Cheese Pizza', 450, '🍕', 'Mains', 'Cheesy, comforting and full of flavour.'],
    ['Creamy Pasta', 320, '🍝', 'Mains', 'Creamy pasta made for a satisfying meal.'],
    ['Fresh Juice', 150, '🥤', 'Drinks', 'A refreshing drink to brighten your day.'],
    ['Chicken Wings', 360, '🍗', 'Appetizers', 'A tasty bite with a delicious finish.'],
    ['Chocolate Cake', 220, '🍰', 'Desserts', 'A sweet treat for your happy moments.']
  ];

  const tx = db.transaction(() => {
    initial.forEach(x => seed.run(...x));
  });

  tx();
}


module.exports = { db, dummyPasswordHash };
