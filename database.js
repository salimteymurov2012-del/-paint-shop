require('dotenv').config();
const { Pool } = require('pg');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

let db = null;
let supabase = null;
let pool = null;

function convertParams(sql, params) {
  let idx = 0;
  const converted = sql.replace(/\?/g, () => `$${++idx}`);
  return { sql: converted, params };
}

function getStorageUrl(bucket, filename) {
  if (!filename) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl;
}

async function initDatabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project-ref')) {
    console.log('Supabase env vars not set, using SQLite fallback');
    return initFallback();
  }

  const match = supabaseUrl.match(/https?:\/\/(.+)\.supabase\.co/);
  if (!match) throw new Error('Invalid SUPABASE_URL');
  const projectRef = match[1];

  pool = new Pool({
    host: `db.${projectRef}.supabase.co`,
    database: 'postgres',
    user: 'postgres',
    password: supabaseServiceKey,
    port: 5432,
    ssl: { rejectUnauthorized: false },
    max: 10,
    idleTimeoutMillis: 30000,
  });

  supabase = createClient(supabaseUrl, supabaseServiceKey);

  await createTables();
  await seedDefaults();
  await ensureStorageBucket();

  console.log('Supabase PostgreSQL connected');
  return { pool, supabase };
}

async function initFallback() {
  try {
    const initSqlJs = require('sql.js');
    const DB_PATH = path.join(__dirname, 'data', 'shop.db');
    const dataDir = path.join(__dirname, 'data');

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    const SQL = await initSqlJs();

    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    db.run('PRAGMA foreign_keys = ON');
    createTablesFallback(db);
    seedDefaultsFallback(db);
    saveDatabaseFallback();
    console.log('Using SQLite fallback (local development)');
    return db;
  } catch (e) {
    console.error('SQLite not available. Install it with: npm install sql.js');
    throw e;
  }
}

