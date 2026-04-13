# Folder Structure

## Корень проекта
```
hrsystemNew/
├── client/          — React SPA
├── server/          — Node.js Express API
└── docs/ai-context/ — AI-контекст документация
```

---

## client/src/

```
src/
├── api/                  — Axios-функции для каждого backend-модуля
│   ├── instance.js       — axios-инстанс + refresh interceptor
│   ├── index.js          — центральный реэкспорт
│   └── <module>.js       — CRUD функции (attendance, employees, facePasses, ...)
│
├── assets/               — Изображения, иконки
├── icons/                — Кастомные SVG-иконки как React компоненты
│
├── components/           — Переиспользуемые UI-компоненты
│   ├── Add*.jsx          — Формы добавления (AddEmployee, AddUser, ...)
│   ├── Edit*.jsx         — Формы редактирования
│   ├── *Table.jsx        — Таблицы данных (AttendanceTable, EmployeesTable, ...)
│   ├── *Filter.jsx       — Компоненты фильтрации
│   ├── *Modal.jsx        — Модальные окна
│   ├── Sidebar.jsx       — Боковое меню
│   ├── Pagination.jsx    — Пагинация
│   ├── Button.jsx        — Кнопка (обёртка)
│   ├── Badge.jsx         — Статус-бейдж
│   └── BottomNavTelegram.jsx — Нижняя навигация для Telegram
│
├── context/
│   └── ScreenStackContext.jsx — Стек навигации (Telegram back-button)
│
├── helpers/
│   └── time.js           — Вспомогательные функции для времени
│
├── hooks/                — Кастомные React-хуки
│   ├── useAuthCheck.js   — Проверка авторизации
│   ├── usePermissions.js — RBAC для веб
│   ├── usePermissionsTelegram.js — RBAC для Telegram
│   ├── useTelegram.js    — Telegram WebApp SDK интеграция
│   ├── usePullToRefresh.js — Pull-to-refresh (mobile)
│   ├── useReferenceData.js — Загрузка справочников (branches, departments, employees)
│   └── useOpen*.js       — Навигационные хелперы (открыть форму добавления/редактирования)
│
├── layouts/
│   ├── WebLayout.jsx     — Основной layout: Sidebar + content + Alert
│   └── TelegramLayout.jsx — Telegram layout: BottomNav + content
│
├── locales/              — Переводы i18next
│   ├── ru.json           — Русский
│   ├── uz.json           — Узбекский (латиница)
│   ├── uzCyrl.json       — Узбекский (кириллица)
│   └── en.json           — Английский
│
├── pages/                — Страницы (маршруты)
│   ├── AuthPage.jsx      — Веб-логин
│   ├── AuthPageTelegram.jsx — Telegram-логин
│   ├── DashboardPage.jsx — Главная страница
│   ├── EmployeesPage.jsx / EmployeesPageTelegram.jsx
│   ├── AttendancePage.jsx / AttendancePageWeb.jsx / AttendancePageTelegram.jsx
│   ├── FacePassesPage.jsx / FacePassesPageWeb.jsx / FacePassesPageTelegram.jsx
│   ├── VehiclePassesPage.jsx / VehiclePassesPageTelegram.jsx / VehiclePassesPageWeb.jsx
│   ├── LateEmployeesPage.jsx
│   ├── TimesheetPage.jsx
│   ├── WorkSchedulesPage.jsx
│   ├── TimeOffPage.jsx
│   ├── HolidaysPage.jsx
│   ├── BranchesPage.jsx / DepartmentsPage.jsx / PositionsPage.jsx
│   ├── DoorsPage.jsx / GatesPage.jsx / FaceDevicesPage.jsx / VehicleCamerasPage.jsx
│   ├── UsersPage.jsx
│   ├── TelegramBotsPage.jsx
│   └── HomePageTelegram.jsx / MorePageTelegram.jsx
│
├── services/
│   ├── api.js            — Вспомогательные API-утилиты
│   └── font.js           — Загрузка шрифтов
│
├── stores/               — Zustand-сторы
│   ├── authStore.js      — Состояние авторизации
│   ├── alertStore.js     — Глобальные уведомления
│   ├── filterDataStore.js — Состояния фильтров (persistent)
│   └── useSidebarStore.js — Состояние сайдбара
│
├── styles/               — Глобальные SCSS-стили
├── themes.scss           — CSS-переменные тем (light/dark)
│
├── utils/                — Утилиты
│   ├── DocGenerator.js   — Генерация Word (.docx) документов
│   ├── downloadDoc.js    — Скачивание PDF/документов
│   ├── DownloadAttendanceToExcel.js — Экспорт посещаемости в Excel
│   ├── date.js           — Форматирование дат
│   └── utils.js          — Общие утилиты
│
├── App.jsx               — Корневой роутер (web + telegram routes)
├── routes.jsx            — Веб-маршруты
└── telegramRoutes.jsx    — Telegram-маршруты
```

---

## server/

```
server/
├── modules/              — Бизнес-модули (по одному на домен)
│   └── <name>/
│       ├── <name>.routes.js
│       ├── <name>.controller.js
│       ├── <name>.service.js
│       ├── <name>.model.js
│       └── <name>.helpers.js
│
├── middlewares/          — Express middleware
│   ├── authMiddleware.js      — Проверка JWT
│   ├── authPhotoMiddleware.js — Auth для фото
│   ├── tenantMiddleware.js    — Выбор tenant-схемы
│   ├── uploadPhoto.js         — Multer + Sharp
│   ├── logger.js              — HTTP-логгер
│   ├── deviceMiddleware.js    — Идентификация устройства
│   └── tempPhotoToken.js      — Временные токены фото
│
├── utils/                — Серверные утилиты
│   ├── hikEventChecker.js     — Polling Hikvision устройств
│   ├── faceDeviceFunction.js  — Управление face-устройствами
│   ├── doorFunctions.js       — Управление дверьми
│   ├── attendanceUtils.js     — Расчёт посещаемости
│   ├── parseHikvisionEvent.js — Парсинг событий Hikvision
│   ├── prismaContext.js       — Фабрика Prisma-клиентов по tenant
│   ├── prismaForTenant.js     — Tenant-специфичный Prisma
│   ├── userSyncHik.js         — Синхронизация с Hikvision
│   └── digest.js              — Digest authentication
│
├── services/
│   └── telegram-bot/    — Grammy Telegram Bot
│
├── workers/
│   ├── notificationsWorker.js — Отправка уведомлений из очереди
│   └── doorTasksWorker.js     — Обработка задач доступа к дверям
│
├── helpers/
│   └── timesheet.helpers.js   — Расчёты табеля
│
├── prisma/
│   ├── schema.client.prisma   — Схема для каждого tenant
│   └── schema.public.prisma   — Общая схема (tenants, notifications)
│
├── prisma-clients/       — Авто-сгенерированные Prisma клиенты
├── routes/index.js       — Центральный роутер (монтирует все модули)
├── app.js                — Express конфигурация
├── server.js             — Точка запуска
├── config.js             — ENV конфиг
└── db.js                 — PostgreSQL pool (pg)
```
