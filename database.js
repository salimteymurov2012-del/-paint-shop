require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

let supabase = null;
let useSupabase = false;
let db = null;

function getStorageUrl(bucket, filename) {
  if (!filename) return null;
  const { data } = supabase.storage.from(bucket).getPublicUrl(filename);
  return data.publicUrl;
}

async function initDatabase() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey || supabaseUrl.includes('your-project-ref')) {
    console.log('Supabase env vars not set, using SQLite fallback');
    return initFallback();
  }
  supabase = createClient(supabaseUrl, supabaseServiceKey);
  useSupabase = true;
  await ensureStorageBucket();
  console.log('Supabase connected');
}

async function initFallback() {
  try {
    const initSqlJs = require('sql.js');
    const DB_PATH = path.join(__dirname, 'data', 'shop.db');
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) { const buffer = fs.readFileSync(DB_PATH); db = new SQL.Database(buffer); }
    else { db = new SQL.Database(); }
    db.run('PRAGMA foreign_keys = ON');
    const tables = [
      'CREATE TABLE IF NOT EXISTS categories (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, parent_id TEXT, order_index INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
      'CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT UNIQUE NOT NULL, description TEXT, price REAL NOT NULL, old_price REAL, discount INTEGER DEFAULT 0, discount_percent INTEGER DEFAULT 0, category_id TEXT, sizes TEXT DEFAULT \'[]\', difficulty TEXT DEFAULT \'Средний\', colors_count INTEGER DEFAULT 24, manufacturer TEXT DEFAULT \'\', includes TEXT, stock INTEGER DEFAULT 0, visible INTEGER DEFAULT 1, order_index INTEGER DEFAULT 0, is_new INTEGER DEFAULT 0, is_bestseller INTEGER DEFAULT 0, is_recommended INTEGER DEFAULT 0, is_limited INTEGER DEFAULT 0, seo_title TEXT, seo_description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
      'CREATE TABLE IF NOT EXISTS product_images (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, filename TEXT NOT NULL, is_main INTEGER DEFAULT 0, order_index INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
      'CREATE TABLE IF NOT EXISTS banners (id TEXT PRIMARY KEY, title TEXT, subtitle TEXT, button_text TEXT, button_link TEXT, image TEXT, is_active INTEGER DEFAULT 1, order_index INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
      'CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_email TEXT, address TEXT, comment TEXT, items TEXT NOT NULL DEFAULT \'[]\', total REAL NOT NULL, status TEXT DEFAULT \'new\', delivery_method TEXT, payment_method TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
      'CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, product_id TEXT NOT NULL, author TEXT NOT NULL, rating INTEGER DEFAULT 5, text TEXT, is_approved INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
      'CREATE TABLE IF NOT EXISTS promocodes (id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, discount_percent INTEGER NOT NULL, max_uses INTEGER DEFAULT 0, used_count INTEGER DEFAULT 0, expires_at DATETIME, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
      'CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT)',
      'CREATE TABLE IF NOT EXISTS admin_sessions (id TEXT PRIMARY KEY, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)',
    ];
    tables.forEach(s => db.run(s));
    const defaults = { site_name:'Painting by Number', site_description:'Rəqəmlərlə rəsmlər', admin_key:'admin123', phone:'+994 (50) 123-45-67', email:'info@example.az', address:'Bakı şəhəri', manufacturer:'Мой бренд', social_links:JSON.stringify([{name:'Instagram',url:'#',icon:'📷'},{name:'Telegram',url:'#',icon:'✈️'},{name:'WhatsApp',url:'#',icon:'💬'}]), delivery_info:'Bakı üzrə 1-3 gün, Azərbaycan üzrə 3-7 gün', payment_info:'Çatdırılma zamanı nağd, kartla online', about_text:'Rəqəmlərlə rəsmlər dəsti ilə hər kəs özünü rəssam kimi hiss edə bilər.' };
    for (const [key, value] of Object.entries(defaults)) {
      const existing = db.exec(`SELECT value FROM settings WHERE key = '${key.replace(/'/g, "''")}'`);
      if (!existing.length) db.run('INSERT INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
    const data = db.export(); fs.writeFileSync(path.join(__dirname, 'data', 'shop.db'), Buffer.from(data));
    console.log('Using SQLite fallback (local development)');
    return db;
  } catch (e) { console.error('SQLite not available. Install it with: npm install sql.js'); throw e; }
}

async function ensureStorageBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some(b => b.name === 'products')) {
    await supabase.storage.createBucket('products', { public: true, allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'], fileSizeLimit: 10485760 });
  }
}

function getDb() { return db || { supabase }; }

// --- Helpers ---
function getTableFromSQL(sql) {
  const m = sql.match(/\b(?:FROM|INTO|UPDATE|TABLE)\s+(\w+)/i);
  return m ? m[1] : null;
}

function extractLimit(sql) {
  const m = sql.match(/LIMIT\s+(\d+)/i);
  return m ? parseInt(m[1]) : null;
}

// --- Main query functions ---
async function queryAll(sql, params = []) {
  if (!useSupabase) {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const results = []; while (stmt.step()) results.push(stmt.getAsObject()); stmt.free();
    return results;
  }
  const u = sql.trim().toUpperCase();
  if (sql.includes('categories') && (sql.includes('c.name') || sql.includes('category_name'))) return queryProducts(sql, params);
  if (sql.includes('(SELECT filename FROM product_images')) return queryHomeProducts(sql, params);
  if (sql.includes('SELECT COUNT(*) FROM products') && sql.includes('categories')) return queryCategoriesWithCount(sql, params);
  if (sql.includes('reviews LEFT JOIN products') || (sql.includes('reviews') && sql.includes('product_name'))) return queryReviews(sql, params);
  if (u.includes('COUNT(DISTINCT')) return queryCountDistinct(sql, params);
  if (u.includes('COUNT(')) return queryCount(sql, params);
  if (u.includes('COALESCE') || u.includes('SUM(')) return queryAggregate(sql, params);
  if (u.includes('GROUP BY')) return queryGroupBy(sql, params);
  if (u.startsWith('SELECT')) return querySimple(sql, params);
  return [];
}

async function queryOne(sql, params = []) {
  const rows = await queryAll(sql, params);
  return rows.length ? rows[0] : null;
}

async function run(sql, params = []) {
  if (!useSupabase) { db.run(sql, params); const d = db.export(); fs.writeFileSync(path.join(__dirname, 'data', 'shop.db'), Buffer.from(d)); return; }
  const u = sql.trim().toUpperCase();

  if (u.startsWith('INSERT')) {
    const table = getTableFromSQL(sql);
    const colsMatch = sql.match(/\(([^)]+)\)/);
    if (!table || !colsMatch) return;
    const cols = colsMatch[1].split(',').map(c => c.trim());
    const obj = {}; cols.forEach((col, i) => { if (params[i] !== undefined) obj[col] = params[i]; });
    if (u.includes('ON CONFLICT') || u.includes('OR REPLACE')) await supabase.from(table).upsert(obj, { onConflict: cols[0] });
    else await supabase.from(table).insert(obj);
    return;
  }

  if (u.startsWith('UPDATE')) {
    const table = getTableFromSQL(sql);
    const setMatch = sql.match(/SET\s+(.+?)\s+WHERE/is);
    if (!table || !setMatch) return;
    const setParts = setMatch[1].split(',').map(s => s.trim());
    const updateObj = {}; let pIdx = 0;
    for (const part of setParts) {
      const eqIdx = part.indexOf('='); const col = part.substring(0, eqIdx).trim();
      if (part.includes('CURRENT_TIMESTAMP')) continue;
      updateObj[col] = params[pIdx++];
    }
    let q = supabase.from(table).update(updateObj);
    const whereClause = sql.match(/WHERE\s+(.+?)$/is);
    if (whereClause) {
      const wm = whereClause[1].match(/(\w+)\s*=\s*/);
      if (wm && params[pIdx] !== undefined) q = q.eq(wm[1], params[pIdx]);
    }
    await q;
    return;
  }

  if (u.startsWith('DELETE')) {
    const table = getTableFromSQL(sql);
    const whereClause = sql.match(/WHERE\s+(.+?)$/is);
    if (!table) return;
    let q = supabase.from(table).delete();
    if (whereClause) {
      const wm = whereClause[1].match(/(\w+)\s*=\s*/);
      if (wm && params.length > 0) q = q.eq(wm[1], params[0]);
    }
    await q;
    return;
  }
}

