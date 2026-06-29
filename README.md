# Картины по номерам — Paint by Numbers Shop

Интернет-магазин для продажи наборов для рисования по номерам.

## Локальный запуск

```bash
npm install
npm start
```

Сайт будет доступен по адресу: http://localhost:3000

Без настройки Supabase будет использоваться локальная SQLite (`data/shop.db`).

## Админ-панель

Откройте `/admin.html` и войдите с секретным ключом (по умолчанию: `admin123`).

## Настройка Supabase (продакшн)

1. Создайте проект в [Supabase](https://supabase.com)
2. Выполните SQL из `supabase-schema.sql` в SQL Editor
3. Создайте Storage bucket `products` (публичный)
4. Скопируйте SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY

### Перенос существующих данных

```bash
npm run migrate
```

### Деплой на Render

1. Создайте репозиторий на GitHub и загрузите туда этот проект
2. На [Render Dashboard](https://dashboard.render.com) нажмите **New +** → **Web Service**
3. Подключите GitHub репозиторий
4. Настройки:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. В разделе **Environment Variables** добавьте:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
6. Нажмите **Create Web Service**

> ✅ Данные теперь хранятся в Supabase PostgreSQL и не теряются после перезапуска.

## Технологии

- Node.js + Express
- Supabase PostgreSQL + Storage (продакшн)
- SQLite (локальная разработка)
- Multer (загрузка файлов)
- Чистый HTML/CSS/JS
