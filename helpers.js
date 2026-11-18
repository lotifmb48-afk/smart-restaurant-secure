const { db } = require('./database');

function sameOrigin(req, res, next) {
  const origin = req.get('origin');

  if (!origin) {
    return res.status(403).json({
      error: 'Origin যাচাই করা যায়নি। ওয়েবসাইট থেকেই আবার চেষ্টা করুন।'
    });
  }

  try {
    if (new URL(origin).host !== req.get('host')) {
      return res.status(403).json({
        error: 'Cross-origin request blocked.'
      });
    }
  } catch {
    return res.status(403).json({
      error: 'Invalid origin.'
    });
  }

  next();
}

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
  if (typeof value !== 'string') {
    throw new Error(`${label} সঠিকভাবে দিন।`);
  }

  const v = value.trim();

  if (required && !v) {
    throw new Error(`${label} দিতে হবে।`);
  }

  if (v.length > max) {
    throw new Error(`${label} সর্বোচ্চ ${max} অক্ষরের হতে পারে।`);
  }

  return v;
}

function publicFood(row) {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    emoji: row.emoji,
    category: row.category,
    description: row.description
  };
}

function orderViews(rows) {
  if (!rows.length) return [];
  const ids = rows.map(row => row.id);
  const placeholders = ids.map(() => '?').join(',');
  const itemRows = db.prepare(`
    SELECT order_id, menu_item_id AS id, name, price, quantity
    FROM order_items WHERE order_id IN (${placeholders})
    ORDER BY id
  `).all(...ids);
  const grouped = new Map(ids.map(id => [id, []]));
  for (const item of itemRows) grouped.get(item.order_id).push({
    id: item.id, name: item.name, price: item.price, quantity: item.quantity
  });
  return rows.map(row => ({
    id: row.id, customer: row.customer, phone: row.phone,
    address: row.address, notes: row.notes, total: row.total,
    status: row.status, date: row.created_at, items: grouped.get(row.id) || []
  }));
}


module.exports = { sameOrigin, requireAdmin, requireFullAdmin, cleanString, publicFood, orderViews };
