// Миграция данных из SQLite (shop.db) в Supabase PostgreSQL
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

require('dotenv').config();

const DB_PATH = path.join(__dirname, 'data', 'shop.db');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

async function migrate() {
  console.log('=== Миграция данных из SQLite в Supabase ===\n');

  // 1. Проверяем наличие shop.db
  if (!fs.existsSync(DB_PATH)) {
    console.log('❌ shop.db не найден. Создайте базу данных, запустив сервер локально.');
    process.exit(1);
  }

  // 2. Проверяем переменные окружения
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Установите SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env');
    process.exit(1);
  }

  // 3. Подключаемся к SQLite
  console.log('📦 Чтение SQLite базы...');
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const sqliteDb = new SQL.Database(buffer);

  // 4. Подключаемся к Supabase
  console.log('☁️  Подключение к Supabase...');
  const match = supabaseUrl.match(/https?:\/\/(.+)\.supabase\.co/);
  const projectRef = match[1];

  const pool = new Pool({
    host: `db.${projectRef}.supabase.co`,
    database: 'postgres',
    user: 'postgres',
    password: supabaseServiceKey,
    port: 5432,
    ssl: { rejectUnauthorized: false },
  });

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // 5. Создаём таблицы
  console.log('🏗️  Создание таблиц...');
  const createSQL = fs.readFileSync(path.join(__dirname, 'supabase-schema.sql'), 'utf8');
  const statements = createSQL.split(';').filter(s => s.trim().length > 0 && !s.trim().startsWith('--'));
  for (const stmt of statements) {
    try { await pool.query(stmt); } catch (e) { console.error('  ⚠️', e.message); }
  }

  // 6. Мигрируем каждую таблицу
  const tables = ['settings', 'categories', 'products', 'product_images', 'banners', 'orders', 'reviews', 'promocodes', 'admin_sessions'];

  for (const table of tables) {
    console.log(`\n📋 Миграция таблицы: ${table}`);
    const rows = sqliteDb.exec(`SELECT * FROM ${table}`);
    if (!rows.length || !rows[0].values.length) {
      console.log(`  → пусто (0 записей)`);
      continue;
    }

    const columns = rows[0].columns;
    const values = rows[0].values;

    for (const row of values) {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });

      const colList = columns.join(', ');
      const paramList = columns.map((_, i) => `$${i + 1}`).join(', ');
      const updateList = columns.map(col => `${col} = EXCLUDED.${col}`).join(', ');

      try {
        await pool.query(
          `INSERT INTO ${table} (${colList}) VALUES (${paramList}) ON CONFLICT (${columns[0]}) DO UPDATE SET ${updateList}`,
          row
        );
      } catch (e) {
        console.log(`  ⚠️  Ошибка записи: ${e.message}`);
      }
    }
    console.log(`  → ${values.length} записей перенесено`);
  }

  // 7. Загружаем изображения в Supabase Storage
  console.log('\n🖼️  Загрузка изображений в Supabase Storage...');

  // Создаём bucket если нет
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets.some(b => b.name === 'products');
  if (!bucketExists) {
    await supabase.storage.createBucket('products', {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
      fileSizeLimit: 10485760,
    });
    console.log('  ✅ Bucket "products" создан');
  } else {
    console.log('  ✅ Bucket "products" уже существует');
  }

  if (fs.existsSync(UPLOADS_DIR)) {
    const files = fs.readdirSync(UPLOADS_DIR).filter(f => f !== '.gitkeep');
    let uploaded = 0;
    for (const file of files) {
      const filePath = path.join(UPLOADS_DIR, file);
      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(file).toLowerCase();
      const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
      const contentType = mimeTypes[ext] || 'image/jpeg';

      const { error } = await supabase.storage.from('products').upload(file, fileBuffer, {
        contentType,
        upsert: true,
      });

      if (error && !error.message.includes('already exists')) {
        console.log(`  ⚠️  Ошибка загрузки ${file}: ${error.message}`);
      } else {
        uploaded++;
      }
    }
    console.log(`  → ${uploaded}/${files.length} изображений загружено`);
  } else {
    console.log('  → Папка uploads не найдена, пропускаем');
  }

  // 8. Закрываем соединения
  await pool.end();
  sqliteDb.close();

  console.log('\n✅ Миграция завершена!');
  console.log('Запустите сервер: npm start');
}

migrate().catch(e => {
  console.error('❌ Ошибка миграции:', e);
  process.exit(1);
});
