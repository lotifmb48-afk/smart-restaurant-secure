const { db } = require('./database');
const { sameOrigin, cleanString, publicFood } = require('./helpers');

module.exports = function registerPublicRoutes(app) {
app.get('/api/health', (req, res) => {
  res.json({ ok: true });
});

app.get('/api/menu', (req, res) => {
  res.json(
    db.prepare('SELECT * FROM menu_items ORDER BY id')
      .all()
      .map(publicFood)
  );
});

app.post('/api/orders', sameOrigin, (req, res) => {
  try {
    const customer = cleanString(req.body.customer, 100, 'নাম');
    const phone = cleanString(req.body.phone, 30, 'ফোন নম্বর');
    const address = cleanString(req.body.address || '', 300, 'ঠিকানা', false);
    const notes = cleanString(req.body.notes || '', 500, 'নোট', false);

    if (
      !Array.isArray(req.body.items) ||
      req.body.items.length < 1 ||
      req.body.items.length > 30
    ) {
      return res.status(400).json({
        error: 'কার্টে ১–৩০টি আইটেম থাকতে হবে।'
      });
    }

    const seen = new Set();
    let items = [];
    let total = 0;

    for (const raw of req.body.items) {
      const id = Number(raw.id);
      const quantity = Number(raw.quantity);

      if (
        !Number.isSafeInteger(id) ||
        id < 1 ||
        !Number.isSafeInteger(quantity) ||
        quantity < 1 ||
        quantity > 50 ||
        seen.has(id)
      ) {
        return res.status(400).json({
          error: 'কার্টের আইটেম বা পরিমাণ সঠিক নয়।'
        });
      }

      seen.add(id);

      items.push({ id, quantity });
    }

    // Resolve every cart item in one parameterized query (no per-item DB round trips).
    const ids = items.map(item => item.id);
    const placeholders = ids.map(() => '?').join(',');
    const foods = db.prepare(
      `SELECT id, name, price FROM menu_items WHERE id IN (${placeholders})`
    ).all(...ids);
    const foodById = new Map(foods.map(food => [food.id, food]));
    if (foods.length !== ids.length) {
      return res.status(400).json({
        error: 'মেনুর একটি আইটেম আর পাওয়া যাচ্ছে না। পেজ রিফ্রেশ করুন।'
      });
    }
    items = items.map(item => ({ ...foodById.get(item.id), quantity: item.quantity }));
    for (const item of items) {
      total += item.price * item.quantity;
      if (!Number.isSafeInteger(total) || total > 100000000) {
        return res.status(400).json({ error: 'অর্ডারের মোট মূল্য সীমার বেশি।' });
      }
    }

    const createOrder = db.transaction(() => {
      const result = db.prepare(`
        INSERT INTO orders
        (customer, phone, address, notes, total, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(customer, phone, address, notes, total, 'Pending');

      const insertItem = db.prepare(`
        INSERT INTO order_items
        (order_id, menu_item_id, name, price, quantity)
        VALUES (?, ?, ?, ?, ?)
      `);

      items.forEach(i => {
        insertItem.run(
          result.lastInsertRowid,
          i.id,
          i.name,
          i.price,
          i.quantity
        );
      });

      return Number(result.lastInsertRowid);
    });

    const id = createOrder();

    res.status(201).json({
      ok: true,
      order: { id, total, status: 'Pending' },
      message: `অর্ডার সফল হয়েছে। অর্ডার নম্বর #${id}`
    });
  } catch (e) {
    res.status(400).json({
      error: e.message || 'অর্ডার গ্রহণ করা যায়নি।'
    });
  }
});


};
