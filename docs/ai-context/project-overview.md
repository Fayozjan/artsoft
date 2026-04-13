# Project Overview — HR System (OnBase HR)

## Назначение
Корпоративная система управления персоналом (HRM) с поддержкой веб-интерфейса и Telegram-бота. Разработана для управления сотрудниками, посещаемостью, рабочими графиками, контролем доступа (лицо + ANPR), отпусками и табелями.

## Основные технологии

| Слой | Технологии |
|------|-----------|
| Frontend | React 18.3, Vite 5.3, React Router 6, Zustand, Redux Toolkit |
| Backend | Node.js (ESM), Express 4.21 |
| ORM | Prisma 6 (multi-schema) |
| Database | PostgreSQL |
| Auth | JWT (access 15m + refresh 8h), cookies |
| UI | Bootstrap 5.3, Material-UI 6.4, SCSS modules |
| Telegram | Grammy 1.36 (Telegram Bot + Web App) |
| Export | ExcelJS, jsPDF, pdfmake, docx |
| i18n | i18next — ru / uz / uzCyrl / en |

## Архитектурный стиль
- **Monorepo**: `client/` (React SPA) + `server/` (Express REST API)
- **Multi-tenant**: каждый клиент имеет отдельную PostgreSQL-схему; `public` схема — общая (tenants, notifications)
- **Модульный backend**: каждый домен — отдельная папка `modules/<name>/` со своим routes / controller / service / model
- **Двойной UI**: веб-маршруты (`/`) + Telegram Web App маршруты (`/tg/`)

## Взаимодействие частей системы

```
[Telegram WebApp / Browser]
         |
    [React SPA] ──axios──> [Express /api/*]
         |                        |
    [Zustand/Redux]         [tenantMiddleware] ──> [Prisma (schema per tenant)]
         |                        |
    [i18next]               [modules/*]
                                  |
                    [Hikvision Face/ANPR Devices]
                    [Grammy Telegram Bot]
                    [Workers: notifications, doorTasks]
```

## Ключевые функции
1. Управление сотрудниками (CRUD, фото, документы)
2. Контроль посещаемости (через распознавание лиц)
3. Управление рабочими графиками (fixed / shift / flexible)
4. Учёт опозданий и отсутствий
5. Управление доступом — двери, ворота, ANPR камеры
6. Табель рабочего времени
7. Telegram-интеграция (бот + Web App)
8. Экспорт в Excel / PDF / Word
9. Ролевая система доступа (RBAC по меню)
10. Мультиязычность: рус / узб / узб (кирилл) / eng
