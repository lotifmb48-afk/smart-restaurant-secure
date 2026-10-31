require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());
const isProduction = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT || 3000);
const sessionSecret = process.env.SESSION_SECRET || '';
if (sessionSecret.length < 32) {
  console.error('ERROR: SESSION_SECRET must be at least 32 characters. Set it in your .env file.');
  process.exit(1);
}
if (!process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
  console.error('ERROR: Set ADMIN_USERNAME and ADMIN_PASSWORD in .env. Password must be at least 12 characters.');
  process.exit(1);
}

const dbFile = path.resolve(process.env.DATABASE_FILE || './data/restaurant.sqlite');
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
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expired_at ON sessions(expired_at);
`);
const dummyPasswordHash = bcrypt.hashSync('dummy-password-for-timing-only', 12);
// Add role support without changing existing admin accounts.
const adminColumns = db.pragma('table_info(admins)');
if (!adminColumns.some(column => column.name === 'role')) {
  db.exec(`
    ALTER TABLE admins
    ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'
    CHECK(role IN ('admin', 'demo'))
  `);
}
const adminCount = db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
const demoUsername = process.env.DEMO_ADMIN_USERNAME;
const demoPassword = process.env.DEMO_ADMIN_PASSWORD;

if (demoUsername && demoPassword && demoPassword.length >= 12) {
  const demoHash = bcrypt.hashSync(demoPassword, 12);

  db.prepare(`
    INSERT INTO admins (username, password_hash, role)
    VALUES (?, ?, 'demo')
    ON CONFLICT(username) DO UPDATE SET
      password_hash = excluded.password_hash,
      role = 'demo'
  `).run(demoUsername, demoHash);

  console.log('Demo admin account is ready.');
}
if (adminCount === 0) {
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 12);

  db.prepare(
    'INSERT INTO admins (username, password_hash) VALUES (?, ?)'
  ).run(process.env.ADMIN_USERNAME, hash);

  console.log('Initial admin account created from environment variables.');
} else {
  console.warn(
    'Admin already exists. Existing credentials are preserved.'
  );
}

class SQLiteSessionStore extends session.Store {
  constructor(database) {
    super(); this.db = database;
    this.getStmt = database.prepare('SELECT sess FROM sessions WHERE sid = ? AND expired_at > ?');
    this.setStmt = database.prepare('INSERT INTO sessions (sid, sess, expired_at) VALUES (?, ?, ?) ON CONFLICT(sid) DO UPDATE SET sess=excluded.sess, expired_at=excluded.expired_at');
    this.destroyStmt = database.prepare('DELETE FROM sessions WHERE sid = ?');
    this.touchStmt = database.prepare('UPDATE sessions SET expired_at = ? WHERE sid = ?');
    setInterval(() => { try { database.prepare('DELETE FROM sessions WHERE expired_at <= ?').run(Date.now()); } catch {} }, 60 * 60 * 1000).unref();
  }
  get(sid, cb) {
    try { const row = this.getStmt.get(sid, Date.now()); cb(null, row ? JSON.parse(row.sess) : null); }
    catch (e) { cb(e); }
  }
  set(sid, sess, cb) {
    try { const expires = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 8 * 60 * 60 * 1000; this.setStmt.run(sid, JSON.stringify(sess), expires); cb && cb(null); }
    catch (e) { cb && cb(e); }
  }
  destroy(sid, cb) { try { this.destroyStmt.run(sid); cb && cb(null); } catch (e) { cb && cb(e); } }
  touch(sid, sess, cb) {
    try { const expires = sess.cookie && sess.cookie.expires ? new Date(sess.cookie.expires).getTime() : Date.now() + 8 * 60 * 60 * 1000; this.touchStmt.run(expires, sid); cb && cb(null); }
    catch (e) { cb && cb(e); }
  }
}

app.disable('x-powered-by');
if (isProduction) app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '20kb' }));
app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use(session({
  name: 'sr.sid',
  secret: sessionSecret,
  store: new SQLiteSessionStore(db),
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: { httpOnly: true, secure: isProduction, sameSite: 'lax', maxAge: 8 * 60 * 60 * 1000 }
}));
app.use('/api/admin/login', rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: { error: 'অনেকবার চেষ্টা করা হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।' } }));
app.use('/api/admin/reset-password', rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: true,
  legacyHeaders: false
}));
app.use('/api/orders', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false }));

function sameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (!origin) return res.status(403).json({ error: 'Origin যাচাই করা যায়নি। ওয়েবসাইট থেকেই আবার চেষ্টা করুন।' });
  try {
    if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Cross-origin request blocked.' });
  } catch { return res.status(403).json({ error: 'Invalid origin.' }); }
  next();
function requireAdmin(req, res, next) {
  if (!req.session.adminId) {
    return res.status(401).json({
      error: 'অ্যাডমিন হিসেবে লগইন করুন।'
    });
  }

  next();
}

function requireFullAdmin(req, res, next) {
  if (!req.session.adminId) {
    return res.status(401).json({
      error: 'অ্যাডমিন হিসেবে লগইন করুন।'
    });
  }

  if (req.session.adminRole !== 'admin') {
    return res.status(403).json({
      error: 'Demo account is read-only.'
    });
  }

  next();
}
function cleanString(value, max, label, required = true) {
  if (typeof value !== 'string') throw new Error(`${label} সঠিকভাবে দিন।`);
  const v = value.trim();
  if (required && !v) throw new Error(`${label} দিতে হবে।`);
  if (v.length > max) throw new Error(`${label} সর্বোচ্চ ${max} অক্ষরের হতে পারে।`);
  return v;
}
function publicFood(row) { return { id: row.id, name: row.name, price: row.price, emoji: row.emoji, category: row.category, description: row.description }; }
function orderView(row) {
  const items = db.prepare('SELECT menu_item_id AS id, name, price, quantity FROM order_items WHERE order_id = ?').all(row.id);
  return { id: row.id, customer: row.customer, phone: row.phone, address: row.address, notes: row.notes, total: row.total, status: row.status, date: row.created_at, items };
}

// Seed the menu only when the database is empty.
if (db.prepare('SELECT COUNT(*) AS n FROM menu_items').get().n === 0) {
  const seed = db.prepare('INSERT INTO menu_items (name, price, emoji, category, description) VALUES (?, ?, ?, ?, ?)');
  const initial = [
    ['Classic Burger',250,'🍔','Popular','A delicious classic, freshly prepared.'],
    ['Cheese Pizza',450,'🍕','Mains','Cheesy, comforting and full of flavour.'],
    ['Creamy Pasta',320,'🍝','Mains','Creamy pasta made for a satisfying meal.'],
    ['Fresh Juice',150,'🥤','Drinks','A refreshing drink to brighten your day.'],
    ['Chicken Wings',360,'🍗','Appetizers','A tasty bite with a delicious finish.'],
    ['Chocolate Cake',220,'🍰','Desserts','A sweet treat for your happy moments.']
  ];
  const tx = db.transaction(() => initial.forEach(x => seed.run(...x)));
  tx();
}

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/menu', (req, res) => res.json(db.prepare('SELECT * FROM menu_items ORDER BY id').all().map(publicFood)));
app.post('/api/orders', sameOrigin, (req, res) => {
  try {
    const customer = cleanString(req.body.customer, 100, 'নাম');
    const phone = cleanString(req.body.phone, 30, 'ফোন নম্বর');
    const address = cleanString(req.body.address || '', 300, 'ঠিকানা', false);
    const notes = cleanString(req.body.notes || '', 500, 'নোট', false);
    if (!Array.isArray(req.body.items) || req.body.items.length < 1 || req.body.items.length > 30) return res.status(400).json({ error: 'কার্টে ১–৩০টি আইটেম থাকতে হবে।' });
    const seen = new Set(); const items = []; let total = 0;
    for (const raw of req.body.items) {
      const id = Number(raw.id), quantity = Number(raw.quantity);
      if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 50 || seen.has(id)) return res.status(400).json({ error: 'কার্টের আইটেম বা পরিমাণ সঠিক নয়।' });
      seen.add(id);
      const food = db.prepare('SELECT id, name, price FROM menu_items WHERE id = ?').get(id);
      if (!food) return res.status(400).json({ error: 'মেনুর একটি আইটেম আর পাওয়া যাচ্ছে না। পেজ রিফ্রেশ করুন।' });
      total += food.price * quantity;
      if (!Number.isSafeInteger(total) || total > 100000000) return res.status(400).json({ error: 'অর্ডারের মোট মূল্য সীমার বেশি।' });
      items.push({ ...food, quantity });
    }
    const createOrder = db.transaction(() => {
      const result = db.prepare('INSERT INTO orders (customer, phone, address, notes, total, status) VALUES (?, ?, ?, ?, ?, ?)').run(customer, phone, address, notes, total, 'Pending');
      const insertItem = db.prepare('INSERT INTO order_items (order_id, menu_item_id, name, price, quantity) VALUES (?, ?, ?, ?, ?)');
      items.forEach(i => insertItem.run(result.lastInsertRowid, i.id, i.name, i.price, i.quantity));
      return Number(result.lastInsertRowid);
    });
    const id = createOrder();
    res.status(201).json({ ok: true, order: { id, total, status: 'Pending' }, message: `অর্ডার সফল হয়েছে। অর্ডার নম্বর #${id}` });
  } catch (e) { res.status(400).json({ error: e.message || 'অর্ডার গ্রহণ করা যায়নি।' }); }
});