async function createTables() {
  const sql = `
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      parent_id TEXT,
      order_index INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
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
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS product_images (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      is_main INTEGER DEFAULT 0,
      order_index INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS banners (
      id TEXT PRIMARY KEY,
      title TEXT,
      subtitle TEXT,
      button_text TEXT,
      button_link TEXT,
      image TEXT,
      is_active INTEGER DEFAULT 1,
      order_index INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
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
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      author TEXT NOT NULL,
      rating INTEGER DEFAULT 5,
      text TEXT,
      is_approved INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS promocodes (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      discount_percent INTEGER NOT NULL,
      max_uses INTEGER DEFAULT 0,
      used_count INTEGER DEFAULT 0,
      expires_at TIMESTAMPTZ,
      is_active INTEGER DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
    CREATE TABLE IF NOT EXISTS admin_sessions (
      id TEXT PRIMARY KEY,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  const statements = sql.split(';').filter(s => s.trim().length > 0);
  for (const stmt of statements) {
    await pool.query(stmt);
  }
}

async function seedDefaults() {
  const defaultSettings = {
    site_name: 'Painting by Number',
    site_description: 'Rəqəmlərlə rəsmlər',
    admin_key: 'admin123',
    phone: '+994 (50) 123-45-67',
    email: 'info@example.az',
    address: 'Bakı şəhəri',
    manufacturer: 'Мой бренд',
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
    await pool.query(
      'INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING',
      [key, value]
    );
  }
}

async function ensureStorageBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets.some(b => b.name === 'products');
  if (!exists) {
    await supabase.storage.createBucket('products', {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
      fileSizeLimit: 10485760,
    });
  }
}

function createTablesFallback(sqlDb) {
  const tables = `
    CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, parent_id TEXT, order_index INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT, price REAL NOT NULL, old_price REAL, discount INTEGER DEFAULT 0, discount_percent INTEGER DEFAULT 0, category_id TEXT, sizes TEXT DEFAULT '[]', difficulty TEXT DEFAULT 'Средний', colors_count INTEGER DEFAULT 24, manufacturer TEXT DEFAULT '', includes TEXT, stock INTEGER DEFAULT 0, visible INTEGER DEFAULT 1, order_index INTEGER DEFAULT 0, is_new INTEGER DEFAULT 0, is_bestseller INTEGER DEFAULT 0, is_recommended INTEGER DEFAULT 0, is_limited INTEGER DEFAULT 0, seo_title TEXT, seo_description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS product_images (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, filename TEXT NOT NULL, is_main INTEGER DEFAULT 0, order_index INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS banners (id TEXT PRIMARY KEY, title TEXT, subtitle TEXT, button_text TEXT, button_link TEXT, image TEXT, is_active INTEGER DEFAULT 1, order_index INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_email TEXT, address TEXT, comment TEXT, items TEXT NOT NULL DEFAULT '[]', total REAL NOT NULL, status TEXT DEFAULT 'new', delivery_method TEXT, payment_method TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, author TEXT NOT NULL, rating INTEGER DEFAULT 5, text TEXT, is_approved INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS promocodes (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, discount_percent INTEGER NOT NULL, max_uses INTEGER DEFAULT 0, used_count INTEGER DEFAULT 0, expires_at DATETIME, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
  `;
  tables.split(';').filter(s => s.trim()).forEach(s => sqlDb.run(s));
}

function seedDefaultsFallback(sqlDb) {
  const defaultSettings = {
    site_name: 'Painting by Number',
    site_description: 'Rəqəmlərlə rəsmlər',
    admin_key: 'admin123',
    phone: '+994 (50) 123-45-67',
    email: 'info@example.az',
    address: 'Bakı şəhəri',
    manufacturer: 'Мой бренд',
    social_links: JSON.stringify([{ name: 'Instagram', url: '#', icon: '📷' }, { name: 'Telegram', url: '#', icon: '✈️' }, { name: 'WhatsApp', url: '#', icon: '💬' }]),
    delivery_info: 'Bakı üzrə 1-3 gün, Azərbaycan üzrə 3-7 gün',
    payment_info: 'Çatdırılma zamanı nağd, kartla online',
    about_text: 'Rəqəmlərlə rəsmlər dəsti ilə hər kəs özünü rəssam kimi hiss edə bilər.'
  };
  for (const [key, value] of Object.entries(defaultSettings)) {
    const existing = sqlDb.exec(`SELECT value FROM settings WHERE key = '${key.replace(/'/g, "''")}'`);
    if (!existing.length) {
      sqlDb.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  }
}

function saveDatabaseFallback() {
  if (db) {
    const data = db.export();
    fs.writeFileSync(path.join(__dirname, 'data', 'shop.db'), Buffer.from(data));
  }
}

function getDb() {
  return db || { pool, supabase };
}

async function queryAll(sql, params = []) {
  if (pool) {
    const { sql: convertedSql, params: convertedParams } = convertParams(sql, params);
    const result = await pool.query(convertedSql, convertedParams);
    return result.rows;
  }
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const results = [];
  while (stmt.step()) results.push(stmt.getAsObject());
  stmt.free();
  return results;
}

async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows.length ? rows[0] : null;
}

async function run(sql, params = []) {
  if (pool) {
    const { sql: convertedSql, params: convertedParams } = convertParams(sql, params);

    let finalSql = convertedSql;
    const finalParams = [...convertedParams];

    if (finalSql.toUpperCase().includes('INSERT OR REPLACE')) {
      finalSql = finalSql.replace(/INSERT OR REPLACE/i, 'INSERT');
      const match = finalSql.match(/INSERT\s+INTO\s+(\w+)\s*\(([^)]+)\)/i);
      if (match) {
        const tableName = match[1];
        const columns = match[2].split(',').map(c => c.trim());
        const updateParts = columns.map(c => `${c} = EXCLUDED.${c}`);
        finalSql += ` ON CONFLICT (${columns[0]}) DO UPDATE SET ${updateParts.join(', ')}`;
      }
    }

    await pool.query(finalSql, finalParams);
    return;
  }
  db.run(sql, params);
  saveDatabaseFallback();
}

async function uploadToStorage(fileBuffer, filename, contentType) {
  if (!supabase) return filename;
  const { data, error } = await supabase.storage
    .from('products')
    .upload(filename, fileBuffer, {
      contentType,
      upsert: true,
    });
  if (error) throw error;
  return filename;
}

async function deleteFromStorage(filename) {
  if (!supabase || !filename) return;
  await supabase.storage.from('products').remove([filename]);
}

function getSupabase() {
  return supabase;
}

function getPublicUrl(filename) {
  return getStorageUrl('products', filename);
}

module.exports = {
  initDatabase, getDb, queryAll, queryOne, run,
  uploadToStorage, deleteFromStorage, getSupabase, getPublicUrl
};
