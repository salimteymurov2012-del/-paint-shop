# Инструкция по деплою на Render с Supabase

## 1. Создание проекта Supabase

1. Зарегистрируйтесь на https://supabase.com
2. Нажмите **New Project**
3. Введите название (например, `paint-shop`)
4. Установите **Database Password** (запомните его)
5. Выберите регион, ближайший к вашей аудитории (например, Frankfurt)
6. Нажмите **Create new project** (подождите ~2 минуты)

## 2. Создание таблиц в Supabase

После создания проекта:
1. Перейдите в раздел **SQL Editor**
2. Нажмите **New query**
3. Скопируйте содержимое файла `supabase-schema.sql` из проекта
4. Вставьте и нажмите **Run** (или `Ctrl+Enter`)

Это создаст все необходимые таблицы:
- `categories` — категории товаров
- `products` — товары
- `product_images` — изображения товаров
- `banners` — баннеры
- `orders` — заказы
- `reviews` — отзывы
- `promocodes` — промокоды
- `settings` — настройки магазина
- `admin_sessions` — сессии администратора

## 3. Создание Storage Bucket для изображений

1. Перейдите в раздел **Storage**
2. Нажмите **New bucket**
3. Название: `products`
4. **Public bucket**: включено (ON)
5. Разрешить MIME типы: `image/png`, `image/jpeg`, `image/jpg`, `image/webp`
6. Максимальный размер файла: `10485760` (10 MB)
7. Нажмите **Create bucket**

### Настройка CORS (важно для загрузки изображений)

1. Перейдите в раздел **Storage** → **Settings**
2. В секции **CORS** добавьте правило:
   - Origin: `*`
   - Methods: `GET, POST, PUT, DELETE, OPTIONS`
   - Headers: `*`
3. Нажмите **Save**

## 4. Получение ключей API

1. Перейдите в раздел **Project Settings** → **API**
2. Скопируйте следующие значения:
   - **Project URL** (SUPABASE_URL) — вида `https://xxxxx.supabase.co`
   - **anon public** (SUPABASE_ANON_KEY)
   - **service_role** (SUPABASE_SERVICE_ROLE_KEY) — НЕ ДЕЛИТЕСЬ ЭТИМ КЛЮЧОМ

## 5. Перенос данных из SQLite в Supabase (если есть существующие данные)

### Локально:

1. Откройте `.env` в корне проекта и вставьте ваши ключи:
```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

2. Убедитесь, что `data/shop.db` содержит ваши данные

3. Запустите миграцию:
```bash
npm run migrate
```

Скрипт перенесёт:
- Все настройки магазина
- Все категории
- Все товары
- Все изображения товаров
- Все баннеры
- Все заказы
- Все отзывы
- Все промокоды
- Все изображения из папки `uploads/` в Supabase Storage

## 6. Деплой на Render

### Шаг 1: Подготовка репозитория

```bash
git init
git add .
git commit -m "Переход на Supabase"
git remote add origin https://github.com/ВАШ_АККАУНТ/НАЗВАНИЕ_РЕПО.git
git push -u origin main
```

### Шаг 2: Создание Web Service на Render

1. Зайдите на https://dashboard.render.com
2. Нажмите **New +** → **Web Service**
3. Подключите ваш GitHub репозиторий
4. Настройки:
   - **Name**: `paint-shop` (или любое название)
   - **Runtime**: **Node**
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### Шаг 3: Добавление переменных окружения в Render

В разделе **Environment Variables** добавьте:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://xxxxx.supabase.co` |
| `SUPABASE_ANON_KEY` | ваш anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ваш service_role key |
| `PORT` | `10000` |

### Шаг 4: Деплой

Нажмите **Create Web Service**

Подождите ~5 минут, пока Render соберёт и запустит проект.

## 7. Проверка

1. Откройте URL вашего сервиса (например, `https://paint-shop.onrender.com`)
2. Проверьте, что товары и категории отображаются
3. Зайдите в админ-панель: `https://paint-shop.onrender.com/admin.html`
4. Войдите с ключом (по умолчанию: `admin123`)
5. Проверьте, что можно добавлять/редактировать/удалять товары
6. Проверьте, что изображения загружаются

## 8. Важные замечания

- **Данные теперь хранятся в Supabase PostgreSQL** — они не пропадут после перезапуска Render или выхода из режима сна
- **Изображения хранятся в Supabase Storage** — они тоже сохраняются постоянно
- **SQLite больше не используется** — `shop.db` остаётся только для локальной разработки без Supabase
- **После первого успешного деплоя** удалите локальную папку `data/` и файл `shop.db`, чтобы не было путаницы

## Структура проекта после изменений

```
C:\Users\User\Desktop\
├── server.js              # Основной сервер (изменён)
├── database.js            # Модуль БД — использует Supabase (переписан)
├── migrate.js             # Скрипт миграции из SQLite в Supabase
├── supabase-schema.sql    # SQL для создания таблиц в Supabase
├── package.json           # Обновлён (добавлены pg, @supabase/supabase-js)
├── .env                   # Переменные окружения (НЕ КОММИТИТЬ)
├── .gitignore             # Обновлён
├── data/shop.db           # Локальная SQLite (для разработки)
├── uploads/               # Локальные изображения (для миграции)
├── public/                # Фронтенд (НЕ ИЗМЕНЁН)
│   ├── index.html         # Главная страница
│   ├── admin.html         # Админ-панель
│   ├── css/
│   └── js/
└── INSTRUCTIONS.md        # Эта инструкция
```

## Устранение неполадок

- **502 Bad Gateway**: Проверьте, что `PORT=10000` указан в переменных окружения Render
- **Изображения не загружаются**: Проверьте, что CORS настроен в Supabase Storage
- **Ошибка "relation does not exist"**: Запустите SQL из `supabase-schema.sql` в SQL Editor Supabase
- **Ошибка подключения к БД**: Проверьте SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY
