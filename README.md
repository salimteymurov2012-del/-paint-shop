# Картины по номерам — Paint by Numbers Shop

Интернет-магазин для продажи наборов для рисования по номерам.

## Локальный запуск

```bash
npm install
npm start
```

Сайт будет доступен по адресу: http://localhost:3000

## Админ-панель

Откройте `/admin.html` и войдите с секретным ключом (по умолчанию: `admin123`).

## Деплой на Render

1. Создайте репозиторий на GitHub и загрузите туда этот проект
2. На [Render Dashboard](https://dashboard.render.com) нажмите **New +** → **Web Service**
3. Подключите GitHub репозиторий
4. Настройки:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free
5. Нажмите **Create Web Service**

> **Важно**: На бесплатном плане Render данные (БД, загруженные изображения) хранятся временно и теряются при перезапуске сервера. Для production используйте PostgreSQL.

## Изменение названия сайта

Зайдите в админ-панель → **Настройки** → измените поле **Название магазина**.

## Технологии

- Node.js + Express
- SQLite (sql.js)
- Multer (загрузка файлов)
- Чистый HTML/CSS/JS
