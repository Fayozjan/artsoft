# OnBase HR System — Claude Context

Полная документация: `docs/`

## Быстрый старт

| Задача | Читать |
|--------|--------|
| Новая страница / компонент | `docs/coding-rules.md` → "Паттерн страницы" |
| Найти файл | `docs/folder-structure.md` |
| Новый API эндпоинт | `docs/api-endpoints.md` + `docs/coding-rules.md` |
| Работа с БД | `docs/data-models.md` |
| Общий контекст проекта | `docs/project-overview.md` |

## Ключевые соглашения (кратко)

- **Backend**: ESM, модульная структура `server/modules/<name>/`, через `req.prisma`
- **Frontend**: React 18 + Vite, Zustand, SCSS Modules, i18next
- **Стили страниц**: CSS Module классы (`styles.page`, `styles.main`, `styles.mainHeader`, `styles.tableContainer`, `styles.table`) — не inline styles
- **Stock-страницы**: общий `client/src/pages/StockPage.module.scss`
- **Permissions**: `usePermissions(currentPath)` → `canAdd`, `canEdit`, `canDelete`
- **Alerts**: `useAlertStore()` → `showAlert(message, type)`
- **Все тексты**: через `t('key')` из `useTranslation()`
- **Пересборка клиента** (`vite build` и т.п.): не запускать — пользователь делает это сам

## Структура проекта

```
OnBase/
├── client/          — React SPA (Vite)
├── server/          — Node.js Express API
└── docs/            — Документация
```
