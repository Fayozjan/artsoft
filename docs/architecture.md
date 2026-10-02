# Architecture — hrsystemNew

**Обновлено:** 2026-05-15

---

## Обзор

Multi-tenant HR-система. Каждый клиент (тенант) = отдельная PostgreSQL-схема. Единый сервер обслуживает всех тенантов через поддомен.

```
Browser / Telegram WebApp
       │
       ▼
  Vite Dev Server :5000  ──proxy /api──▶  Express :7000
       │                                        │
       ▼                                        ▼
  React SPA (client/)              PostgreSQL :5432
                                   ├── schema: public   (tenants, telegram_users)
                                   ├── schema: artsoft  (employees, attendance, …)
                                   └── schema: <tenant> (per-tenant data)
```

---

## Сервер (`server/`)

### Точка входа

| Файл | Назначение |
|------|-----------|
| `server.js` | HTTP сервер на порту 7000, graceful shutdown, background workers |
| `app.js` | Express middleware stack, монтирование роутов на `/api` |

### Middleware стек (порядок применения)

```
cookieParser()
express.json()
express.urlencoded()
logger (morgan)
    │
    └── /api/*
         ├── tenantMiddleware   — определяет тенант по поддомену, устанавливает prismaContext
         ├── authMiddleware     — проверяет JWT, устанавливает req.user
         ├── authPhotoMiddleware — облегчённая auth для GET /employees/image/*
         └── uploadPhoto        — multer (disk) + sharp (→ jpeg, max 200KB)
```

### Структура модуля

Каждый домен — 4 файла:

```
modules/<name>/
  <name>.routes.js      — Express Router + middleware chain
  <name>.controller.js  — req/res, без бизнес-логики
  <name>.service.js     — бизнес-правила
  <name>.model.js       — Prisma / $queryRaw запросы
  <name>.helpers.js     — утилиты (опционально)
```

### Все модули (40)

| Роут prefix | Модуль |
|-------------|--------|
| `/api/auth` | auth |
| `/api/branches` | branches |
| `/api/departments` | departments |
| `/api/employees` | employees |
| `/api/employment-orders` | employmentOrders |
| `/api/employee-schedule-history` | employeeScheduleHistory |
| `/api/employee-salary-history` | employeeSalaryHistory |
| `/api/face-passes` | facePasses |
| `/api/vehicle-passes` | vehiclePasses |
| `/api/attendance` | attendance |
| `/api/late-employees` | lateEmployees |
| `/api/timesheet` | timesheet |
| `/api/work-schedules` | workSchedules |
| `/api/time-off` | timeOff |
| `/api/production-calendar` | productionCalendar |
| `/api/positions` | positions |
| `/api/users` | users |
| `/api/telegram-bots` | telegramBots |
| `/api/doors` | doors |
| `/api/gates` | gates |
| `/api/face-devices` | faceDevices |
| `/api/anpr-cameras` | anprCameras |
| `/api/employee-door-tasks` | employeeDoorTasks |
| `/api/menus` | menus |
| `/api/dashboard` | dashboard |
| `/api/payroll` | payroll |
| `/api/staffing-tables` | staffingTable |
| `/api/staffing-positions` | staffingPosition |
| `/api/product-categories` | productCategories |
| `/api/products` | products |
| `/api/units` | units |
| `/api/partners` | partners |
| `/api/partner-categories` | partnerCategories |
| `/api/stock-locations` | stockLocations |
| `/api/stock-lots` | stockLots |
| `/api/stock-picking-types` | stockPickingTypes |
| `/api/stock-pickings` | stockPickings |
| `/api/stock-moves` | stockMoves |
| `/api/stock-quants` | stockQuants |
| `/api/bill-of-materials` | billOfMaterials |
| `/api/manufacturing-orders` | manufacturingOrders |
| `/api/canteen` | canteen |
| `/api/production-report` | productionReport |

### База данных

