const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { v4: uuidv4 } = require('uuid');
const { initDatabase, getDb, queryAll, queryOne, run, uploadToStorage, deleteFromStorage, getSupabase, getPublicUrl } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function adminAuth(req, res, next) {
  const key = req.headers['x-admin-key'];
  const settings = await queryOne('SELECT value FROM settings WHERE key = ?', ['admin_key']);
  if (key && settings && key === settings.value) {
    req.isAdmin = true;
    return next();
  }
  return res.status(403).json({ error: 'Доступ запрещён' });
}

app.get('/uploads/:filename', async (req, res) => {
  try {
    const supabase = getSupabase();
    if (supabase) {
      const { data, error } = await supabase.storage.from('products').download(req.params.filename);
      if (error || !data) return res.sendFile(path.join(__dirname, 'uploads', req.params.filename));
      const buffer = Buffer.from(await data.arrayBuffer());
      res.set('Content-Type', data.type || 'image/jpeg');
      res.set('Cache-Control', 'public, max-age=31536000');
      return res.send(buffer);
    }
    res.sendFile(path.join(__dirname, 'uploads', req.params.filename));
  } catch (e) {
    res.status(404).end();
  }
});

app.get('/api/products', async (req, res) => {
  const { category, search, sort, difficulty, visible } = req.query;
  let sql = 'SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE 1=1';
  const params = [];
  if (visible !== 'all') sql += ' AND p.visible = 1';
  if (category) { sql += ' AND p.category_id = ?'; params.push(category); }
  if (search) { sql += ' AND (LOWER(p.name) LIKE LOWER(?) OR LOWER(p.description) LIKE LOWER(?))'; params.push(`%${search}%`, `%${search}%`); }
  if (difficulty && difficulty !== 'all') { sql += ' AND p.difficulty = ?'; params.push(difficulty); }
  const sortMap = { price_asc: 'p.price ASC', price_desc: 'p.price DESC', name: 'p.name ASC', new: 'p.created_at DESC', default: 'p.order_index ASC, p.created_at DESC' };
  sql += ' ORDER BY ' + (sortMap[sort] || sortMap.default);
  const products = await queryAll(sql, params);
  const result = await Promise.all(products.map(async p => ({
    ...p,
    images: await queryAll('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_main DESC, order_index ASC', [p.id])
  })));
  res.json(result);
});

app.get('/api/products/:id', async (req, res) => {
  const product = await queryOne('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?', [req.params.id]);
  if (!product) return res.status(404).json({ error: 'Не найдено' });
  product.images = await queryAll('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_main DESC, order_index ASC', [product.id]);
  res.json(product);
});

app.get('/api/categories', async (req, res) => {
  const categories = await queryAll(`SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.visible = 1) as product_count FROM categories c ORDER BY c.order_index ASC`);
  res.json(categories);
});

app.get('/api/banners', async (req, res) => {
  res.json(await queryAll('SELECT * FROM banners WHERE is_active = 1 ORDER BY order_index ASC'));
});

