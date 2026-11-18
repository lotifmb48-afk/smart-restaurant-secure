const bcrypt = require('bcryptjs');
const { db, dummyPasswordHash } = require('./database');
const { sameOrigin, requireAdmin, requireFullAdmin, cleanString, orderViews } = require('./helpers');

module.exports = function registerAdminRoutes(app) {
app.get('/api/admin/me', (req, res) => {
  res.json({
    loggedIn: Boolean(req.session.adminId),
    username: req.session.adminUsername || null,
    role: req.session.adminRole || null
  });
});

app.post('/api/admin/demo-login', sameOrigin, (req, res) => {
  try {
    const demo = db.prepare(`
      SELECT id, username, role FROM admins
      WHERE role = 'demo'
      ORDER BY id ASC LIMIT 1
    `).get();

    if (!demo) {
      return res.status(503).json({
        error: 'ডেমো অ্যাকাউন্ট কনফিগার করা নেই।'
      });
    }

    req.session.regenerate(err => {
      if (err) {
        return res.status(500).json({ error: 'ডেমো লগইন করা যায়নি।' });
      }

      req.session.adminId = demo.id;
      req.session.adminUsername = demo.username;
      req.session.adminRole = 'demo';

      req.session.save(saveErr => {
        if (saveErr) {
          return res.status(500).json({ error: 'ডেমো সেশন সংরক্ষণ করা যায়নি।' });
        }
        res.json({ ok: true, username: demo.username, role: 'demo' });
      });
    });
  } catch (error) {
    console.error('Demo login failed.');
    res.status(500).json({ error: 'ডেমো লগইন করা যায়নি।' });
  }
});

app.post('/api/admin/login', sameOrigin, async (req, res) => {
  try {
    const username = cleanString(
      req.body.username,
      100,
      'ইউজারনেম'
    );

    const password = cleanString(
      req.body.password,
      200,
      'পাসওয়ার্ড'
    );

    const admin = db.prepare(`
      SELECT id, username, password_hash, role
      FROM admins
      WHERE username = ?
    `).get(username);

    const valid = await bcrypt.compare(
      password,
      admin ? admin.password_hash : dummyPasswordHash
    );

    if (!admin || !valid) {
      return res.status(401).json({
        error: 'ইউজারনেম বা পাসওয়ার্ড ভুল।'
      });
    }

    req.session.regenerate(err => {
      if (err) {
        return res.status(500).json({
          error: 'লগইন করা যায়নি। আবার চেষ্টা করুন।'
        });
      }

      req.session.adminId = admin.id;
      req.session.adminUsername = admin.username;
      req.session.adminRole = admin.role || 'admin';

      req.session.save(saveErr => {
        if (saveErr) {
          return res.status(500).json({
            error: 'সেশন সংরক্ষণ করা যায়নি।'
          });
        }

        res.json({
          ok: true,
          username: admin.username,
          role: admin.role || 'admin'
        });
      });
    });
  } catch (e) {
    res.status(400).json({
      error: e.message || 'লগইন করা যায়নি।'
    });
  }
});

app.post('/api/admin/logout', sameOrigin, requireAdmin, (req, res) => {
  req.session.destroy(err => {
    res.clearCookie('sr.sid', {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax'
    });

    if (err) {
      return res.status(500).json({
        error: 'লগআউট সম্পন্ন হয়নি।'
      });
    }

    res.json({ ok: true });
  });
});

app.get('/api/admin/orders', requireAdmin, (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM orders ORDER BY id DESC LIMIT 500'
  ).all();

  const orders = orderViews(rows);

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
  const statuses = [
    'Pending',
    'Preparing',
    'Ready',
    'Delivered',
    'Completed'
  ];

  const id = Number(req.params.id);
  const status = req.body.status;

  if (
    !Number.isSafeInteger(id) ||
    id < 1 ||
    !statuses.includes(status)
  ) {
    return res.status(400).json({
      error: 'অর্ডার বা স্ট্যাটাস সঠিক নয়।'
    });
  }

  const result = db.prepare(
    'UPDATE orders SET status = ? WHERE id = ?'
  ).run(status, id);

  if (!result.changes) {
    return res.status(404).json({
      error: 'অর্ডার পাওয়া যায়নি।'
    });
  }

  res.json({ ok: true });
});

