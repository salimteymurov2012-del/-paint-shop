const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

require('dotenv').config();

const DB_PATH = path.join(__dirname, 'data', 'shop.db');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

async function migrate() {
  console.log('=== Миграция данных из SQLite в Supabase ===\n');

  if (!fs.existsSync(DB_PATH)) {
    console.log('❌ shop.db не найден.');
    process.exit(1);
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.log('❌ Установите SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env');
    process.exit(1);
  }

  console.log('📦 Чтение SQLite базы...');
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const sqliteDb = new SQL.Database(buffer);

  console.log('☁️  Подключение к Supabase...');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    let success = 0;
    let errors = 0;

    for (const row of values) {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });

      const { error } = await supabase.from(table).upsert(obj, { onConflict: columns[0] });

      if (error) {
        console.log(`  ⚠️  Ошибка записи: ${error.message}`);
        errors++;
      } else {
        success++;
      }
    }
    console.log(`  → ${success} записей перенесено${errors ? `, ${errors} ошибок` : ''}`);
  }

  console.log('\n🖼️  Загрузка изображений в Supabase Storage...');

  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets && buckets.some(b => b.name === 'products');
  if (!bucketExists) {
    const { error: bucketError } = await supabase.storage.createBucket('products', {
      public: true,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'],
      fileSizeLimit: 10485760,
    });
    if (bucketError) {
      console.log(`  ⚠️  Ошибка создания bucket: ${bucketError.message}`);
    } else {
      console.log('  ✅ Bucket "products" создан');
    }
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

  sqliteDb.close();

  console.log('\n✅ Миграция завершена!');
  console.log('Запустите сервер: npm start');
}

migrate().catch(e => {
  console.error('❌ Ошибка миграции:', e);
  process.exit(1);
});
