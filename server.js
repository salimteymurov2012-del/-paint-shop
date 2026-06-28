const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { initDatabase, getDb, queryAll, queryOne, run } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, uuidv4() + ext);
  }
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } });

function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'];
  const settings = queryOne('SELECT value FROM settings WHERE key = ?', ['admin_key']);
  if (key && settings && key === settings.value) {
    req.isAdmin = true;
    return next();
  }
  return res.status(403).json({ error: 'Доступ запрещён' });
}

// ===========================
// PUBLIC API
// ===========================

app.get('/api/products', (req, res) => {
  const { category, search, sort, difficulty, visible } = req.query;
  let sql = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1';
  const params = [];

  if (visible !== 'all') sql += ' AND p.visible = 1';
  if (category) { sql += ' AND p.category_id = ?'; params.push(category); }
  if (search) { sql += ' AND (p.name LIKE ? OR p.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  if (difficulty && difficulty !== 'all') { sql += ' AND p.difficulty = ?'; params.push(difficulty); }

  const sortMap = { price_asc: 'p.price ASC', price_desc: 'p.price DESC', name: 'p.name ASC', new: 'p.created_at DESC', default: 'p.order_index ASC, p.created_at DESC' };
  sql += ' ORDER BY ' + (sortMap[sort] || sortMap.default);

  const products = queryAll(sql, params);
  const result = products.map(p => ({
    ...p,
    images: queryAll('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_main DESC, order_index ASC', [p.id])
  }));
  res.json(result);
});

app.get('/api/products/:id', (req, res) => {
  const product = queryOne('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [req.params.id]);
  if (!product) return res.status(404).json({ error: 'Не найдено' });
  product.images = queryAll('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_main DESC, order_index ASC', [product.id]);
  res.json(product);
});

app.get('/api/categories', (req, res) => {
  const categories = queryAll('SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.visible = 1) as product_count FROM categories c ORDER BY c.order_index ASC');
  res.json(categories);
});

app.get('/api/banners', (req, res) => {
  res.json(queryAll('SELECT * FROM banners WHERE is_active = 1 ORDER BY order_index ASC'));
});

app.post('/api/orders', (req, res) => {
  const { name, phone, email, address, comment, items, delivery_method, payment_method } = req.body;
  if (!name || !phone || !items) return res.status(400).json({ error: 'Заполните обязательные поля' });
  const id = uuidv4();
  const total = JSON.parse(items).reduce((s, i) => s + (i.price * i.quantity), 0);
  run(`INSERT INTO orders (id, customer_name, customer_phone, customer_email, address, comment, items, total, delivery_method, payment_method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, name, phone, email || '', address || '', comment || '', items, total, delivery_method || '', payment_method || '']);
  res.json({ success: true, id });
});

app.get('/api/settings/public', (req, res) => {
  const keys = ['site_name', 'site_description', 'phone', 'email', 'address', 'social_links', 'delivery_info', 'payment_info', 'about_text', 'manufacturer'];
  const settings = {};
  for (const key of keys) {
    const row = queryOne('SELECT value FROM settings WHERE key = ?', [key]);
    if (row) {
      if (key === 'social_links') {
        try { settings[key] = JSON.parse(row.value); } catch(e) { settings[key] = []; }
      } else {
        settings[key] = row.value;
      }
    }
  }
  res.json(settings);
});

app.get('/api/home-products', (req, res) => {
  const news = queryAll("SELECT p.*, (SELECT filename FROM product_images WHERE product_id = p.id AND is_main = 1 LIMIT 1) as image FROM products p WHERE p.visible = 1 AND p.is_new = 1 ORDER BY p.created_at DESC LIMIT 8");
  const bestsellers = queryAll("SELECT p.*, (SELECT filename FROM product_images WHERE product_id = p.id AND is_main = 1 LIMIT 1) as image FROM products p WHERE p.visible = 1 AND p.is_bestseller = 1 ORDER BY p.order_index ASC LIMIT 8");
  const recommended = queryAll("SELECT p.*, (SELECT filename FROM product_images WHERE product_id = p.id AND is_main = 1 LIMIT 1) as image FROM products p WHERE p.visible = 1 AND p.is_recommended = 1 ORDER BY p.order_index ASC LIMIT 8");
  const limited = queryAll("SELECT p.*, (SELECT filename FROM product_images WHERE product_id = p.id AND is_main = 1 LIMIT 1) as image FROM products p WHERE p.visible = 1 AND p.is_limited = 1 ORDER BY p.order_index ASC LIMIT 8");
  res.json({ news, bestsellers, recommended, limited });
});

// ===========================
// ADMIN API
// ===========================

app.post('/api/admin/login', (req, res) => {
  const { key } = req.body;
  const settings = queryOne('SELECT value FROM settings WHERE key = ?', ['admin_key']);
  if (settings && key === settings.value) {
    const sessionId = uuidv4();
    run('INSERT INTO admin_sessions (id) VALUES (?)', [sessionId]);
    res.json({ success: true, token: sessionId, key });
  } else {
    res.status(403).json({ error: 'Неверный ключ доступа' });
  }
});

app.get('/api/admin/check', (req, res) => {
  const key = req.headers['x-admin-key'];
  const settings = queryOne('SELECT value FROM settings WHERE key = ?', ['admin_key']);
  res.json({ authenticated: !!(key && settings && key === settings.value) });
});

app.get('/api/admin/products', adminAuth, (req, res) => {
  const products = queryAll('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.order_index ASC, p.created_at DESC');
  const result = products.map(p => ({ ...p, images: queryAll('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_main DESC, order_index ASC', [p.id]) }));
  res.json(result);
});

app.post('/api/admin/products', adminAuth, upload.array('images', 10), (req, res) => {
  const id = uuidv4();
  const slug = req.body.name.toLowerCase().replace(/[^a-zа-яё0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
  const data = req.body;

  run(`INSERT INTO products (id, name, slug, description, price, old_price, discount, discount_percent, category_id, sizes, difficulty, colors_count, manufacturer, includes, stock, visible, is_new, is_bestseller, is_recommended, is_limited, seo_title, seo_description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
    id, data.name, slug, data.description || '', parseFloat(data.price) || 0,
    data.old_price ? parseFloat(data.old_price) : 0,
    data.old_price ? 1 : 0, parseInt(data.discount_percent) || 0,
    data.category_id || null, data.sizes || '[]', data.difficulty || 'Средний',
    parseInt(data.colors_count) || 24, data.manufacturer || '',
    data.includes || '', parseInt(data.stock) || 0,
    data.visible !== undefined ? parseInt(data.visible) : 1,
    data.is_new ? 1 : 0, data.is_bestseller ? 1 : 0, data.is_recommended ? 1 : 0, data.is_limited ? 1 : 0,
    data.seo_title || '', data.seo_description || ''
  ]);

  if (req.files && req.files.length > 0) {
    req.files.forEach((file, index) => {
      run('INSERT INTO product_images (id, product_id, filename, is_main, order_index) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), id, file.filename, index === 0 ? 1 : 0, index]);
    });
  }
  res.json({ success: true, id });
});

app.put('/api/admin/products/:id', adminAuth, upload.array('images', 10), (req, res) => {
  const data = req.body;
  const id = req.params.id;
  run(`UPDATE products SET name=?, description=?, price=?, old_price=?, discount=?, discount_percent=?, category_id=?, sizes=?, difficulty=?, colors_count=?, manufacturer=?, includes=?, stock=?, visible=?, is_new=?, is_bestseller=?, is_recommended=?, is_limited=?, seo_title=?, seo_description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [
    data.name, data.description || '', parseFloat(data.price) || 0,
    data.old_price ? parseFloat(data.old_price) : 0,
    data.old_price ? 1 : 0, parseInt(data.discount_percent) || 0,
    data.category_id || null, data.sizes || '[]', data.difficulty || 'Средний',
    parseInt(data.colors_count) || 24, data.manufacturer || '',
    data.includes || '', parseInt(data.stock) || 0,
    data.visible !== undefined ? parseInt(data.visible) : 1,
    data.is_new ? 1 : 0, data.is_bestseller ? 1 : 0, data.is_recommended ? 1 : 0, data.is_limited ? 1 : 0,
    data.seo_title || '', data.seo_description || '', id
  ]);
  if (req.files && req.files.length > 0) {
    const currentCount = queryOne('SELECT COUNT(*) as c FROM product_images WHERE product_id = ?', [id])?.c || 0;
    req.files.forEach((file, index) => {
      run('INSERT INTO product_images (id, product_id, filename, is_main, order_index) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), id, file.filename, 0, currentCount + index]);
    });
  }
  res.json({ success: true });
});

app.delete('/api/admin/products/:id', adminAuth, (req, res) => {
  run('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.put('/api/admin/products/:id/visibility', adminAuth, (req, res) => {
  run('UPDATE products SET visible = ? WHERE id = ?', [req.body.visible, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/admin/products/:id/image/:imageId', adminAuth, (req, res) => {
  run('DELETE FROM product_images WHERE id = ? AND product_id = ?', [req.params.imageId, req.params.id]);
  res.json({ success: true });
});

app.put('/api/admin/products/:id/main-image/:imageId', adminAuth, (req, res) => {
  run('UPDATE product_images SET is_main = 0 WHERE product_id = ?', [req.params.id]);
  run('UPDATE product_images SET is_main = 1 WHERE id = ?', [req.params.imageId]);
  res.json({ success: true });
});

app.get('/api/admin/categories', adminAuth, (req, res) => {
  res.json(queryAll('SELECT * FROM categories ORDER BY order_index ASC'));
});

app.post('/api/admin/categories', adminAuth, (req, res) => {
  const id = uuidv4();
  const slug = req.body.name.toLowerCase().replace(/[^a-zа-яё0-9]+/g, '-').replace(/^-|-$/g, '');
  run('INSERT INTO categories (id, name, slug, parent_id, order_index) VALUES (?, ?, ?, ?, ?)',
    [id, req.body.name, slug, req.body.parent_id || null, parseInt(req.body.order_index) || 0]);
  res.json({ success: true, id });
});

app.put('/api/admin/categories/:id', adminAuth, (req, res) => {
  run('UPDATE categories SET name=?, parent_id=?, order_index=? WHERE id=?',
    [req.body.name, req.body.parent_id || null, parseInt(req.body.order_index) || 0, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/admin/categories/:id', adminAuth, (req, res) => {
  run('DELETE FROM categories WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/admin/banners', adminAuth, (req, res) => {
  res.json(queryAll('SELECT * FROM banners ORDER BY order_index ASC'));
});

app.post('/api/admin/banners', adminAuth, upload.single('image'), (req, res) => {
  const id = uuidv4();
  run('INSERT INTO banners (id, title, subtitle, button_text, button_link, image, is_active, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.body.title || '', req.body.subtitle || '', req.body.button_text || '', req.body.button_link || '',
    req.file ? req.file.filename : '', req.body.is_active !== undefined ? parseInt(req.body.is_active) : 1, parseInt(req.body.order_index) || 0]);
  res.json({ success: true, id });
});

app.put('/api/admin/banners/:id', adminAuth, upload.single('image'), (req, res) => {
  if (req.file) {
    run('UPDATE banners SET title=?, subtitle=?, button_text=?, button_link=?, image=?, is_active=?, order_index=? WHERE id=?',
      [req.body.title || '', req.body.subtitle || '', req.body.button_text || '', req.body.button_link || '',
      req.file.filename, req.body.is_active !== undefined ? parseInt(req.body.is_active) : 1, parseInt(req.body.order_index) || 0, req.params.id]);
  } else {
    run('UPDATE banners SET title=?, subtitle=?, button_text=?, button_link=?, is_active=?, order_index=? WHERE id=?',
      [req.body.title || '', req.body.subtitle || '', req.body.button_text || '', req.body.button_link || '',
      req.body.is_active !== undefined ? parseInt(req.body.is_active) : 1, parseInt(req.body.order_index) || 0, req.params.id]);
  }
  res.json({ success: true });
});

app.delete('/api/admin/banners/:id', adminAuth, (req, res) => {
  run('DELETE FROM banners WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/admin/orders', adminAuth, (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM orders';
  const params = [];
  if (status && status !== 'all') { sql += ' WHERE status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';
  res.json(queryAll(sql, params));
});

app.put('/api/admin/orders/:id/status', adminAuth, (req, res) => {
  run('UPDATE orders SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/admin/orders/:id', adminAuth, (req, res) => {
  run('DELETE FROM orders WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/admin/reviews', adminAuth, (req, res) => {
  res.json(queryAll('SELECT r.*, p.name as product_name FROM reviews r LEFT JOIN products p ON r.product_id = p.id ORDER BY r.created_at DESC'));
});

app.put('/api/admin/reviews/:id/approve', adminAuth, (req, res) => {
  run('UPDATE reviews SET is_approved = ? WHERE id = ?', [req.body.approved, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/admin/reviews/:id', adminAuth, (req, res) => {
  run('DELETE FROM reviews WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/admin/promocodes', adminAuth, (req, res) => {
  res.json(queryAll('SELECT * FROM promocodes ORDER BY created_at DESC'));
});

app.post('/api/admin/promocodes', adminAuth, (req, res) => {
  const id = uuidv4();
  run('INSERT INTO promocodes (id, code, discount_percent, max_uses, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    [id, req.body.code, parseInt(req.body.discount_percent), parseInt(req.body.max_uses) || 0, req.body.expires_at || null, 1]);
  res.json({ success: true, id });
});

app.delete('/api/admin/promocodes/:id', adminAuth, (req, res) => {
  run('DELETE FROM promocodes WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/admin/settings', adminAuth, (req, res) => {
  const all = queryAll('SELECT * FROM settings');
  const settings = {};
  for (const s of all) settings[s.key] = s.value;
  res.json(settings);
});

app.put('/api/admin/settings', adminAuth, (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }
  res.json({ success: true });
});

app.get('/api/my-ip', (req, res) => {
  const ips = os.networkInterfaces();
  let ip = 'localhost';
  for (const name of Object.keys(ips)) {
    for (const iface of ips[name]) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.')) {
        ip = iface.address;
        break;
      }
    }
    if (ip !== 'localhost') break;
  }
  res.json({ ip });
});

app.get('/api/admin/stats', adminAuth, (req, res) => {
  const totalProducts = queryOne('SELECT COUNT(*) as c FROM products')?.c || 0;
  const totalOrders = queryOne('SELECT COUNT(*) as c FROM orders')?.c || 0;
  const totalRevenue = queryOne("SELECT COALESCE(SUM(total), 0) as s FROM orders WHERE status != ?", ['cancelled'])?.s || 0;
  const totalCustomers = queryOne('SELECT COUNT(DISTINCT customer_phone) as c FROM orders')?.c || 0;
  const newOrders = queryOne("SELECT COUNT(*) as c FROM orders WHERE status = 'new'")?.c || 0;
  const popular = queryAll("SELECT p.id, p.name, COUNT(*) as total FROM products p GROUP BY p.id ORDER BY total DESC LIMIT 5");
  res.json({ totalProducts, totalOrders, totalRevenue, totalCustomers, newOrders, popular });
});

// Init and start
async function start() {
  const uploadsDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

start().catch(console.error);
