# Architecture

## Backend (server/)

### Точка входа
- `server.js` — запускает Express на порту 7000, регистрирует глобальные обработчики ошибок, запускает workers
- `app.js` — настраивает middleware (cookie-parser, body-parser, morgan), статику из `/client/dist`, роутинг `/api`
- `config.js` — env-переменные: PORT, DATABASE_URL, CLIENT_DATABASE_URL, ACCESS_SECRET, REFRESH_SECRET

### Структура модуля (паттерн для каждого домена)
```
modules/<name>/
  <name>.routes.js      — Express Router, middleware chain
  <name>.controller.js  — req/res handlers (тонкий слой)
  <name>.service.js     — бизнес-логика
  <name>.model.js       — SQL / Prisma запросы
  <name>.helpers.js     — утилиты домена (опционально)
```

### Middleware стек (порядок применения)
1. `tenantMiddleware` — определяет tenant по JWT/cookie, подставляет нужный Prisma-клиент в `req.prisma`
2. `authMiddleware` — проверяет access JWT, кладёт `req.user`
3. `authPhotoMiddleware` — лёгкая auth для фото-запросов
4. `uploadPhoto` — Multer + Sharp (конвертация → jpg)
5. `logger` — Morgan HTTP-логгер

### База данных
- **Драйвер**: Prisma ORM + `pg` (pool) для raw SQL при необходимости
- **Две схемы**:
  - `public` — tenants, tenant_telegram_users, notifications_outbox
  - `<tenant_schema>` — все операционные данные (employees, attendance, etc.)
- **Prisma клиенты**: `prisma-clients/client` (client schema), `prisma-clients/public` (public schema)
- **Фабрика**: `utils/prismaContext.js` создаёт Prisma-клиент для нужной схемы по tenant

### Background Workers
- `workers/notificationsWorker.js` — отправляет Telegram-уведомления из `notifications_outbox`
- `workers/doorTasksWorker.js` — выполняет задачи синхронизации доступа на face-устройства

### Интеграции
- **Hikvision** — polling событий (`utils/hikEventChecker.js`), Digest Auth (`utils/digest.js`)
- **Telegram Bot** — Grammy (`services/telegram-bot/`), веб-хуки и polling

---

## Frontend (client/)

### Точка входа
- `index.html` — подключает Telegram Web App SDK
- `main.jsx` — инициализация React, Router, i18next, Redux store
- `App.jsx` — корневой роутер: `<Routes>` для веб + `<Routes>` для `/tg/*`

### Layouts
- `WebLayout.jsx` — Sidebar + основная область + глобальный Alert
- `TelegramLayout.jsx` — BottomNav (4 пункта) + область контента

### Маршрутизация
- `routes.jsx` — ~20 веб-маршрутов
- `telegramRoutes.jsx` — ~10 Telegram-маршрутов

### State Management
| Store | Технология | Назначение |
|-------|-----------|-----------|
| authStore | Zustand | user, settings, login/logout/refresh |
| alertStore | Zustand | глобальные уведомления |
| filterDataStore | Zustand + persist | состояния фильтров таблиц |
| useSidebarStore | Zustand | открыт/закрыт сайдбар |
| Redux store | Redux Toolkit + persist | сложные данные (legacy) |

### API слой
- `api/instance.js` — axios-инстанс, JWT refresh interceptor (401/403 → `/api/auth/refresh`)
- `api/index.js` — реэкспорт всех модулей
- `api/<module>.js` — CRUD функции для каждого модуля (25+ файлов)

### Стилизация
- SCSS Modules (`.module.scss` рядом с компонентом)
- Bootstrap 5.3 (grid, утилиты)
- Material-UI (отдельные сложные компоненты)
- `themes.scss` — CSS-переменные темы (light/dark)

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
client/   → npm run build → dist/
server/   → Express раздаёт dist/ как статику + /api/* обрабатывает
Port:       7000 (prod), 5000 dev-сервер Vite с proxy → 7000
```