app.delete('/api/admin/orders/:id', sameOrigin, requireFullAdmin, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      error: 'অর্ডার আইডি সঠিক নয়।'
    });
  }

  const result = db.prepare(
    'DELETE FROM orders WHERE id = ?'
  ).run(id);

  if (!result.changes) {
    return res.status(404).json({
      error: 'অর্ডার পাওয়া যায়নি।'
    });
  }

  res.json({ ok: true });
});

app.post('/api/admin/menu', sameOrigin, requireFullAdmin, (req, res) => {
  try {
    const name = cleanString(req.body.name, 100, 'খাবারের নাম');
    const category = cleanString(
      req.body.category || 'Popular',
      60,
      'ক্যাটাগরি'
    );
    const emoji = cleanString(
      req.body.emoji || '🍽️',
      20,
      'ইমোজি'
    );
    const description = cleanString(
      req.body.description || 'Freshly prepared favourite.',
      300,
      'বর্ণনা'
    );

    const price = Number(req.body.price);

    if (
      !Number.isSafeInteger(price) ||
      price < 1 ||
      price > 10000000
    ) {
      return res.status(400).json({
        error: 'দাম ১ থেকে ১০,০০,০০০ টাকার মধ্যে পূর্ণসংখ্যা হতে হবে।'
      });
    }

    const result = db.prepare(`
      INSERT INTO menu_items (name, price, emoji, category, description)
      VALUES (?, ?, ?, ?, ?)
    `).run(name, price, emoji, category, description);

    res.status(201).json({
      ok: true,
      id: Number(result.lastInsertRowid)
    });
  } catch (e) {
    res.status(400).json({
      error: e.message || 'মেনু সংরক্ষণ করা যায়নি।'
    });
  }
});

app.put('/api/admin/menu/:id', sameOrigin, requireFullAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    const name = cleanString(req.body.name, 100, 'খাবারের নাম');
    const category = cleanString(
      req.body.category || 'Popular',
      60,
      'ক্যাটাগরি'
    );
    const emoji = cleanString(
      req.body.emoji || '🍽️',
      20,
      'ইমোজি'
    );
    const description = cleanString(
      req.body.description || 'Freshly prepared favourite.',
      300,
      'বর্ণনা'
    );
    const price = Number(req.body.price);

    if (
      !Number.isSafeInteger(id) ||
      id < 1 ||
      !Number.isSafeInteger(price) ||
      price < 1 ||
      price > 10000000
    ) {
      return res.status(400).json({
        error: 'আইডি বা দাম সঠিক নয়।'
      });
    }

    const result = db.prepare(`
      UPDATE menu_items
      SET name=?, price=?, emoji=?, category=?, description=?
      WHERE id=?
    `).run(name, price, emoji, category, description, id);

    if (!result.changes) {
      return res.status(404).json({
        error: 'মেনু আইটেম পাওয়া যায়নি।'
      });
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({
      error: e.message || 'মেনু আপডেট করা যায়নি।'
    });
  }
});

app.delete('/api/admin/menu/:id', sameOrigin, requireFullAdmin, (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id < 1) {
    return res.status(400).json({
      error: 'আইডি সঠিক নয়।'
    });
  }

  const result = db.prepare(
    'DELETE FROM menu_items WHERE id = ?'
  ).run(id);

  if (!result.changes) {
    return res.status(404).json({
      error: 'মেনু আইটেম পাওয়া যায়নি।'
    });
  }

  res.json({ ok: true });
});


};