```
PostgreSQL
├── schema: public
│   ├── tenants                  — реестр тенантов (subdomain → schema_name)
│   └── tenant_telegram_users    — связь telegram_id → tenant
│
└── schema: <tenant_schema>      (per tenant, изолированно)
    ├── users                    — аккаунты (username, password_hash, status)
    ├── employees                — сотрудники (first_name, last_name, photo, …)
    ├── branches                 — филиалы
    ├── departments              — подразделения
    ├── positions                — должности
    ├── attendance               — посещаемость (face-device events)
    ├── timesheet                — табели
    ├── work_schedules           — графики работы
    ├── sessions                 — JWT refresh сессии
    ├── payroll_sheets           — расчётные листы
    ├── staffing_tables          — штатное расписание
    ├── product_categories       — категории товаров (иерархия)
    ├── products                 — товарная номенклатура
    ├── units                    — единицы измерения
    ├── partner_categories       — категории партнёров
    ├── partners                 — партнёры (поставщики / клиенты)
    ├── stock_locations          — единое дерево локаций (internal/supplier/customer/production/…)
    ├── stock_lots               — партии/серийные номера
    ├── stock_picking_types      — типы операций (incoming/outgoing/internal)
    ├── stock_pickings           — документы складских операций
    ├── stock_moves              — строки движения товаров
    ├── stock_quants             — текущие остатки по локациям (materialized)
    ├── bill_of_materials        — спецификации продуктов (BoM)
    ├── bom_lines                — строки спецификации (компоненты)
    ├── manufacturing_orders     — производственные заказы
    ├── canteen_allowances       — дневные нормы порций сотрудников
    ├── canteen_meals            — факты выдачи/отказа порции на терминале
    └── … (production_calendar, time_off, doors, face_devices, etc.)
```

**Prisma clients:**
- `prisma-clients/client` — per-tenant схема
- `prisma-clients/public` — public схема
- `utils/prismaContext.js` — AsyncLocalStorage (текущий prisma-клиент в запросе)
- `utils/tenantContext.js` — AsyncLocalStorage (текущий тенант)
- `utils/prismaForTenant.js` — фабрика Prisma-клиента по `tenant.schema`

### Auth flow

```
POST /api/auth/login
  ├── tenantMiddleware (определить схему)
  ├── bcrypt.compare(password, hash)
  ├── jwt.sign → accessToken (15m) + refreshToken (8h)
  ├── session записывается в БД
  └── оба токена → httpOnly cookies

POST /api/auth/refresh
  ├── tenantMiddleware
  ├── jwt.verify(refreshToken, REFRESH_SECRET)
  ├── findSession(userId, refreshToken) в БД
  ├── updateSession → новый refreshToken (rotation)
  └── новые токены → cookies

GET /api/... (protected)
  ├── tenantMiddleware
  ├── authMiddleware: jwt.verify(accessToken) → req.user
  └── controller
```

### Background Workers

| Файл | Назначение | Расписание |
|------|-----------|-----------|
| `workers/notificationsWorker.js` | Отправка Telegram-уведомлений из `notifications_outbox` | Постоянный polling |
| `workers/doorTasksWorker.js` | Синхронизация прав доступа на face-устройства | Event-driven |

### Внешние интеграции

| Интеграция | Реализация |
|-----------|-----------|
| Hikvision face devices | HTTP Digest Auth, polling событий через `utils/hikEventChecker.js` |
| Telegram Bot | Grammy framework (`services/telegram-bot/`), webhook + polling |
| ANPR cameras | HTTP polling, парсинг номеров |

---

## Клиент (`client/`)

### Точка входа

```
index.html         — подключает Telegram Web App SDK
main.jsx           — React, Router, i18next, Redux store
App.jsx            — две группы роутов: web и /tg/*
```

### Layouts

| Layout | Назначение |
|--------|-----------|
| `WebLayout.jsx` | Sidebar + основная область + Alert |
| `TelegramLayout.jsx` | BottomNav (4 пункта) + контент |