app.get('/api/admin/me', (req, res) => res.json({ loggedIn: Boolean(req.session.adminId), username: req.session.adminUsername || null }));
app.post('/api/admin/reset-password', sameOrigin, async (req, res) => {
  try {
    const crypto = require('crypto');
    const resetToken = process.env.ADMIN_RESET_TOKEN;

    if (!resetToken) {
      return res.status(404).json({ error: 'এই সুবিধা চালু নেই।' });
    }

    const suppliedToken = String(req.body.token || '');
    const expected = Buffer.from(resetToken);
    const supplied = Buffer.from(suppliedToken);

    if (
      expected.length !== supplied.length ||
      !crypto.timingSafeEqual(expected, supplied)
    ) {
      return res.status(403).json({ error: 'অনুমতি দেওয়া হয়নি।' });
    }

    const username = cleanString(req.body.username, 100, 'ইউজারনেম');
    const password = String(req.body.password || '');

    if (password.length < 12 || password.length > 200) {
      return res.status(400).json({
        error: 'পাসওয়ার্ড কমপক্ষে ১২ অক্ষরের হতে হবে।'
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const resetAdmin = db.transaction(() => {
      const admin = db.prepare(
        'SELECT id FROM admins ORDER BY id LIMIT 1'
      ).get();

      if (admin) {
        db.prepare(
          'UPDATE admins SET username = ?, password_hash = ? WHERE id = ?'
        ).run(username, passwordHash, admin.id);
      } else {
        db.prepare(
          'INSERT INTO admins (username, password_hash) VALUES (?, ?)'
        ).run(username, passwordHash);
      }

      db.prepare('DELETE FROM sessions').run();
    });

    resetAdmin();

    return res.json({
      ok: true,
      message: 'অ্যাডমিন অ্যাকাউন্ট রিসেট হয়েছে।'
    });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        error: 'এই ইউজারনেমটি আগে থেকেই ব্যবহৃত হচ্ছে।'
      });
    }

    console.error('Admin reset failed.');
    return res.status(500).json({
      error: 'রিসেট করা যায়নি। সার্ভার কনফিগারেশন পরীক্ষা করুন।'
    });
  }
});
app.post('/api/admin/login', sameOrigin, async (req, res) => {
  try {
    const username = cleanString(req.body.username, 100, 'ইউজারনেম');
    const password = cleanString(req.body.password, 200, 'পাসওয়ার্ড');
    const admin = db.prepare('SELECT id, username, password_hash, role FROM admins WHERE username = ?').get(username);
    const valid = await bcrypt.compare(password, admin ? admin.password_hash : dummyPasswordHash);
    if (!admin || !valid) return res.status(401).json({ error: 'ইউজারনেম বা পাসওয়ার্ড ভুল।' });
    req.session.regenerate(err => {
      if (err) return res.status(500).json({ error: 'লগইন করা যায়নি। আবার চেষ্টা করুন।' });
      req.session.adminId = admin.id;
req.session.adminUsername = admin.username;
req.session.adminRole = admin.role || 'admin';
      req.session.save(saveErr => saveErr ? res.status(500).json({ error: 'সেশন সংরক্ষণ করা যায়নি।' }) : res.json({ ok: true, username: admin.username }));
    });
  } catch (e) { res.status(400).json({ error: e.message || 'লগইন করা যায়নি।' }); }
});
app.post('/api/admin/logout', sameOrigin, requireAdmin, (req, res) => req.session.destroy(err => {
  res.clearCookie('sr.sid', { httpOnly: true, secure: isProduction, sameSite: 'lax' });
  if (err) return res.status(500).json({ error: 'লগআউট সম্পন্ন হয়নি।' });
  res.json({ ok: true });
}));
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const rows = db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 500').all();
  const orders = rows.map(orderView);

  if (req.session.adminRole === 'demo') {
    return res.json(orders.map(order => ({
      ...order,
      customer: 'Demo Customer',
      phone: '',
      address: '',
      notes: ''
    })));
  }

  res.json(orders);
});
app.patch('/api/admin/orders/:id', sameOrigin, requireFullAdmin, (req, res) => {
  const statuses = ['Pending', 'Preparing', 'Ready', 'Delivered', 'Completed'];
  const id = Number(req.params.id), status = req.body.status;
  if (!Number.isSafeInteger(id) || id < 1 || !statuses.includes(status)) return res.status(400).json({ error: 'অর্ডার বা স্ট্যাটাস সঠিক নয়।' });
  const result = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  if (!result.changes) return res.status(404).json({ error: 'অর্ডার পাওয়া যায়নি।' });
  res.json({ ok: true });
});
app.delete('/api/admin/orders/:id', sameOrigin, requireFullAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'অর্ডার আইডি সঠিক নয়।' });
  const result = db.prepare('DELETE FROM orders WHERE id = ?').run(id);
  if (!result.changes) return res.status(404).json({ error: 'অর্ডার পাওয়া যায়নি।' });
  res.json({ ok: true });
});
app.post('/api/admin/menu', sameOrigin, requireFullAdmin, (req, res) => {
  try {
    const name = cleanString(req.body.name, 100, 'খাবারের নাম');
    const category = cleanString(req.body.category || 'Popular', 60, 'ক্যাটাগরি');
    const emoji = cleanString(req.body.emoji || '🍽️', 20, 'ইমোজি');
    const description = cleanString(req.body.description || 'Freshly prepared favourite.', 300, 'বর্ণনা');
    const price = Number(req.body.price);
    if (!Number.isSafeInteger(price) || price < 1 || price > 10000000) return res.status(400).json({ error: 'দাম ১ থেকে ১০,০০,০০০ টাকার মধ্যে পূর্ণসংখ্যা হতে হবে।' });
    const result = db.prepare('INSERT INTO menu_items (name, price, emoji, category, description) VALUES (?, ?, ?, ?, ?)').run(name, price, emoji, category, description);
    res.status(201).json({ ok: true, id: Number(result.lastInsertRowid) });
  } catch (e) { res.status(400).json({ error: e.message || 'মেনু সংরক্ষণ করা যায়নি।' }); }
});
app.put('/api/admin/menu/:id', sameOrigin, requireFullAdmin, (req, res) => {
  try {
    const id = Number(req.params.id), name = cleanString(req.body.name, 100, 'খাবারের নাম'), category = cleanString(req.body.category || 'Popular', 60, 'ক্যাটাগরি'), emoji = cleanString(req.body.emoji || '🍽️', 20, 'ইমোজি'), description = cleanString(req.body.description || 'Freshly prepared favourite.', 300, 'বর্ণনা'), price = Number(req.body.price);
    if (!Number.isSafeInteger(id) || id < 1 || !Number.isSafeInteger(price) || price < 1 || price > 10000000) return res.status(400).json({ error: 'আইডি বা দাম সঠিক নয়।' });
    const result = db.prepare('UPDATE menu_items SET name=?, price=?, emoji=?, category=?, description=? WHERE id=?').run(name, price, emoji, category, description, id);
    if (!result.changes) return res.status(404).json({ error: 'মেনু আইটেম পাওয়া যায়নি।' });
    res.json({ ok: true });
  } catch (e) { res.status(400).json({ error: e.message || 'মেনু আপডেট করা যায়নি।' }); }
});
app.delete('/api/admin/menu/:id', sameOrigin, requireFullAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'আইডি সঠিক নয়।' });
  const result = db.prepare('DELETE FROM menu_items WHERE id = ?').run(id);
  if (!result.changes) return res.status(404).json({ error: 'মেনু আইটেম পাওয়া যায়নি।' });
  res.json({ ok: true });
});

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], maxAge: isProduction ? '1h' : 0 }));
app.use((err, req, res, next) => { console.error(err); if (res.headersSent) return next(err); res.status(500).json({ error: 'সার্ভারে সমস্যা হয়েছে।' }); });
app.listen(port, '0.0.0.0', () => console.log(`Smart Restaurant running on port ${port}`));
