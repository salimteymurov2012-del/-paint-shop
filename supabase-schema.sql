-- ============================================
-- SQL-команды для создания таблиц в Supabase
-- Выполнить в SQL Editor Supabase Dashboard
-- ============================================

-- Таблица категорий
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  parent_id TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица товаров
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_az TEXT DEFAULT '',
  name_ru TEXT DEFAULT '',
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  description_az TEXT DEFAULT '',
  description_ru TEXT DEFAULT '',
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

-- Таблица изображений товаров
CREATE TABLE IF NOT EXISTS product_images (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  is_main INTEGER DEFAULT 0,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица баннеров
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

-- Таблица заказов
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

-- Таблица отзывов
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  author TEXT NOT NULL,
  rating INTEGER DEFAULT 5,
  text TEXT,
  is_approved INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Таблица промокодов
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

-- Таблица настроек
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Таблица сессий админа
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
