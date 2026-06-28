const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'data', 'shop.db');
let db = null;

async function initDatabase() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  const SQL = await initSqlJs();
  
  // Try to load existing DB
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run('PRAGMA foreign_keys = ON');

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      parent_id TEXT,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      old_price REAL,
      discount INTEGER DEFAULT 0,
      discount_percent INTEGER DEFAULT 0,
      category_id TEXT,
      sizes TEXT DEFAULT '[]',
      difficulty TEXT DEFAULT 'Средний',
      colors_count INTEGER DEFAULT 24,
      manufacturer TEXT DEFAULT '',
      includes TEXT,
      stock INTEGER DEFAULT 0,
      visible INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0,
      is_new INTEGER DEFAULT 0,
      is_bestseller INTEGER DEFAULT 0,
      is_recommended INTEGER DEFAULT 0,
      is_limited INTEGER DEFAULT 0,
      seo_title TEXT,
      seo_description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      is_main INTEGER DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS banners (
      id TEXT PRIMARY KEY,
      title TEXT,
      subtitle TEXT,
      button_text TEXT,
      button_link TEXT,
      image TEXT,
      is_active INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      customer_email TEXT,
      address TEXT,
      comment TEXT,
      items TEXT NOT NULL DEFAULT '[]',
      total REAL NOT NULL,
      status TEXT DEFAULT 'new',
      delivery_method TEXT,
      payment_method TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      author TEXT NOT NULL,
      rating INTEGER DEFAULT 5,
      text TEXT,
      is_approved INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS promocodes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      discount_percent INTEGER NOT NULL,
      max_uses INTEGER DEFAULT 0,
      used_count INTEGER DEFAULT 0,
      expires_at DATETIME,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default settings
  const defaultSettings = {
    site_name: 'Название магазина',
    site_description: 'Rəqəmlərlə rəsmlər',
    admin_key: 'admin123',
    phone: '+994 (50) 123-45-67',
    email: 'info@example.az',
    address: 'Bakı şəhəri',
    manufacturer: 'Mənim brendim',
    social_links: JSON.stringify([
      { name: 'Instagram', url: '#', icon: '📷' },
      { name: 'Telegram', url: '#', icon: '✈️' },
      { name: 'WhatsApp', url: '#', icon: '💬' }
    ]),
    delivery_info: 'Bakı üzrə 1-3 gün, Azərbaycan üzrə 3-7 gün',
    payment_info: 'Çatdırılma zamanı nağd, kartla online',
    about_text: 'Rəqəmlərlə rəsmlər dəsti ilə hər kəs özünü rəssam kimi hiss edə bilər.'
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = db.exec(`SELECT value FROM settings WHERE key = '${key.replace(/'/g, "''")}'`);
    if (!existing.length) {
      db.run(`INSERT INTO settings (key, value) VALUES (?, ?)`, [key, value]);
    }
  }

  saveDatabase();
  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function getDb() {
  return db;
}

// Helper: convert sql.js result to array of objects
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    results.push(row);
  }
  stmt.free();
  return results;
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length ? rows[0] : null;
}

function run(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
}

module.exports = { initDatabase, getDb, queryAll, queryOne, run };