app.post('/api/orders', async (req, res) => {
  const { name, phone, email, address, comment, items, delivery_method, payment_method } = req.body;
  if (!name || !phone || !items) return res.status(400).json({ error: 'Заполните обязательные поля' });
  const id = uuidv4();
  const total = JSON.parse(items).reduce((s, i) => s + (i.price * i.quantity), 0);
  await run(`INSERT INTO orders (id, customer_name, customer_phone, customer_email, address, comment, items, total, delivery_method, payment_method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [id, name, phone, email || '', address || '', comment || '', items, total, delivery_method || '', payment_method || '']);
  res.json({ success: true, id });
});

app.get('/api/settings/public', async (req, res) => {
  const keys = ['site_name', 'site_description', 'phone', 'email', 'address', 'social_links', 'delivery_info', 'payment_info', 'about_text', 'manufacturer'];
  const settings = {};
  for (const key of keys) {
    const row = await queryOne('SELECT value FROM settings WHERE key = ?', [key]);
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

app.get('/api/home-products', async (req, res) => {
  const news = await queryAll("SELECT p.*, (SELECT filename FROM product_images WHERE product_id = p.id AND is_main = 1 LIMIT 1) as image FROM products p WHERE p.visible = 1 AND p.is_new = 1 ORDER BY p.created_at DESC LIMIT 8");
  const bestsellers = await queryAll("SELECT p.*, (SELECT filename FROM product_images WHERE product_id = p.id AND is_main = 1 LIMIT 1) as image FROM products p WHERE p.visible = 1 AND p.is_bestseller = 1 ORDER BY p.order_index ASC LIMIT 8");
  const recommended = await queryAll("SELECT p.*, (SELECT filename FROM product_images WHERE product_id = p.id AND is_main = 1 LIMIT 1) as image FROM products p WHERE p.visible = 1 AND p.is_recommended = 1 ORDER BY p.order_index ASC LIMIT 8");
  const limited = await queryAll("SELECT p.*, (SELECT filename FROM product_images WHERE product_id = p.id AND is_main = 1 LIMIT 1) as image FROM products p WHERE p.visible = 1 AND p.is_limited = 1 ORDER BY p.order_index ASC LIMIT 8");
  res.json({ news, bestsellers, recommended, limited });
});

app.post('/api/admin/login', async (req, res) => {
  const { key } = req.body;
  const settings = await queryOne('SELECT value FROM settings WHERE key = ?', ['admin_key']);
  if (settings && key === settings.value) {
    const sessionId = uuidv4();
    await run('INSERT INTO admin_sessions (id) VALUES (?)', [sessionId]);
    res.json({ success: true, token: sessionId, key });
  } else {
    res.status(403).json({ error: 'Неверный ключ доступа' });
  }
});

app.get('/api/admin/check', async (req, res) => {
  const key = req.headers['x-admin-key'];
  const settings = await queryOne('SELECT value FROM settings WHERE key = ?', ['admin_key']);
  res.json({ authenticated: !!(key && settings && key === settings.value) });
});

app.get('/api/admin/products', adminAuth, async (req, res) => {
  const products = await queryAll('SELECT p.*, c.name as category_name FROM products p LEFT JOIN categories c ON p.category_id = c.id ORDER BY p.order_index ASC, p.created_at DESC');
  const result = await Promise.all(products.map(async p => ({ ...p, images: await queryAll('SELECT * FROM product_images WHERE product_id = ? ORDER BY is_main DESC, order_index ASC', [p.id]) })));
  res.json(result);
});

app.post('/api/admin/products', adminAuth, upload.array('images', 10), async (req, res) => {
  const id = uuidv4();
  const slug = req.body.name.toLowerCase().replace(/[^a-zа-яё0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now();
  const data = req.body;
  await run(`INSERT INTO products (id, name, slug, description, price, old_price, discount, discount_percent, category_id, sizes, difficulty, colors_count, manufacturer, includes, stock, visible, is_new, is_bestseller, is_recommended, is_limited, seo_title, seo_description)
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
    for (let index = 0; index < req.files.length; index++) {
      const file = req.files[index];
      const filename = uuidv4() + path.extname(file.originalname);
      await uploadToStorage(file.buffer, filename, file.mimetype);
      await run('INSERT INTO product_images (id, product_id, filename, is_main, order_index) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), id, filename, index === 0 ? 1 : 0, index]);
    }
  }
  res.json({ success: true, id });
});

app.put('/api/admin/products/:id', adminAuth, upload.array('images', 10), async (req, res) => {
  const data = req.body;
  const id = req.params.id;
    await run(`UPDATE products SET name=?, description=?, price=?, old_price=?, discount=?, discount_percent=?, category_id=?, sizes=?, difficulty=?, colors_count=?, manufacturer=?, includes=?, stock=?, visible=?, is_new=?, is_bestseller=?, is_recommended=?, is_limited=?, seo_title=?, seo_description=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [
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
    const currentCount = (await queryOne('SELECT COUNT(*) as c FROM product_images WHERE product_id = ?', [id]))?.c || 0;
    for (let index = 0; index < req.files.length; index++) {
      const file = req.files[index];
      const filename = uuidv4() + path.extname(file.originalname);
      await uploadToStorage(file.buffer, filename, file.mimetype);
      await run('INSERT INTO product_images (id, product_id, filename, is_main, order_index) VALUES (?, ?, ?, ?, ?)',
        [uuidv4(), id, filename, 0, currentCount + index]);
    }
  }
  res.json({ success: true });
});

app.delete('/api/admin/products/:id', adminAuth, async (req, res) => {
  const images = await queryAll('SELECT filename FROM product_images WHERE product_id = ?', [req.params.id]);
  for (const img of images) {
    await deleteFromStorage(img.filename);
  }
  await run('DELETE FROM product_images WHERE product_id = ?', [req.params.id]);
  await run('DELETE FROM products WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.put('/api/admin/products/:id/visibility', adminAuth, async (req, res) => {
  await run('UPDATE products SET visible = ? WHERE id = ?', [req.body.visible, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/admin/products/:id/image/:imageId', adminAuth, async (req, res) => {
  const img = await queryOne('SELECT filename FROM product_images WHERE id = ? AND product_id = ?', [req.params.imageId, req.params.id]);
  if (img) await deleteFromStorage(img.filename);
  await run('DELETE FROM product_images WHERE id = ? AND product_id = ?', [req.params.imageId, req.params.id]);
  res.json({ success: true });
});

app.put('/api/admin/products/:id/main-image/:imageId', adminAuth, async (req, res) => {
  await run('UPDATE product_images SET is_main = 0 WHERE product_id = ?', [req.params.id]);
  await run('UPDATE product_images SET is_main = 1 WHERE id = ?', [req.params.imageId]);
  res.json({ success: true });
});

app.get('/api/admin/categories', adminAuth, async (req, res) => {
  res.json(await queryAll('SELECT * FROM categories ORDER BY order_index ASC'));
});

app.post('/api/admin/categories', adminAuth, async (req, res) => {
  const id = uuidv4();
  const slug = req.body.name.toLowerCase().replace(/[^a-zа-яё0-9]+/g, '-').replace(/^-|-$/g, '');
  await run('INSERT INTO categories (id, name, slug, parent_id, order_index) VALUES (?, ?, ?, ?, ?)',
    [id, req.body.name, slug, req.body.parent_id || null, parseInt(req.body.order_index) || 0]);
  res.json({ success: true, id });
});

app.put('/api/admin/categories/:id', adminAuth, async (req, res) => {
  await run('UPDATE categories SET name=?, parent_id=?, order_index=? WHERE id=?',
    [req.body.name, req.body.parent_id || null, parseInt(req.body.order_index) || 0, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/admin/categories/:id', adminAuth, async (req, res) => {
  await run('DELETE FROM categories WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/admin/banners', adminAuth, async (req, res) => {
  res.json(await queryAll('SELECT * FROM banners ORDER BY order_index ASC'));
});

app.post('/api/admin/banners', adminAuth, upload.single('image'), async (req, res) => {
  const id = uuidv4();
  let filename = '';
  if (req.file) {
    filename = uuidv4() + path.extname(req.file.originalname);
    await uploadToStorage(req.file.buffer, filename, req.file.mimetype);
  }
  await run('INSERT INTO banners (id, title, subtitle, button_text, button_link, image, is_active, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.body.title || '', req.body.subtitle || '', req.body.button_text || '', req.body.button_link || '',
    filename, req.body.is_active !== undefined ? parseInt(req.body.is_active) : 1, parseInt(req.body.order_index) || 0]);
  res.json({ success: true, id });
});

app.put('/api/admin/banners/:id', adminAuth, upload.single('image'), async (req, res) => {
  if (req.file) {
    const filename = uuidv4() + path.extname(req.file.originalname);
    await uploadToStorage(req.file.buffer, filename, req.file.mimetype);
    await run('UPDATE banners SET title=?, subtitle=?, button_text=?, button_link=?, image=?, is_active=?, order_index=? WHERE id=?',
      [req.body.title || '', req.body.subtitle || '', req.body.button_text || '', req.body.button_link || '',
      filename, req.body.is_active !== undefined ? parseInt(req.body.is_active) : 1, parseInt(req.body.order_index) || 0, req.params.id]);
  } else {
    await run('UPDATE banners SET title=?, subtitle=?, button_text=?, button_link=?, is_active=?, order_index=? WHERE id=?',
      [req.body.title || '', req.body.subtitle || '', req.body.button_text || '', req.body.button_link || '',
      req.body.is_active !== undefined ? parseInt(req.body.is_active) : 1, parseInt(req.body.order_index) || 0, req.params.id]);
  }
  res.json({ success: true });
});

app.delete('/api/admin/banners/:id', adminAuth, async (req, res) => {
  await run('DELETE FROM banners WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/admin/orders', adminAuth, async (req, res) => {
  const { status } = req.query;
  let sql = 'SELECT * FROM orders';
  const params = [];
  if (status && status !== 'all') { sql += ' WHERE status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC';
  res.json(await queryAll(sql, params));
});

app.put('/api/admin/orders/:id/status', adminAuth, async (req, res) => {
  await run('UPDATE orders SET status = ? WHERE id = ?', [req.body.status, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/admin/orders/:id', adminAuth, async (req, res) => {
  await run('DELETE FROM orders WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/admin/reviews', adminAuth, async (req, res) => {
  res.json(await queryAll('SELECT r.*, p.name as product_name FROM reviews r LEFT JOIN products p ON r.product_id = p.id ORDER BY r.created_at DESC'));
});

app.put('/api/admin/reviews/:id/approve', adminAuth, async (req, res) => {
  await run('UPDATE reviews SET is_approved = ? WHERE id = ?', [req.body.approved, req.params.id]);
  res.json({ success: true });
});

app.delete('/api/admin/reviews/:id', adminAuth, async (req, res) => {
  await run('DELETE FROM reviews WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/admin/promocodes', adminAuth, async (req, res) => {
  res.json(await queryAll('SELECT * FROM promocodes ORDER BY created_at DESC'));
});

app.post('/api/admin/promocodes', adminAuth, async (req, res) => {
  const id = uuidv4();
  await run('INSERT INTO promocodes (id, code, discount_percent, max_uses, expires_at, is_active) VALUES (?, ?, ?, ?, ?, ?)',
    [id, req.body.code, parseInt(req.body.discount_percent), parseInt(req.body.max_uses) || 0, req.body.expires_at || null, 1]);
  res.json({ success: true, id });
});

app.delete('/api/admin/promocodes/:id', adminAuth, async (req, res) => {
  await run('DELETE FROM promocodes WHERE id = ?', [req.params.id]);
  res.json({ success: true });
});

app.get('/api/admin/settings', adminAuth, async (req, res) => {
  const all = await queryAll('SELECT * FROM settings');
  const settings = {};
  for (const s of all) settings[s.key] = s.value;
  res.json(settings);
});

app.put('/api/admin/settings', adminAuth, async (req, res) => {
  for (const [key, value] of Object.entries(req.body)) {
    await run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value', [key, value]);
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

app.get('/api/admin/stats', adminAuth, async (req, res) => {
  const totalProducts = (await queryOne('SELECT COUNT(*) as c FROM products'))?.c || 0;
  const totalOrders = (await queryOne('SELECT COUNT(*) as c FROM orders'))?.c || 0;
  const totalRevenue = (await queryOne("SELECT COALESCE(SUM(total), 0) as s FROM orders WHERE status != ?", ['cancelled']))?.s || 0;
  const totalCustomers = (await queryOne('SELECT COUNT(DISTINCT customer_phone) as c FROM orders'))?.c || 0;
  const newOrders = (await queryOne("SELECT COUNT(*) as c FROM orders WHERE status = 'new'"))?.c || 0;
  const popular = await queryAll("SELECT p.id, p.name, COUNT(*) as total FROM products p GROUP BY p.id ORDER BY total DESC LIMIT 5");
  res.json({ totalProducts, totalOrders, totalRevenue, totalCustomers, newOrders, popular });
});

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

start().catch(console.error);