// --- SELECT handlers ---

async function querySimple(sql, params) {
  const table = getTableFromSQL(sql);
  if (!table) return [];
  let q = supabase.from(table).select('*');
  const { conditions, pIdx } = parseWhere(sql, params);
  for (const [col, val] of conditions) q = q.eq(col, val);
  const orderClause = sql.match(/ORDER\s+BY\s+(.+?)(?:\s+LIMIT|\s*$)/is);
  if (orderClause) {
    for (const part of orderClause[1].split(',').map(s => s.trim())) {
      const desc = part.toUpperCase().includes('DESC'); const col = part.replace(/\s+(ASC|DESC)/i, '').trim();
      q = q.order(col, { ascending: !desc });
    }
  }
  const limit = extractLimit(sql);
  if (limit) q = q.limit(limit);
  const { data } = await q; return data || [];
}

async function queryProducts(sql, params) {
  let q = supabase.from('products').select('*');
  const whereClause = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s*$)/is);
  let pIdx = 0;

  if (whereClause) {
    const conds = whereClause[1].split(/\s+AND\s+/i);
    for (const c of conds) {
      const t = c.trim(); if (t === '1=1' || t === '(1=1)') continue;

      if (t.includes('OR') && t.includes('LIKE')) {
        const cols = t.match(/LOWER\((\w+)\)/g);
        if (cols && params[pIdx] !== undefined) {
          const val = String(params[pIdx]).replace(/%/g, '');
          if (val) q = q.or(cols.map(col => `${col.replace(/LOWER\(|\)/g, '')}.ilike.%${val}%`).join(','));
          pIdx++;
        }
        continue;
      }

      const m = t.match(/(?:p\.)?(\w+)\s*(=|!=|<>)\s*/i);
      if (!m) continue;
      const col = m[1]; const op = m[2];

      const litMatch = t.match(/=\s*'([^']*)'/);
      if (litMatch) { if (op === '=') q = q.eq(col, litMatch[1]); continue; }
      if (t.includes('visible') && t.includes('= 1')) { q = q.eq('visible', 1); continue; }
      if (params[pIdx] !== undefined) {
        if (op === '=') q = q.eq(col, params[pIdx]);
        else if (op === '!=' || op === '<>') q = q.neq(col, params[pIdx]);
        pIdx++;
      }
    }
  }

  const orderClause = sql.match(/ORDER\s+BY\s+(.+?)(?:\s+LIMIT|\s*$)/is);
  if (orderClause) {
    for (const part of orderClause[1].split(',').map(s => s.trim())) {
      const pp = part.replace(/p\./g, '');
      const desc = pp.toUpperCase().includes('DESC'); const col = pp.replace(/\s+(ASC|DESC)/i, '').trim();
      q = q.order(col, { ascending: !desc });
    }
  }
  const limit = extractLimit(sql);
  if (limit) q = q.limit(limit);

  const { data } = await q;
  if (!data?.length) return [];

  const { data: cats } = await supabase.from('categories').select('id,name');
  const catMap = {}; if (cats) cats.forEach(c => { catMap[c.id] = c.name; });
  return data.map(r => ({ ...r, category_name: catMap[r.category_id] || null }));
}