### Маршрутизация

- `routes.jsx` — ~20 веб-маршрутов (ленивая загрузка)
- `telegramRoutes.jsx` — ~10 Telegram-маршрутов

### State Management

| Store | Технология | Данные |
|-------|-----------|--------|
| `authStore` | Zustand | user, login/logout/refresh |
| `alertStore` | Zustand | глобальные уведомления |
| `filterDataStore` | Zustand + persist | состояния фильтров таблиц |
| `useSidebarStore` | Zustand | открыт/закрыт сайдбар |
| Redux store | RTK + persist | legacy сложные данные |

### API слой

```
api/instance.js    — axios-инстанс, 401/403 → авто-refresh, retry
api/index.js       — реэкспорт всех модулей
api/<module>.js    — CRUD функции (25+ файлов, по одному на домен)
```

Всегда использовать функции из `api/<module>.js`, никогда — прямой `axios`.

### Компоненты

- `pages/` — умные компоненты (данные, логика)
- `components/` — тупые переиспользуемые

Паттерн истории (salary, schedule): `OverlaySidebar` слева через `handleLeftPanel(type, key)`.

### Стилизация

- SCSS Modules (`.module.scss` рядом с компонентом)
- Bootstrap 5.3 (grid, утилиты)
- Material-UI (отдельные сложные компоненты)
- `themes.scss` — CSS-переменные для light/dark

### i18n

4 локали: `ru`, `uz`, `uzCyrl`, `en`. Ключи — верхний уровень или вложенный объект домена.

---

## API

- Base URL: `/api`
- Auth: JWT в httpOnly cookies (`access_token`, `refresh_token`)
- Формат ответа: JSON
- Tenant: определяется автоматически через JWT payload
- Все эндпоинты (кроме `/api/auth/*` и `/api/face-devices/events`) требуют авторизации

---

## Деплой

```
Dev:
  client/  →  Vite dev server :5000  (proxy /api → :7000)
  server/  →  nodemon server.js :7000

Prod:
  client/  →  npm run build → dist/
  server/  →  Express раздаёт dist/ как статику + /api/* обрабатывает
  Port:    7000
```

### Prisma миграции

```bash
cd server/
npx prisma migrate dev   # client schema (schema.client.prisma)
# DATABASE_URL должен указывать на нужную схему
```

Две схемы Prisma:
- `schema.client.prisma` — per-tenant таблицы
- `schema.public.prisma` — tenants, global tables

### Мульти-тенантные миграции и seed

```bash
cd server/

# 1. Применить новую схему ко всем тенантам (db push)
npm run migrate:tenants

# 2. Синхронизировать меню, RBAC и дефолтные данные для всех тенантов
npm run seed:tenants
```

`migrate:tenants` — запускает `dbPushForSchema` для каждого тенанта из `public.tenants`.
`seed:tenants` — запускает `seedTenantData(prisma)` (upsert-идемпотентно) для каждого тенанта.

После добавления нового модуля (inventory / manufacturing):
1. Включить модуль в admin panel (TenantDetailPage → toggles)
2. Запустить `npm run migrate:tenants`
3. Запустить `npm run seed:tenants`

---

## Конфигурация (`server/.env`)

| Переменная | Назначение |
|-----------|-----------|
| `PORT` | HTTP порт (default 7000) |
| `NODE_ENV` | `development` / `production` |
| `DATABASE_URL` | Prisma connection string |
| `CLIENT_DATABASE_URL` | Prisma per-tenant connection string |
| `ACCESS_SECRET` | JWT access token secret |
| `REFRESH_SECRET` | JWT refresh token secret |
| `BOT_TOKEN` | Telegram bot token |
| `DB_HOST/NAME/USER/PASSWORD` | Прямое подключение к PostgreSQL |
| `BACKUP_TIME` | Cron расписание бэкапа |
| `DEFAULT_TENANT` | Тенант по умолчанию для dev-режима |