async function queryHomeProducts(sql, params) {
  let q = supabase.from('products').select('*').eq('visible', 1);
  if (sql.includes('is_new')) q = q.eq('is_new', 1);
  if (sql.includes('is_bestseller')) q = q.eq('is_bestseller', 1);
  if (sql.includes('is_recommended')) q = q.eq('is_recommended', 1);
  if (sql.includes('is_limited')) q = q.eq('is_limited', 1);
  if (sql.includes('created_at')) q = q.order('created_at', { ascending: false });
  if (sql.includes('order_index')) q = q.order('order_index');
  const limit = extractLimit(sql); if (limit) q = q.limit(limit);
  const { data } = await q;
  const result = [];
  for (const product of (data || [])) {
    const { data: images } = await supabase.from('product_images').select('filename').eq('product_id', product.id).eq('is_main', 1).limit(1);
    result.push({ ...product, image: images?.length ? images[0].filename : null });
  }
  return result;
}

async function queryCategoriesWithCount(sql, params) {
  const { data } = await supabase.from('categories').select('*').order('order_index');
  if (!data) return [];
  const result = [];
  for (const cat of data) {
    const { count } = await supabase.from('products').select('*', { count: 'exact', head: true }).eq('category_id', cat.id).eq('visible', 1);
    result.push({ ...cat, product_count: count || 0 });
  }
  return result;
}

async function queryReviews(sql, params) {
  let q = supabase.from('reviews').select('*');
  const orderClause = sql.match(/ORDER\s+BY\s+(.+?)$/is);
  if (orderClause) {
    for (const part of orderClause[1].split(',').map(s => s.trim())) {
      const pp = part.replace(/r\./g, '');
      const desc = pp.toUpperCase().includes('DESC'); const col = pp.replace(/\s+(ASC|DESC)/i, '').trim();
      q = q.order(col, { ascending: !desc });
    }
  }
  const { data } = await q;
  if (!data?.length) return [];
  const { data: prods } = await supabase.from('products').select('id,name');
  const prodMap = {}; if (prods) prods.forEach(p => { prodMap[p.id] = p.name; });
  return data.map(r => ({ ...r, product_name: prodMap[r.product_id] || null }));
}

async function queryCount(sql, params) {
  const table = getTableFromSQL(sql);
  if (!table) return [{ c: 0 }];
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  const whereClause = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s*$)/is);
  if (whereClause) {
    let pIdx = 0;
    for (const cond of whereClause[1].split(/\s+AND\s+/i)) {
      const t = cond.trim(); const m = t.match(/(?:p\.)?(\w+)\s*(=|!=|<>)\s*/i);
      if (!m) continue;
      const litMatch = t.match(/=\s*'([^']*)'/);
      if (litMatch) { q = q.eq(m[1], litMatch[1]); continue; }
      if (t.includes('= 1')) { q = q.eq(m[1], 1); continue; }
      if (params[pIdx] !== undefined) { q = q.eq(m[1], params[pIdx]); pIdx++; }
    }
  }
  const { count } = await q;
  return [{ c: count || 0 }];
}

async function queryCountDistinct(sql, params) {
  const table = getTableFromSQL(sql);
  if (!table) return [{ c: 0 }];
  const colMatch = sql.match(/DISTINCT\s+(\w+)/i);
  const col = colMatch ? colMatch[1] : 'id';
  const { data } = await supabase.from(table).select(col);
  const unique = new Set((data || []).map(r => r[col]));
  return [{ c: unique.size }];
}

async function queryAggregate(sql, params) {
  const table = getTableFromSQL(sql);
  if (!table) return [{ s: 0 }];
  let q = supabase.from(table).select('total,status');
  const whereClause = sql.match(/WHERE\s+(.+?)$/is);
  if (whereClause) {
    const m = whereClause[1].match(/(\w+)\s*(!=|<>|=)\s*/);
    if (m) {
      const litMatch = whereClause[1].match(/=\s*'([^']*)'/);
      if (litMatch && m[2] !== '=') q = q.neq(m[1], litMatch[1]);
      else if (m[2] === '=' && litMatch) q = q.eq(m[1], litMatch[1]);
      else if (params[0] !== undefined && m[2] !== '=') q = q.neq(m[1], params[0]);
    }
  }
  const { data } = await q;
  if (!data?.length) return [{ s: 0 }];
  const sum = data.reduce((acc, r) => acc + (parseFloat(r.total) || 0), 0);
  return [{ s: sum }];
}

async function queryGroupBy(sql, params) {
  const { data } = await supabase.from('orders').select('items');
  if (!data) return [];
  const countMap = {};
  for (const order of data) {
    try {
      const items = JSON.parse(order.items || '[]');
      for (const item of items) {
        const id = item.id || item.product_id; const name = item.name;
        if (id) { if (!countMap[id]) countMap[id] = { id, name: name || id, total: 0 }; countMap[id].total += item.quantity || 1; }
      }
    } catch(e) {}
  }
  return Object.values(countMap).sort((a, b) => b.total - a.total).slice(0, 5);
}

function parseWhere(sql, params) {
  const conditions = [];
  let pIdx = 0;
  const whereClause = sql.match(/WHERE\s+(.+?)(?:\s+ORDER\s+BY|\s+LIMIT|\s*$)/is);
  if (whereClause) {
    for (const c of whereClause[1].split(/\s+AND\s+/i)) {
      const t = c.trim(); if (t === '1=1') continue;
      const m = t.match(/(\w+)\s*=?\s*/i);
      if (m) {
        const col = m[1];
        const litMatch = t.match(/=\s*'([^']*)'/);
        if (litMatch) { conditions.push([col, litMatch[1]]); continue; }
        if (params[pIdx] !== undefined) { conditions.push([col, params[pIdx]]); pIdx++; }
      }
    }
  }
  return { conditions, pIdx };
}

// --- Storage ---
async function uploadToStorage(fileBuffer, filename, contentType) {
  if (!supabase) return filename;
  const { error } = await supabase.storage.from('products').upload(filename, fileBuffer, { contentType, upsert: true });
  if (error) throw error;
  return filename;
}

async function deleteFromStorage(filename) {
  if (!supabase || !filename) return;
  await supabase.storage.from('products').remove([filename]);
}

function getSupabase() { return supabase; }
function getPublicUrl(filename) { return getStorageUrl('products', filename); }

module.exports = {
  initDatabase, getDb, queryAll, queryOne, run,
  uploadToStorage, deleteFromStorage, getSupabase, getPublicUrl
};
